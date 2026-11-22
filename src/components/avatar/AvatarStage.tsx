'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { AvatarEffects } from './AvatarEffects';
import { AvatarFallback } from './AvatarFallback';
import { AvatarLoader } from './AvatarLoader';
import {
  cancelModelDownload,
  isSiteRevealed,
  loaderDone,
  useSiteRevealed,
} from '../loader/loaderClient';
import { ANIMATION, AVATAR_LABEL, POINTER } from './avatar.config';
import type { LookTarget, RithAvatarHandle } from './avatar.types';
import { useAvatarBehavior } from './useAvatarBehavior';
import { useAvatarDrag } from './useAvatarDrag';
import { useInView, usePageVisible } from './useInView';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const AvatarCanvas = dynamic(() => import('./AvatarCanvas'), { ssr: false });

type StageState = 'static' | 'loading' | 'live';

class AvatarErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));

/** The loading screen only waits for the avatar when the visitor lands on the Hero. */
function landsOnHero(stage: HTMLElement | null) {
  if (!stage || (window.location.hash && window.location.hash !== '#home')) return false;
  const rect = stage.getBoundingClientRect();
  return rect.top < window.innerHeight + 400 && rect.bottom > -400;
}

/**
 * The Hero's right column. The static image is server-rendered so the layout
 * is complete on first paint; the 3D bundle loads afterwards and fades in.
 */
