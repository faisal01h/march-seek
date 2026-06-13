import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Location pin (map marker for events) */}
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            {/* Seek / scan arcs (radar style representing "seek") */}
            <path
                d="M15.5 5.2 Q18 5.2 18 8.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.65"
            />
            <path
                d="M16.8 3 Q21 3 21 8.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.4"
            />
        </svg>
    );
}
