'use client';

import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { PORTFOLIO } from '../data.js';
import { useActiveSection, cn, Icon } from './primitives.jsx';

const NAV_ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.092 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  ),
  about: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0" />
    </svg>
  ),
  skills: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.25 6.75L21 12l-6.75 2.25L12 21l-2.25-6.75L3 12l6.75-2.25L12 3z" />
    </svg>
  ),
  projects: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  experience: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.44 60.44 0 00-.491 6.347A48.6 48.6 0 0112 20.904a48.6 48.6 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.9 59.9 0 0112 3.493a59.9 59.9 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.7 50.7 0 0112 13.489a50.7 50.7 0 017.74-3.342" />
    </svg>
  ),
  contact: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
};

const pad = (n) => String(n).padStart(2, '0');

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

/**
 * Editorial header: name first, role as a quiet line, then an understated
 * status, the command-palette jump and the résumé link. Transparent at the
 * top of the page; gains a soft backdrop and hairline once scrolled.
 */
export function TopBar({ onOpenCmdK }) {
  const { person, navLinks } = PORTFOLIO;
  const scrolled = useScrolled();
  const active = useActiveSection(navLinks.map((n) => n.id));
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <header className="site-header" data-scrolled={scrolled || menuOpen ? '' : undefined}>
        <a href="#home" className="site-name" onClick={closeMenu}>{person.name}</a>
        <span className="site-role">
          {person.title} <span aria-hidden="true">·</span> {person.location.split(',')[0]}
        </span>

        <div className="site-actions">
          <span className="site-status"><i aria-hidden="true" />Employed</span>
          <button type="button" className="site-jump" onClick={onOpenCmdK} aria-label="Open command palette">
            Jump to <kbd>⌘K</kbd>
          </button>
          <a className="site-resume" href="/files/resume.pdf" download aria-label="Download résumé (PDF)">
            Résumé
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v14M6 12l6 6 6-6" />
            </svg>
          </a>
          <button
            type="button"
            className="site-menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span>{menuOpen ? 'Close' : 'Menu'}</span>
            <span className="site-menu-icon" data-open={menuOpen ? '' : undefined} aria-hidden="true"><i /><i /></span>
          </button>
        </div>
      </header>
      <MobileMenu open={menuOpen} onClose={closeMenu} active={active} />
    </>
  );
}

/** Compact navigation for screens without the side rail. */
function MobileMenu({ open, onClose, active }) {
  const { navLinks } = PORTFOLIO;
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prev = body.style.overflow;
    body.style.overflow = 'hidden';
    firstRef.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div
      id="mobile-nav"
      className="mnav"
      data-open={open ? '' : undefined}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
    >
      <ol className="mnav-list">
        {navLinks.map((n, i) => (
          <li key={n.id} style={{ '--k': i }}>
            <a
              href={`#${n.id}`}
              ref={i === 0 ? firstRef : undefined}
              tabIndex={open ? 0 : -1}
              aria-current={active === n.id ? 'location' : undefined}
              onClick={onClose}
            >
              <span className="mnav-num">{pad(i + 1)}</span>
              <span className="mnav-label">{n.label}</span>
            </a>
          </li>
        ))}
      </ol>
      <div className="mnav-foot">
        <span className="site-status site-status--show"><i aria-hidden="true" />Employed</span>
        <a href="/files/resume.pdf" download tabIndex={open ? 0 : -1} className="mnav-resume">Résumé (PDF) ↓</a>
      </div>
    </div>
  );
}

/**
 * Slim side rail: icons threaded on a hairline, a short accent mark that
 * slides to the section in view, and a label on hover / keyboard focus.
 */
