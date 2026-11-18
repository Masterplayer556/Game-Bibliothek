"use client";

// The bar at the bottom, as liquid glass: a drop of glass sits under the chosen page. Tapping
// another page sends the drop there with a spring; it swells and stretches while it moves.
// Pressing and sliding along the bar lifts the drop and carries it under the finger; letting
// go opens the page beneath it. Only transform and opacity move, so it stays smooth.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { PixelIcon } from "./PixelIcon";
import { currentItem, NAV, PRIMARY, SECONDARY, type NavItem } from "./navigation";
import { sectionStyle } from "./section";

/** A finger has to move this far along the bar before it carries the drop. */
const DRAG_THRESHOLD_PX = 10;

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The drop under the chosen slot (`index`), its swell when it jumps, and dragging it along the
 * slots from `range[0]` to `range[1]`. `onPick` gets the slot it was let go on.
 *
 * Smoothness: the drop only ever moves by `transform` (run by the compositor, so it keeps
 * gliding while the new page renders). While dragging, the bar is measured once when the drag
 * starts and the drop is moved at most once per frame, so no layout is forced on each move.
 */
function useLiquidLens(index: number, range: [number, number], onPick: (slot: number) => void) {
  const track = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const shine = useRef<HTMLSpanElement>(null);
  const previous = useRef(index);
  /** Set when a drag let go: the drop is already there, so it does not swell again. */
  const dropped = useRef(false);
  const drag = useRef<{
    id: number;
    x: number;
    active: boolean;
    under: number;
    left: number;
    pitch: number;
    latest: number;
    frame: number;
  } | null>(null);
  const [under, setUnder] = useState<number | null>(null);

  // The glide itself is a CSS transition on the drop; here it swells and stretches toward
  // where it goes (further = longer), then settles.
  useEffect(() => {
    const from = previous.current;
    previous.current = index;
    const afterDrag = dropped.current;
    dropped.current = false;
    if (from === index || afterDrag || reducedMotion()) return;
    const stretch = Math.min(0.5, 0.14 + Math.abs(index - from) * 0.09);
    body.current?.animate([{ transform: "scale(1, 1)" }, { transform: `scale(${1 + stretch}, 1.18)`, offset: 0.3 }, { transform: "scale(1, 1)" }], {
      duration: 640,
      easing: "cubic-bezier(.25,.8,.25,1)",
    });
    shine.current?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 0 }], { duration: 700, easing: "ease-out" });
  }, [index]);

  function place() {
    const d = drag.current;
    if (!d) return;
    d.frame = 0;
    const x = Math.min(range[1] * d.pitch, Math.max(range[0] * d.pitch, d.latest - d.left - d.pitch / 2));
    if (lens.current) lens.current.style.transform = `translate3d(${x}px, 0, 0)`;
    const slot = Math.round(x / d.pitch);
    if (slot !== d.under) {
      d.under = slot;
      setUnder(slot);
    }
  }

  function release() {
    const d = drag.current;
    drag.current = null;
    if (d?.frame) cancelAnimationFrame(d.frame);
    const el = lens.current;
    if (el) {
      el.removeAttribute("data-lifted");
      el.style.transform = "";
    }
    setUnder(null);
    return d;
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag.current = { id: event.pointerId, x: event.clientX, active: false, under: index, left: 0, pitch: 0, latest: event.clientX, frame: 0 };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      d.latest = event.clientX;
      if (!d.active) {
        if (Math.abs(event.clientX - d.x) < DRAG_THRESHOLD_PX) return;
        d.active = true;
        // From now on the bar gets the pointer, so letting go does not also click a link.
        event.currentTarget.setPointerCapture(event.pointerId);
        // Measured once per drag: the bar does not move while the finger is on it.
        const el = track.current!;
        const slot = el.querySelector<HTMLElement>("[data-slot]")!;
        const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
        d.left = el.getBoundingClientRect().left;
        d.pitch = slot.offsetWidth + gap;
        lens.current?.setAttribute("data-lifted", "true");
        place();
        return;
      }
      if (!d.frame) d.frame = requestAnimationFrame(place);
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      if (!d.active) {
        drag.current = null;
        return;
      }
      if (d.frame) place();
      release();
      if (d.under !== index) dropped.current = true;
      onPick(d.under);
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      release();
    },
  };

  return { track, lens, body, shine, under, handlers };
}

/** Remembers a tapped slot until the page has changed, so the drop moves at once. */
function useChosen(routeIndex: number) {
  const pathname = usePathname();
  const [tapped, setTapped] = useState<{ from: string; index: number } | null>(null);
  const chosen = tapped && tapped.from === pathname ? tapped.index : routeIndex;
  return { chosen, choose: (index: number) => setTapped({ from: pathname, index }) };
}

type SpanRef = React.Ref<HTMLSpanElement>;

function Lens({ index, item, lensRef, bodyRef, shineRef }: { index: number; item: NavItem; lensRef: SpanRef; bodyRef: SpanRef; shineRef: SpanRef }) {
  return (
    <span ref={lensRef} aria-hidden className="tab-lens" style={{ "--i": index, ...sectionStyle(item.section) } as CSSProperties}>
      <span ref={bodyRef} className="tab-lens-body">
        <span ref={shineRef} className="tab-lens-shine" />
      </span>
    </span>
  );
}

