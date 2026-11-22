import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLASSES_ARMS } from './avatar.config';

function createArm(side: 1 | -1) {
  const [originX, originY, originZ] = GLASSES_ARMS.headOrigin;
  const points = GLASSES_ARMS.path.map(
    ([x, y, z]) => new THREE.Vector3(x * side - originX, y - originY, z - originZ),
  );
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = new THREE.TubeGeometry(curve, GLASSES_ARMS.segments, GLASSES_ARMS.radius, 6, false);
  // A rounded tip, so the open end of the tube never shows behind the ear.
  const tip = new THREE.SphereGeometry(GLASSES_ARMS.radius, 6, 4);
  tip.translate(points[points.length - 1].x, points[points.length - 1].y, points[points.length - 1].z);
  const arm = mergeGeometries([tube, tip]);
  tube.dispose();
  tip.dispose();
  return arm;
}

/**
 * Both arms as one mesh, in the Head bone's space, so they cost one draw call
 * and follow every head movement exactly. The caller disposes it.
 */
export function createGlassesArms() {
  const left = createArm(1);
  const right = createArm(-1);
  const geometry = mergeGeometries([left, right]);
  left.dispose();
  right.dispose();
  const material = new THREE.MeshStandardMaterial({
    color: GLASSES_ARMS.color,
    roughness: GLASSES_ARMS.roughness,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'GlassesArms';
  return mesh;
}
