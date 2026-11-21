'use client';

import { useEffect, useRef, useState } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(REDUCED);
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
}

/**
 * Restrained cursor tilt. Attach the returned ref to a host that stays still;
 * its [data-tilt] child receives --tilt-x / --tilt-y (and --shine-x / --shine-y)
 * and CSS does the rest, so the hover target never moves out from under the
 * cursor. Mouse only: touch and pen keep their own :active feedback.
 */
export function useTilt({ max = 4 } = {}) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const target = host.querySelector('[data-tilt]');
    if (!target) return;

    let raf = 0;
    let cx = 0;
    let cy = 0;

    const paint = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = clamp01((cx - r.left) / r.width);
      const py = clamp01((cy - r.top) / r.height);
      const k = window.innerWidth < 1200 ? 0.6 : 1;   // gentler on small laptops / tablets
      target.style.setProperty('--tilt-x', `${((0.5 - py) * 2 * max * k).toFixed(2)}deg`);
      target.style.setProperty('--tilt-y', `${((px - 0.5) * 2 * max * k).toFixed(2)}deg`);
      target.style.setProperty('--shine-x', `${(px * 100).toFixed(1)}%`);
      target.style.setProperty('--shine-y', `${(py * 100).toFixed(1)}%`);
    };

    const onMove = (e) => {
      if (e.pointerType !== 'mouse' || window.matchMedia(REDUCED).matches) return;
      cx = e.clientX;
      cy = e.clientY;
      target.setAttribute('data-tilting', '');
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      target.removeAttribute('data-tilting');
      ['--tilt-x', '--tilt-y', '--shine-x', '--shine-y'].forEach((p) => target.style.removeProperty(p));
    };

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      onLeave();
    };
  }, [max]);

  return hostRef;
}

/**
 * Sets data-live on an element while it is on screen, so looping decorative
 * animations only run when someone can see them.
 */
export function useLiveWhileVisible() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute('data-live', e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/**
 * One fade-and-rise per section heading. Only headings still below the fold
 * are hidden, and only once JS is running, so nothing flashes on reload and
 * nothing depends on the animation to be readable.
 */
export function useSectionHeaderReveal() {
  useEffect(() => {
    if (window.matchMedia(REDUCED).matches) return;
    const heads = [...document.querySelectorAll('section:not(#home) .section-header')]
      .filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9);
    if (!heads.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.setAttribute('data-rv-in', '');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });

    heads.forEach((el) => { el.setAttribute('data-rv', ''); io.observe(el); });
    return () => io.disconnect();
  }, []);
}

/**
 * Scroll-driven timeline. A reading line sits at 62% of the viewport:
 *   --tl-p         how far the accent line has been drawn (0–1)
 *   data-in        entry has been revealed (early, at 92%, so nobody waits)
 *   data-reached   the line has passed this entry's marker
 *   data-current   the last entry reached, gently emphasised
 * Hidden states only apply under [data-anim], which is set here, so the
 * timeline is fully readable without JS or with reduced motion.
 */
export function useTimeline() {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia(REDUCED).matches) return;
    const items = [...root.querySelectorAll('.timeline-item')];
    if (!items.length) return;

    let raf = 0;
    let listening = false;
    let current = null;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const line = vh * 0.62;
      const box = root.getBoundingClientRect();
      root.style.setProperty('--tl-p', clamp01((line - box.top) / box.height).toFixed(4));

      let next = null;
      items.forEach((el) => {
        const top = el.getBoundingClientRect().top;
        if (top < vh * 0.92) el.setAttribute('data-in', '');
        const reached = top + 36 <= line;
        el.toggleAttribute('data-reached', reached);
        if (reached) next = el;
      });
      if (next !== current) {
        current?.removeAttribute('data-current');
        next?.setAttribute('data-current', '');
        current = next;
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

    update();                            // mark what's already on screen first…
    root.setAttribute('data-anim', '');  // …so only entries below the fold start hidden

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === listening) return;
      listening = e.isIntersecting;
      window[listening ? 'addEventListener' : 'removeEventListener']('scroll', schedule, { passive: true });
      window[listening ? 'addEventListener' : 'removeEventListener']('resize', schedule, { passive: true });
      schedule();
    }, { rootMargin: '20% 0px 20% 0px' });
    io.observe(root);

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
      root.removeAttribute('data-anim');
    };
  }, []);

  return ref;
}
