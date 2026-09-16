// Pure JS 3D vector math
class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  negate() { return new Vec3(-this.x, -this.y, -this.z); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  // Rotate around unit axis by angle (Rodrigues' formula)
  rotateAround(axis, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = this.dot(axis);
    const cross = axis.cross(this);
    return new Vec3(
      this.x * cos + cross.x * sin + axis.x * dot * (1 - cos),
      this.y * cos + cross.y * sin + axis.y * dot * (1 - cos),
      this.z * cos + cross.z * sin + axis.z * dot * (1 - cos)
    );
  }
}

const NORMALS = {
  U: new Vec3(0, 1, 0),
  D: new Vec3(0, -1, 0),
  F: new Vec3(0, 0, 1),
  B: new Vec3(0, 0, -1),
  R: new Vec3(1, 0, 0),
  L: new Vec3(-1, 0, 0),
};

const FACES = ['U', 'D', 'F', 'B', 'R', 'L'];

const FACE_AXES = {
  F: { n: new Vec3(0, 0, 1),  u: new Vec3(0, 1, 0),  r: new Vec3(1, 0, 0) },
  B: { n: new Vec3(0, 0, -1), u: new Vec3(0, 1, 0),  r: new Vec3(-1, 0, 0) },
  R: { n: new Vec3(1, 0, 0),  u: new Vec3(0, 1, 0),  r: new Vec3(0, 0, -1) },
  L: { n: new Vec3(-1, 0, 0), u: new Vec3(0, 1, 0),  r: new Vec3(0, 0, 1) },
  U: { n: new Vec3(0, 1, 0),  u: new Vec3(0, 0, -1), r: new Vec3(1, 0, 0) },
  D: { n: new Vec3(0, -1, 0), u: new Vec3(0, 0, 1),  r: new Vec3(1, 0, 0) }
};

function faceOfNormal(vec) {
  for (const f of FACES) {
    const n = NORMALS[f];
    const dx = n.x - vec.x, dy = n.y - vec.y, dz = n.z - vec.z;
    if (dx*dx + dy*dy + dz*dz < 0.01) return f;
  }
  return null;
}

const result = {};

for (const f of FACES) {
  const axes = FACE_AXES[f];
  result[f] = {};

  const arrowDefs = [
    { key: 'tl_up',    corner: 'tl', dir: 'up',    D: axes.u.clone(),          sliceNorm: axes.r.negate() },
    { key: 'tl_left',  corner: 'tl', dir: 'left',  D: axes.r.negate(),         sliceNorm: axes.u.clone() },
    { key: 'tr_up',    corner: 'tr', dir: 'up',    D: axes.u.clone(),          sliceNorm: axes.r.clone() },
    { key: 'tr_right', corner: 'tr', dir: 'right', D: axes.r.clone(),          sliceNorm: axes.u.clone() },
    { key: 'bl_left',  corner: 'bl', dir: 'left',  D: axes.r.negate(),         sliceNorm: axes.u.negate() },
    { key: 'bl_down',  corner: 'bl', dir: 'down',  D: axes.u.negate(),         sliceNorm: axes.r.negate() },
    { key: 'br_right', corner: 'br', dir: 'right', D: axes.r.clone(),          sliceNorm: axes.u.negate() },
    { key: 'br_down',  corner: 'br', dir: 'down',  D: axes.u.negate(),         sliceNorm: axes.r.clone() }
  ];

  for (const a of arrowDefs) {
    const moveFace = faceOfNormal(a.sliceNorm);
    const n = axes.n;
    const D = a.D;
    const sliceN = a.sliceNorm;

    // Angle = (-PI/2) * turns.
    // For turns = +1, angle = -PI/2.
    const pRot = n.rotateAround(sliceN, -Math.PI / 2);
    const delta = new Vec3(pRot.x - n.x, pRot.y - n.y, pRot.z - n.z);
    const dot = delta.dot(D);

    const turns = dot > 0 ? 1 : -1;
    result[f][a.key] = { face: moveFace, turns };
  }
}

console.log('const FACE_CORNER_MOVES = ' + JSON.stringify(result, null, 2) + ';');
