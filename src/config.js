import * as THREE from 'three';

/** Sticker colours, western scheme: white up, yellow down, green front. */
export const COLORS = {
  U: 0xf2f2f2,
  D: 0xf5d616,
  F: 0x1fa04a,
  B: 0x1663c7,
  R: 0xd6262b,
  L: 0xe07a20,
};

export const FACES = ['U', 'D', 'F', 'B', 'R', 'L'];

/** Outward normal of every face, as integer lattice directions. */
export const NORMALS = {
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
};

/**
 * In-plane frame of each face: u across, v = n x u up, so (u, v, n) is right
 * handed. Reading a face through this frame is reading it from outside, which
 * is what lets the flat diagram draw all six faces with the same handedness.
 */
export const U_AXIS = {
  U: new THREE.Vector3(1, 0, 0),
  D: new THREE.Vector3(1, 0, 0),
  F: new THREE.Vector3(1, 0, 0),
  B: new THREE.Vector3(1, 0, 0),
  R: new THREE.Vector3(0, 1, 0),
  L: new THREE.Vector3(0, 1, 0),
};

export const THEME = {
  background: 0x2b3a36,
  body: 0x111a19,
  ring: 0xbfd8d2,
  ringActive: 0xff8c1a,
};

/** Geometry of the solid cube. */
export const CUBE = {
  spacing: 1.02,
  size: 0.96,
  sticker: 0.82,
  stickerLift: 0.502,
};

/**
 * The flat diagram: three big circles, one per axis of the cube, sitting on a
 * triangle and overlapping. A big circle is only the frame of its axis - the
 * two faces of that axis are drawn as two smaller circles side by side inside
 * it, the + face towards the outside of the triangle and the - face towards
 * the middle, each carrying that face's eight stickers. The face's fixed
 * centre sticker sits on the tiny hub ring at the heart of its own circle.
 */
export const FLAT = {
  groupRadius: 1.0,
  triRadius: 1.0,
  faceOffset: 0.52,
  faceRing: 0.38,
  hubRing: 0.15,
  dotSize: 0.12,
  frustum: 2.45,
};

/** The three axis groups, placed by angle around the diagram. */
export const AXIS_GROUPS = [
  { angle: 90, outer: 'U', inner: 'D' },
  { angle: 210, outer: 'R', inner: 'L' },
  { angle: 330, outer: 'F', inner: 'B' },
];
