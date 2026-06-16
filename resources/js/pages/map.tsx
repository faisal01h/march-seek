import { usePage } from '@inertiajs/react';
import Echo from 'laravel-echo';
import mapboxgl from 'mapbox-gl';
import Pusher from 'pusher-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MdAdminPanelSettings, MdChat, MdClose, MdLayers, MdList, MdMyLocation } from 'react-icons/md';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapFeatureProperties {
    id: string;
    headline: string;
    summary?: string;
    source_url: string;
    provider?: string;
    place_name?: string;
    fetched_at?: string;
    hashtags?: string[];
}

type SelectedFeature = MapFeatureProperties;

const osmStyles: Record<string, { name: string; url: string }> = {
    positron: { name: 'Positron (Light)', url: 'https://tiles.openmaptiles.org/styles/positron/style.json' },
    'dark-matter': { name: 'Dark Matter', url: 'https://tiles.openmaptiles.org/styles/dark-matter/style.json' },
    'osm-bright': { name: 'OSM Bright', url: 'https://tiles.openmaptiles.org/styles/osm-bright/style.json' },
    'klokantech-basic': { name: 'Basic', url: 'https://tiles.openmaptiles.org/styles/klokantech-basic/style.json' },
};

export default function Map() {
    const { mapboxToken, auth, mapConfig } = usePage<{
        mapboxToken?: string;
        auth?: { user?: { id: number; name?: string } | null };
        mapConfig?: {
            provider: 'mapbox' | 'osm';
            mapboxToken?: string;
            osmStyle?: string;
        };
    }>().props;

    const isOsm = mapConfig?.provider === 'osm';

    // Inject CSS once to hide Mapbox logo when in OSM mode
    useEffect(() => {
        if (isOsm) {
            const styleId = 'osm-mapbox-logo-hide';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = `
                    .osm-mode .mapboxgl-ctrl-logo,
                    .mapboxgl-ctrl-logo { display: none !important; }
                `;
                document.head.appendChild(style);
            }
        }
    }, [isOsm]);
    const isAuthenticated = !!auth?.user;

    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const echoRef = useRef<any>(null);
    const currentGeoJsonRef = useRef<any>(null);
    const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
    const [heatmapVisible, setHeatmapVisible] = useState(false);
    const [currentEvents, setCurrentEvents] = useState<any[]>([]);
    const [allFeatures, setAllFeatures] = useState<any[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const hasAutoSelectedRef = useRef(false);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [happeningOpen, setHappeningOpen] = useState(true);
    const [showEventsSheet, setShowEventsSheet] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchTermRef = useRef('');
    const [showStylePicker, setShowStylePicker] = useState(false);

    // Trending hashtags/topics computed client-side from loaded active features (respects current search/filter)
    const trendingHashtags = useMemo(() => {
        const counts: Record<string, number> = {};
        allFeatures.forEach((f: any) => {
            const tags: string[] = f.properties?.hashtags || [];
            tags.forEach((tag: string) => {
                counts[tag] = (counts[tag] || 0) + 1;
            });
        });
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));
    }, [allFeatures]);

    const addUserLocationMarker = () => {
        if (!userLocation || !mapRef.current) return;

        const { lat, lng } = userLocation;

        if (userMarkerRef.current) {
            userMarkerRef.current.remove();
        }

        const el = document.createElement('div');
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.backgroundColor = '#3b82f6';
        el.style.border = '3px solid #ffffff';
        el.style.borderRadius = '50%';
        el.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.35)';
        el.style.cursor = 'pointer';
        el.title = 'Your approximate location';

        const marker = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
        })
            .setLngLat([lng, lat])
            .addTo(mapRef.current);

        userMarkerRef.current = marker;
    };

    function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function formatTime(iso?: string) {
        if (!iso) return '';
        const date = new Date(iso);
        const diffMs = Date.now() - date.getTime();
        const diffH = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffH < 1) {
            const diffM = Math.floor(diffMs / (1000 * 60));
            return diffM < 1 ? 'just now' : `${diffM}m ago`;
        }
        return `${diffH}h ago`;
    }

    function isActive(iso?: string): boolean {
        if (!iso) return false;
        const diffMs = Date.now() - new Date(iso).getTime();
        return diffMs < 24 * 60 * 60 * 1000; // within last 24 hours
    }

    const selectEvent = (ev: any) => {
        setSelectedFeature(ev);
        if (mapRef.current && ev.lng != null && ev.lat != null) {
            mapRef.current.easeTo({
                center: [ev.lng, ev.lat],
                zoom: Math.max(7, mapRef.current.getZoom()),
                duration: 600,
            });
        }
    };

    const locateUser = () => {
        if (userLocation && mapRef.current) {
            mapRef.current.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 12,
            });
            return;
        }
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(loc);
                    if (mapRef.current) {
                        mapRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 12 });
                    }
                },
                () => alert('Could not get your location. Please enable location services.'),
                { enableHighAccuracy: false, timeout: 8000 }
            );
        }
    };

    // --- Search + full-text data loading helpers (re-uses the same API that powers admin preprocessed search) ---
    async function loadMapDataForSearch(search: string) {
        const url = search.trim()
            ? `/api/map-data?search=${encodeURIComponent(search.trim())}`
            : '/api/map-data';
        const res = await fetch(url);
        const geojson = await res.json();

        // Always prune to only active (recent 24h) items. Server does this too,
        // but client-side ensures the map source, clusters, dots, counts, and lists
        // never include stale data even as time passes or after realtime appends.
        const features = (geojson.features || []).filter((f: any) =>
            isActive(f.properties?.fetched_at)
        );
        setAllFeatures(features);

        // Rebuild the "Currently Happening" list from (active) results - show all, not limited to 8
        const events = [...features]
            .map((f: any) => ({
                ...f.properties,
                lng: f.geometry.coordinates[0],
                lat: f.geometry.coordinates[1],
            }))
            .sort((a: any, b: any) => {
                const ta = a.fetched_at ? new Date(a.fetched_at).getTime() : 0;
                const tb = b.fetched_at ? new Date(b.fetched_at).getTime() : 0;
                return tb - ta;
            });
        setCurrentEvents(events);

        return {
            type: 'FeatureCollection',
            features,
        };
    }

    async function applySearch(search: string) {
        if (!mapRef.current) {
            return;
        }
        try {
            const geojson = await loadMapDataForSearch(search);
            currentGeoJsonRef.current = geojson;

            const source = mapRef.current.getSource('news') as mapboxgl.GeoJSONSource | undefined;
            if (source) {
                source.setData(geojson);
            } else {
                addNewsOverlay(geojson);
            }
        } catch (err) {
            console.error('Failed to apply search filter', err);
        }
    }

    const clearSearch = () => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }
        setSearchTerm('');
        applySearch('');
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }
        searchDebounceRef.current = setTimeout(() => {
            applySearch(value);
        }, 300);
    };

    const changeOsmStyle = (styleKey: string) => {
        if (!isOsm || !mapRef.current) return;

        const styleInfo = osmStyles[styleKey];
        if (!styleInfo) return;

        setShowStylePicker(false);

        // For reliability we are currently using standard OSM raster tiles (see map initialization).
        // The style picker lets the user choose a preferred OpenMapTiles look (the name is shown).
        // To use actual vector styles from OpenMapTiles, update the style URL in code
        // (most require a MapTiler API key: https://maptiler.com).
        console.info(`OSM basemap style selected: ${styleInfo.name} (using standard OSM raster for compatibility)`);

        // If you want to force a style reload in the future, you could do:
        // mapRef.current.setStyle(...) + re-add overlay on 'style.load'
    };

    // Helper to add the news source + custom layers (clusters, dots, heatmap) on top of the current basemap style.
    // Called on initial load and after style changes (for OSM style picker).
    const addNewsOverlay = (geojsonData: any) => {
        const map = mapRef.current;
        if (!map) return;

        // Clean up previous if re-adding (e.g. after setStyle)
        ['news-cluster-count', 'news-clusters', 'news-dots', 'news-heatmap'].forEach((id) => {
            if (map.getLayer(id)) {
                try { map.removeLayer(id); } catch {}
            }
        });
        if (map.getSource('news')) {
            try { map.removeSource('news'); } catch {}
        }

        map.addSource('news', {
            type: 'geojson',
            data: geojsonData,
            cluster: true,
            clusterMaxZoom: 8,
            clusterRadius: 40,
        });

        // Heatmap layer
        map.addLayer({
            id: 'news-heatmap',
            type: 'heatmap',
            source: 'news',
            maxzoom: 12,
            paint: {
                'heatmap-weight': 1,
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,255,0)',
                    0.2, 'royalblue',
                    0.4, 'cyan',
                    0.6, 'lime',
                    0.8, 'yellow',
                    1, 'red',
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 9, 30],
                'heatmap-opacity': 0.7,
            },
            layout: { visibility: 'none' },
        });

        // Dot layer
        map.addLayer({
            id: 'news-dots',
            type: 'circle',
            source: 'news',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': '#ef4444',
                'circle-radius': 7,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#fff',
                'circle-opacity': 0.85,
            },
        });

        // Cluster circles
        map.addLayer({
            id: 'news-clusters',
            type: 'circle',
            source: 'news',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': '#f97316',
                'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff',
                'circle-opacity': 0.9,
            },
        });

        // Cluster count labels
        map.addLayer({
            id: 'news-cluster-count',
            type: 'symbol',
            source: 'news',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12,
            },
            paint: { 'text-color': '#fff' },
        });

        // Click handlers (re-attach after style change)
        map.on('click', 'news-dots', (e) => {
            const props = e.features?.[0]?.properties as MapFeatureProperties | undefined;
            if (props) setSelectedFeature(props);
        });

        map.on('click', 'news-clusters', (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ['news-clusters'] });
            if (!features.length) return;
            const clusterId = features[0].properties?.cluster_id;
            const source = map.getSource('news') as mapboxgl.GeoJSONSource;
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err || zoom == null) return;
                map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
            });
        });

        map.on('mouseenter', 'news-dots', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'news-dots', () => {
            map.getCanvas().style.cursor = '';
        });
    };

    // Get user location: prefer browser geolocation, fallback to IP
    useEffect(() => {
        let didFallback = false;

        const tryIPLocation = async () => {
            if (didFallback) return;
            didFallback = true;
            try {
                const res = await fetch('https://ipapi.co/json/', { method: 'GET' });
                const data = await res.json();
                if (data.latitude && data.longitude) {
                    setUserLocation({ lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) });
                }
            } catch (e) {
                console.warn('IP geolocation fallback failed', e);
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                () => {
                    tryIPLocation();
                },
                { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
            );
        } else {
            tryIPLocation();
        }
    }, []);

    // Automatically select and show the nearest event once we have user location + features
    useEffect(() => {
        if (!userLocation || allFeatures.length === 0 || !mapRef.current) return;

        let nearest: any = null;
        let minDist = Infinity;

        allFeatures.forEach((f: any) => {
            const [lng, lat] = f.geometry.coordinates;
            const dist = getDistance(userLocation.lat, userLocation.lng, lat, lng);
            if (dist < minDist) {
                minDist = dist;
                nearest = f;
            }
        });

        if (nearest && !hasAutoSelectedRef.current) {
            const props = {
                ...nearest.properties,
                lng: nearest.geometry.coordinates[0],
                lat: nearest.geometry.coordinates[1],
            };
            setSelectedFeature(props);

            // Fly to the nearest event
            if (mapRef.current) {
                mapRef.current.flyTo({
                    center: [props.lng, props.lat],
                    zoom: 9,
                    speed: 1.1,
                    curve: 1.2,
                    essential: true,
                });
            }
            hasAutoSelectedRef.current = true;
        }
    }, [userLocation, allFeatures]);

    // Display current user location as a marker on the map (purely frontend, coords never sent to our server)
    useEffect(() => {
        if (!userLocation) {
            if (userMarkerRef.current) {
                userMarkerRef.current.remove();
                userMarkerRef.current = null;
            }
            return;
        }

        addUserLocationMarker();

        // Cleanup when location changes or unmount
        return () => {
            if (userMarkerRef.current) {
                userMarkerRef.current.remove();
                userMarkerRef.current = null;
            }
        };
    }, [userLocation]);

    // Keep searchTermRef in sync for realtime listener (which runs in a closure)
    useEffect(() => {
        searchTermRef.current = searchTerm;
    }, [searchTerm]);

    // Periodic prune: remove items older than 24h from the map source even if no new events arrive.
    // This keeps cluster counts (the numbers on the orange circles), dots, and the "Currently Happening"
    // list / button counts accurate to only active recent data.
    useEffect(() => {
        const pruneInterval = setInterval(() => {
            const map = mapRef.current;
            if (!map) return;

            const src = map.getSource('news') as mapboxgl.GeoJSONSource | undefined;
            if (!src) return;

            const currentData: any = (src as any)._data || { type: 'FeatureCollection', features: [] };
            const before = currentData.features.length;

            const pruned = currentData.features.filter((f: any) =>
                isActive(f.properties?.fetched_at)
            );

            if (pruned.length < before) {
                const prunedGeo = { type: 'FeatureCollection', features: pruned };
                src.setData(prunedGeo);

                setAllFeatures(pruned);

                const events = [...pruned]
                    .map((f: any) => ({
                        ...f.properties,
                        lng: f.geometry.coordinates[0],
                        lat: f.geometry.coordinates[1],
                    }))
                    .sort((a: any, b: any) => {
                        const ta = a.fetched_at ? new Date(a.fetched_at).getTime() : 0;
                        const tb = b.fetched_at ? new Date(b.fetched_at).getTime() : 0;
                        return tb - ta;
                    });
                setCurrentEvents(events);
            }
        }, 5 * 60 * 1000); // every 5 minutes

        return () => clearInterval(pruneInterval);
    }, []);

    useEffect(() => {
        if (mapRef.current) {
            return;
        }

        const provider = mapConfig?.provider ?? 'mapbox';
        const token = mapConfig?.mapboxToken ?? mapboxToken ?? import.meta.env.VITE_MAPBOX_TOKEN;

        let mapStyle: any;

        if (provider === 'mapbox') {
            if (token) {
                mapboxgl.accessToken = token;
            }
            mapStyle = 'mapbox://styles/mapbox/dark-v11';
        } else {
            // For OSM we start with a completely empty style.
            // We explicitly add the OSM raster basemap *inside* the 'load' handler (below)
            // for reliable timing and to guarantee the tile layer is present and visible.
            mapStyle = {
                version: 8,
                sources: {},
                layers: []
            };
        }

        mapRef.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: mapStyle,
            center: [0, 20],
            zoom: 2,
            attributionControl: false, // we add custom attribution below based on provider
        });

        // Custom attribution + hide Mapbox logo when using OSM (to avoid "Mapbox overlay" in OSM mode)
        const addCustomAttribution = () => {
            const provider = mapConfig?.provider ?? 'mapbox';
            if (provider === 'osm') {
                // Hide Mapbox logo completely for non-Mapbox providers
                const hideMapboxLogo = () => {
                    document.querySelectorAll('.mapboxgl-ctrl-logo').forEach((el) => {
                        (el as HTMLElement).style.display = 'none';
                    });
                };
                hideMapboxLogo();
                // Re-check after style data changes
                mapRef.current.on('styledata', hideMapboxLogo);

                // Add proper OSM attribution
                mapRef.current.addControl(
                    new mapboxgl.AttributionControl({
                        compact: true,
                        customAttribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    }),
                    'bottom-right'
                );
            } else {
                // For Mapbox, add standard attribution (style will provide logo + text)
                mapRef.current.addControl(
                    new mapboxgl.AttributionControl({ compact: true }),
                    'bottom-right'
                );
            }
        };
        addCustomAttribution();

        // Swallow non-fatal map style errors (prevents "Style is not done loading" spam in logs when external styles fail)
        mapRef.current.on('error', (e: any) => {
            if (e?.error?.message?.includes('Style')) {
                // Expected when trying vector styles that require keys or have loading issues
                console.warn('Map style warning (non-fatal):', e.error.message);
            }
        });

        // Setup Echo for realtime (manual, contained in component)
        (window as any).Pusher = Pusher;
        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
            wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
            enabledTransports: ['ws', 'wss'],
        });
        echoRef.current = echo;

        mapRef.current.on('load', async () => {
            try {
                const provider = mapConfig?.provider ?? 'mapbox';

                // For OSM, explicitly add the reliable raster basemap *first* in the load handler.
                // This guarantees the OSM tiles are visible underneath the news data layers.
                if (provider === 'osm' && !mapRef.current.getSource('osm')) {
                    mapRef.current.addSource('osm', {
                        type: 'raster',
                        tiles: [
                            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        ],
                        tileSize: 256,
                    });
                    mapRef.current.addLayer({
                        id: 'osm',
                        type: 'raster',
                        source: 'osm',
                    });
                }

                // Initial load (respects any searchTerm if user types extremely fast before map loads)
                const geojson = await loadMapDataForSearch(searchTermRef.current);
                currentGeoJsonRef.current = geojson;

                // If user location was already resolved before map was ready, add the marker now
                if (userLocation) {
                    addUserLocationMarker();
                }

                addNewsOverlay(geojson);
            } catch (err) {
                console.error('Failed to load initial map data', err);
            }
        });

        // Realtime append (or re-apply active search filter so new matching items appear live)
        echo.channel('public-map').listen('.news.geocoded', (data: any) => {
            const source = mapRef.current.getSource('news') as mapboxgl.GeoJSONSource | undefined;

            if (!source) {
return;
}

            // If user is currently searching, re-fetch the filtered dataset (FTS on server)
            // so any newly geocoded item that matches the query appears on the map + list.
            if (searchTermRef.current.trim()) {
                applySearch(searchTermRef.current);
                return;
            }

            const currentData = (source as any)._data || { type: 'FeatureCollection', features: [] };

            // Prune any items that have aged past 24h, then add the new event if it's active and not duplicate.
            // This ensures orange cluster counts (and dots) only reflect active/recent 24h news.
            let activeFeatures = currentData.features.filter((f: any) =>
                isActive(f.properties?.fetched_at)
            );

            const newId = data.id;
            const alreadyPresent = activeFeatures.some(
                (f: any) => f.properties && f.properties.id === newId
            );

            if (!alreadyPresent && isActive(data.fetched_at)) {
                const newFeature = {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [data.longitude, data.latitude] },
                    properties: {
                        id: data.id,
                        headline: data.headline,
                        summary: data.summary,
                        source_url: data.source_url,
                        provider: data.provider,
                        place_name: data.place_name,
                        fetched_at: data.fetched_at,
                        hashtags: data.hashtags || [],
                    },
                };
                activeFeatures = [...activeFeatures, newFeature];
            }

            source.setData({
                type: 'FeatureCollection',
                features: activeFeatures,
            });

            setAllFeatures(activeFeatures);

            // Keep "Currently Happening" list in sync with only active items (now shows all, no 8 limit)
            const events = [...activeFeatures]
                .map((f: any) => ({
                    ...f.properties,
                    lng: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                }))
                .sort((a: any, b: any) => {
                    const ta = a.fetched_at ? new Date(a.fetched_at).getTime() : 0;
                    const tb = b.fetched_at ? new Date(b.fetched_at).getTime() : 0;
                    return tb - ta;
                });
            setCurrentEvents(events);
        });

        return () => {
            if (echoRef.current) {
                echoRef.current.leave('public-map');
                echoRef.current = null;
            }

            if (userMarkerRef.current) {
                userMarkerRef.current.remove();
                userMarkerRef.current = null;
            }

            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }

            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    const toggleHeatmap = () => {
        const map = mapRef.current;

        if (!map) {
return;
}

        const visibility = heatmapVisible ? 'none' : 'visible';
        map.setLayoutProperty('news-heatmap', 'visibility', visibility);
        setHeatmapVisible(!heatmapVisible);
    };

    return (
        <div className="relative flex h-screen w-full flex-col bg-gray-950 text-white overflow-hidden">
            {/* Top header - always visible, compact on mobile */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-gray-900/90 px-3 py-2 backdrop-blur z-30">
                <div className="rounded-lg bg-gray-900 px-3 py-1 text-sm font-semibold tracking-wider border border-white/10 shrink-0">
                    MARCHSEEK
                </div>

                {/* News search with full-text (server-side via PreprocessedNews scopeSearch) */}
                <div className="flex-1 min-w-0 max-w-sm">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            placeholder="Search news, places, hashtags…"
                            className="w-full rounded-xl border border-white/10 bg-gray-900/80 px-3 py-1.5 text-sm placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
                            aria-label="Search map events"
                        />
                        {searchTerm && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white px-1 text-lg leading-none"
                                aria-label="Clear search"
                            >
                                <MdClose />
                            </button>
                        )}
                    </div>
                </div>

                {/* Desktop actions */}
                <div className="hidden md:flex items-center gap-2 text-sm shrink-0">
                    <button
                        onClick={toggleHeatmap}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                            heatmapVisible ? 'bg-orange-500 text-white border-orange-500' : 'border-white/10 bg-gray-900/70 hover:bg-gray-800'
                        }`}
                    >
                        {heatmapVisible ? 'Hide Heatmap' : 'Show Heatmap'}
                    </button>
                    <button
                        onClick={locateUser}
                        className="rounded-lg border border-white/10 bg-gray-900/70 px-3 py-1.5 text-xs hover:bg-gray-800"
                        title="Go to my location"
                    >
                        <MdMyLocation className="inline-block mr-1 -mt-0.5" /> Locate me
                    </button>

                    {/* OSM Style selector - Google Maps like simple picker */}
                    {isOsm && (
                        <div className="relative">
                            <button
                                onClick={() => setShowStylePicker(!showStylePicker)}
                                className="rounded-lg border border-white/10 bg-gray-900/70 px-3 py-1.5 text-xs hover:bg-gray-800"
                                title="Change basemap style"
                            >
                                🗺️ Style
                            </button>
                            {showStylePicker && (
                                <div className="absolute right-0 mt-1 z-50 w-48 rounded-xl border border-white/10 bg-gray-900/95 shadow-xl text-sm py-1">
                                    {Object.entries(osmStyles).map(([key, style]) => (
                                        <button
                                            key={key}
                                            onClick={() => changeOsmStyle(key)}
                                            className="w-full text-left px-4 py-1.5 hover:bg-white/5 text-gray-200"
                                        >
                                            {style.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {isAuthenticated && (
                        <a
                            href="/admin"
                            className="rounded-lg border border-white/10 bg-gray-900/70 px-3 py-1.5 text-xs hover:bg-gray-800"
                        >
                            <MdAdminPanelSettings className="inline-block mr-1 -mt-0.5" /> Admin
                        </a>
                    )}
                </div>

                {/* Mobile actions - compact icons */}
                <div className="flex md:hidden items-center gap-1 shrink-0">
                    <button
                        onClick={toggleHeatmap}
                        className={`rounded p-2 text-lg ${heatmapVisible ? 'text-orange-400' : 'text-gray-300'}`}
                        aria-label="Toggle heatmap"
                    >
                        <MdLayers />
                    </button>
                    <button
                        onClick={locateUser}
                        className="rounded p-2 text-lg"
                        aria-label="Locate me"
                    >
                        <MdMyLocation />
                    </button>
                    <button
                        onClick={() => setShowEventsSheet(true)}
                        className="rounded bg-gray-900/70 border border-white/10 px-2 py-1 text-xs"
                    >
                        Events ({currentEvents.length})
                    </button>
                    {isAuthenticated && (
                        <a
                            href="/admin"
                            className="rounded p-2 text-xs border border-white/10"
                            aria-label="Admin"
                            title="Admin"
                        >
                            <MdAdminPanelSettings />
                        </a>
                    )}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left sidebar - Trending + Currently Happening (desktop) */}
                <div className="hidden lg:flex w-72 flex-col border-r border-white/10 bg-gray-900/60 overflow-hidden">
                    {/* Trending section - on top as requested */}
                    <div className="border-b border-white/10">
                        <div className="p-3 text-sm font-semibold text-orange-400 flex items-center gap-2">
                            Trending
                            <span className="text-[10px] font-normal text-gray-400">({trendingHashtags.length})</span>
                        </div>
                        {trendingHashtags.length > 0 ? (
                            <div className="p-2 pt-0 space-y-0.5 text-xs max-h-32 overflow-y-auto border-b border-white/5">
                                {trendingHashtags.map((t, i) => (
                                    <div key={i} className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-white/5">
                                        <span className="text-orange-300">#{t.tag}</span>
                                        <span className="text-gray-500 tabular-nums">{t.count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-3 pb-3 text-[10px] text-gray-500">No trending hashtags yet.</div>
                        )}
                    </div>

                    {/* Currently Happening */}
                    <div className="flex items-center justify-between border-b border-white/10 p-3 text-sm font-semibold">
                        <div className="flex items-center gap-2 text-orange-400">
                            {searchTerm ? 'Search results' : 'Currently Happening'}
                            <span className="text-[10px] font-normal text-gray-400">({currentEvents.length})</span>
                        </div>
                        <button
                            onClick={() => setHappeningOpen(!happeningOpen)}
                            className="text-gray-400 hover:text-white text-lg leading-none"
                        >
                            {happeningOpen ? '−' : '+'}
                        </button>
                    </div>
                    {happeningOpen && (
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
                            {currentEvents.length === 0 && (
                                <div className="p-3 text-gray-500 text-center">
                                    {searchTerm ? 'No matches for your search.' : 'No recent events in the last 24h.'}
                                </div>
                            )}
                            {currentEvents.map((ev, idx) => (
                                <div
                                    key={ev.id || idx}
                                    onClick={() => {
                                        selectEvent(ev);
                                    }}
                                    className="cursor-pointer rounded-lg p-2 hover:bg-white/5 active:bg-white/10 border-l-2 border-orange-500/30"
                                >
                                    <div className="font-medium truncate text-gray-100">{ev.place_name || 'Unknown'}</div>
                                    <div className="text-gray-400 line-clamp-2 text-[10px] mt-0.5">{ev.headline}</div>
                                    <div className="text-[9px] text-gray-500 mt-1">{formatTime(ev.fetched_at)}</div>
                                    {(ev.hashtags || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(ev.hashtags || []).slice(0, 4).map((h: string, i: number) => (
                                                <span key={i} className="px-1 py-0.5 text-[8px] bg-orange-500/10 text-orange-300 rounded">#{h}</span>
                                            ))}
                                            {(ev.hashtags || []).length > 4 && <span className="text-[8px] text-gray-500">+{(ev.hashtags || []).length - 4}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main map area */}
                <div className="relative flex-1 overflow-hidden">
                    <div ref={mapContainer} className={`w-full h-full ${isOsm ? 'osm-mode' : ''}`} />

                    {/* Mobile floating action buttons */}
                    <div className="lg:hidden absolute bottom-4 right-4 z-20 flex flex-col gap-2">
                        <button
                            onClick={() => setShowEventsSheet(true)}
                            className="bg-gray-900/90 border border-white/10 rounded-full px-4 py-2 text-sm shadow-lg inline-flex items-center gap-1.5"
                        >
                            <MdList /> Events ({currentEvents.length})
                        </button>
                        <button
                            onClick={locateUser}
                            className="bg-gray-900/90 border border-white/10 rounded-full p-3 shadow-lg text-xl"
                            aria-label="Locate me"
                        >
                            <MdMyLocation />
                        </button>
                    </div>

                    {/* Desktop detail sidebar */}
                    {selectedFeature && (
                        <div className="hidden lg:block absolute top-4 right-4 z-20 w-80 rounded-2xl border border-white/10 bg-gray-900/95 p-4 shadow-2xl text-sm">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <div className="text-xs uppercase tracking-widest text-orange-400">
                                        {selectedFeature.place_name || 'Unknown location'}
                                    </div>
                                    <div className="text-[10px] text-gray-500">{formatTime(selectedFeature.fetched_at)}</div>
                                </div>
                                <button
                                    onClick={() => setSelectedFeature(null)}
                                    className="text-gray-400 hover:text-white text-2xl leading-none"
                                    aria-label="Close"
                                >
                                    <MdClose />
                                </button>
                            </div>
                            <h3 className="font-semibold mb-2 leading-tight">{selectedFeature.headline}</h3>
                            {selectedFeature.summary && (
                                <p className="text-xs text-gray-300 line-clamp-5 mb-3">{selectedFeature.summary}</p>
                            )}
                            {(selectedFeature.hashtags || []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2 mb-3">
                                    {(selectedFeature.hashtags || []).map((h: string, i: number) => (
                                        <span key={i} className="px-1.5 py-0.5 text-[10px] bg-orange-500/10 text-orange-300 rounded">#{h}</span>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">{selectedFeature.provider}</span>
                                <a
                                    href={selectedFeature.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline"
                                >
                                    Read source →
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Desktop right panel is handled above; on mobile we use sheets below */}
            </div>

            {/* Mobile Events Bottom Sheet */}
            {showEventsSheet && (
                <div className="lg:hidden fixed inset-0 z-40 flex items-end">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowEventsSheet(false)} />
                    <div className="relative w-full max-h-[70vh] rounded-t-3xl border-t border-white/10 bg-gray-900 p-4 overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <div className="font-semibold">
                                {searchTerm ? 'Search results' : 'Currently Happening'} ({currentEvents.length})
                            </div>
                            <button onClick={() => setShowEventsSheet(false)} className="text-xl" aria-label="Close">
                                <MdClose />
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-[55vh] space-y-2 text-sm">
                            {currentEvents.map((ev, idx) => (
                                <div
                                    key={ev.id || idx}
                                    onClick={() => {
                                        selectEvent(ev);
                                        setShowEventsSheet(false);
                                    }}
                                    className="rounded-xl bg-gray-800/70 p-3 active:bg-gray-700"
                                >
                                    <div className="font-medium">{ev.place_name}</div>
                                    <div className="text-xs text-gray-300 mt-1 line-clamp-2">{ev.headline}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">{formatTime(ev.fetched_at)}</div>
                                    {(ev.hashtags || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(ev.hashtags || []).slice(0, 4).map((h: string, i: number) => (
                                                <span key={i} className="px-1 py-0.5 text-[9px] bg-orange-500/10 text-orange-300 rounded">#{h}</span>
                                            ))}
                                            {(ev.hashtags || []).length > 4 && <span className="text-[9px] text-gray-500">+{(ev.hashtags || []).length - 4}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {currentEvents.length === 0 && (
                                <div className="text-gray-500 text-center py-8">
                                    {searchTerm ? 'No matches for your search.' : 'No recent events.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Details Bottom Sheet */}
            {selectedFeature && (
                <div className="lg:hidden fixed inset-x-0 bottom-0 z-40">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedFeature(null)} />
                    <div className="relative rounded-t-3xl border-t border-white/10 bg-gray-900 p-4 max-h-[65vh] overflow-auto shadow-2xl">
                        <div className="flex justify-between mb-3">
                            <div>
                                <div className="uppercase text-xs tracking-widest text-orange-400">{selectedFeature.place_name}</div>
                                <div className="text-[10px] text-gray-500">{formatTime(selectedFeature.fetched_at)}</div>
                            </div>
                            <button onClick={() => setSelectedFeature(null)} className="text-2xl text-gray-400" aria-label="Close">
                                <MdClose />
                            </button>
                        </div>
                        <h3 className="font-semibold text-base mb-2">{selectedFeature.headline}</h3>
                        {selectedFeature.summary && (
                            <p className="text-sm text-gray-300 mb-4">{selectedFeature.summary}</p>
                        )}
                        {(selectedFeature.hashtags || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 mb-4">
                                {(selectedFeature.hashtags || []).map((h: string, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 text-[11px] bg-orange-500/10 text-orange-300 rounded">#{h}</span>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{selectedFeature.provider}</span>
                            <a
                                href={selectedFeature.source_url}
                                target="_blank"
                                className="text-blue-400 underline"
                            >
                                Read full article
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat widget - floating bottom right, works on mobile */}
            <ChatWidget />
        </div>
    );
}

function ChatWidget() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const chatEchoRef = useRef<any>(null);

    useEffect(() => {
        fetch('/api/chat/messages')
            .then((r) => r.json())
            .then(setMessages)
            .catch(() => {});

        // Self contained echo for the chat feature
        (window as any).Pusher = Pusher;
        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
            wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
            enabledTransports: ['ws', 'wss'],
        });
        chatEchoRef.current = echo;

        echo.channel('public-chat').listen('.chat.message', (data: any) => {
            setMessages((prev) => [...prev, data]);
        });

        return () => {
            if (chatEchoRef.current) {
                chatEchoRef.current.leave('public-chat');
            }
        };
    }, []);

    useEffect(() => {
        if (open) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open]);

    const send = async () => {
        if (!input.trim() || sending) {
return;
}

        setSending(true);
        setError(null);

        try {
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ content: input.trim() }),
            });

            if (res.status === 429) {
                setError('Too many messages. Please wait a moment.');

                return;
            }

            if (!res.ok) {
                setError('Failed to send.');

                return;
            }

            const msg = await res.json();
            setMessages((prev) => [...prev, msg]);
            setInput('');
        } finally {
            setSending(false);
        }
    };

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
            {open && (
                <div
                    className="w-80 bg-gray-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    style={{ height: '420px' }}
                >
                    <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
                        <span className="text-sm font-semibold">Public chat</span>
                        <span className="text-xs text-gray-500">Anonymous · 48h expiry</span>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
                        {messages.length === 0 && (
                            <p className="text-xs text-gray-500 text-center mt-8">No messages yet. Say something.</p>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} className="bg-gray-800/70 rounded-xl px-3 py-2">
                                <p className="text-gray-100 break-words">{msg.content}</p>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {error && <p className="text-xs text-red-400 px-4 pb-1">{error}</p>}

                    <div className="px-4 py-3 border-t border-white/10 flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            maxLength={500}
                            placeholder="Type a message…"
                            className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-3 py-2 outline-none border border-white/10 focus:border-white/30 placeholder:text-gray-500"
                        />
                        <button
                            onClick={send}
                            disabled={sending || !input.trim()}
                            className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                        >
                            {sending ? '…' : 'Send'}
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={() => setOpen(!open)}
                className="bg-orange-500 hover:bg-orange-400 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors text-xl"
                title="Toggle public chat"
            >
                {open ? <MdClose /> : <MdChat />}
            </button>
        </div>
    );
}
