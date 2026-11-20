'use client';

import { useState, useEffect } from 'react';
import { PORTFOLIO } from '../data.js';

const KEYWORDS = ['clean web apps.', 'mobile apps.', 'game worlds.', 'scalable systems.'];

/**
 * Rotating keyword in the headline's italic. Every word is stacked, invisible,
 * in one grid cell, so the slot is always as wide as the longest word and the
 * headline never reflows. The current word rises in while the previous one
 * lifts away; words always change whole, never letter by letter.
 */
function RotatingWord({ words, interval = 3200 }) {
  const [state, setState] = useState({ cur: 0, prev: null, n: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => ({ cur: (s.cur + 1) % words.length, prev: s.cur, n: s.n + 1 }));
    }, interval);
    return () => clearInterval(id);
  }, [words.length, interval]);

  return (
    <span className="hero-rotator" aria-hidden="true">
      {words.map((w) => (
        <span key={w} className="hero-word hero-word--ghost">{w}</span>
      ))}
      {state.prev !== null && (
        <span key={`out-${state.n}`} className="hero-word hero-word--out">{words[state.prev]}</span>
      )}
      <span key={`in-${state.n}`} className="hero-word hero-word--in">{words[state.cur]}</span>
    </span>
  );
}

const ArrowUpRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export function Hero({ onOpenCmdK }) {
  const { person } = PORTFOLIO;
  const stats = [
    { k: 'Projects', v: `${PORTFOLIO.projects.length}+` },
    { k: 'Stacks',   v: String(PORTFOLIO.skills.length) },
    { k: 'School',   v: 'CADT ’26' },
    { k: 'Based in', v: 'PP · KH' },
  ];

  return (
    <section id="home" className="hero min-h-screen pt-28 sm:pt-32 md:pt-40 pb-16 md:pb-20 relative overflow-hidden bg-bg">
      <div className="section-container flex flex-col items-start" style={{ maxWidth: 880 }}>

        <p className="hero-eyebrow">
          <i className="hero-eyebrow-dot" aria-hidden="true" />
          <span className="hero-eyebrow-status">Open to work</span>
          <span className="hero-eyebrow-sep" aria-hidden="true">·</span>
          <span>{person.location}</span>
        </p>

        <h1 className="hero-title">
          Rith Seyhak<span className="hero-index" aria-hidden="true">01</span>
          <br />
          builds{' '}
          <span className="sr-only">clean web apps, mobile apps, game worlds and scalable systems.</span>
          <RotatingWord words={KEYWORDS} />
        </h1>

        <p className="hero-lede">
          <strong>Software engineer</strong> in Phnom Penh, Cambodia — currently studying CS at CADT.
          I spend my evenings turning ideas into code, from POS systems to tower-defense games.
        </p>

        <dl className="hero-stats">
          {stats.map(({ k, v }) => (
            <div key={k} className="hero-stat">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="hero-actions">
          <button type="button" className="hero-cta" onClick={onOpenCmdK}>
            <span className="hero-cta-label">Explore this site</span>
          </button>
          <a className="hero-link" href={person.github} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight />
          </a>
          <a className="hero-link" href={person.linkedin} target="_blank" rel="noreferrer">
            LinkedIn <ArrowUpRight />
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
