'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  SiHtml5, SiCss, SiJavascript, SiTypescript, SiReact,
  SiTailwindcss, SiDart, SiFlutter, SiNodedotjs, SiExpress, SiPython,
  SiMongodb, SiPostgresql, SiMysql, SiUnity, SiGit,
  SiDocker, SiFirebase, SiCloudflare, SiPostman, SiFigma,
  SiCplusplus, SiC, SiVercel, SiAngular, SiNestjs,
} from 'react-icons/si';
import { FaJava } from 'react-icons/fa';
import { PORTFOLIO } from '../data.js';
import { useReveal, cn } from './primitives.jsx';
import { useLiveWhileVisible } from './motion.js';

function LocalIcon({ src, alt }) {
  return <img src={src} alt={alt} width={44} height={44} style={{ objectFit: 'contain' }} />;
}

const SKILL_ICONS = {
  'HTML':         { icon: <SiHtml5       size={44} color="#E44D26" /> },
  'CSS':          { icon: <SiCss         size={44} color="#1572B6" /> },
  'JavaScript':   { icon: <SiJavascript  size={44} color="#F7DF1E" /> },
  'TypeScript':   { icon: <SiTypescript  size={44} color="#3178C6" /> },
  'React':        { icon: <SiReact       size={44} color="#61DAFB" /> },
  'Angular':      { icon: <SiAngular     size={44} color="#DD0031" /> },
  'NestJS':       { icon: <SiNestjs      size={44} color="#E0234E" /> },
  'Next.js':      { icon: <LocalIcon src="/icons/next.svg" alt="Next.js" /> },
  'Tailwind CSS': { icon: <SiTailwindcss  size={44} color="#06B6D4" /> },
  'Dart':         { icon: <SiDart         size={44} color="#0175C2" /> },
  'Flutter':      { icon: <SiFlutter      size={44} color="#02569B" /> },
  'Node.js':      { icon: <SiNodedotjs   size={44} color="#339933" /> },
  'Express':      { icon: <SiExpress     size={44} color="var(--c-ink)" /> },
  'Python':       { icon: <SiPython      size={44} color="#3776AB" /> },
  'Java':         { icon: <FaJava        size={44} color="#007396" /> },
  'C++':          { icon: <SiCplusplus   size={44} color="#00599C" /> },
  'C':            { icon: <LocalIcon src="/icons/c-program-icon.svg" alt="C" /> },
  'MongoDB':      { icon: <SiMongodb     size={44} color="#47A248" /> },
  'PostgreSQL':   { icon: <SiPostgresql  size={44} color="#4169E1" /> },
  'MySQL':        { icon: <SiMysql       size={44} color="#4479A1" /> },
  'Unity':        { icon: <SiUnity       size={44} color="var(--c-ink)" /> },
  'C#':           { icon: <LocalIcon src="/icons/csharp.svg" alt="C#" /> },
  'Git':          { icon: <SiGit         size={44} color="#F05032" /> },
  'Docker':       { icon: <SiDocker      size={44} color="#2496ED" /> },
  'Firebase':     { icon: <SiFirebase    size={44} color="#FFCA28" /> },
  'Cloudflare':   { icon: <SiCloudflare  size={44} color="#F38020" /> },
  'Vercel':       { icon: <SiVercel       size={44} color="var(--c-ink)" /> },
  'Postman':      { icon: <SiPostman     size={44} color="#FF6C37" /> },
  'Figma':        { icon: <SiFigma       size={44} color="#F24E1E" /> },
};

