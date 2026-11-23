'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { PORTFOLIO } from '../data.js';
import { Icon } from './primitives.jsx';
import { TechPill } from './TechPill.jsx';
import { useReducedMotion, useTilt } from './motion.js';
import { AvatarCompanion } from './companion/AvatarCompanion';

// Loaded on first hover / focus of a thumbnail, so it costs nothing up front.
const loadShowcase = () => import('./ProjectShowcase.jsx');
const ProjectShowcase = dynamic(loadShowcase, { ssr: false });

/* ---------------------------------------------------------------------------
   Scroll → slide stepping
   The scene is pinned with CSS sticky inside a tall track; project i rests at
   i × SEG viewport-heights into the pin, and the active project is derived
   from the scroll position (so the scrollbar, anchors and focus all work).

   While the scene is pinned, input moves exactly one project per gesture:
     wheel / trackpad  one step per gesture; the rest of the gesture, including
                       trackpad momentum, is absorbed
     touch             one step per swipe
     keys              ↓ ↑ PageDown PageUp Space step one project
   A gesture that carries into the scene from outside stops on the project it
   entered at. At the first / last project, a fresh gesture outward is left to
   the browser, so the section always releases naturally.
   All per-project states derive in CSS from one variable, --pj-active.
   --------------------------------------------------------------------------- */
const SEG = 0.36;          // viewport-heights of scroll per project while pinned
const ENTER_AT = 0.3;      // project 1 plays in once the scene's top passes 30% of the viewport
const ENTER_AT_SMALL = 0.8; // on small screens, as soon as the stage starts to appear
const HYST = 0.1;          // fraction of a stretch to overshoot before switching (no flicker at edges)
const WHEEL_MIN = 24;      // px of wheel travel before a gesture counts as intent
const GESTURE_GAP = 180;   // ms without wheel input that ends a gesture
const STEP_GAP = 650;      // ms between steps, so each transition lands
const SWIPE_MIN = 44;      // px of finger travel for a touch step

const pad = (n) => String(n).padStart(2, '0');

