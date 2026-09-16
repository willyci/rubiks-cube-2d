import * as THREE from 'three';
import { COLORS, FACES, NORMALS, THEME, CUBE } from './config.js';

/** Rounded-square sticker sprite, drawn once and tinted per face. */
function stickerTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const r = s * 0.18;
  const p = s * 0.06;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(p + r, p);
  g.arcTo(s - p, p, s - p, s - p, r);
  g.arcTo(s - p, s - p, p, s - p, r);
  g.arcTo(p, s - p, p, p, r);
  g.arcTo(p, p, s - p, p, r);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Which face a lattice direction points at. */
export function faceOfNormal(v) {
  for (const f of FACES) if (NORMALS[f].equals(v)) return f;
  return null;
}

/**
 * The solid 3x3 puzzle, and the single source of truth for the cube's state.
 * Every piece carries integer lattice coordinates plus a quaternion, and both
 * are rewritten exactly after each turn, so nothing drifts. Other views (the
 * flat diagram) register with `addView` and are driven by the same turns.
 */
export class RubiksCube {
  constructor() {
    this.root = new THREE.Group();
    this.pieces = [];
    this.stickers = [];
    this.views = [];

    this._stickerTex = stickerTexture();
    this._build();
  }

  addView(view) {
    this.views.push(view);
    view.sync();
  }

  // ---------------------------------------------------------------- building

  _build() {
    const bodyGeo = new THREE.BoxGeometry(CUBE.size, CUBE.size, CUBE.size);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: THEME.body,
      roughness: 0.65,
      metalness: 0.05,
    });
    const stickerGeo = new THREE.PlaneGeometry(CUBE.sticker, CUBE.sticker);

    const stickerMats = {};
    for (const f of FACES) {
      stickerMats[f] = new THREE.MeshStandardMaterial({
        color: COLORS[f],
        map: this._stickerTex,
        transparent: true,
        alphaTest: 0.4,
        roughness: 0.42,
        metalness: 0.0,
      });
    }

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;

          const home = new THREE.Vector3(x, y, z);
          const solid = new THREE.Group();
          solid.add(new THREE.Mesh(bodyGeo, bodyMat));

          const piece = { home, coord: home.clone(), quat: new THREE.Quaternion(), solid };

          for (const f of FACES) {
            const n = NORMALS[f];
            if (home.dot(n) !== 1) continue;

            const mesh = new THREE.Mesh(stickerGeo, stickerMats[f]);
            mesh.position.copy(n).multiplyScalar(CUBE.stickerLift);
            mesh.lookAt(mesh.position.clone().add(n));
            solid.add(mesh);

            // `local` is the sticker's outward direction in the piece's own
            // frame; turned by the piece's quaternion it gives the face the
            // sticker currently shows.
            this.stickers.push({ piece, local: n.clone(), home: f, color: COLORS[f] });
          }

          this._place(piece);
          this.root.add(solid);
          this.pieces.push(piece);
        }
      }
    }
  }

  /** Snap a piece onto its exact lattice state (no float drift). */
  _place(piece) {
    piece.solid.position.copy(piece.coord).multiplyScalar(CUBE.spacing);
    piece.solid.quaternion.copy(piece.quat);
  }

  /** The face a sticker currently shows. */
  stickerFace(sticker) {
    const n = sticker.local.clone().applyQuaternion(sticker.piece.quat).round();
    return faceOfNormal(n);
  }

  // ------------------------------------------------------------------- moves

  layerPieces(face) {
    const n = NORMALS[face];
    return this.pieces.filter((p) => p.coord.dot(n) === 1);
  }

  /**
   * Start a turn. Returns a handle the move engine drives frame by frame.
   * A quarter turn is -90 degrees about the face's outward normal, which is
   * exactly "clockwise seen from outside" for every face.
   */
  beginMove(face, turns) {
    const axis = NORMALS[face];
    const angle = (-Math.PI / 2) * turns;
    const members = this.layerPieces(face);

    const pivot = new THREE.Group();
    this.root.add(pivot);
    for (const p of members) pivot.attach(p.solid);

    const subs = this.views.map((v) => v.beginMove(face, turns));

    return {
      face,
      turns,
      setProgress: (t) => {
        pivot.setRotationFromAxisAngle(axis, angle * t);
        for (const s of subs) s.setProgress(t);
      },
      finish: () => {
        const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        for (const p of members) {
          p.coord.applyQuaternion(q).round();
          p.quat.premultiply(q).normalize();
          this.root.attach(p.solid);
          this._place(p);
        }
        this.root.remove(pivot);
        for (const s of subs) s.finish();
      },
    };
  }

  reset() {
    for (const p of this.pieces) {
      p.coord.copy(p.home);
      p.quat.identity();
      this._place(p);
    }
    for (const v of this.views) v.sync();
  }

  isSolved() {
    return this.pieces.every((p) => p.coord.equals(p.home) && Math.abs(p.quat.w) > 0.9999);
  }
}