export function Skills({ activeTech, onTechClick }) {
  const { skills, categories } = PORTFOLIO;
  const [cat, setCat] = useState('all');
  const ref = useReveal();
  const gridRef = useLiveWhileVisible();
  const filterRef = useRef(null);
  const pillRefs = useRef({});
  const [indicator, setIndicator] = useState(null);

  useEffect(() => {
    function measure() {
      const el = pillRefs.current[cat];
      const container = filterRef.current;
      if (!el || !container) return;
      const c = container.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      setIndicator({ x: e.left - c.left, y: e.top - c.top, w: e.width, h: e.height });
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (filterRef.current) ro.observe(filterRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [cat]);

  const counts = useMemo(() => {
    const c = { all: skills.length };
    skills.forEach((s) => { c[s.cat] = (c[s.cat] || 0) + 1; });
    return c;
  }, []);

  const filtered = useMemo(() => {
    const list = cat === 'all' ? skills : skills.filter((s) => s.cat === cat);
    return list.slice().sort((a, b) => b.level - a.level);
  }, [cat]);

  return (
    <section id="skills" className="py-[var(--section-y)] relative bg-bg-2">
      <div className="section-container">
        <div className="section-header">
          <div className="font-display italic text-[15px] text-ink-3">/ 03 · skills</div>
          <div>
            <h2 className="font-display font-medium text-ink tracking-[-0.025em] leading-none" style={{ fontSize: 'clamp(36px,5.5vw,64px)' }}>
              {skills.length} tools I actually reach<br />for, on a good day.
            </h2>
            <p className="mt-3.5 max-w-[560px] text-ink-2 text-[15px] leading-relaxed">
              Filter by category. Hover to highlight. Click a tech in Work to cross-filter here.
            </p>
          </div>
        </div>

        <div className="reveal" ref={ref}>
          <div ref={filterRef} className="relative flex flex-wrap justify-center gap-2 mb-7" style={{ isolation: 'isolate' }}>
            <span
              aria-hidden
              className="absolute top-0 left-0 rounded-full pointer-events-none"
              style={{
                background: 'white',
                mixBlendMode: 'difference',
                zIndex: 2,
                transform: indicator ? `translate(${indicator.x}px, ${indicator.y}px)` : 'none',
                width: indicator?.w || 0,
                height: indicator?.h || 0,
                opacity: indicator ? 1 : 0,
                transition: 'transform 520ms cubic-bezier(.2,.8,.2,1), width 520ms cubic-bezier(.2,.8,.2,1), height 520ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease',
              }}
            />
            {categories.map((c) => {
              const isActive = cat === c.id;
              return (
                <button
                  key={c.id}
                  ref={(el) => { if (el) pillRefs.current[c.id] = el; }}
                  aria-pressed={isActive}
                  className={cn(
                    'sk-filter relative px-4 py-2 border rounded-full text-[13px] font-sans inline-flex items-center gap-2',
                    isActive && !indicator
                      ? 'bg-ink text-bg border-ink'
                      : 'bg-bg border-line text-ink-2 hover:border-ink-3 hover:text-ink'
                  )}
                  onClick={() => setCat(c.id)}
                >
                  {c.label}
                  <span className="font-display italic text-[13.5px] opacity-60">{counts[c.id] || 0}</span>
                </button>
              );
            })}
          </div>

          <div className="skills-icon-grid" ref={gridRef}>
            {filtered.map((s, i) => {
              const meta = SKILL_ICONS[s.name];
              if (!meta) return null;
              const dim = activeTech && !activeTech.includes(s.name);
              return (
                <div
                  key={s.name}
                  className={cn(
                    'skill-icon-tile flex flex-col items-center gap-2.5 py-5 px-2 pb-4 rounded-design cursor-default',
                    dim && 'dim'
                  )}
                  // Only a handful of icons drift, each on its own slow rhythm.
                  data-float={i % 6 === 2 ? '' : undefined}
                  style={{ '--sk-turn': i % 2 ? 1 : -1, '--sk-dur': `${6.5 + (i % 4) * 0.8}s`, '--sk-delay': `${-i * 0.7}s` }}
                  onClick={() => onTechClick && onTechClick(s.name)}
                >
                  <div className="sk-icon">
                    <span className="sk-tip" aria-hidden="true">{s.name}</span>
                    <div className="sk-float">
                      <div className="sk-glyph">{meta.icon}</div>
                    </div>
                  </div>
                  <span className="sk-name font-display italic text-[13.5px] text-ink-2 text-center leading-[1.3]">{s.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
