import { useReducedMotion } from '../motion.js';

/** Typed entry point to the site's existing reduced-motion hook. */
export const usePrefersReducedMotion: () => boolean = useReducedMotion;
