"use client";

// The bar at the bottom, as liquid glass: a drop of glass sits under the chosen page. Tapping
// another page sends the drop there on a spring; it stretches with its speed and settles.
// Pressing and sliding along the bar lifts the drop and carries it after the finger; letting
// go sends it, with the speed it had, to the page beneath it. Only transform and opacity move.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { PixelIcon } from "./PixelIcon";
import { currentItem, NAV, PRIMARY, SECONDARY, type NavItem } from "./navigation";
import { sectionStyle } from "./section";

/** A finger has to move this far along the bar before it carries the drop. */
const DRAG_THRESHOLD_PX = 10;

/** Springs as stiffness and damping ratio (1 = no overshoot). */
const GLIDE = { k: 340, zeta: 0.76 };
const FOLLOW = { k: 900, zeta: 0.86 };
const LIFT = { k: 420, zeta: 0.78 };
/** How far the drop stretches at most, and the speed (px/s) at which it gets there by ~63 %. */
const STRETCH_MAX = 0.36;
const STRETCH_SPEED = 1100;
/** The lifted drop is this much bigger. */
const LIFT_SCALE = { x: 0.14, y: 0.24 };

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One step of a damped spring toward `target` (semi-implicit Euler, stable at small steps). */
function springStep(x: number, v: number, target: number, spring: { k: number; zeta: number }, dt: number): [number, number] {
  const c = 2 * Math.sqrt(spring.k) * spring.zeta;
  const a = spring.k * (target - x) - c * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
}

type Motion = {
  /** Where the drop is and how fast it goes (px, px/s), along the track. */
  x: number;
  v: number;
  target: number;
  /** 0 = resting, 1 = lifted under a finger. */
  lift: number;
  liftV: number;
  liftTarget: number;
  /** Smoothed stretch from the speed, so a shaky finger does not make the drop wobble. */
  stretch: number;
  following: boolean;
  frame: number;
  last: number;
};

/**
 * The drop under the chosen slot (`index`) and dragging it along the slots from `range[0]` to
 * `range[1]`. `onPick` gets the slot it was let go on.
 *
 * Smoothness: one spring drives the drop, whatever it does. A new target (a tap, the finger, a
 * release) only changes where the spring pulls, so the drop keeps its speed and never jumps.
 * At rest the inline styles are removed and CSS (`--i`) holds the place, so nothing runs.
 * The bar is measured only when a motion starts, never per frame.
 */
