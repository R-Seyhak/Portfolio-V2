'use client';

import { useState, useEffect } from 'react';
import { useMouse } from './primitives.jsx';
import { useSectionHeaderReveal } from './motion.js';
import { TopBar, LeftRail, CmdK } from './Chrome.jsx';
import { Hero } from './Hero.jsx';
import { About } from './About.jsx';
import { Skills } from './Skills.jsx';
import { Projects } from './Projects.jsx';
import { Experience } from './Experience.jsx';
import { Contact } from './Contact.jsx';
import { Tweaks } from './Tweaks.jsx';
import { SceneCanvasHost } from './three/SceneCanvasHost';

const TWEAK_DEFAULTS = {
  accentHue: 250,
  emberHue: 40,
  theme: 'paper',
  density: 'roomy',
  cursorGlow: false,
  grain: true,
};

export function App() {
  const [tweakState, setTweakState] = useState(TWEAK_DEFAULTS);
  const [tweaksVisible, setTweaksVisible] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [activeTech, setActiveTech] = useState(null);

  useMouse(tweakState.cursorGlow);
  useSectionHeaderReveal();

  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute('data-theme', tweakState.theme || 'paper');
    r.setAttribute('data-density', tweakState.density || 'roomy');
    r.style.setProperty('--hue-accent', tweakState.accentHue ?? 250);
    r.style.setProperty('--hue-ember', tweakState.emberHue ?? 40);
    document.body.classList.toggle('grain', !!tweakState.grain);
  }, [tweakState]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onMsg(e) {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === '__activate_edit_mode') setTweaksVisible(true);
      if (d.type === '__deactivate_edit_mode') setTweaksVisible(false);
    }
    window.addEventListener('message', onMsg);
    window.parent?.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function setTheme(t) { setTweakState((s) => ({ ...s, theme: t })); }

  return (
    <>
      <SceneCanvasHost />
      {tweakState.cursorGlow && <div className="cursor-glow" />}
      <TopBar onOpenCmdK={() => setCmdOpen(true)} />
      <LeftRail />
      <Hero onOpenCmdK={() => setCmdOpen(true)} />
      <About />
      <Skills activeTech={activeTech} />
      <Projects
        onTechHover={(techs) => setActiveTech(techs)}
        onTechLeave={() => setActiveTech(null)}
      />
      <Experience />
      <Contact />
      <CmdK open={cmdOpen} onClose={() => setCmdOpen(false)} setTheme={setTheme} theme={tweakState.theme} />
      <Tweaks visible={tweaksVisible} state={tweakState} setState={setTweakState} />
    </>
  );
}