function TabLink({
  item,
  current,
  on,
  under,
  onTap,
  className = "",
  style,
  full = false,
}: {
  item: NavItem;
  current: NavItem;
  on: boolean;
  under: boolean;
  onTap: () => void;
  className?: string;
  style?: CSSProperties;
  /** Room for the full name (wide bar). */
  full?: boolean;
}) {
  return (
    <Link
      href={item.href}
      data-slot
      draggable={false}
      aria-current={item === current ? "page" : undefined}
      data-on={on}
      data-under={under}
      onClick={onTap}
      style={{ ...sectionStyle(item.section), ...style }}
      className={`tab-item ${className}`}
    >
      <PixelIcon name={item.icon} className="h-[25px] w-[25px]" />
      <span className="whitespace-nowrap">{full ? item.label : item.short}</span>
    </Link>
  );
}

/** Slot of «Mehr» on the phone: four main pages, «Mehr», then the four other pages. */
const MORE = PRIMARY.length;
const PHONE_SLOTS: (NavItem | "more")[] = [...PRIMARY, "more", ...SECONDARY];

/**
 * The bar on a phone. Five slots show at a time on a track of nine. «Mehr» slides the track to
 * the left: the button moves to the left edge and the other pages follow it in from the right.
 */
function PhoneTabBar({ current }: { current: NavItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(!current.primary);
  // Open when the page belongs to the «more» group; follow when another link changes the group.
  const [group, setGroup] = useState(current.primary);
  if (group !== current.primary) {
    setGroup(current.primary);
    setOpen(!current.primary);
  }
  const { chosen, choose } = useChosen(PHONE_SLOTS.indexOf(current));
  // The drop waits on «Mehr» while the chosen page is on the hidden side of the track.
  const lensIndex = open ? (chosen > MORE ? chosen : MORE) : chosen < MORE ? chosen : MORE;
  const lensItem = PHONE_SLOTS[lensIndex] === "more" ? current : (PHONE_SLOTS[lensIndex] as NavItem);

  const pick = (slot: number) => {
    const target = PHONE_SLOTS[slot];
    if (!target) return;
    if (target === "more") {
      setOpen((o) => !o);
      return;
    }
    choose(slot);
    if (target !== current) router.push(target.href);
  };
  const { track, lens, body, shine, under, handlers } = useLiquidLens(lensIndex, open ? [MORE, MORE + SECONDARY.length] : [0, MORE], pick);

  return (
    // Its own name: the page never covers the bar. Only one bar shows at a time.
    <div className="glass tabbar pointer-events-auto md:hidden" {...handlers}>
      <div className="tab-viewport" style={{ width: "calc(5 * var(--slot) + 4 * var(--gap))" }}>
        <div ref={track} className="tab-track" data-open={open}>
          <Lens index={lensIndex} item={lensItem} lensRef={lens} bodyRef={body} shineRef={shine} />
          {PRIMARY.map((item, i) => (
            <TabLink
              key={item.href}
              item={item}
              current={current}
              on={lensIndex === i}
              under={under === i}
              onTap={() => choose(i)}
              className="tab-leaving"
              style={{ transitionDelay: open ? `${i * 25}ms` : `${(PRIMARY.length - i) * 35}ms` }}
            />
          ))}
          <button
            type="button"
            data-slot
            aria-expanded={open}
            aria-label={open ? "Weniger" : "Mehr"}
            data-on={lensIndex === MORE}
            data-under={under === MORE}
            onClick={() => setOpen((o) => !o)}
            style={sectionStyle(current.section)}
            className="tab-item"
          >
            {/* The four tiles turn into an arrow pointing back. */}
            <span className="relative h-[25px] w-[25px]">
              <span className={`tab-icon-swap absolute inset-0 ${open ? "scale-50 rotate-90 opacity-0" : ""}`}>
                <PixelIcon name="more" className="h-[25px] w-[25px]" />
              </span>
              <span className={`tab-icon-swap absolute inset-0 ${open ? "" : "scale-50 -rotate-90 opacity-0"}`}>
                <PixelIcon name="less" className="h-[25px] w-[25px]" />
              </span>
            </span>
            <span>Mehr</span>
          </button>
          {SECONDARY.map((item, i) => (
            <TabLink
              key={item.href}
              item={item}
              current={current}
              on={lensIndex === MORE + 1 + i}
              under={under === MORE + 1 + i}
              onTap={() => choose(MORE + 1 + i)}
              className="tab-following"
              style={{ transitionDelay: open ? `${60 + i * 55}ms` : "0ms", "--follow": `${(i + 1) * 18}px` } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** From tablet width all eight pages fit in the bar. */
function WideTabBar({ current }: { current: NavItem }) {
  const router = useRouter();
  const { chosen, choose } = useChosen(NAV.indexOf(current));
  const pick = (slot: number) => {
    const target = NAV[slot];
    if (!target) return;
    choose(slot);
    if (target !== current) router.push(target.href);
  };
  const { track, lens, body, shine, under, handlers } = useLiquidLens(chosen, [0, NAV.length - 1], pick);
  return (
    <div className="glass tabbar pointer-events-auto hidden md:block" {...handlers}>
      <div className="tab-viewport">
        <div ref={track} className="tab-track">
          <Lens index={chosen} item={NAV[chosen] ?? current} lensRef={lens} bodyRef={body} shineRef={shine} />
          {NAV.map((item, i) => (
            <TabLink key={item.href} item={item} current={current} on={chosen === i} under={under === i} onTap={() => choose(i)} full />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TabBar() {
  const current = currentItem(usePathname());
  return (
    <nav
      aria-label="Hauptnavigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <PhoneTabBar current={current} />
      <WideTabBar current={current} />
    </nav>
  );
}
