/** Settings shared by every 3D element on the page, so they all look like one world. */
export const DPR_RANGE: [number, number] = [1, 1.5];

export const LIGHTING = {
  /** Overall brightness. Change this first. */
  exposure: 1.5,
  ambient: 0.62,
  key: { position: [-2, 4, 3] as const, intensity: 1.35 },
  rim: { position: [2.5, 2, -2] as const, intensity: 0.55 },
  environment: 0.32,
  shadow: { opacity: 0.26, blur: 2.6, scale: 2.4, far: 1.4 },
} as const;
