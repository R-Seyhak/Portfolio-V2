'use client';

import * as THREE from 'three';
import { useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, View } from '@react-three/drei';
import { DPR_RANGE, LIGHTING } from './scene.config';
import { reportSceneFailure, useSceneCanvas } from './sceneStore';
import { SharedEnvironment } from './StageLighting';

const OVERSCAN_PX = 140;

function ContextGuard() {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', reportSceneFailure);
    return () => canvas.removeEventListener('webglcontextlost', reportSceneFailure);
  }, [canvas]);
  return null;
}

/**
 * Views draw with auto-clear off, so the canvas is wiped once at the start of
 * each frame. Nothing from a previous frame can linger when a View moves.
 */
function ClearEachFrame() {
  useFrame(({ gl }) => {
    gl.setRenderTarget(null);
    gl.clear(true, true, false);
  });
  return null;
}

/**
 * Puts the canvas where the page has scrolled to, once per frame. Between frames
 * the browser scrolls it along with the content, so a touch fling can't pull the
 * 3D away from the text around it, which a position: fixed canvas would allow.
 */
function AnchorToPage() {
  useFrame((state) => {
    const layer = state.gl.domElement.closest<HTMLElement>('.scene-layer');
    if (!layer) return;
    const ratio = window.devicePixelRatio || 1;
    layer.style.setProperty('--scene-y', `${Math.round(window.scrollY * ratio) / ratio}px`);
    // Views are placed from the viewport's top, which is where this frame's canvas starts.
    const { size } = state;
    if (size.top !== 0 || size.left !== 0) state.setSize(size.width, size.height, size.updateStyle, 0, 0);
  }, -2);
  return null;
}

/** Set before the canvas first measures itself, so it never starts out of place. */
function placeLayer(layer: HTMLDivElement | null) {
  if (layer && !layer.style.getPropertyValue('--scene-y')) {
    layer.style.setProperty('--scene-y', `${window.scrollY}px`);
  }
}

/**
 * The page's one WebGL canvas. It sits behind the content, and each section
 * draws into it through a <SceneView>. Opaque sections cover it as they scroll
 * past. 100vh is the tallest viewport on phones, so the canvas doesn't
 * reallocate every time the address bar shows or hides. The extra height keeps
 * 3D drawn just below the fold, ready for a fast swipe.
 */
export default function SceneCanvas() {
  const { rendering, visible } = useSceneCanvas();
  const [dpr, setDpr] = useState<number | [number, number]>(DPR_RANGE);

  return (
    <div ref={placeLayer} className="scene-layer">
    <Canvas
      className="scene-canvas"
      data-visible={visible || undefined}
      aria-hidden="true"
      eventSource={document.body}
      eventPrefix="client"
      dpr={dpr}
      frameloop={rendering ? 'always' : 'never'}
      resize={{ scroll: false }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `calc(100vh + ${OVERSCAN_PX}px)`,
        transform: 'translate3d(0, var(--scene-y, 0px), 0)',
        willChange: 'transform',
        pointerEvents: 'none',
      }}
      gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        // Measured against the supplied render, ACES at this exposure matched the
        // skin and clothing colours about three times more closely than Neutral.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = LIGHTING.exposure;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <AnchorToPage />
      <ContextGuard />
      <ClearEachFrame />
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <SharedEnvironment />
      <View.Port />
    </Canvas>
    </div>
  );
}