export function AvatarStage({ trackRef }: { trackRef: RefObject<HTMLElement> }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<RithAvatarHandle>(null);
  const lookTarget = useRef<LookTarget>({ x: 0, y: 0, active: false });
  const greeted = useRef(false);

  const [state, setState] = useState<StageState>('static');
  const reducedMotion = usePrefersReducedMotion();
  const pageVisible = usePageVisible();
  const nearView = useInView(stageRef, { rootMargin: '400px' });
  const onScreen = useInView(stageRef);
  const mostlyOnScreen = useInView(stageRef, { threshold: 0.45 });
  const active = onScreen && pageVisible;
  const revealed = useSiteRevealed();
  // Nothing behind the loading screen counts toward the idle and sleep timers.
  const { mode, activate, greet } = useAvatarBehavior(
    avatarRef,
    state === 'live',
    active && revealed,
    reducedMotion,
  );
  const { drag, dragging, handlers: dragHandlers } = useAvatarDrag();

  const showStatic = useCallback(() => setState('static'), []);
  const markReady = useCallback(() => {
    setState('live');
    loaderDone('code', 'model', 'scene');
  }, []);

  // Without 3D, the loading screen waits for the static image instead.
  const settleOnFallback = useCallback(() => {
    const finish = () => loaderDone('code', 'model', 'scene');
    const image = stageRef.current?.querySelector('img');
    if (image) image.decode().then(finish, finish);
    else finish();
  }, []);

  const waitsForAvatar = useRef(false);
  useEffect(() => {
    loaderDone('app');
    waitsForAvatar.current = !isSiteRevealed() && landsOnHero(stageRef.current);
    if (!waitsForAvatar.current) loaderDone('code', 'model', 'scene');
  }, []);

  // Behind the loading screen the 3D starts at once. Otherwise it waits for idle time.
  const [shouldMount, setShouldMount] = useState(false);
  const gaveUp = useRef(false);
  useEffect(() => {
    // A direct link to another section can still be scrolling there until the reveal.
    const scrolledNear = nearView && revealed;
    if (shouldMount || gaveUp.current || (!scrolledNear && !waitsForAvatar.current)) return;
    if (!supportsWebGL()) {
      gaveUp.current = true;
      cancelModelDownload(); // No WebGL, so don't spend the visitor's data on the model.
      settleOnFallback();
      return;
    }
    const start = () => {
      setState('loading');
      setShouldMount(true);
    };
    if (waitsForAvatar.current) {
      start();
      return;
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 300);
    return () => clearTimeout(id);
  }, [nearView, revealed, shouldMount, settleOnFallback]);

  // Greet once per page visit, after the reveal, with the model drawn and in view.
  useEffect(() => {
    if (
      !revealed ||
      state !== 'live' ||
      mode !== 'idle' ||
      !mostlyOnScreen ||
      !pageVisible ||
      reducedMotion ||
      greeted.current
    ) {
      return;
    }
    const id = setTimeout(() => {
      greeted.current = greet();
    }, ANIMATION.greetingDelayMs);
    return () => clearTimeout(id);
  }, [revealed, state, mode, mostlyOnScreen, pageVisible, reducedMotion, greet]);

  // Keep the question marks and Zzz anchored to the head at any stage size.
  useEffect(() => {
    const stage = stageRef.current;
    if (state !== 'live' || mode === 'idle' || !stage) return;
    const place = () => {
      const anchor = avatarRef.current?.headAnchor();
      if (!anchor) return;
      stage.style.setProperty('--av-head-x', `${(anchor.x * 100).toFixed(2)}%`);
      stage.style.setProperty('--av-head-right', `${(anchor.right * 100).toFixed(2)}%`);
      stage.style.setProperty('--av-head-top', `${(anchor.top * 100).toFixed(2)}%`);
    };
    place();
    window.addEventListener('resize', place, { passive: true });
    return () => window.removeEventListener('resize', place);
  }, [state, mode]);

  // Head and eyes follow a mouse across the Hero. Touch has no cursor to follow.
  useEffect(() => {
    const host = trackRef.current;
    const stage = stageRef.current;
    const target = lookTarget.current;
    if (state !== 'live' || reducedMotion || !host || !stage) {
      target.active = false;
      return;
    }

    let frame = 0;
    let clientX = 0;
    let clientY = 0;

    const update = () => {
      frame = 0;
      const rect = stage.getBoundingClientRect();
      const faceX = rect.left + rect.width / 2;
      const faceY = rect.top + rect.height * POINTER.faceY;
      target.x = clampUnit((clientX - faceX) / (window.innerWidth * 0.5));
      target.y = clampUnit((faceY - clientY) / (window.innerHeight * 0.5));
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      clientX = event.clientX;
      clientY = event.clientY;
      target.active = true;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') target.active = false;
    };

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave, { passive: true });
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      target.active = false;
    };
  }, [state, reducedMotion, trackRef]);

  const failed = useCallback(() => {
    gaveUp.current = true;
    setShouldMount(false);
    showStatic();
    settleOnFallback();
  }, [showStatic, settleOnFallback]);

  const smile = (value: number) => avatarRef.current?.setMorph('smile', value);
  const hoverOn = () => {
    smile(ANIMATION.hoverSmile);
    avatarRef.current?.setHover(true);
    if (mode !== 'sleeping' && mode !== 'fallingAsleep') avatarRef.current?.blink();
  };
  const hoverOff = () => {
    smile(0);
    avatarRef.current?.setHover(false);
  };

  return (
    <div ref={stageRef} className="av-stage" data-state={state} data-dragging={dragging || undefined}>
      <div className="av-visual" role="img" aria-label={AVATAR_LABEL}>
        <AvatarFallback />
        {shouldMount && (
          <AvatarErrorBoundary onError={failed}>
            <AvatarCanvas
              avatarRef={avatarRef}
              active={active || state === 'loading'}
              lookTarget={lookTarget}
              drag={drag}
              reducedMotion={reducedMotion}
              onReady={markReady}
              onContextLost={failed}
            />
          </AvatarErrorBoundary>
        )}
      </div>

      {state === 'loading' && <AvatarLoader />}

      {state === 'live' && (
        <button
          type="button"
          className="av-hit"
          aria-label={mode === 'sleeping' ? 'Wake up the 3D avatar' : 'Say hello to the 3D avatar'}
          onClick={activate}
          {...dragHandlers}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') hoverOn();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') hoverOff();
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(':focus-visible')) hoverOn();
          }}
          onBlur={hoverOff}
        />
      )}

      {state === 'live' && <AvatarEffects mode={mode} />}
    </div>
  );
}
