'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  SiFlutter, SiTypescript, SiExpress, SiPostgresql,
  SiMongodb, SiReact, SiNodedotjs, SiUnity,
  SiAngular, SiNestjs, SiRedis, SiSocketdotio, SiDocker,
  SiPython, SiRaspberrypi, SiFirebase,
} from 'react-icons/si';
import { PORTFOLIO } from '../data.js';
import { Icon } from './primitives.jsx';

const TECH_ICONS = {
  'Flutter':    <SiFlutter     size={13} color="#02569B" />,
  'TypeScript': <SiTypescript  size={13} color="#3178C6" />,
  'Express':    <SiExpress     size={13} color="currentColor" />,
  'PostgreSQL': <SiPostgresql  size={13} color="#4169E1" />,
  'MongoDB':    <SiMongodb     size={13} color="#47A248" />,
  'React':      <SiReact       size={13} color="#61DAFB" />,
  'Node.js':    <SiNodedotjs   size={13} color="#339933" />,
  'Unity':      <SiUnity       size={13} color="currentColor" />,
  'C#':         <img src="/icons/csharp.svg" alt="" width={13} height={13} />,
  'Angular':      <SiAngular      size={13} color="#DD0031" />,
  'NestJS':       <SiNestjs       size={13} color="#E0234E" />,
  'Redis':        <SiRedis        size={13} color="#FF4438" />,
  'Socket.IO':    <SiSocketdotio  size={13} color="currentColor" />,
  'Docker':       <SiDocker       size={13} color="#2496ED" />,
  'Python':       <SiPython       size={13} color="#3776AB" />,
  'Raspberry Pi': <SiRaspberrypi  size={13} color="#A22846" />,
  'Firebase':     <SiFirebase     size={13} color="#FFCA28" />,
};

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
const HYST = 0.1;          // fraction of a stretch to overshoot before switching (no flicker at edges)
const WHEEL_MIN = 24;      // px of wheel travel before a gesture counts as intent
const GESTURE_GAP = 180;   // ms without wheel input that ends a gesture
const STEP_GAP = 650;      // ms between steps, so each transition lands
const SWIPE_MIN = 44;      // px of finger travel for a touch step

const pad = (n) => String(n).padStart(2, '0');

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
}

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
        const line = vh * ENTER_AT;
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
      if (t?.closest?.('[data-native-scroll]')) return;   // e.g. the screenshot viewer
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

  return { refs, focusProject };
}

/* ---------------------------------------------------------------------------
   Screenshot viewer
   A modal <dialog> (focus stays inside, Esc closes, focus returns to the
   thumbnail). The image grows out of the thumbnail and shrinks back into it
   on close. The image is sized in JS from the thumbnail's natural size, so the
   open animation never waits for a load; it is never scaled past 100%.
   --------------------------------------------------------------------------- */
const VIEW_EASE = 'cubic-bezier(.2,.8,.2,1)';

