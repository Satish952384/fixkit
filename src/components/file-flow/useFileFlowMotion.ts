import { useEffect, type RefObject } from "react";
import { FIELD_CENTER, type FlowFile } from "./fileFlowData";

const MOUSE_RADIUS = 210; // px
const MOUSE_MAX_SHIFT = 16; // px
const SCROLL_PULL = 0.5; // how far objects travel toward the field
const SCROLL_RANGE = 0.85; // fraction of hero height over which the effect plays

type Motion = { x: number; y: number; r: number; s: number; o: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Drives mouse + scroll response without React state: values are lerped in a
 * requestAnimationFrame loop and written straight to `transform` / `opacity`.
 * The loop only runs while something is still moving.
 */
export function useFileFlowMotion(
  rootRef: RefObject<HTMLDivElement | null>,
  fieldRef: RefObject<HTMLDivElement | null>,
  itemRefs: RefObject<(HTMLDivElement | null)[]>,
  files: readonly FlowFile[],
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQuery.matches;

    let width = 0;
    let height = 0;
    let left = 0;
    let top = 0; // page-space top of the hero
    let hidden: boolean[] = [];

    let inView = true;
    let pointerX = 0;
    let pointerY = 0; // viewport-space
    let pointerActive = false;

    let raf = 0;
    let last = 0;

    const cur: Motion[] = files.map(() => ({ x: 0, y: 0, r: 0, s: 1, o: 1 }));
    const field = { s: 1, o: 1 };

    const measure = () => {
      const rect = root.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      left = rect.left;
      top = rect.top + window.scrollY;
      hidden = files.map((_, i) => {
        const el = itemRefs.current[i];
        return !el || getComputedStyle(el).display === "none";
      });
    };

    const resetStyles = () => {
      itemRefs.current.forEach((el) => {
        if (!el) return;
        el.style.transform = "";
        el.style.opacity = "";
      });
      const fieldEl = fieldRef.current;
      if (fieldEl) {
        fieldEl.style.transform = "";
        fieldEl.style.opacity = "";
      }
      cur.forEach((c) => {
        c.x = 0;
        c.y = 0;
        c.r = 0;
        c.s = 1;
        c.o = 1;
      });
      field.s = 1;
      field.o = 1;
    };

    const tick = (now: number) => {
      raf = 0;
      if (reduced || !inView || width === 0) {
        last = 0;
        return;
      }

      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      const ease = 1 - Math.exp(-dt * 5);

      const scrollY = window.scrollY;
      const p = clamp(scrollY / (height * SCROLL_RANGE), 0, 1);
      const k = width < 768 ? 0.6 : 1; // calmer on small screens
      const cx = (width * FIELD_CENTER.x) / 100;
      const cy = (height * FIELD_CENTER.y) / 100;
      const lx = pointerX - left;
      const ly = pointerY + scrollY - top;

      let moving = false;

      for (let i = 0; i < files.length; i++) {
        const el = itemRefs.current[i];
        if (!el || hidden[i]) continue;
        const f = files[i];
        const c = cur[i];

        const ax = (width * f.x) / 100;
        const ay = (height * f.y) / 100;

        // Mouse: nearby objects drift away slightly, tilt and lift.
        let mx = 0;
        let my = 0;
        let mr = 0;
        let ms = 0;
        if (pointerActive) {
          const dx = ax - lx;
          const dy = ay - ly;
          const d = Math.hypot(dx, dy);
          if (d < MOUSE_RADIUS) {
            const s = 1 - d / MOUSE_RADIUS;
            const influence = s * s * (3 - 2 * s);
            const nx = d > 1 ? dx / d : 0;
            const ny = d > 1 ? dy / d : 0;
            const mag = MOUSE_MAX_SHIFT * influence * f.depth;
            mx = nx * mag;
            my = ny * mag;
            mr = (dx >= 0 ? 1 : -1) * 4 * influence;
            ms = 0.05 * influence * f.depth;
          }
        }

        // Scroll: objects travel toward the processing field and fade.
        const tx = mx + (cx - ax) * p * SCROLL_PULL * k;
        const ty = my + (cy - ay) * p * SCROLL_PULL * k;
        const tr = mr;
        const ts = 1 + ms - 0.3 * p;
        const to = 1 - 0.55 * p;

        c.x += (tx - c.x) * ease;
        c.y += (ty - c.y) * ease;
        c.r += (tr - c.r) * ease;
        c.s += (ts - c.s) * ease;
        c.o += (to - c.o) * ease;

        if (
          Math.abs(tx - c.x) > 0.05 ||
          Math.abs(ty - c.y) > 0.05 ||
          Math.abs(tr - c.r) > 0.02 ||
          Math.abs(ts - c.s) > 0.001 ||
          Math.abs(to - c.o) > 0.002
        ) {
          moving = true;
        }

        el.style.transform = `translate3d(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px, 0) rotate(${c.r.toFixed(2)}deg) scale(${c.s.toFixed(3)})`;
        el.style.opacity = c.o.toFixed(3);
      }

      // Processing field compresses as the hero scrolls away.
      const fs = 1 - 0.28 * p;
      const fo = 1 - 0.5 * p;
      field.s += (fs - field.s) * ease;
      field.o += (fo - field.o) * ease;
      if (Math.abs(fs - field.s) > 0.001 || Math.abs(fo - field.o) > 0.002) moving = true;

      const fieldEl = fieldRef.current;
      if (fieldEl) {
        fieldEl.style.transform = `scale(${field.s.toFixed(3)})`;
        fieldEl.style.opacity = field.o.toFixed(3);
      }

      if (moving) {
        raf = requestAnimationFrame(tick);
      } else {
        last = 0;
      }
    };

    const schedule = () => {
      if (reduced || !inView || raf) return;
      raf = requestAnimationFrame(tick);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointerX = e.clientX;
      pointerY = e.clientY;
      pointerActive = true;
      schedule();
    };
    const onPointerLeave = () => {
      pointerActive = false;
      schedule();
    };
    const onScroll = () => schedule();

    const onReducedChange = () => {
      reduced = reducedQuery.matches;
      if (reduced) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
        resetStyles();
      } else {
        measure();
        schedule();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      measure();
      schedule();
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        root.dataset.inview = String(inView); // CSS pauses drift while off-screen
        if (inView) schedule();
      },
      { rootMargin: "80px" },
    );
    intersectionObserver.observe(root);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("blur", onPointerLeave);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    reducedQuery.addEventListener("change", onReducedChange);

    measure();
    schedule();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", onPointerLeave);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      reducedQuery.removeEventListener("change", onReducedChange);
      resetStyles();
    };
  }, [rootRef, fieldRef, itemRefs, files]);
}