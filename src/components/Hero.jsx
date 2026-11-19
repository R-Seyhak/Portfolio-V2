'use client';

import { useState, useEffect } from 'react';
import { PORTFOLIO } from '../data.js';
import { Icon } from './primitives.jsx';

function Typewriter({ words, period = 2400 }) {
  const [idx, setIdx] = useState(0);
  const [sub, setSub] = useState('');
  const [del, setDel] = useState(false);

  useEffect(() => {
    const full = words[idx % words.length];
    const delta = del ? 60 : 120;
    const t = setTimeout(() => {
      if (!del) {
        const next = full.slice(0, sub.length + 1);
        setSub(next);
        if (next === full) setTimeout(() => setDel(true), period);
      } else {
        const next = full.slice(0, sub.length - 1);
        setSub(next);
        if (next === '') { setDel(false); setIdx((i) => i + 1); }
      }
    }, delta);
    return () => clearTimeout(t);
  }, [sub, del, idx, words, period]);

  return (
    <span>
      <span className="italic font-medium text-accent">{sub}</span>
      <span style={{ display: 'inline-block', width: '3px', height: '0.85em', background: 'currentColor', marginLeft: '4px', animation: 'blink 1s infinite', verticalAlign: 'baseline' }} />
    </span>
  );
}

export function Hero({ onOpenCmdK }) {
  const { person } = PORTFOLIO;
  return (
    <section id="home" className="min-h-screen pt-28 sm:pt-32 md:pt-40 pb-16 md:pb-20 relative overflow-hidden bg-bg">
      <div className="section-container flex flex-col items-start" style={{ maxWidth: 880 }}>

        <div className="inline-flex items-center gap-2.5 font-mono text-[12px] text-ink-2 px-3.5 py-2 border border-line rounded-full bg-bg-2 mb-7">
          <span style={{ color: 'oklch(62% 0.2 25)' }}>●</span>
          Employed · Phnom Penh / Remote
        </div>

        <h1
          className="font-display font-normal text-ink leading-[1.05] tracking-[-0.035em]"
          style={{ fontSize: 'clamp(40px, 5.5vw, 76px)' }}
        >
          Rith Seyhak
          <span className="inline-block font-mono text-[0.15em] align-super text-ink-3 ml-1.5 tracking-normal font-medium">01</span>
          <br />
          <span className="inline-block mr-3.5">builds</span>
          <span className="inline-block min-h-[1.1em] min-w-[10ch] align-baseline whitespace-nowrap">
            <Typewriter words={['clean web apps.', 'mobile apps.', 'game worlds.', 'scalable systems.']} />
          </span>
        </h1>

        <p className="mt-6 text-[16px] sm:text-[18px] md:text-[19px] leading-[1.55] text-ink-2 max-w-[520px]">
          <b className="text-ink font-semibold">Software engineer</b> in Phnom Penh, Cambodia — currently studying CS at CADT.
          I spend my evenings turning ideas into code, from POS systems to tower-defense games.
        </p>

        <div className="hero-stat-row mt-9 w-full">
          {[
            { k: 'Projects', v: `${PORTFOLIO.projects.length}+` },
            { k: 'Stacks',   v: String(PORTFOLIO.skills.length) },
            { k: 'School',   v: "CADT '26" },
            { k: 'Based in', v: 'PP · KH' },
          ].map(({ k, v }) => (
            <div key={k} className="hero-stat-item flex flex-col px-7 border-r border-line">
              <span className="font-mono text-[10px] text-ink-3 uppercase tracking-[0.08em]">{k}</span>
              <span className="font-display text-[24px] font-medium text-ink mt-1 tracking-[-0.02em]">{v}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-9">
          <button
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-[10px] text-[14px] font-medium bg-ink text-bg border border-transparent transition-[transform,background] active:translate-y-px hover:opacity-90 cursor-pointer"
            onClick={onOpenCmdK}
          >
            Explore this site
            <span className="font-mono opacity-60 text-[11px] ml-1">⌘K</span>
          </button>
          <a
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-[10px] text-[14px] font-medium bg-transparent text-ink border border-line-2 transition-[transform,background,border-color] active:translate-y-px hover:bg-bg-2 hover:border-ink-3"
            href={person.github} target="_blank" rel="noreferrer"
          >
            <Icon.github /> GitHub
          </a>
          <a
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-[10px] text-[14px] font-medium bg-transparent text-ink border border-line-2 transition-[transform,background,border-color] active:translate-y-px hover:bg-bg-2 hover:border-ink-3"
            href={person.linkedin} target="_blank" rel="noreferrer"
          >
            <Icon.linkedin /> LinkedIn
          </a>
        </div>

        <div
          className="hero-marquee mt-[60px] pt-6 border-t border-line w-[80vw] max-w-[1400px]"
          style={{ marginLeft: 'calc(50% - 40vw)', marginRight: 'calc(50% - 40vw)', alignSelf: 'center' }}
        >
          <div className="hero-marquee-track inline-flex animate-marquee font-display text-[20px] sm:text-[24px] md:text-[28px] font-normal text-ink-3 tracking-[-0.02em]">
            <span className="italic mr-10">full-stack</span>
            <span className="italic mr-10">mobile</span>
            <span className="italic mr-10">UI design</span>
            <span className="italic mr-10">problem solving</span>
            <span className="italic mr-10">full-stack</span>
            <span className="italic mr-10">mobile</span>
            <span className="italic mr-10">UI design</span>
            <span className="italic mr-10">problem solving</span>
          </div>
        </div>
      </div>
    </section>
  );
}