function useProjectSteps(count, titles, reduced) {
  const refs = useRef({ track: null, scene: null, hudIndex: null, hudTitle: null, projects: [], titles: [] });
  refs.current.titles = titles;

  useEffect(() => {
    const R = refs.current;
    if (reduced || !R.track || !R.scene) return;

    let active = -2;
    let raf = 0;
    let listening = false;

    const apply = (next) => {
      if (next === active) return;
      active = next;
      R.scene.style.setProperty('--pj-active', String(next));
      R.projects.forEach((el, i) => el && el.toggleAttribute('data-active', i === next));
      const shown = Math.max(next, 0);
      if (R.hudIndex) R.hudIndex.textContent = pad(shown + 1);
      if (R.hudTitle) R.hudTitle.textContent = R.titles[shown] ?? '';
    };

    const update = () => {
      raf = 0;
      const vh = R.scene.offsetHeight || window.innerHeight;
      const top = R.track.getBoundingClientRect().top;
      let next;
      if (top > 0) {
        // Scene still sliding in: show project 1 once it's well into view.
        const line = vh * (window.innerWidth < 768 ? ENTER_AT_SMALL : ENTER_AT);
        const margin = vh * 0.03;
        next = active < 0 ? (top < line - margin ? 0 : -1) : (top > line + margin ? -1 : 0);
      } else {
        // Project i rests at p = i; switches happen halfway between rests.
        const p = -top / (SEG * vh);
        const cur = Math.max(active, 0);
        const down = Math.floor(p + 0.5 - HYST);
        const up = Math.floor(p + 0.5 + HYST);
        next = down > cur ? down : up < cur ? up : cur;
        next = Math.min(Math.max(next, 0), count - 1);
      }
      apply(next);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

    /* ---- One project per gesture -------------------------------------- */
    const geometry = () => {
      const vh = R.scene.offsetHeight || window.innerHeight;
      const rect = R.track.getBoundingClientRect();
      return { vh, top: rect.top, pin: rect.height - vh, docTop: rect.top + window.scrollY };
    };
    const inPin = (g) => g.top <= 1 && g.top >= -g.pin - 1;
    const shownIndex = (g) =>
      active >= 0 ? active : Math.min(Math.max(Math.round(-g.top / (SEG * g.vh)), 0), count - 1);
    const canStep = (g, dir) => {
      if (!inPin(g)) return false;
      const next = shownIndex(g) + dir;
      return next >= 0 && next < count;
    };
    const jumpTo = (y) => {
      const root = document.documentElement;
      const behavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';      // the page is pinned; only the scene animates
      window.scrollTo(0, y);
      root.style.scrollBehavior = behavior;
    };
    let lastStep = 0;
    const step = (dir) => {
      const g = geometry();
      const next = shownIndex(g) + dir;
      if (next < 0 || next >= count) return false;
      jumpTo(g.docTop + next * SEG * g.vh);
      lastStep = performance.now();
      update();
      return true;
    };

    // A wheel / swipe gesture that started outside the scene and carried into
    // it stops on the project it entered at instead of flying through.
    let lastWheel = 0;
    let lastSwipe = 0;
    let wasInside = inPin(geometry());
    let wasAbove = geometry().top > 0;
    let wheelMode = 'native';   // 'step' | 'hold' | 'native' for the current wheel gesture
    const catchEntry = () => {
      const g = geometry();
      const inside = inPin(g);
      const now = performance.now();
      if (inside && !wasInside && (now - lastWheel < 400 || now - lastSwipe < 1500)) {
        jumpTo(g.docTop + (wasAbove ? 0 : count - 1) * SEG * g.vh);
        lastStep = now;
        wheelMode = 'hold';
        lastSwipe = 0;
        update();
      }
      wasInside = inPin(geometry());
      if (!wasInside) wasAbove = geometry().top > 0;
    };
    const onScroll = () => { catchEntry(); schedule(); };

    let wheelDir = 0;
    let wheelSum = 0;
    const onWheel = (e) => {
      if (e.ctrlKey || e.target.closest?.('[data-native-scroll]')) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!dy || Math.abs(e.deltaX) > Math.abs(dy)) return;
      const now = performance.now();
      const dir = Math.sign(dy);
      const g = geometry();
      if (now - lastWheel > GESTURE_GAP || dir !== wheelDir) {
        update();   // decide from the current position, not last frame's
        wheelDir = dir;
        wheelSum = 0;
        // Small deltas shortly after a step, or right after the previous
        // gesture ended, are the tail of trackpad momentum, not a new swipe.
        const momentumTail = inPin(g) && Math.abs(dy) < 12 &&
          (now - lastStep < 1100 || now - lastWheel < 450);
        wheelMode = momentumTail ? 'hold' : canStep(g, dir) ? 'step' : 'native';
      }
      lastWheel = now;
      if (wheelMode === 'native') return;    // outside the scene, or releasing at either end
      e.preventDefault();
      if (wheelMode === 'hold' || now - lastStep < STEP_GAP) return;
      wheelSum += dy;
      if (Math.abs(wheelSum) >= WHEEL_MIN && step(dir)) wheelMode = 'hold';
    };

    let touchY = 0;
    let touchX = 0;
    let touchMode = null;      // null until the first move decides: 'step' | 'native'
    let touchStepped = false;
    let touchStartedInside = false;
    const onTouchStart = (e) => {
      if (e.touches.length !== 1 || e.target.closest?.('[data-native-scroll]')) { touchMode = 'native'; return; }
      touchY = e.touches[0].clientY;
      touchX = e.touches[0].clientX;
      touchMode = null;
      touchStepped = false;
      touchStartedInside = inPin(geometry());
    };
    const onTouchMove = (e) => {
      if (touchMode === 'native' || e.touches.length !== 1) return;
      const dy = touchY - e.touches[0].clientY;       // > 0: finger moves up = scroll down
      const dx = touchX - e.touches[0].clientX;
      if (touchMode === null) {
        if (!dy || Math.abs(dx) > Math.abs(dy)) return;
        update();
        touchMode = touchStartedInside && canStep(geometry(), Math.sign(dy)) ? 'step' : 'native';
        if (touchMode === 'native') return;
      }
      if (e.cancelable) e.preventDefault();
      if (!touchStepped && Math.abs(dy) >= SWIPE_MIN && performance.now() - lastStep >= STEP_GAP * 0.6) {
        touchStepped = step(Math.sign(dy));
      }
    };
    const onTouchEnd = () => {
      if (touchMode === 'native') lastSwipe = performance.now();
      touchMode = null;
    };

    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (t?.closest?.('[data-native-scroll]') || document.querySelector('dialog[open]')) return;   // e.g. the project showcase
      let dir = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') dir = 1;
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1;
      else if (e.key === ' ' && t?.tagName !== 'BUTTON') dir = e.shiftKey ? -1 : 1;
      if (!dir) return;
      update();
      if (!canStep(geometry(), dir)) return;
      e.preventDefault();
      if (performance.now() - lastStep >= STEP_GAP * 0.6) step(dir);
    };

    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        const g = geometry();
        wasInside = inPin(g);
        if (!wasInside) wasAbove = g.top > 0;
      }
      const method = on ? 'addEventListener' : 'removeEventListener';
      window[method]('scroll', onScroll, { passive: true });
      window[method]('resize', schedule, { passive: true });
      window[method]('wheel', onWheel, { passive: false });
      window[method]('touchstart', onTouchStart, { passive: true });
      window[method]('touchmove', onTouchMove, { passive: false });
      window[method]('touchend', onTouchEnd, { passive: true });
      window[method]('touchcancel', onTouchEnd, { passive: true });
      window[method]('keydown', onKey);
    };

    update();
    const io = new IntersectionObserver(
      ([entry]) => { listen(entry.isIntersecting); schedule(); },
      { rootMargin: '100% 0px 100% 0px' }
    );
    io.observe(R.track);

    return () => {
      io.disconnect();
      listen(false);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [count, reduced]);

  // Keyboard users tabbing into a project that isn't on stage: scroll to the
  // middle of that project's stretch so the scene switches to it.
  const focusProject = useCallback((i) => {
    const R = refs.current;
    if (reduced || !R.track || !R.scene || R.projects[i]?.hasAttribute('data-active')) return;
    const vh = R.scene.offsetHeight;
    const trackTop = R.track.getBoundingClientRect().top + window.scrollY;
    const root = document.documentElement;
    const behavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, trackTop + i * SEG * vh);
    root.style.scrollBehavior = behavior;
  }, [reduced]);

  // Only follow focus that a Tab press moved here. Focus also fires when the
  // window regains it, and following that would yank the page back to Projects
  // from wherever the visitor has since scrolled.
  const tabbedAt = useRef(-Infinity);
  useEffect(() => {
    const onTab = (e) => { if (e.key === 'Tab') tabbedAt.current = performance.now(); };
    window.addEventListener('keydown', onTab, true);
    return () => window.removeEventListener('keydown', onTab, true);
  }, []);
  const followTabFocus = useCallback((i) => {
    if (performance.now() - tabbedAt.current < 400) focusProject(i);
  }, [focusProject]);

  return { refs, focusProject, followTabFocus };
}