function ShotViewer({ project, index, count, origin, reduced, onClose }) {
  const dlgRef = useRef(null);
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const closing = useRef(false);

  const fit = useCallback(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return;
    const w = origin?.naturalWidth || img.naturalWidth || 1600;
    const h = origin?.naturalHeight || img.naturalHeight || 1000;
    const k = Math.min(stage.clientWidth / w, stage.clientHeight / h, 1);
    img.style.width = `${Math.round(w * k)}px`;
    img.style.height = `${Math.round(h * k)}px`;
  }, [origin]);

  // Transform that puts the viewer image exactly over the thumbnail.
  const toThumb = useCallback(() => {
    const img = imgRef.current;
    if (!img || !origin?.isConnected) return null;
    const a = origin.getBoundingClientRect();
    const b = img.getBoundingClientRect();
    if (!a.width || !b.width) return null;
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${a.width / b.width}, ${a.height / b.height})`;
  }, [origin]);

  // Open: lock the page, show the dialog, grow the image out of the thumbnail.
  useLayoutEffect(() => {
    const dlg = dlgRef.current;
    const root = document.documentElement;
    const body = document.body;
    const prev = { overflow: body.style.overflow, gutter: root.style.scrollbarGutter };
    root.style.scrollbarGutter = 'stable';   // no layout shift when the scrollbar hides
    body.style.overflow = 'hidden';
    if (!dlg.open) dlg.showModal();
    fit();

    if (!reduced) {
      const from = toThumb();
      imgRef.current.animate(
        from
          ? [{ transform: from }, { transform: 'none' }]
          : [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }],
        { duration: 560, easing: VIEW_EASE }
      );
      dlg.querySelectorAll('[data-fade]').forEach((el) => {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 320, easing: 'ease', delay: Number(el.dataset.fade) || 0, fill: 'backwards',
        });
      });
    }

    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      dlg.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      body.style.overflow = prev.overflow;
      root.style.scrollbarGutter = prev.gutter;
    };
  }, [fit, toThumb, reduced]);

  // Close: shrink back into the thumbnail while the backdrop fades.
  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const dlg = dlgRef.current;
    const finish = () => { if (dlg.open) dlg.close(); onClose(); };
    if (reduced) { finish(); return; }
    const to = toThumb();
    const anims = [
      imgRef.current.animate(
        to
          ? [{ transform: 'none' }, { transform: to }]
          : [{ opacity: 1 }, { opacity: 0, transform: 'scale(.97)' }],
        { duration: to ? 440 : 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
      ),
    ];
    dlg.querySelectorAll('[data-fade]').forEach((el) => {
      anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease', fill: 'forwards' }));
    });
    Promise.all(anims.map((a) => a.finished)).then(finish, finish);
  }, [onClose, reduced, toThumb]);

  useEffect(() => {
    const dlg = dlgRef.current;
    const onCancel = (e) => { e.preventDefault(); requestClose(); };              // Esc
    const onNativeClose = () => { if (!closing.current) { closing.current = true; onClose(); } };
    dlg.addEventListener('cancel', onCancel);
    dlg.addEventListener('close', onNativeClose);
    return () => {
      dlg.removeEventListener('cancel', onCancel);
      dlg.removeEventListener('close', onNativeClose);
    };
  }, [requestClose, onClose]);

  return (
    <dialog
      ref={dlgRef}
      className="pj-viewer"
      aria-label={`${project.title} screenshot`}
      data-native-scroll
      onClick={(e) => { if (e.target !== imgRef.current) requestClose(); }}
    >
      <div className="pj-viewer-backdrop" data-fade="0" aria-hidden="true" />
      <div className="pj-viewer-bar" data-fade="120">
        <p className="pj-viewer-meta">
          <b>{pad(index + 1)} / {pad(count)}</b>
          <span className="pj-label-rule" aria-hidden="true" />
          <span>{project.year} · {project.tag}</span>
        </p>
        <button type="button" className="pj-viewer-close">
          Close <kbd>Esc</kbd>
        </button>
      </div>
      <div className="pj-viewer-stage" ref={stageRef}>
        <img ref={imgRef} className="pj-viewer-img" src={project.image} alt={`${project.title} screenshot`} decoding="async" />
      </div>
      <div className="pj-viewer-caption" data-fade="160">
        <p className="pj-viewer-title">{project.title}</p>
        <Roles project={project} className="pj-roles pj-roles--viewer" />
      </div>
    </dialog>
  );
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

      {project.features?.length > 0 && (
        <ul className="pj-features" role="list">
          {project.features.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}

      <div className="pj-tech">
        {project.tech.map((t) => (
          <span
            key={t}
            className="pj-pill"
            onMouseEnter={() => onTechHover && onTechHover([t])}
            onMouseLeave={() => onTechLeave && onTechLeave()}
          >
            {TECH_ICONS[t]}
            {t}
          </span>
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
  const { refs, focusProject } = useProjectSteps(n, titles, reduced);
  const R = refs.current;

  const [viewer, setViewer] = useState(null);   // { index, origin: <img> }
  const closeViewer = useCallback(() => setViewer(null), []);

  return (
    <section id="projects" className="pt-[var(--section-y)] relative bg-bg">
      <div className="section-container" style={{ maxWidth: 1680 }}>
        <div className="section-header" style={{ marginBottom: 0 }}>
          <div className="font-display italic text-[15px] text-ink-3">/ 04 · work</div>
          <div>
            <h2 className="font-display font-medium text-ink tracking-[-0.025em] leading-none" style={{ fontSize: 'clamp(36px,5.5vw,64px)' }}>
              Things I've<br />actually shipped.
            </h2>
            <p className="mt-3.5 max-w-[560px] text-ink-2 text-[15px] leading-relaxed">
              A closer look at what I've built — hover a tech pill to highlight that skill above.
            </p>
          </div>
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
                    onFocus={() => focusProject(i)}
                  >
                    <figure className="pj-shot">
                      {p.image && (
                        <button
                          type="button"
                          className="pj-shot-open"
                          aria-label={`View ${p.title} screenshot full screen`}
                          onClick={(e) => setViewer({ index: i, origin: e.currentTarget.querySelector('img') })}
                        >
                          <img src={p.image} alt="" loading="lazy" decoding="async" />
                        </button>
                      )}
                    </figure>
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

      {viewer && (
        <ShotViewer
          key={timeline[viewer.index].id}
          project={timeline[viewer.index]}
          index={viewer.index}
          count={n}
          origin={viewer.origin}
          reduced={reduced}
          onClose={closeViewer}
        />
      )}
    </section>
  );
}
