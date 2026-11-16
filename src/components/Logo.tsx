// The mark: a bound book with a gold D-pad embossed on its cover and a ribbon bookmark.
// Colours come from the design tokens.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      {/* pages */}
      <rect x="8" y="6" width="21" height="23" rx="1.5" fill="var(--color-field)" stroke="var(--color-border-strong)" />
      <path d="M11 26.5h16M11 24h16" stroke="var(--color-border-strong)" strokeWidth="0.75" />
      {/* ribbon */}
      <path d="M20 24h4v8l-2-2-2 2z" fill="var(--color-danger)" />
      {/* cover and spine */}
      <rect x="3" y="2" width="23" height="24" rx="2" fill="var(--color-logo-cover)" />
      <path d="M5 2h3v24H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--color-logo-spine)" />
      {/* D-pad */}
      <path d="M15 8h4v4h4v4h-4v4h-4v-4h-4v-4h4z" fill="var(--color-highlight-fill)" />
      <rect x="16" y="13" width="2" height="2" fill="var(--color-logo-spine)" />
    </svg>
  );
}
