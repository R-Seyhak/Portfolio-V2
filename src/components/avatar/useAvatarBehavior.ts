import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { SLEEP } from './avatar.config';
import type { AvatarMode, RithAvatarHandle } from './avatar.types';

/** A click that lands this soon after it cancelled a doze should not also start a reaction. */
const CANCEL_CLICK_GUARD_MS = 700;

/**
 * The avatar's interaction state machine:
 *
 *   idle ──click──▶ brainLoading ──finished──▶ idle
 *   idle ──30 s without activity──▶ fallingAsleep ──finished──▶ sleeping
 *   fallingAsleep ──any activity──▶ idle
 *   sleeping ──click──▶ wakingUp ──finished──▶ idle
 *
 * The current mode lives in a ref so decisions never wait for a render. React
 * state only updates on a transition, which is when the effects need to change.
 */
export function useAvatarBehavior(
  avatarRef: RefObject<RithAvatarHandle>,
  live: boolean,
  onScreen: boolean,
) {
  const [mode, setModeState] = useState<AvatarMode>('idle');
  const modeRef = useRef<AvatarMode>('idle');
  const lastActivity = useRef(0);
  const cancelledAt = useRef(-Infinity);

  const setMode = useCallback((next: AvatarMode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  const fallAsleep = useCallback(() => {
    if (modeRef.current !== 'idle') return false;
    const started = avatarRef.current?.perform('fallingAsleep', () => {
      if (modeRef.current !== 'fallingAsleep') return;
      if (avatarRef.current?.perform('sleeping')) setMode('sleeping');
      else setMode('idle');
    });
    if (started) setMode('fallingAsleep');
    return Boolean(started);
  }, [avatarRef, setMode]);

  /** A click, tap or Enter on the avatar. */
  const activate = useCallback(() => {
    const current = modeRef.current;
    if (current === 'sleeping') {
      const started = avatarRef.current?.perform('wakingUp', () => {
        lastActivity.current = performance.now();
        setMode('idle');
      });
      if (started) setMode('wakingUp');
      return;
    }
    if (current !== 'idle') return;
    if (performance.now() - cancelledAt.current < CANCEL_CLICK_GUARD_MS) return;
    const started = avatarRef.current?.perform('brainLoading', () => setMode('idle'));
    if (started) setMode('brainLoading');
  }, [avatarRef, setMode]);

  // Visitor activity only stamps a time, so constant mouse movement costs nothing.
  useEffect(() => {
    if (!live) return;
    let lastX = -1;
    let lastY = -1;

    const noteActivity = () => {
      lastActivity.current = performance.now();
      if (modeRef.current === 'fallingAsleep') {
        cancelledAt.current = lastActivity.current;
        avatarRef.current?.release();
        setMode('idle');
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const moved = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      if (lastX >= 0 && moved < SLEEP.moveThresholdPx) return;
      const isFirstReading = lastX < 0;
      lastX = event.clientX;
      lastY = event.clientY;
      if (!isFirstReading) noteActivity();
    };

    const options = { passive: true, capture: true } as const;
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'touchmove', 'scroll'] as const;
    window.addEventListener('pointermove', onPointerMove, options);
    events.forEach((name) => window.addEventListener(name, noteActivity, options));
    return () => {
      window.removeEventListener('pointermove', onPointerMove, options);
      events.forEach((name) => window.removeEventListener(name, noteActivity, options));
    };
  }, [live, avatarRef, setMode]);

  // The 30 seconds only count while the avatar can actually be seen.
  useEffect(() => {
    if (live && onScreen) lastActivity.current = performance.now();
  }, [live, onScreen]);

  useEffect(() => {
    if (!live || !onScreen || mode !== 'idle') return;
    let timer = 0;
    const check = () => {
      const remaining = SLEEP.idleMs - (performance.now() - lastActivity.current);
      if (remaining > 0) {
        timer = window.setTimeout(check, remaining);
      } else if (!fallAsleep()) {
        // A body clip is still finishing. Look again shortly.
        timer = window.setTimeout(check, 500);
      }
    };
    check();
    return () => window.clearTimeout(timer);
  }, [live, onScreen, mode, fallAsleep]);

  // If the 3D view goes away mid-reaction, drop its effects too.
  useEffect(() => {
    if (!live && modeRef.current !== 'idle') setMode('idle');
  }, [live, setMode]);

  return { mode, activate };
}
