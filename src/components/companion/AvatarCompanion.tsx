'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RithAvatarHandle } from '../avatar/avatar.types';
import { useInView, usePageVisible } from '../avatar/useInView';
import { usePrefersReducedMotion } from '../avatar/usePrefersReducedMotion';
import { useSiteRevealed } from '../loader/loaderClient';
import {
  requestSceneCanvas,
  showSceneCanvas,
  supportsWebGL,
  useSceneCanvas,
} from '../three/sceneStore';
import { COMPANION } from './companion.config';

const CompanionScene = dynamic(() => import('./CompanionScene'), { ssr: false });

/**
 * True when no line of heading text comes within `clearance` of the box.
 * With `anyRow`, a line counts even at a different height: the headings move
 * vertically while they reveal, so the figure's column has to be clear of them.
 */
function clearOfText(box: DOMRect, host: Element, note: Element | null, clearance: number, anyRow: boolean) {
  const range = document.createRange();
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (!text.textContent?.trim() || note?.contains(text)) continue;
    range.selectNodeContents(text);
    for (const line of range.getClientRects()) {
      if (!line.width) continue;
      const sameColumn = line.right + clearance > box.left && line.left - clearance < box.right;
      const sameRow = anyRow || (line.bottom + clearance > box.top && line.top - clearance < box.bottom);
      if (sameColumn && sameRow) return false;
    }
  }
  return true;
}

/**
 * The small figure beside the Work heading. It stays out if the heading needs
 * the room, plays its pose once on arrival, and repeats it only now and then
 * while it stays on screen.
 */
export function AvatarCompanion() {
  const spotRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<RithAvatarHandle>(null);
  const memory = useRef({ entered: false, nextMoveAt: 0 });

  const { failed } = useSceneCanvas();
  const revealed = useSiteRevealed();
  const reducedMotion = usePrefersReducedMotion();
  const pageVisible = usePageVisible();
  const near = useInView(spotRef, { rootMargin: '400px', once: true });
  const onScreen = useInView(spotRef);
  // Waits until the heading has started to reveal, so the figure never arrives first.
  const appeared = useInView(spotRef, { threshold: 0.75, once: true }) && revealed;

  const [fits, setFits] = useState(false);
  const [broken, setBroken] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const unavailable = failed || broken;
  const active = appeared && fits && onScreen && pageVisible && !unavailable;

  useEffect(() => {
    const spot = spotRef.current;
    const host = spot?.closest('.section-header');
    if (!spot || !host) return;
    const note = spot.querySelector('.cp-line');
    const measure = () => {
      const box = spot.getBoundingClientRect();
      setFits(box.width > 0 && clearOfText(box, host, note, COMPANION.textClearancePx, true));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(spot);
    // Web fonts change how wide the heading is.
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) measure();
    });
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, []);

  // The 3D only loads when the figure has room and is about to be seen.
  useEffect(() => {
    if (mounted || unavailable || !revealed || !near || !fits) return;
    if (!supportsWebGL()) {
      setBroken(true);
      return;
    }
    requestSceneCanvas();
    setMounted(true);
  }, [mounted, unavailable, revealed, near, fits]);

  useEffect(() => {
    const avatar = avatarRef.current;
    const spot = spotRef.current;
    if (!ready || !active || !avatar || !spot) return;
    avatar.setMorph('smile', COMPANION.smile);

    const seen = memory.current;
    let moveTimer = 0;
    let noteTimer = 0;

    const showNote = () => {
      const host = spot.closest('.section-header');
      const note = spot.querySelector('.cp-line');
      if (!host || !note) return;
      if (!clearOfText(note.getBoundingClientRect(), host, note, COMPANION.noteClearancePx, false)) return;
      spot.setAttribute('data-speaking', '');
      noteTimer = window.setTimeout(() => spot.removeAttribute('data-speaking'), COMPANION.lineMs);
    };

    const tick = () => {
      if (!avatar.perform('proud')) {
        // Still blending out of the last pose.
        moveTimer = window.setTimeout(tick, 600);
        return;
      }
      if (!seen.entered) {
        seen.entered = true;
        showNote();
      }
      const { encoreMinMs, encoreMaxMs } = COMPANION;
      const wait = encoreMinMs + Math.random() * (encoreMaxMs - encoreMinMs);
      seen.nextMoveAt = performance.now() + wait;
      moveTimer = window.setTimeout(tick, wait);
    };

    if (reducedMotion) {
      // Keeps the note and the expression, without any body movement.
      if (!seen.entered) {
        seen.entered = true;
        showNote();
      }
    } else {
      const wait = seen.entered
        ? Math.max(seen.nextMoveAt - performance.now(), COMPANION.enterDelayMs)
        : COMPANION.enterDelayMs;
      moveTimer = window.setTimeout(tick, wait);
    }

    return () => {
      window.clearTimeout(moveTimer);
      window.clearTimeout(noteTimer);
      spot.removeAttribute('data-speaking');
      avatar.release();
    };
  }, [ready, active, reducedMotion]);

  const markReady = useCallback(() => {
    setReady(true);
    showSceneCanvas();
  }, []);
  const markBroken = useCallback(() => setBroken(true), []);

  return (
    <div
      ref={spotRef}
      className="cp-spot"
      data-on={(ready && appeared && fits && !unavailable) || undefined}
      aria-hidden="true"
    >
      {mounted && !unavailable && (
        <CompanionScene
          avatarRef={avatarRef}
          active={active}
          reducedMotion={reducedMotion}
          onReady={markReady}
          onError={markBroken}
        />
      )}
      <div className="cp-veil" />
      <p className="cp-line">{COMPANION.line}</p>
    </div>
  );
}
