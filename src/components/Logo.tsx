// The mark: the app icon (game covers behind a drop of liquid glass with a controller), from design/app-icon.svg.
const ICON_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-96.png`;

export function Logo({ className = "" }: { className?: string }) {
  return (
    // A small local PNG; next/image cannot optimise it in a static export.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ICON_URL} alt="" aria-hidden className={`rounded-[22%] shadow-[0_4px_10px_-4px_var(--color-shadow)] ${className}`} />
  );
}
