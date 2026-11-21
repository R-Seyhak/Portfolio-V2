'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './primitives.jsx';
import { TechPill } from './TechPill.jsx';

const pad = (n) => String(n).padStart(2, '0');
const CLOSE_MS = 240;

const shotsOf = (p) => (p.images?.length ? p.images : [p.image]).filter(Boolean);
const rolesOf = (p) => [].concat(p.roles ?? []).filter(Boolean);

const Chevron = ({ dir }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir < 0 ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6'} />
  </svg>
);

function Notes({ label, items }) {
  if (!items?.length) return null;
  return (
    <section className="sc-section">
      <h3 className="sc-label">{label}</h3>
      <ul className="sc-list" role="list">
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </section>
  );
}

/**
 * Fullscreen project presentation: a modal <dialog> (focus stays inside, Esc
 * closes) with its own scroll area. Optional fields in data.js (images, live,
 * implementation, challenges) appear only when a project actually has them.
 */
export default function ProjectShowcase({ projects, startIndex, reduced, onClose }) {
  const [view, setView] = useState({ index: startIndex, shot: 0, dir: 0, moved: false });
  const dlgRef = useRef(null);
  const sheetRef = useRef(null);
  const pressedBackdrop = useRef(false);
  const closing = useRef(false);
  const indexRef = useRef(startIndex);
  indexRef.current = view.index;

  const n = projects.length;
  const project = projects[view.index];
  const shots = shotsOf(project);
  const prev = projects[(view.index - 1 + n) % n];
  const next = projects[(view.index + 1) % n];
  const roles = rolesOf(project);

  const goProject = useCallback((delta) => {
    setView((v) => ({ index: (v.index + delta + n) % n, shot: 0, dir: delta, moved: true }));
  }, [n]);

  const goShot = useCallback((delta) => {
    setView((v) => {
      const count = shotsOf(projects[v.index]).length;
      return { ...v, shot: (v.shot + delta + count) % count, dir: delta, moved: true };
    });
  }, [projects]);

  // ← → walk through this project's images, then on to the neighbouring project.
  const step = useCallback((delta) => {
    setView((v) => {
      const count = shotsOf(projects[v.index]).length;
      const shot = v.shot + delta;
      if (shot >= 0 && shot < count) return { ...v, shot, dir: delta, moved: true };
      const index = (v.index + delta + n) % n;
      const last = delta < 0 ? shotsOf(projects[index]).length - 1 : 0;
      return { index, shot: last, dir: delta, moved: true };
    });
  }, [projects, n]);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const dlg = dlgRef.current;
    const finish = () => {
      if (dlg.open) dlg.close();
      onClose(indexRef.current);
    };
    if (reduced) { finish(); return; }
    dlg.setAttribute('data-closing', '');
    setTimeout(finish, CLOSE_MS);
  }, [onClose, reduced]);

  // Open: lock the page behind the dialog without shifting its layout.
  useLayoutEffect(() => {
    const dlg = dlgRef.current;
    const root = document.documentElement;
    const body = document.body;
    const prevLock = { overflow: body.style.overflow, gutter: root.style.scrollbarGutter };
    root.style.scrollbarGutter = 'stable';
    body.style.overflow = 'hidden';
    if (!dlg.open) dlg.showModal();
    sheetRef.current?.focus({ preventScroll: true });
    return () => {
      body.style.overflow = prevLock.overflow;
      root.style.scrollbarGutter = prevLock.gutter;
    };
  }, []);

  useEffect(() => {
    const dlg = dlgRef.current;
    const onCancel = (e) => { e.preventDefault(); requestClose(); };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
  }, [requestClose]);

  // New project: start from the top and warm up its neighbours' images.
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
    [prev, next].forEach((p) => {
      const src = shotsOf(p)[0];
      if (src) new Image().src = src;
    });
  }, [view.index]); // eslint-disable-line react-hooks/exhaustive-deps

  // A control that had focus can unmount on a project change (e.g. image dots).
  // Keep focus in the dialog so keyboard navigation carries on working.
  useEffect(() => {
    const dlg = dlgRef.current;
    const active = document.activeElement;
    if (!active || active === document.body || !dlg.contains(active)) {
      sheetRef.current?.focus({ preventScroll: true });
    }
  }, [view.index, view.shot]);

  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  };

  // Close only for a press that both starts and ends on the backdrop, so a
  // text selection dragged out of the sheet doesn't dismiss it.
  const onPointerDown = (e) => { pressedBackdrop.current = e.target === dlgRef.current; };
  const onClick = (e) => {
    if (e.target === dlgRef.current && pressedBackdrop.current) requestClose();
  };

  const announcement = view.moved
    ? `Project ${view.index + 1} of ${n}: ${project.title}${shots.length > 1 ? `, image ${view.shot + 1} of ${shots.length}` : ''}`
    : '';

  return (
    <dialog
      ref={dlgRef}
      className="sc"
      aria-labelledby="sc-title"
      data-native-scroll
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div className="sc-sheet" ref={sheetRef} tabIndex={-1}>
        <p className="sr-only" aria-live="polite">{announcement}</p>

        <header className="sc-bar">
          <div className="sc-head">
            <p className="sc-kicker">
              <span>{pad(view.index + 1)} / {pad(n)}</span>
              <span className="pj-label-rule" aria-hidden="true" />
              <span>{project.tag}</span>
            </p>
            <h2 id="sc-title" className="sc-title">{project.title}</h2>
          </div>
          <div className="sc-controls">
            {n > 1 && (
              <div className="sc-nav" role="group" aria-label="Browse projects">
                <button type="button" className="sc-btn" onClick={() => goProject(-1)} aria-label={`Previous project: ${prev.title}`}>
                  <Chevron dir={-1} />
                </button>
                <button type="button" className="sc-btn" onClick={() => goProject(1)} aria-label={`Next project: ${next.title}`}>
                  <Chevron dir={1} />
                </button>
              </div>
            )}
            <button type="button" className="sc-close" onClick={requestClose} aria-label="Close project showcase">
              <span className="sc-close-text">Close</span>
              <kbd>Esc</kbd>
              <span className="sc-close-icon"><Icon.close /></span>
            </button>
          </div>
        </header>

        <div className="sc-stage">
          <img
            key={`${project.id}-${view.shot}`}
            className="sc-shot"
            style={{ '--dir': view.dir }}
            src={shots[view.shot]}
            width={shots[view.shot] === project.image ? project.imageSize?.[0] : undefined}
            height={shots[view.shot] === project.image ? project.imageSize?.[1] : undefined}
            alt={`${project.title} screenshot${shots.length > 1 ? ` ${view.shot + 1} of ${shots.length}` : ''}`}
            decoding="async"
          />
          {shots.length > 1 && (
            <>
              <button type="button" className="sc-btn sc-shot-nav sc-shot-nav--prev" onClick={() => goShot(-1)} aria-label="Previous image">
                <Chevron dir={-1} />
              </button>
              <button type="button" className="sc-btn sc-shot-nav sc-shot-nav--next" onClick={() => goShot(1)} aria-label="Next image">
                <Chevron dir={1} />
              </button>
              <div className="sc-dots" role="group" aria-label="Choose image">
                {shots.map((s, k) => (
                  <button
                    key={s}
                    type="button"
                    className="sc-dot"
                    aria-label={`Image ${k + 1} of ${shots.length}`}
                    aria-current={k === view.shot ? 'true' : undefined}
                    onClick={() => setView((v) => ({ ...v, shot: k, dir: Math.sign(k - v.shot), moved: true }))}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="sc-body" key={project.id}>
          <div className="sc-main">
            <section className="sc-section">
              <h3 className="sc-label">Overview</h3>
              <p className="sc-lead">{project.summary}</p>
              {project.detail && <p className="sc-text">{project.detail}</p>}
            </section>

            {project.contribution && (
              <section className="sc-section">
                <h3 className="sc-label">What I worked on</h3>
                <p className="sc-text sc-text--strong">{project.contribution}</p>
              </section>
            )}

            <Notes label="Key features" items={project.features} />
            <Notes label="Implementation" items={project.implementation} />
            <Notes label="Challenges" items={project.challenges} />
          </div>

          <aside className="sc-side">
            <dl className="sc-facts">
              {roles.length > 0 && (
                <div><dt>{roles.length > 1 ? 'Roles' : 'Role'}</dt><dd>{roles.join(' / ')}</dd></div>
              )}
              <div><dt>Year</dt><dd>{project.year}</dd></div>
              <div><dt>Type</dt><dd>{project.tag}</dd></div>
              {project.team && <div><dt>Team</dt><dd>{project.team}</dd></div>}
            </dl>

            <div className="sc-section">
              <h3 className="sc-label">Technologies</h3>
              <div className="sc-tech">
                {project.tech.map((t) => <TechPill key={t} name={t} />)}
              </div>
            </div>

            {(project.href || project.live) && (
              <div className="sc-links">
                {project.live && (
                  <a href={project.live} target="_blank" rel="noreferrer" className="pj-link">
                    Live demo <span className="pj-link-arrow" aria-hidden="true">↗</span>
                  </a>
                )}
                {project.href && (
                  <a href={project.href} target="_blank" rel="noreferrer" className="pj-link">
                    <Icon.github width={15} height={15} />
                    GitHub repository <span className="pj-link-arrow" aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>

        {n > 1 && (
          <button type="button" className="sc-next" onClick={() => goProject(1)}>
            <span className="sc-next-label">Next project</span>
            <span className="sc-next-title">{next.title}</span>
            <span className="sc-next-arrow"><Chevron dir={1} /></span>
          </button>
        )}
      </div>
    </dialog>
  );
}
