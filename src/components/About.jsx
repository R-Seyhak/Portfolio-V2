'use client';

import { useEffect, useRef } from 'react';
import { PORTFOLIO } from '../data.js';
import { useTilt } from './motion.js';

const pad = (n) => String(n).padStart(2, '0');

/**
 * One-shot reveals for every [data-reveal] block in the section (a single
 * IntersectionObserver), plus a gentle scroll parallax on the portrait whose
 * listener only runs while the portrait is on screen.
 */
function useAboutMotion() {
  const rootRef = useRef(null);
  const figRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const fig = figRef.current;
    if (!root) return;

    const targets = root.querySelectorAll('[data-reveal]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach((el) => el.setAttribute('data-in', ''));
      return;
    }

    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.setAttribute('data-in', '');
        reveal.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((el) => reveal.observe(el));

    // Parallax: -1 (portrait below centre) … 1 (above centre).
    let raf = 0;
    let listening = false;
    const update = () => {
      raf = 0;
      const r = fig.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = (vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2);
      fig.style.setProperty('--ab-par', Math.max(-1, Math.min(1, p)).toFixed(3));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const watch = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === listening) return;
      listening = e.isIntersecting;
      window[listening ? 'addEventListener' : 'removeEventListener']('scroll', schedule, { passive: true });
      if (listening) schedule();
    });
    if (fig) watch.observe(fig);

    return () => {
      reveal.disconnect();
      watch.disconnect();
      window.removeEventListener('scroll', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return { rootRef, figRef };
}

export function About() {
  const { person } = PORTFOLIO;
  const { rootRef, figRef } = useAboutMotion();
  const tiltRef = useTilt({ max: 3 });

  const facts = [
    { k: 'Based in', v: person.location },
    {
      k: 'Studying',
      v: <>Computer Science <span className="ab-dim">— Cambodia Academy of Digital Technology, ’26</span></>,
    },
    { k: 'Focus', v: 'Full-stack · Mobile' },
    { k: 'Status', v: <span className="ab-status"><i aria-hidden="true" />Open to work</span> },
  ];

  return (
    <section id="about" className="ab" ref={rootRef}>
      <div className="section-container">
        <div className="ab-head" data-reveal>
          <span>/ 02 · about</span>
          <span className="ab-rule" aria-hidden="true" />
          <span>Profile</span>
        </div>

        <h2 className="ab-title" data-reveal>
          <span className="ab-line"><span style={{ '--k': 0 }}>A student, builder,</span></span>
          <span className="ab-line ab-line--indent">
            <span style={{ '--k': 1 }}>&amp; <em>curious generalist.</em></span>
          </span>
        </h2>

        <div className="ab-body">
          <div className="ab-left">
            <figure className="ab-figure" ref={figRef} data-reveal>
              <div className="ab-depth" ref={tiltRef}>
                <span className="ab-frame" aria-hidden="true"><i /></span>
                <div className="ab-card" data-tilt>
                  <div className="ab-portrait">
                    <div className="ab-portrait-par">
                      <img
                        src="/photos/about.png"
                        alt="Portrait of Rith Seyhak"
                        width={850}
                        height={1106}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <figcaption className="ab-caption">
                <span className="ab-caption-fig">Fig. 01</span>
                <span className="ab-caption-rule" aria-hidden="true" />
                <b>Rith Seyhak</b>
                <span className="ab-caption-meta">Software Engineering · CADT ’26</span>
              </figcaption>
              <span className="ab-coords" aria-hidden="true">Phnom Penh · 11.56° N 104.92° E</span>
            </figure>

            <div className="ab-interests" data-reveal>
              <p className="ab-kicker">Interests <span>({pad(person.interests.length)})</span></p>
              <ul className="ab-kw" role="list">
                {person.interests.map((t, i) => (
                  <li key={t} style={{ '--k': i }}>
                    <span className="ab-kw-n">{pad(i + 1)}</span>
                    <span className="ab-kw-t">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="ab-copy">
            <p className="ab-stand" data-reveal>
              I’m an aspiring software engineer based in Phnom Penh.{' '}
              <span className="ab-stand-2">I like making things that feel as good to use as they are useful.</span>
            </p>

            <div className="ab-text" data-reveal>
              <p>
                <b>I’m Rith Seyhak</b>, a full-stack developer leaning toward design. Most of my work lives
                at the intersection of <span className="ab-tech">Flutter</span>, <span className="ab-tech">React</span>,
                and <span className="ab-tech">Node</span> — but I’ll pick up whatever the problem calls for, from{' '}
                <span className="ab-tech">Unity C#</span> for a game jam to <span className="ab-tech">PostgreSQL</span> for
                a pay-as-you-go POS.
              </p>
              <p>{person.bio_long}</p>
            </div>

            <dl className="ab-index" data-reveal>
              {facts.map((f, i) => (
                <div key={f.k} className="ab-row" style={{ '--k': i }}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