export function LeftRail() {
  const { navLinks } = PORTFOLIO;
  const ids = navLinks.map((n) => n.id);
  const active = useActiveSection(ids);
  const index = Math.max(0, ids.indexOf(active));

  return (
    <nav className="rail" aria-label="Sections">
      <span className="rail-line" aria-hidden="true" />
      <span className="rail-mark" aria-hidden="true" style={{ '--rail-i': index }} />
      <ol className="rail-list">
        {navLinks.map((n, i) => (
          <li key={n.id}>
            <a
              href={`#${n.id}`}
              className="rail-link"
              aria-label={n.label}
              aria-current={active === n.id ? 'location' : undefined}
            >
              <span className="rail-icon" aria-hidden="true">{NAV_ICONS[n.id]}</span>
              <span className="rail-tip" aria-hidden="true">
                <span className="rail-num">{pad(i + 1)}</span>
                {n.label}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function CmdK({ open, onClose, setTheme, theme }) {
  const { navLinks, person } = PORTFOLIO;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const nav = navLinks.map((n) => ({
      kind: 'go', label: `Go to ${n.label}`, hint: `#${n.id}`, group: 'Navigation',
      action: () => { document.getElementById(n.id)?.scrollIntoView({ behavior: 'smooth' }); },
    }));
    const acts = [
      { kind: 'theme', label: 'Theme: Paper', hint: theme === 'paper' ? 'active' : '', group: 'Appearance', action: () => setTheme('paper') },
      { kind: 'theme', label: 'Theme: Sepia',  hint: theme === 'sepia'  ? 'active' : '', group: 'Appearance', action: () => setTheme('sepia') },
      { kind: 'theme', label: 'Theme: Dark',   hint: theme === 'dark'   ? 'active' : '', group: 'Appearance', action: () => setTheme('dark') },
    ];
    const ext = [
      { kind: 'link', label: 'Open GitHub',            hint: '↗', group: 'External', action: () => window.open(person.github, '_blank') },
      { kind: 'link', label: 'Open LinkedIn',          hint: '↗', group: 'External', action: () => window.open(person.linkedin, '_blank') },
      { kind: 'link', label: `Email ${person.email}`,  hint: '↗', group: 'External', action: () => window.open(`mailto:${person.email}`) },
    ];
    return [...nav, ...acts, ...ext];
  }, [theme]);

  const filtered = useMemo(() => {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(s));
  }, [q, items]);

  useEffect(() => {
    if (open) {
      setQ(''); setSel(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter')  { e.preventDefault(); filtered[sel]?.action(); onClose(); }
    else if (e.key === 'Escape') { onClose(); }
  }

  if (!open) return null;

  const grouped = {};
  filtered.forEach((it, i) => {
    grouped[it.group] = grouped[it.group] || [];
    grouped[it.group].push({ ...it, _i: i });
  });

  return (
    <div
      data-native-scroll
      className="fixed inset-0 grid place-items-start justify-center pt-[12vh] z-[100]"
      style={{ background: 'color-mix(in oklch, var(--c-ink) 40%, transparent)', backdropFilter: 'blur(8px)', animation: 'fade-in 0.2s' }}
      onClick={onClose}
    >
      <div
        className="w-[min(560px,92vw)] bg-bg border border-line-2 rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 30px 80px -20px oklch(0% 0 0 / 0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="w-full px-5 py-[18px] border-b border-line text-[16px] bg-transparent outline-none text-ink"
          placeholder="Type a command or search…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={onKey}
        />
        <div className="max-h-[50vh] overflow-auto p-2">
          {Object.keys(grouped).map((g) => (
            <Fragment key={g}>
              <div className="px-3 pt-2.5 pb-1 font-mono text-[10px] text-ink-3 uppercase tracking-[0.08em]">{g}</div>
              {grouped[g].map((it) => (
                <div
                  key={it.label}
                  className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] text-ink cursor-pointer', it._i === sel && 'bg-bg-2')}
                  onMouseEnter={() => setSel(it._i)}
                  onClick={() => { it.action(); onClose(); }}
                >
                  <div className={cn('w-7 h-7 rounded-[7px] border border-line bg-bg-2 grid place-items-center font-mono text-[12px] text-ink-2', it._i === sel && 'bg-ink text-bg border-ink')}>
                    {it.kind === 'go' ? '→' : it.kind === 'theme' ? '◐' : '↗'}
                  </div>
                  <div>{it.label}</div>
                  <div className="ml-auto font-mono text-[11px] text-ink-3">{it.hint}</div>
                </div>
              ))}
            </Fragment>
          ))}
          {filtered.length === 0 && (
            <div className="py-6 px-4 text-center text-ink-3 text-[13px]">No matches</div>
          )}
        </div>
        <div className="border-t border-line px-4 py-2.5 font-mono text-[11px] text-ink-3 flex justify-between">
          <span>
            <span className="px-[5px] py-px border border-line rounded bg-bg-2">↑↓</span> navigate ·{' '}
            <span className="px-[5px] py-px border border-line rounded bg-bg-2">↵</span> open
          </span>
          <span><span className="px-[5px] py-px border border-line rounded bg-bg-2">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
