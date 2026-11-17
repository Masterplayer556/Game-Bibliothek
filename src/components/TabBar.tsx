"use client";

// The bar at the bottom, as liquid glass: a drop of glass sits under the chosen page. Tapping
// another page sends the drop there with a spring; it swells and stretches while it moves.
// Pressing and sliding along the bar lifts the drop and carries it under the finger; letting
// go opens the page beneath it. Only transform-like properties move, so it stays smooth.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Icon } from "./Icon";
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
 */
function useLiquidLens(index: number, range: [number, number], onPick: (slot: number) => void) {
  const track = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const shine = useRef<HTMLSpanElement>(null);
  const previous = useRef(index);
  const drag = useRef<{ id: number; x: number; active: boolean; under: number } | null>(null);
  const [under, setUnder] = useState<number | null>(null);

  // The glide itself is a CSS transition on `translate`; here the drop swells and stretches
  // toward where it goes (further = longer), then settles.
  useEffect(() => {
    const from = previous.current;
    previous.current = index;
    if (from === index || reducedMotion()) return;
    const stretch = Math.min(0.5, 0.14 + Math.abs(index - from) * 0.09);
    lens.current?.animate([{ scale: "1 1" }, { scale: `${1 + stretch} 1.18`, offset: 0.3 }, { scale: "1 1" }], {
      duration: 640,
      easing: "cubic-bezier(.25,.8,.25,1)",
    });
    shine.current?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 0 }], { duration: 700, easing: "ease-out" });
  }, [index]);

  function metrics() {
    const el = track.current!;
    const slot = el.querySelector<HTMLElement>("[data-slot]")!;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    return { left: el.getBoundingClientRect().left, pitch: slot.offsetWidth + gap };
  }

  function lift(lifted: boolean) {
    const el = lens.current;
    if (!el) return;
    if (lifted) el.setAttribute("data-lifted", "true");
    else {
      el.removeAttribute("data-lifted");
      el.style.translate = "";
    }
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag.current = { id: event.pointerId, x: event.clientX, active: false, under: index };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      if (!d.active) {
        if (Math.abs(event.clientX - d.x) < DRAG_THRESHOLD_PX) return;
        d.active = true;
        // From now on the bar gets the pointer, so letting go does not also click a link.
        event.currentTarget.setPointerCapture(event.pointerId);
        lift(true);
      }
      const { left, pitch } = metrics();
      const x = Math.min(range[1] * pitch, Math.max(range[0] * pitch, event.clientX - left - pitch / 2));
      if (lens.current) lens.current.style.translate = `${x}px 0`;
      const slot = Math.round(x / pitch);
      if (slot !== d.under) {
        d.under = slot;
        setUnder(slot);
      }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      drag.current = null;
      if (!d.active) return;
      lift(false);
      setUnder(null);
      onPick(d.under);
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      drag.current = null;
      lift(false);
      setUnder(null);
    },
  };

  return { track, lens, shine, under, handlers };
}

/** Remembers a tapped slot until the page has changed, so the drop moves at once. */
function useChosen(routeIndex: number) {
  const pathname = usePathname();
  const [tapped, setTapped] = useState<{ from: string; index: number } | null>(null);
  const chosen = tapped && tapped.from === pathname ? tapped.index : routeIndex;
  return { chosen, choose: (index: number) => setTapped({ from: pathname, index }) };
}

function Lens({ index, item, lensRef, shineRef }: { index: number; item: NavItem; lensRef: React.Ref<HTMLSpanElement>; shineRef: React.Ref<HTMLSpanElement> }) {
  return (
    <span ref={lensRef} aria-hidden className="tab-lens" style={{ "--i": index, ...sectionStyle(item.section) } as CSSProperties}>
      <span ref={shineRef} className="tab-lens-shine" />
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
      <Icon name={item.icon} className="h-[23px] w-[23px]" />
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
  const { track, lens, shine, under, handlers } = useLiquidLens(lensIndex, open ? [MORE, MORE + SECONDARY.length] : [0, MORE], pick);

  return (
    // Its own name: the page never covers the bar. Only one bar shows at a time.
    <div className="glass tabbar pointer-events-auto md:hidden" {...handlers}>
      <div className="tab-viewport" style={{ width: "calc(5 * var(--slot) + 4 * var(--gap))" }}>
        <div ref={track} className="tab-track" data-open={open}>
          <Lens index={lensIndex} item={lensItem} lensRef={lens} shineRef={shine} />
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
            <span className="relative h-[23px] w-[23px]">
              <Icon name="more" className={`tab-icon-swap absolute inset-0 h-[23px] w-[23px] ${open ? "scale-50 rotate-90 opacity-0" : ""}`} />
              <Icon name="back" className={`tab-icon-swap absolute inset-0 h-[23px] w-[23px] ${open ? "" : "scale-50 -rotate-90 opacity-0"}`} />
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
  const { track, lens, shine, under, handlers } = useLiquidLens(chosen, [0, NAV.length - 1], pick);
  return (
    <div className="glass tabbar pointer-events-auto hidden md:block" {...handlers}>
      <div className="tab-viewport">
        <div ref={track} className="tab-track">
          <Lens index={chosen} item={NAV[chosen] ?? current} lensRef={lens} shineRef={shine} />
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
