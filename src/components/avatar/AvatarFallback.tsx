import { FALLBACK_SIZE, FALLBACK_SRC } from './avatar.config';

/** Static render shown while the 3D model loads, and whenever it cannot run. */
export function AvatarFallback() {
  return (
    // The parent carries role="img" and the label, so this stays decorative.
    <img
      className="av-fallback"
      src={FALLBACK_SRC}
      width={FALLBACK_SIZE.width}
      height={FALLBACK_SIZE.height}
      alt=""
      decoding="async"
      draggable={false}
    />
  );
}
