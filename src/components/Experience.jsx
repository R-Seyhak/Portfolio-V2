'use client';

import { useState } from 'react';
import { PORTFOLIO } from '../data.js';
import { useReveal, Icon } from './primitives.jsx';

export function Experience() {
  const { experience } = PORTFOLIO;
  const [certOpen, setCertOpen] = useState(false);
  const ref = useReveal();

  return (
    <section id="experience" className="py-[var(--section-y)] relative bg-bg-2">
      <div className="section-container">
        <div className="section-header">
          <div className="font-display italic text-[15px] text-ink-3">/ 05 · path</div>
          <div>
            <h2 className="font-display font-medium text-ink tracking-[-0.025em] leading-none" style={{ fontSize: 'clamp(36px,5.5vw,64px)' }}>
              The road<br />so far.
            </h2>
            <p className="mt-3.5 max-w-[560px] text-ink-2 text-[15px] leading-relaxed">
              Work, education, volunteering, and the odd side quest. Still early, still learning.
            </p>
          </div>
        </div>

        <div className="reveal" ref={ref}>
          <div className="timeline">
            {experience.map((e) => (
              <div key={e.id} className="timeline-item" data-type={e.type}>
                <div className="font-display italic text-[14px] text-ink-3 pt-1">
                  {e.type}
                  <span className="block text-ink font-medium mt-1 text-[14px]">{e.duration}</span>
                </div>
                <div className="timeline-body">
                  <h4 className="font-display text-[24px] font-medium tracking-[-0.02em] leading-[1.2]">{e.role}</h4>
                  <div className="mt-1 text-[14px] text-ink-2">{e.org} · {e.location}</div>
                  <p className="mt-3.5 text-[15px] text-ink-2 leading-relaxed max-w-[620px]">{e.description}</p>
                  {e.highlights && (
                    <ul className="mt-3 list-none p-0">
                      {e.highlights.map((h) => (
                        <li key={h} className="flex gap-2.5 items-start text-[14px] text-ink-2 py-1">
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.certificate && (
                    <button
                      className="mt-[18px] inline-flex items-center gap-2 px-3.5 py-[7px] text-[14px] border border-accent text-accent bg-accent-soft rounded-full font-display italic transition-all hover:bg-accent hover:text-white"
                      onClick={() => setCertOpen(true)}
                    >
                      <Icon.cert /> View certificate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {certOpen && (
        <div
          className="fixed inset-0 grid place-items-center p-5 z-[100]"
          style={{ background: 'oklch(0% 0 0 / 0.7)', backdropFilter: 'blur(6px)', animation: 'fade-in 0.15s' }}
          onClick={() => setCertOpen(false)}
        >
          <div
            className="relative bg-bg rounded-design-lg max-w-[720px] w-full p-10 border border-line"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3.5 right-3.5 w-[34px] h-[34px] rounded-full bg-bg-2 border border-line grid place-items-center text-[16px] text-ink-2"
              onClick={() => setCertOpen(false)}
            >
              <Icon.close />
            </button>
            <div className="flex items-center gap-2 font-display italic text-[13.5px] font-medium text-ink-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              Certificate
            </div>
            <h3 className="font-display text-[32px] font-medium mt-2 tracking-[-0.02em]">STEM Festival 2025</h3>
            <div className="mt-5 rounded-[14px] overflow-hidden border border-line">
              <img src="/photos/STEM Certificate.png" alt="STEM Festival 2025 Certificate" className="w-full block" />
            </div>
            <p className="mt-[18px] text-[14px] text-ink-2 leading-relaxed">
              Issued to Rith Seyhak for transportation coordination at the Annual STEM Festival, Phnom Penh, 2025.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
