'use client';

import * as THREE from 'three';
import { Suspense, memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { EventManager } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import RithAvatar from './RithAvatar';
import { CAMERA_FOV, DRAG, FRAMING, LIGHTING, MOBILE_BELOW_PX } from './avatar.config';
import type { DragTargetRef, LookTargetRef, RithAvatarHandle } from './avatar.types';

export interface AvatarCanvasProps {
  avatarRef: Ref<RithAvatarHandle>;
  /** False while off-screen or in a hidden tab: rendering stops completely. */
  active: boolean;
  lookTarget: LookTargetRef;
  drag: DragTargetRef;
  reducedMotion: boolean;
  onReady: () => void;
  onContextLost: () => void;
}

const DPR_RANGE: [number, number] = [1, 1.5];

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

/**
 * Turns the avatar while it's dragged and springs it back on release. The shadow
 * sits in the outer group, so it turns with him but doesn't tilt.
 */
function Turntable({
  drag,
  reducedMotion,
  shadow,
  children,
}: {
  drag: DragTargetRef;
  reducedMotion: boolean;
  shadow: ReactNode;
  children: ReactNode;
}) {
  const turn = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const motion = useRef({ yaw: 0, yawSpeed: 0, pitch: 0, pitchSpeed: 0 });

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const state = motion.current;
    const input = drag.current;

    if (input.active) {
      state.yaw = THREE.MathUtils.damp(state.yaw, input.yaw, DRAG.followSpeed, delta);
      state.pitch = THREE.MathUtils.damp(state.pitch, input.pitch, DRAG.followSpeed, delta);
      state.yawSpeed = 0;
      state.pitchSpeed = 0;
    } else if (state.yaw || state.pitch || state.yawSpeed || state.pitchSpeed) {
      const damping = reducedMotion ? DRAG.reducedDamping : DRAG.damping;
      state.yawSpeed += (-DRAG.stiffness * state.yaw - damping * state.yawSpeed) * delta;
      state.pitchSpeed += (-DRAG.stiffness * state.pitch - damping * state.pitchSpeed) * delta;
      state.yaw += state.yawSpeed * delta;
      state.pitch += state.pitchSpeed * delta;
      const settled =
        Math.abs(state.yaw) + Math.abs(state.pitch) < 5e-4 &&
        Math.abs(state.yawSpeed) + Math.abs(state.pitchSpeed) < 5e-3;
      if (settled) state.yaw = state.pitch = state.yawSpeed = state.pitchSpeed = 0;
    }

    input.currentYaw = state.yaw;
    if (turn.current) turn.current.rotation.y = state.yaw;
    if (tilt.current) tilt.current.rotation.x = state.pitch;
  });

  return (
    <group ref={turn}>
      <group ref={tilt}>{children}</group>
      {shadow}
    </group>
  );
}

// Memoized so a change of interaction mode never re-renders the 3D scene.
export default memo(function AvatarCanvas({
  avatarRef,
  active,
  lookTarget,
  drag,
  reducedMotion,
  onReady,
  onContextLost,
}: AvatarCanvasProps) {
  const [dpr, setDpr] = useState<number | [number, number]>(DPR_RANGE);
  const [scale] = useState(() => framingFor(window.innerWidth).scale);

  return (
    <Canvas
      className="av-canvas"
      aria-hidden="true"
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
        <Turntable
          drag={drag}
          reducedMotion={reducedMotion}
          shadow={
            // Must sit below y = 0: drei blurs on a plane at the world origin, and
            // from above that plane is behind the shadow camera and wipes the result.
            <ContactShadows
              position={[0, -0.002, 0]}
              frames={1}
              resolution={256}
              opacity={LIGHTING.shadow.opacity}
              blur={LIGHTING.shadow.blur}
              scale={LIGHTING.shadow.scale}
              far={LIGHTING.shadow.far}
            />
          }
        >
          <RithAvatar
            ref={avatarRef}
            scale={scale}
            active={active}
            lookTarget={lookTarget}
            drag={drag}
            reducedMotion={reducedMotion}
            onReady={onReady}
          />
        </Turntable>
      </Suspense>
    </Canvas>
  );
});
