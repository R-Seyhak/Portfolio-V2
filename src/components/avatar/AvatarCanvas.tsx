'use client';

import * as THREE from 'three';
import { Suspense, memo, useEffect, useLayoutEffect, useState } from 'react';
import type { Ref } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { EventManager } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import RithAvatar from './RithAvatar';
import { CAMERA_FOV, FRAMING, LIGHTING, MOBILE_BELOW_PX } from './avatar.config';
import type { LookTargetRef, RithAvatarHandle } from './avatar.types';

export interface AvatarCanvasProps {
  avatarRef: Ref<RithAvatarHandle>;
  /** False while off-screen or in a hidden tab: rendering stops completely. */
  active: boolean;
  lookTarget: LookTargetRef;
  reducedMotion: boolean;
  onReady: () => void;
  onContextLost: () => void;
}

const DPR_RANGE: [number, number] = [1, 1.75];

// Hover, click and scroll are handled by the DOM, so no raycasts run against
// the 78k-triangle skinned mesh and the canvas can never trap a touch or wheel.
const noPointerEvents = (): EventManager<HTMLElement> => ({ enabled: false, priority: 0 });

const framingFor = (width: number) =>
  width < MOBILE_BELOW_PX ? FRAMING.mobile : FRAMING.desktop;

function CameraRig() {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useLayoutEffect(() => {
    if (!height) return;
    const { position, target, minAspect } = framingFor(window.innerWidth);
    const pullBack = Math.max(1, minAspect / (width / height));
    camera.position.set(position[0], position[1], position[2] * pullBack);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
  }, [camera, width, height]);

  return null;
}

function ContextGuard({ onLost }: { onLost: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [canvas, onLost]);
  return null;
}

// Memoized so a change of interaction mode never re-renders the 3D scene.
export default memo(function AvatarCanvas({
  avatarRef,
  active,
  lookTarget,
  reducedMotion,
  onReady,
  onContextLost,
}: AvatarCanvasProps) {
  const [dpr, setDpr] = useState<number | [number, number]>(DPR_RANGE);
  const [scale] = useState(() => framingFor(window.innerWidth).scale);

  return (
    <Canvas
      className="av-canvas"
      dpr={dpr}
      frameloop={active ? 'always' : 'never'}
      events={noPointerEvents}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 20, position: [...FRAMING.desktop.position] }}
      onCreated={({ gl }) => {
        // Measured against the supplied render, ACES at this exposure matched the
        // skin and clothing colours about three times more closely than Neutral.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = LIGHTING.exposure;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <CameraRig />
      <ContextGuard onLost={onContextLost} />
      <PerformanceMonitor onDecline={() => setDpr(1)} />

      <ambientLight intensity={LIGHTING.ambient} />
      <directionalLight position={[...LIGHTING.key.position]} intensity={LIGHTING.key.intensity} />
      <directionalLight position={[...LIGHTING.rim.position]} intensity={LIGHTING.rim.intensity} />

      <Suspense fallback={null}>
        {/* Built locally: the HDR presets would add a runtime request to a third-party CDN. */}
        <Environment resolution={64} frames={1} environmentIntensity={LIGHTING.environment}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[8, 4, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[-4, 1, 3]} scale={[4, 6, 1]} />
          <Lightformer form="rect" intensity={0.8} position={[4, 1, 2]} scale={[4, 6, 1]} />
        </Environment>
        <RithAvatar
          ref={avatarRef}
          scale={scale}
          active={active}
          lookTarget={lookTarget}
          reducedMotion={reducedMotion}
          onReady={onReady}
        />
        <ContactShadows
          position={[0, 0.001, 0]}
          frames={1}
          resolution={256}
          opacity={LIGHTING.shadow.opacity}
          blur={LIGHTING.shadow.blur}
          scale={LIGHTING.shadow.scale}
          far={LIGHTING.shadow.far}
        />
      </Suspense>
    </Canvas>
  );
});
