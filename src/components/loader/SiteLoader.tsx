import { LOADER_SCRIPT } from './loaderScript';

const STYLES = `
#site-loader {
  --sl-bg: oklch(98.5% .006 85); --sl-ink: oklch(22% .012 70); --sl-ink-2: oklch(44% .012 70);
  --sl-line: oklch(89% .012 85); --sl-accent: oklch(62% .18 250);
  position: fixed; inset: 0; z-index: 10000;
  display: grid; place-items: center;
  padding: 24px;
  box-sizing: border-box;
  background: var(--sl-bg);
  color: var(--sl-ink);
  touch-action: none;
  opacity: 1;
  transition: opacity 650ms cubic-bezier(.4, 0, .2, 1);
  animation: sl-failsafe .4s linear 14s forwards;
}
#site-loader[hidden] { display: none; }
#site-loader[data-leaving] { opacity: 0; pointer-events: none; animation: none; }
@keyframes sl-failsafe { to { opacity: 0; visibility: hidden; } }
.sl-inner { width: min(340px, 100%); }
.sl-name, .sl-msg { margin: 0; opacity: 0; transition: opacity .35s ease; }
#site-loader[data-type] .sl-name, #site-loader[data-type] .sl-msg { opacity: 1; }
.sl-name {
  font: 400 clamp(40px, 9vw, 54px)/1.04 "Fraunces", Georgia, "Times New Roman", serif;
  font-variation-settings: "opsz" 144;
  letter-spacing: -.035em;
}
.sl-msg {
  margin-top: 10px;
  font: italic 400 17px/1.4 "Fraunces", Georgia, "Times New Roman", serif;
  color: var(--sl-ink-2);
}
.sl-track {
  position: relative; overflow: hidden;
  height: 2px; margin-top: 34px;
  background: var(--sl-line);
}
.sl-fill {
  position: absolute; inset: 0;
  background: var(--sl-accent);
  transform: scaleX(0);
  transform-origin: left;
}
.sl-meta {
  display: flex; justify-content: space-between; gap: 16px;
  margin: 12px 0 0;
  font: 400 12.5px/1.4 "Inter", ui-sans-serif, system-ui, sans-serif;
  color: var(--sl-ink-2);
}
.sl-pct { font-variant-numeric: tabular-nums; }
#site-loader[data-indeterminate] .sl-pct { visibility: hidden; }
#site-loader[data-indeterminate] .sl-fill {
  width: 34%; right: auto;
  transform: none;
  animation: sl-slide 1.5s ease-in-out infinite;
}
@keyframes sl-slide {
  from { translate: -100% 0; }
  to   { translate: 300% 0; }
}
html[data-site-loading] { scrollbar-gutter: stable; scroll-behavior: auto; }
html[data-site-loading] body { overflow: hidden; }
@media (prefers-reduced-motion: reduce) {
  #site-loader { transition-duration: 160ms; }
  .sl-name, .sl-msg { transition: none; }
  #site-loader[data-indeterminate] .sl-fill { width: 100%; opacity: .45; animation: none; }
}
`;

const MARKUP = `<div class="sl-inner">
<p class="sl-name">Rith Seyhak</p>
<p class="sl-msg">Tidying things up...</p>
<div class="sl-track" role="progressbar" aria-label="Loading portfolio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="sl-fill"></span></div>
<p class="sl-meta"><span>Loading experience</span><span class="sl-pct">0%</span></p>
</div>`;

/**
 * Full-screen loader. It is plain server-rendered HTML with inline CSS and JS,
 * so it paints before React loads. React never updates anything inside it.
 */
export function SiteLoader() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <noscript>
        <style>{'#site-loader{display:none}'}</style>
      </noscript>
      <div id="site-loader" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: MARKUP }} />
      <script dangerouslySetInnerHTML={{ __html: LOADER_SCRIPT }} />
    </>
  );
}