/** Your part in the project, from `roles` in data.js (a string or a list). */
const rolesOf = (project) => [].concat(project.roles ?? []).filter(Boolean);

function Roles({ project, className = 'pj-roles' }) {
  const roles = rolesOf(project);
  if (!roles.length) return null;
  return (
    <p className={className}>
      {roles.map((r, k) => (
        <span key={r} className="pj-roles-v">
          {k > 0 && <span className="pj-roles-sep" aria-hidden="true">/</span>}
          {r}
        </span>
      ))}
    </p>
  );
}

/** The thumbnail: lifts and tilts toward the cursor; opens the showcase. */
function ProjectShot({ project, onOpen }) {
  const hostRef = useTilt({ max: 4 });
  return (
    <figure className="pj-shot" ref={hostRef}>
      {project.image && (
        <button
          type="button"
          className="pj-shot-open"
          data-tilt
          aria-haspopup="dialog"
          aria-label={`Open ${project.title} project showcase`}
          onClick={onOpen}
          onPointerEnter={loadShowcase}
          onFocus={loadShowcase}
        >
          <img
            src={project.image}
            alt=""
            width={project.imageSize?.[0]}
            height={project.imageSize?.[1]}
            loading="lazy"
            decoding="async"
          />
          <span className="pj-shot-sheen" aria-hidden="true" />
          <span className="pj-shot-mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
            </svg>
          </span>
        </button>
      )}
    </figure>
  );
}

