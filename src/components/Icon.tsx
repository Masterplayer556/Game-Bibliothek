// Duotone vector icons on a 24 × 24 grid. They take the colour of the text around them: the main
// shape in full, the secondary shape faded (SECONDARY), so they keep depth on a coloured tile.
import type { ReactNode } from "react";

const SECONDARY = { opacity: 0.42 };
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS = {
  home: (
    <>
      <path style={SECONDARY} d="M4 10.6 12 4l8 6.6V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M12 2.6c.3 0 .6.1.84.3l8.6 7.1a1.1 1.1 0 1 1-1.4 1.7L12 5.1l-8.04 6.6a1.1 1.1 0 1 1-1.4-1.7l8.6-7.1c.24-.2.54-.3.84-.3z" />
      <rect x="9.6" y="13.4" width="4.8" height="7.6" rx="1.4" />
    </>
  ),
  library: (
    <>
      <rect x="3" y="3.5" width="5" height="16" rx="1.4" />
      <rect style={SECONDARY} x="9.2" y="6" width="4.6" height="13.5" rx="1.3" />
      <rect x="15.4" y="5.4" width="4.4" height="14" rx="1.3" transform="rotate(14 17.6 19.4)" />
      <rect x="2" y="20.2" width="20" height="2" rx="1" />
    </>
  ),
  stats: (
    <>
      <rect style={SECONDARY} x="3.2" y="12.5" width="4.4" height="8.5" rx="1.6" />
      <rect style={SECONDARY} x="9.8" y="8" width="4.4" height="13" rx="1.6" />
      <rect x="16.4" y="3" width="4.4" height="18" rx="1.6" />
      <path {...STROKE} strokeWidth="2" d="M3.5 8.5 8 5.5l4 2 5-4.5" />
    </>
  ),
  trophy: (
    <>
      <path style={SECONDARY} {...STROKE} strokeWidth="1.9" d="M6.5 5.6H4.2a.9.9 0 0 0-.9.9v1a4.4 4.4 0 0 0 3.7 4.4M17.5 5.6h2.3a.9.9 0 0 1 .9.9v1a4.4 4.4 0 0 1-3.7 4.4" />
      <path d="M7.2 3h9.6a1 1 0 0 1 1 1v4.8a5.8 5.8 0 0 1-11.6 0V4a1 1 0 0 1 1-1z" />
      <rect style={SECONDARY} x="10.7" y="14.2" width="2.6" height="3.6" />
      <rect x="7" y="17.4" width="10" height="3.8" rx="1.4" />
    </>
  ),
  chronicle: (
    <>
      <rect style={SECONDARY} x="5.1" y="3" width="1.8" height="18" rx=".9" />
      <circle cx="6" cy="5.5" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="6" cy="18.5" r="2.4" />
      <rect x="10" y="4" width="11" height="3" rx="1.5" />
      <rect style={SECONDARY} x="10" y="10.5" width="8" height="3" rx="1.5" />
      <rect style={SECONDARY} x="10" y="17" width="9.5" height="3" rx="1.5" />
    </>
  ),
  review: (
    <>
      <path d="M10 2.5c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" />
      <path style={SECONDARY} d="M18 13.6c.3 2.3 1.4 3.4 3.7 3.7-2.3.3-3.4 1.4-3.7 3.7-.3-2.3-1.4-3.4-3.7-3.7 2.3-.3 3.4-1.4 3.7-3.7z" />
      <circle style={SECONDARY} cx="19" cy="5" r="1.5" />
    </>
  ),
  plus: (
    <>
      <circle style={SECONDARY} cx="12" cy="12" r="9.5" />
      <rect x="10.8" y="6.5" width="2.4" height="11" rx="1.2" />
      <rect x="6.5" y="10.8" width="11" height="2.4" rx="1.2" />
    </>
  ),
  gamepad: (
    <path
      fillRule="evenodd"
      d="M7.5 6h9a5 5 0 0 1 4.85 3.79l1.2 4.8a3.4 3.4 0 0 1-5.83 3.13L15.2 16H8.8l-1.52 1.72a3.4 3.4 0 0 1-5.83-3.13l1.2-4.8A5 5 0 0 1 7.5 6zM6.9 9.3v1.6H5.3v1.6h1.6v1.6h1.6v-1.6h1.6v-1.6H8.5V9.3zM15.25 10.4a1.05 1.05 0 1 0 2.1 0 1.05 1.05 0 1 0-2.1 0zM16.55 12.6a1.05 1.05 0 1 0 2.1 0 1.05 1.05 0 1 0-2.1 0z"
    />
  ),
  clock: (
    <>
      <circle style={SECONDARY} cx="12" cy="12" r="9.5" />
      <path {...STROKE} strokeWidth="2.3" d="M12 7v5.2l3.4 2" />
    </>
  ),
  calendar: (
    <>
      <rect style={SECONDARY} x="3" y="5" width="18" height="16" rx="3.5" />
      <path d="M3 8.5A3.5 3.5 0 0 1 6.5 5h11A3.5 3.5 0 0 1 21 8.5V10H3z" />
      <rect x="6.8" y="2.5" width="2.2" height="5" rx="1.1" />
      <rect x="15" y="2.5" width="2.2" height="5" rx="1.1" />
      <rect x="6.5" y="12.6" width="2.6" height="2.6" rx=".7" />
      <rect x="10.7" y="12.6" width="2.6" height="2.6" rx=".7" />
      <rect x="14.9" y="12.6" width="2.6" height="2.6" rx=".7" />
      <rect x="6.5" y="16.4" width="2.6" height="2.6" rx=".7" />
      <rect x="10.7" y="16.4" width="2.6" height="2.6" rx=".7" />
    </>
  ),
  star: (
    <path
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      d="M12 2.9l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.3l6-.9z"
    />
  ),
  back: <path {...STROKE} strokeWidth="2.6" d="M14.5 5.5 8 12l6.5 6.5" />,
  forward: <path {...STROKE} strokeWidth="2.6" d="M9.5 5.5 16 12l-6.5 6.5" />,
  more: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2.6" />
      <rect style={SECONDARY} x="13" y="3" width="8" height="8" rx="2.6" />
      <rect style={SECONDARY} x="3" y="13" width="8" height="8" rx="2.6" />
      <rect x="13" y="13" width="8" height="8" rx="2.6" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="2.1" />
      <circle cx="12" cy="12" r="2.1" />
      <circle cx="19" cy="12" r="2.1" />
    </>
  ),
  search: (
    <>
      <circle style={SECONDARY} cx="10.5" cy="10.5" r="6.8" />
      <circle {...STROKE} strokeWidth="2.3" cx="10.5" cy="10.5" r="6.8" />
      <path {...STROKE} strokeWidth="2.8" d="M15.8 15.8 20.5 20.5" />
    </>
  ),
  filter: (
    <>
      <rect style={SECONDARY} x="3" y="5.9" width="18" height="2.2" rx="1.1" />
      <rect style={SECONDARY} x="3" y="10.9" width="18" height="2.2" rx="1.1" />
      <rect style={SECONDARY} x="3" y="15.9" width="18" height="2.2" rx="1.1" />
      <circle cx="8" cy="7" r="2.8" />
      <circle cx="16" cy="12" r="2.8" />
      <circle cx="10" cy="17" r="2.8" />
    </>
  ),
  heart: <path d="M12 20.6s-8.2-5-8.2-10.9A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.2 2.7c0 5.9-8.2 10.9-8.2 10.9z" />,
  flame: (
    <>
      <path d="M12 2.4c.7 3.3 5.2 5.7 5.2 10.9a5.2 5.2 0 0 1-10.4 0c0-2.1.9-3.6 2.1-4.8.2 1.7 1 2.7 2.1 3.2-.6-3.4.3-6.5 1-9.3z" />
      <path style={SECONDARY} d="M12 21.5a3 3 0 0 1-3-3c0-1.8 1.6-2.6 2-4.3 1.6 1 4 2.2 4 4.3a3 3 0 0 1-3 3z" />
    </>
  ),
  crown: (
    <>
      <path strokeLinejoin="round" stroke="currentColor" strokeWidth="1.2" d="M3.5 7.8l4.4 3.7L12 4.8l4.1 6.7 4.4-3.7-1.7 9.6H5.2z" />
      <rect style={SECONDARY} x="5" y="18.6" width="14" height="2.6" rx="1.3" />
    </>
  ),
  flag: (
    <>
      <rect style={SECONDARY} x="4.4" y="2.6" width="2.2" height="19" rx="1.1" />
      <path d="M6.6 3.6h11.6a.8.8 0 0 1 .62 1.3l-2.7 3.4 2.7 3.4a.8.8 0 0 1-.62 1.3H6.6z" />
    </>
  ),
  play: (
    <>
      <circle style={SECONDARY} cx="12" cy="12" r="9.5" />
      <path d="M10 8.1v7.8a.75.75 0 0 0 1.12.65l6.2-3.9a.75.75 0 0 0 0-1.3l-6.2-3.9A.75.75 0 0 0 10 8.1z" />
    </>
  ),
  sync: (
    <>
      <path {...STROKE} strokeWidth="2.3" d="M19 12a7 7 0 0 1-12.4 4.5M5 12a7 7 0 0 1 12.4-4.5" />
      <path {...STROKE} strokeWidth="2.3" d="M17.8 3.6v4h-4M6.2 20.4v-4h4" />
    </>
  ),
  check: <path {...STROKE} strokeWidth="2.8" d="M5 12.5l4.5 4.5L19 7.5" />,
  medal: (
    <>
      <path style={SECONDARY} d="M6.5 2.5h3.6l2.4 5.2H8.9zM17.5 2.5h-3.6l-2.4 5.2h3.6z" />
      <circle cx="12" cy="14.6" r="6.6" />
      <path style={{ opacity: 0.55 }} fill="var(--icon-cut, white)" d="M12 10.6l1.2 2.4 2.6.4-1.9 1.85.45 2.6L12 16.6l-2.35 1.25.45-2.6-1.9-1.85 2.6-.4z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 2.8l9 4.6-9 4.6-9-4.6z" />
      <path style={SECONDARY} {...STROKE} strokeWidth="2.1" d="M3 12l9 4.6 9-4.6" />
      <path {...STROKE} strokeWidth="2.1" d="M3 16.4l9 4.6 9-4.6" />
    </>
  ),
  image: (
    <>
      <rect style={SECONDARY} x="2.5" y="4" width="19" height="16" rx="3.5" />
      <path d="M4.5 18.5l5-6.2 3.6 4.1 2.6-3.1 4.3 5.2z" />
      <circle cx="16.2" cy="8.6" r="1.9" />
    </>
  ),
  pencil: (
    <>
      <path d="M15.6 3.9a2.1 2.1 0 0 1 3 0l1.5 1.5a2.1 2.1 0 0 1 0 3L9.2 19.3l-5.2 1.2 1.2-5.2z" />
      <rect style={SECONDARY} x="11" y="19" width="10" height="2.3" rx="1.15" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4.2" />
      <path style={SECONDARY} d="M4.2 20.4a7.8 7.8 0 0 1 15.6 0 .9.9 0 0 1-.9.9H5.1a.9.9 0 0 1-.9-.9z" />
    </>
  ),
  key: (
    <>
      <circle {...STROKE} strokeWidth="2.4" cx="8" cy="12" r="4.4" />
      <path style={SECONDARY} d="M12 10.8h9v2.4h-2v2.6h-2.4v-2.6H12z" />
    </>
  ),
  list: (
    <>
      <rect style={SECONDARY} x="3" y="4.2" width="4" height="4" rx="1.2" />
      <rect style={SECONDARY} x="3" y="10" width="4" height="4" rx="1.2" />
      <rect style={SECONDARY} x="3" y="15.8" width="4" height="4" rx="1.2" />
      <rect x="9" y="5.1" width="12" height="2.2" rx="1.1" />
      <rect x="9" y="10.9" width="12" height="2.2" rx="1.1" />
      <rect x="9" y="16.7" width="12" height="2.2" rx="1.1" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2.6" />
      <path style={SECONDARY} d="M9 18.2h6l.8 2.3H8.2z" />
    </>
  ),
  switch: (
    <>
      <rect x="2.4" y="5" width="4.6" height="14" rx="2.3" />
      <rect style={SECONDARY} x="7.9" y="5" width="8.2" height="14" rx="1.2" />
      <rect x="17" y="5" width="4.6" height="14" rx="2.3" />
    </>
  ),
  bolt: <path d="M13.6 2.5 4.8 13.6h6.1L9.4 21.5l8.8-11.2h-6.1z" />,
  lock: (
    <>
      <path style={SECONDARY} {...STROKE} strokeWidth="2.3" d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" />
      <rect x="4.5" y="10" width="15" height="11" rx="3" />
    </>
  ),
  info: (
    <>
      <circle style={SECONDARY} cx="12" cy="12" r="9.5" />
      <rect x="10.8" y="10.4" width="2.4" height="7" rx="1.2" />
      <circle cx="12" cy="7.4" r="1.45" />
    </>
  ),
  warning: (
    <>
      <path style={SECONDARY} d="M10.3 3.8a2 2 0 0 1 3.4 0l8 13.6A2 2 0 0 1 20 20.4H4a2 2 0 0 1-1.7-3z" />
      <rect x="10.8" y="8.2" width="2.4" height="6.6" rx="1.2" />
      <circle cx="12" cy="17.3" r="1.4" />
    </>
  ),
  download: (
    <>
      <path style={SECONDARY} d="M3.5 15h4l1.8 2.4h5.4L16.5 15h4v3.5a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5z" />
      <path {...STROKE} strokeWidth="2.4" d="M12 3.5v9M8 9l4 4 4-4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="currentColor" aria-hidden focusable="false">
      {ICONS[name]}
    </svg>
  );
}
