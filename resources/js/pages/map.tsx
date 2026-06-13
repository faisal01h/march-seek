import { usePage } from '@inertiajs/react';
import Echo from 'laravel-echo';
import mapboxgl from 'mapbox-gl';
import Pusher from 'pusher-js';
import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapFeatureProperties {
    id: string;
    headline: string;
    summary?: string;
    source_url: string;
    provider?: string;
    place_name?: string;
    fetched_at?: string;
}

type SelectedFeature = MapFeatureProperties;

export default function Map() {
    const { mapboxToken } = usePage<{ mapboxToken?: string }>().props;

    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const echoRef = useRef<any>(null);
    const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
    const [heatmapVisible, setHeatmapVisible] = useState(false);
    const [currentEvents, setCurrentEvents] = useState<any[]>([]);
    const [allFeatures, setAllFeatures] = useState<any[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const hasAutoSelectedRef = useRef(false);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

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
    const [happeningOpen, setHappeningOpen] = useState(true);

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

    useEffect(() => {
        if (mapRef.current) {
            return;
        }

        mapboxgl.accessToken = mapboxToken ?? import.meta.env.VITE_MAPBOX_TOKEN;

        mapRef.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [0, 20],
            zoom: 2,
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
                const res = await fetch('/api/map-data');
                const geojson = await res.json();

                setAllFeatures(geojson.features || []);

                // If user location was already resolved before map was ready, add the marker now
                if (userLocation) {
                    addUserLocationMarker();
                }

                // Build "Currently Happening" list (most recent first). Server already excludes >24h old.
                const events = (geojson.features || [])
                    .map((f: any) => ({
                        ...f.properties,
                        lng: f.geometry.coordinates[0],
                        lat: f.geometry.coordinates[1],
                    }))
                    .sort((a: any, b: any) => {
                        const ta = a.fetched_at ? new Date(a.fetched_at).getTime() : 0;
                        const tb = b.fetched_at ? new Date(b.fetched_at).getTime() : 0;
                        return tb - ta;
                    })
                    .slice(0, 8);
                setCurrentEvents(events);

                mapRef.current.addSource('news', {
                    type: 'geojson',
                    data: geojson,
                    cluster: true,
                    clusterMaxZoom: 8,
                    clusterRadius: 40,
                });

                // Heatmap layer
                mapRef.current.addLayer({
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

                // Dot layer (individual points)
                mapRef.current.addLayer({
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
                mapRef.current.addLayer({
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
                mapRef.current.addLayer({
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

                // Click handlers
                mapRef.current.on('click', 'news-dots', (e) => {
                    const props = e.features?.[0]?.properties as MapFeatureProperties | undefined;

                    if (props) {
setSelectedFeature(props);
}
                });

                mapRef.current.on('click', 'news-clusters', (e) => {
                    const features = mapRef.current.queryRenderedFeatures(e.point, { layers: ['news-clusters'] });

                    if (!features.length) {
                        return;
                    }

                    const clusterId = features[0].properties?.cluster_id;
                    const source = mapRef.current.getSource('news') as mapboxgl.GeoJSONSource;
                    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                        if (err || zoom == null) {
                            return;
                        }

                        mapRef.current.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
                    });
                });

                mapRef.current.on('mouseenter', 'news-dots', () => {
                    mapRef.current.getCanvas().style.cursor = 'pointer';
                });
                mapRef.current.on('mouseleave', 'news-dots', () => {
                    mapRef.current.getCanvas().style.cursor = '';
                });
            } catch (err) {
                console.error('Failed to load initial map data', err);
            }
        });

        // Realtime append
        echo.channel('public-map').listen('.news.geocoded', (data: any) => {
            const source = mapRef.current.getSource('news') as mapboxgl.GeoJSONSource | undefined;

            if (!source) {
return;
}

            const current = (source as any)._data || { type: 'FeatureCollection', features: [] };
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
                },
            };

            source.setData({
                ...current,
                features: [...current.features, newFeature],
            });

            // Keep Currently Happening list live with new events
            setCurrentEvents((prev: any[]) => {
                const exists = prev.some((e: any) => e.id === data.id);
                if (exists) return prev;
                const newEv = {
                    ...data,
                    lng: data.longitude,
                    lat: data.latitude,
                };
                return [newEv, ...prev].slice(0, 8);
            });
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
        <div className="relative w-full h-screen bg-gray-950 text-white overflow-hidden">
            <div ref={mapContainer} className="w-full h-full" />

            {/* Top left branding + controls */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-gray-900/90 backdrop-blur px-4 py-2 rounded-xl text-sm font-semibold tracking-[2px] border border-white/10">
                    MARCHSEEK
                </div>
                <button
                    onClick={toggleHeatmap}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-white/10 ${
                        heatmapVisible
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-900/90 hover:bg-gray-800 text-gray-200'
                    }`}
                >
                    {heatmapVisible ? 'Hide heatmap' : 'Show heatmap'}
                </button>
                <a
                    href="/admin"
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-900/70 hover:bg-gray-800 border border-white/10 text-gray-400 hover:text-white w-fit"
                >
                    Admin →
                </a>

                {/* Currently Happening section - recent events from last 24h (server filtered) */}
                {currentEvents.length > 0 && (
                    <div className="mt-1 w-[min(18rem,calc(100vw-2rem))] max-h-[50vh] sm:max-h-[340px] overflow-hidden rounded-2xl border border-white/10 bg-gray-900/90 text-xs shadow-2xl">
                        <div 
                            className="flex cursor-pointer items-center justify-between border-b border-white/10 px-3 py-2 hover:bg-white/5"
                            onClick={() => setHappeningOpen(!happeningOpen)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-semibold tracking-wide text-orange-400">Currently Happening</span>
                                <span className="text-[10px] text-gray-500">({currentEvents.length})</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <span className="hidden sm:inline">last 24h</span>
                                <span className={`inline-block transition-transform ${happeningOpen ? 'rotate-180' : ''}`}>▼</span>
                            </div>
                        </div>
                        {happeningOpen && (
                            <div className="max-h-[calc(50vh-2.5rem)] sm:max-h-[300px] overflow-y-auto space-y-2 p-3 pr-2">
                                {currentEvents.map((ev, idx) => (
                                    <div
                                        key={ev.id || idx}
                                        onClick={() => selectEvent(ev)}
                                        className="cursor-pointer rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors active:bg-white/10"
                                    >
                                        <div className="font-medium text-gray-100 truncate">{ev.place_name || 'Unknown location'}</div>
                                        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-300">{ev.headline}</div>
                                        <div className="mt-0.5 text-[9px] text-gray-500">{formatTime(ev.fetched_at)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Article detail panel */}
            {selectedFeature && (
                <div className="absolute top-4 right-4 z-10 w-80 bg-gray-900/95 border border-white/10 text-white rounded-2xl shadow-2xl p-4">
                    <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-xs text-orange-400 font-medium uppercase tracking-widest">
                            {selectedFeature.place_name || 'Unknown location'}
                        </span>
                        <button
                            onClick={() => setSelectedFeature(null)}
                            className="text-gray-400 hover:text-white text-xl leading-none -mt-1"
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                    <h3 className="text-sm font-semibold mb-2 leading-snug pr-4">{selectedFeature.headline}</h3>
                    {selectedFeature.summary && (
                        <p className="text-xs text-gray-300 mb-3 leading-relaxed line-clamp-4">{selectedFeature.summary}</p>
                    )}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{selectedFeature.provider}</span>
                        <a
                            href={selectedFeature.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Read source →
                        </a>
                    </div>
                </div>
            )}

            {/* Chat widget */}
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
                {open ? '×' : '💬'}
            </button>
        </div>
    );
}
