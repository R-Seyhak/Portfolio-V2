import type { CSSProperties } from 'react';
import { BRAIN_LOADING } from './avatar.config';
import type { AvatarMode } from './avatar.types';

/** CSS-only marks around the head. They never take pointer input. */
export function AvatarEffects({ mode }: { mode: AvatarMode }) {
  if (mode === 'brainLoading') {
    const style = { '--av-life': `${BRAIN_LOADING.effectsMs}ms` } as CSSProperties;
    return (
      <div className="av-fx" style={style} aria-hidden="true">
        <div className="av-thought">
          <span className="av-q">?</span>
          <span className="av-q">?</span>
          <span className="av-q">?</span>
          <span className="av-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    );
  }
  if (mode === 'sleeping') {
    return (
      <div className="av-fx" aria-hidden="true">
        <div className="av-zzz">
          <span>z</span>
          <span>z</span>
          <span>z</span>
        </div>
      </div>
    );
  }
  return null;
}