function useLiquidLens(index: number, range: [number, number], onPick: (slot: number) => void) {
  const track = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const shine = useRef<HTMLSpanElement>(null);
  /** The slot the drop rests on when nothing moves. */
  const resting = useRef(index);
  const motion = useRef<Motion | null>(null);
  const pitch = useRef(0);
  const drag = useRef<{ id: number; x: number; active: boolean; under: number; left: number } | null>(null);
  const [under, setUnder] = useState<number | null>(null);

  function measure(): number {
    const el = track.current;
    const slot = el?.querySelector<HTMLElement>("[data-slot]");
    if (!el || !slot) return pitch.current;
    pitch.current = slot.offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
    return pitch.current;
  }

  function paint(m: Motion) {
    const sx = (1 + LIFT_SCALE.x * m.lift) * (1 + m.stretch);
    const sy = (1 + LIFT_SCALE.y * m.lift) * (1 + m.stretch * 0.45);
    if (lens.current) lens.current.style.transform = `translate3d(${m.x.toFixed(2)}px, 0, 0)`;
    if (body.current) body.current.style.transform = `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    if (shine.current) shine.current.style.opacity = Math.min(1, Math.max(m.lift, m.stretch * 3)).toFixed(3);
  }

  function rest() {
    motion.current = null;
    for (const el of [lens.current, body.current, shine.current]) {
      el?.style.removeProperty("transform");
      el?.style.removeProperty("opacity");
    }
    lens.current?.removeAttribute("data-lifted");
  }

  function tick(now: number) {
    const m = motion.current;
    if (!m) return;
    // A frame can come late (a page rendering); the spring is stepped in small pieces anyway.
    let dt = Math.min(0.05, (now - m.last) / 1000);
    m.last = now;
    const spring = m.following ? FOLLOW : GLIDE;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      [m.x, m.v] = springStep(m.x, m.v, m.target, spring, h);
      [m.lift, m.liftV] = springStep(m.lift, m.liftV, m.liftTarget, LIFT, h);
      const goal = STRETCH_MAX * (1 - Math.exp(-Math.abs(m.v) / STRETCH_SPEED));
      m.stretch += (goal - m.stretch) * Math.min(1, h / 0.06);
      dt -= h;
    }
    const still =
      !m.following &&
      Math.abs(m.x - m.target) < 0.25 &&
      Math.abs(m.v) < 4 &&
      Math.abs(m.lift - m.liftTarget) < 0.002 &&
      Math.abs(m.liftV) < 0.02 &&
      m.stretch < 0.002;
    if (still && m.liftTarget === 0) {
      rest();
      return;
    }
    paint(m);
    m.frame = requestAnimationFrame(tick);
  }

  /** Starts (or keeps) the spring going, from slot `from` if it was resting, and returns it. */
  function moving(from = resting.current): Motion {
    let m = motion.current;
    if (!m) {
      const x = from * pitch.current;
      m = { x, v: 0, target: x, lift: 0, liftV: 0, liftTarget: 0, stretch: 0, following: false, frame: 0, last: performance.now() };
      motion.current = m;
    }
    if (!m.frame) {
      m.last = performance.now();
      m.frame = requestAnimationFrame(tick);
    }
    return m;
  }

  // A new chosen slot: the spring now pulls there, keeping whatever speed the drop has.
  useEffect(() => {
    const from = resting.current;
    resting.current = index;
    if (drag.current?.active || (from === index && !motion.current)) return;
    // Hidden bar (the other screen size) or less motion wanted: CSS just puts it there.
    if (reducedMotion() || measure() === 0) {
      if (motion.current) cancelAnimationFrame(motion.current.frame);
      rest();
      return;
    }
    moving(from).target = index * pitch.current;
    // Only a new slot starts a motion; the helpers read refs, so they need not be dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(
    () => () => {
      if (motion.current) cancelAnimationFrame(motion.current.frame);
    },
    [],
  );

  function fingerX(clientX: number, left: number): number {
    const p = pitch.current;
    return Math.min(range[1] * p, Math.max(range[0] * p, clientX - left - p / 2));
  }

  function slotAt(x: number): number {
    return Math.round(x / (pitch.current || 1));
  }

  function release(): number | null {
    const d = drag.current;
    drag.current = null;
    setUnder(null);
    if (!d?.active) return null;
    const m = motion.current;
    if (m) {
      m.following = false;
      m.liftTarget = 0;
      m.target = d.under * pitch.current;
    }
    lens.current?.removeAttribute("data-lifted");
    return d.under;
  }

  /** Ends a drag without choosing: the drop goes back to its slot. */
  function cancel() {
    if (release() !== null && motion.current) motion.current.target = resting.current * pitch.current;
    if (reducedMotion()) rest();
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag.current = { id: event.pointerId, x: event.clientX, active: false, under: index, left: 0 };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      // A mouse keeps its pointer id and moves without a button pressed: if the button was let
      // go somewhere the bar did not hear it (outside it, before the drag began), the drag is
      // over. Without this the drop would follow the bare mouse.
      if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
        cancel();
        return;
      }
      if (!d.active) {
        if (Math.abs(event.clientX - d.x) < DRAG_THRESHOLD_PX) return;
        d.active = true;
        // From now on the bar gets the pointer, so letting go does not also click a link.
        event.currentTarget.setPointerCapture(event.pointerId);
        // Measured once per drag: the bar does not move while the finger is on it.
        measure();
        d.left = track.current!.getBoundingClientRect().left;
        lens.current?.setAttribute("data-lifted", "true");
        if (reducedMotion()) {
          if (motion.current) cancelAnimationFrame(motion.current.frame);
          motion.current = null;
        }
      }
      const x = fingerX(event.clientX, d.left);
      if (reducedMotion()) {
        if (lens.current) lens.current.style.transform = `translate3d(${x}px, 0, 0)`;
      } else {
        const m = moving();
        m.following = true;
        m.liftTarget = 1;
        m.target = x;
      }
      const slot = slotAt(x);
      if (slot !== d.under) {
        d.under = slot;
        setUnder(slot);
      }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      const slot = release();
      if (slot === null) return;
      if (reducedMotion()) rest();
      onPick(slot);
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      cancel();
    },
    // The browser took the pointer away (window lost focus, a dialog …) before it was let go.
    onLostPointerCapture(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      cancel();
    },
  };

  return { track, lens, body, shine, under, handlers };
}

/**
 * Remembers a tapped slot until the page has changed, so the drop moves at once. Forgotten as
 * soon as the page changes: otherwise «Zurück» to the page it was tapped on would bring the
 * old tap back and the drop would stay on the page that was left.
 */
function useChosen(routeIndex: number) {
  const pathname = usePathname();
  const [tapped, setTapped] = useState<{ from: string; index: number } | null>(null);
  if (tapped && tapped.from !== pathname) setTapped(null);
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
  away = false,
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
  /** Slid out of view on the phone: not focusable and not read out. */
  away?: boolean;
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
      inert={away}
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
        <div ref={track} id="tab-more-pages" className="tab-track" data-open={open}>
          <Lens index={lensIndex} item={lensItem} lensRef={lens} bodyRef={body} shineRef={shine} />
          {PRIMARY.map((item, i) => (
            <TabLink
              key={item.href}
              item={item}
              current={current}
              on={lensIndex === i}
              under={under === i}
              onTap={() => choose(i)}
              away={open}
              className="tab-leaving"
              style={{ transitionDelay: open ? `${i * 25}ms` : `${(PRIMARY.length - i) * 35}ms` }}
            />
          ))}
          <button
            type="button"
            data-slot
            // Named by its visible text «Mehr»; aria-expanded tells whether the other pages show.
            aria-expanded={open}
            aria-controls="tab-more-pages"
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
              away={!open}
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
