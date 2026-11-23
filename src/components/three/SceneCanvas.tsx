'use client';

import * as THREE from 'three';
import { useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, View } from '@react-three/drei';
import { DPR_RANGE, LIGHTING } from './scene.config';
import { reportSceneFailure, useSceneCanvas } from './sceneStore';
import { SharedEnvironment } from './StageLighting';

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
 * The page's one WebGL canvas. It stays fixed behind the content, and each
 * section draws into it through a <SceneView>. Opaque sections cover it as they
 * scroll past. 100vh is the tallest viewport on phones, so the canvas doesn't
 * reallocate every time the address bar shows or hides.
 */
export default function SceneCanvas() {
  const { rendering, visible } = useSceneCanvas();
  const [dpr, setDpr] = useState<number | [number, number]>(DPR_RANGE);

  return (
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
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        zIndex: -1,
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
      <ContextGuard />
      <ClearEachFrame />
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <SharedEnvironment />
      <View.Port />
    </Canvas>
  );
}
