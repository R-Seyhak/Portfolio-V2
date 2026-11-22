import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { IDLE_VARIATION, REACTIONS, SLEEP } from './avatar.config';
import type { AvatarMode, ReactionName, RithAvatarHandle } from './avatar.types';

/** A click that lands this soon after it cancelled a doze should not also start a reaction. */
const CANCEL_CLICK_GUARD_MS = 700;

// The greeting has just been a wave, so the first click shows something new.
const REACTION_ORDER: ReactionName[] = ['thumbsUp', 'shrug', 'brainLoading', 'wave'];
const IDLE_MOVES = ['lookAround', 'checkWatch'] as const;

const isIdleMove = (mode: AvatarMode) => mode === 'lookAround' || mode === 'checkWatch';

/**
 * The avatar's interaction state machine:
 *
 *   idle ──click──▶ thumbsUp / shrug / brainLoading / wave ──finished──▶ idle
 *   idle ──8 s without activity──▶ lookAround / checkWatch ──finished──▶ idle
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
  reducedMotion: boolean,
) {
  const [mode, setModeState] = useState<AvatarMode>('idle');
  const modeRef = useRef<AvatarMode>('idle');
  const lastActivity = useRef(0);
  const cancelledAt = useRef(-Infinity);
  const cooldownUntil = useRef(0);
  const nextReaction = useRef(0);
  const nextIdleMove = useRef(0);
  const idleMoveFreeAt = useRef(0);

  const setMode = useCallback((next: AvatarMode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  const finishReaction = useCallback(() => {
    const now = performance.now();
    cooldownUntil.current = now + REACTIONS.cooldownMs;
    lastActivity.current = now;
    setMode('idle');
  }, [setMode]);

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

  const playIdleMove = useCallback(() => {
    if (modeRef.current !== 'idle') return false;
    const name = IDLE_MOVES[nextIdleMove.current % IDLE_MOVES.length];
    const started = avatarRef.current?.perform(name, () => {
      const { gapMinMs, gapMaxMs } = IDLE_VARIATION;
      idleMoveFreeAt.current = performance.now() + gapMinMs + Math.random() * (gapMaxMs - gapMinMs);
      setMode('idle');
    });
    if (started) {
      nextIdleMove.current += 1;
      setMode(name);
    }
    return Boolean(started);
  }, [avatarRef, setMode]);

  /** The once-per-visit hello. Returns false if the body is busy. */
  const greet = useCallback(() => {
    if (modeRef.current !== 'idle') return false;
    const started = avatarRef.current?.play('GreetingWave', finishReaction);
    if (started) setMode('wave');
    return Boolean(started);
  }, [avatarRef, finishReaction, setMode]);

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
    // A background idle move gives way to a click at once.
    if (isIdleMove(current)) avatarRef.current?.release();
    else if (current !== 'idle') return;

    const now = performance.now();
    if (now - cancelledAt.current < CANCEL_CLICK_GUARD_MS || now < cooldownUntil.current) {
      if (isIdleMove(current)) setMode('idle');
      return;
    }

    const order = reducedMotion
      ? REACTION_ORDER.filter((name) => name !== 'wave')
      : REACTION_ORDER;
    const next = order[nextReaction.current % order.length];
    const started =
      next === 'wave'
        ? avatarRef.current?.play('GreetingWave', finishReaction)
        : avatarRef.current?.perform(next, finishReaction);
    if (started) {
      nextReaction.current += 1;
      setMode(next);
    } else if (isIdleMove(current)) {
      setMode('idle');
    }
  }, [avatarRef, finishReaction, reducedMotion, setMode]);

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

  // The timers only count while the avatar can actually be seen.
  useEffect(() => {
    if (live && onScreen) lastActivity.current = performance.now();
  }, [live, onScreen]);

  useEffect(() => {
    if (!live || !onScreen || mode !== 'idle') return;
    let timer = 0;
    const check = () => {
      const now = performance.now();
      const sleepAt = lastActivity.current + SLEEP.idleMs;
      if (now >= sleepAt) {
        // If a body clip is still finishing, look again shortly.
        if (!fallAsleep()) timer = window.setTimeout(check, 500);
        return;
      }
      const moveAt = Math.max(lastActivity.current + IDLE_VARIATION.firstMs, idleMoveFreeAt.current);
      const moveAllowed = !reducedMotion && moveAt < sleepAt - IDLE_VARIATION.sleepMarginMs;
      if (moveAllowed && now >= moveAt) {
        if (!playIdleMove()) timer = window.setTimeout(check, 500);
        return;
      }
      timer = window.setTimeout(check, (moveAllowed ? moveAt : sleepAt) - now);
    };
    check();
    return () => window.clearTimeout(timer);
  }, [live, onScreen, mode, reducedMotion, fallAsleep, playIdleMove]);

  // If the 3D view goes away mid-reaction, drop its effects too.
  useEffect(() => {
    if (!live && modeRef.current !== 'idle') setMode('idle');
  }, [live, setMode]);

  return { mode, activate, greet };
}
