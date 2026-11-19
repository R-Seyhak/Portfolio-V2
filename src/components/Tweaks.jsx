'use client';

import { cn } from './primitives.jsx';

export function Tweaks({ visible, state, setState }) {
  if (!visible) return null;

  function set(k, v) {
    const next = { ...state, [k]: v };
    setState(next);
    window.parent?.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  }

  return (
    <div className="fixed bottom-6 right-6 w-[300px] bg-bg border border-line-2 rounded-[14px] p-[18px] z-[90] flex flex-col gap-3.5"
      style={{ boxShadow: '0 20px 60px -20px oklch(0% 0 0 / 0.3)' }}
    >
      <div className="flex justify-between items-center pb-2.5 border-b border-line">
        <div className="font-semibold text-[14px] before:content-['◆'] before:text-accent before:mr-2 before:text-[10px]">
          Tweaks
        </div>
        <span className="font-mono text-[11px] text-ink-3">live</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="font-mono text-[11px] text-ink-3 uppercase tracking-[0.08em] flex justify-between">
          Theme <span className="text-ink normal-case">{state.theme}</span>
        </div>
        <div className="grid grid-flow-col gap-1 p-[3px] bg-bg-2 border border-line rounded-lg">
          {['paper', 'sepia', 'dark'].map((t) => (
            <button
              key={t}
              className={cn('py-1.5 px-1 text-[12px] text-ink-2 rounded-[5px]', state.theme === t && 'bg-ink text-bg')}
              onClick={() => set('theme', t)}
            >{t}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="font-mono text-[11px] text-ink-3 uppercase tracking-[0.08em] flex justify-between">
          Accent hue <span className="text-ink normal-case">{state.accentHue}°</span>
        </div>
        <input
          type="range" min="0" max="360" value={state.accentHue}
          className="w-full accent-accent"
          onChange={(e) => set('accentHue', +e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="font-mono text-[11px] text-ink-3 uppercase tracking-[0.08em] flex justify-between">
          Density <span className="text-ink normal-case">{state.density}</span>
        </div>
        <div className="grid grid-flow-col gap-1 p-[3px] bg-bg-2 border border-line rounded-lg">
          {['roomy', 'compact'].map((d) => (
            <button
              key={d}
              className={cn('py-1.5 px-1 text-[12px] text-ink-2 rounded-[5px]', state.density === d && 'bg-ink text-bg')}
              onClick={() => set('density', d)}
            >{d}</button>
          ))}
        </div>
      </div>

      {[
        { key: 'cursorGlow', label: 'Cursor glow' },
        { key: 'grain',      label: 'Paper grain' },
      ].map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <div
            className={cn('flex items-center justify-between px-2.5 py-1.5 bg-bg-2 border border-line rounded-lg text-[12px] cursor-pointer', state[key] && 'toggle-on')}
            onClick={() => set(key, !state[key])}
          >
            <span>{label}</span>
            <div className="toggle-switch" />
          </div>
        </div>
      ))}
    </div>
  );
}
