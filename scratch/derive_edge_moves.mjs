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

// Official slice definitions in Rubik's cube:
// M follows L: axis is (-1, 0, 0)
// E follows D: axis is (0, -1, 0)
// S follows F: axis is (0, 0, 1)
const SLICES = {
  M: { axis: new Vec3(-1, 0, 0) },
  E: { axis: new Vec3(0, -1, 0) },
  S: { axis: new Vec3(0, 0, 1) }
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

function findSliceMove(faceName, desiredDirVec, requiredSliceAxisVec) {
  let sliceName = null;
  for (const [name, sl] of Object.entries(SLICES)) {
    const d = Math.abs(sl.axis.dot(requiredSliceAxisVec));
    if (d > 0.99) {
      sliceName = name;
      break;
    }
  }
  if (!sliceName) throw new Error('No slice for axis ' + JSON.stringify(requiredSliceAxisVec));

  const slAxis = SLICES[sliceName].axis;
  const n = FACE_AXES[faceName].n;

  // With turns = +1, angle = -PI/2 around slAxis.
  const pRot = n.rotateAround(slAxis, -Math.PI / 2);
  const delta = new Vec3(pRot.x - n.x, pRot.y - n.y, pRot.z - n.z);
  const dot = delta.dot(desiredDirVec);
  const turns = dot > 0 ? 1 : -1;
  return { face: sliceName, turns };
}

const edgeMoves = {};

for (const f of FACES) {
  const axes = FACE_AXES[f];
  edgeMoves[f] = {
    top_edge:    findSliceMove(f, axes.u.clone(),  axes.r.clone()),
    bottom_edge: findSliceMove(f, axes.u.negate(), axes.r.clone()),
    left_edge:   findSliceMove(f, axes.r.negate(), axes.u.clone()),
    right_edge:  findSliceMove(f, axes.r.clone(),  axes.u.clone())
  };
}

console.log('EDGE_MOVES = ' + JSON.stringify(edgeMoves, null, 2) + ';');