function ProjectInfo({ project, onTechHover, onTechLeave }) {
  const titleId = `project-${project.id}-title`;
  return (
    <div className="pj-info">
      <p className="pj-label">
        <span>{project.year}</span>
        <span className="pj-label-rule" aria-hidden="true" />
        <span>{project.tag}</span>
      </p>
      <h3 id={titleId} className="pj-title" data-long={project.title.length > 16 ? '' : undefined}>
        {project.title}
      </h3>
      <Roles project={project} />
      <p className="pj-summary">{project.summary}</p>
      {project.contribution && <p className="pj-did">{project.contribution}</p>}

      {project.features?.length > 0 && (
        <ul className="pj-features" role="list">
          {project.features.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}

      <div className="pj-tech">
        {project.tech.map((t) => (
          <TechPill
            key={t}
            name={t}
            onMouseEnter={() => onTechHover && onTechHover([t])}
            onMouseLeave={() => onTechLeave && onTechLeave()}
          />
        ))}
      </div>

      {project.href && (
        <div className="pj-cta">
          <a href={project.href} target="_blank" rel="noreferrer" className="pj-link">
            <Icon.github width={15} height={15} />
            See project
            <span className="pj-link-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      )}
    </div>
  );
}

export function Projects({ onTechHover, onTechLeave }) {
  const { projects } = PORTFOLIO;

  // Newest first: the exact reverse of oldest → newest (Array#sort is stable,
  // so within a year the last project in data.js comes first).
  const timeline = useMemo(
    () => [...projects].sort((a, b) => Number(a.year) - Number(b.year)).reverse(),
    [projects]
  );
  const n = timeline.length;
  const titles = useMemo(() => timeline.map((p) => p.title), [timeline]);

  const reduced = useReducedMotion();
  const { refs, focusProject, followTabFocus } = useProjectSteps(n, titles, reduced);
  const R = refs.current;

  const [showcase, setShowcase] = useState(null);   // index of the open project
  const closeShowcase = useCallback((i) => {
    setShowcase(null);
    focusProject(i);
    refs.current.projects[i]?.querySelector('.pj-shot-open')?.focus({ preventScroll: !reduced });
  }, [focusProject, refs, reduced]);

  return (
    <section id="projects" className="pt-[var(--section-y)] relative scene-band">
      <div className="section-container" style={{ maxWidth: 1680 }}>
        <div className="section-header relative" style={{ marginBottom: 0 }}>
          <div className="font-display italic text-[15px] text-ink-3">/ 04 · work</div>
          <div>
            <h2 className="font-display font-medium text-ink tracking-[-0.025em] leading-none" style={{ fontSize: 'clamp(36px,5.5vw,64px)' }}>
              Things I've<br />actually shipped.
            </h2>
            <p className="mt-3.5 max-w-[560px] text-ink-2 text-[15px] leading-relaxed">
              A closer look at what I've built — hover a tech pill to highlight that skill above.
            </p>
          </div>
          <AvatarCompanion />
        </div>
      </div>

      <div
        className="pj-track"
        ref={(el) => { R.track = el; }}
        style={{ '--pj-pin': ((n - 0.5) * SEG).toFixed(3) }}
      >
        <div className="pj-scene" ref={(el) => { R.scene = el; }} style={{ '--pj-n': n }}>
          <div className="pj-stage">
            <div className="pj-stage-inner">
              <ol className="pj-projects" role="list" aria-label="Projects, newest to oldest">
                {timeline.map((p, i) => (
                  <li
                    key={p.id}
                    className="pj-proj"
                    data-flip={i % 2 === 1 ? '' : undefined}
                    style={{ '--i': i }}
                    ref={(el) => { R.projects[i] = el; }}
                    onFocus={() => followTabFocus(i)}
                  >
                    <ProjectShot project={p} onOpen={() => setShowcase(i)} />
                    <ProjectInfo project={p} onTechHover={onTechHover} onTechLeave={onTechLeave} />
                  </li>
                ))}
              </ol>

              {/* Timeline: a rail (line, fill, project dots) that slides so the
                  active dot meets the fixed centre node, and the node with its
                  vertical number counter. */}
              <div className="pj-rig" aria-hidden="true">
                <div className="pj-rail">
                  <span className="pj-line" />
                  <div className="pj-rail-move">
                    <span className="pj-fill" />
                    {timeline.map((p, i) => (
                      <span key={p.id} className="pj-tick" style={{ '--i': i }} />
                    ))}
                  </div>
                </div>
                <div className="pj-node">
                  <div className="pj-node-face">
                    {timeline.map((p, i) => (
                      <span key={p.id} className="pj-num" style={{ '--i': i }}>{pad(i + 1)}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pj-hud" aria-hidden="true">
            <span>/ 04 · work</span>
            <span>
              <b ref={(el) => { R.hudIndex = el; }}>01</b> / {pad(n)}
              <span className="pj-hud-sep" />
              <span ref={(el) => { R.hudTitle = el; }}>{timeline[0]?.title}</span>
            </span>
          </div>
        </div>
      </div>

      {showcase !== null && (
        <ProjectShowcase
          projects={timeline}
          startIndex={showcase}
          reduced={reduced}
          onClose={closeShowcase}
        />
      )}
    </section>
  );
}
