import * as THREE from 'three';
import { NORMALS, U_AXIS, THEME, FLAT, AXIS_GROUPS } from './config.js';
import { faceOfNormal } from './cube.js';

/** A soft round disc, so the dots read as beads without leaving the plane. */
function dotTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s * 0.38, s * 0.34, s * 0.05, s * 0.5, s * 0.5, s * 0.5);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(235,235,235,1)');
  grad.addColorStop(0.85, 'rgba(120,120,120,1)');
  grad.addColorStop(1, 'rgba(90,90,90,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function circleGeometry(radius, segments = 192) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * The cube seen from the other angle: one flat picture built from three big
 * circles, one per axis. A big circle is just the frame of its axis; the two
 * faces of that axis are two smaller circles side by side inside it, the +
 * face towards the outside of the triangle and the - face towards the middle.
 *
 * The eight stickers around a face sit on its ring in the order they appear on
 * the cube, read through the face's (u, v) frame from outside - so a clockwise
 * turn is a clockwise slide on every circle and no face is drawn mirrored.
 * Turning a face spins its own circle while the twelve side stickers arc
 * across to the circles they land on, inside the other two big circles.
 *
 * It lives in its own scene with an orthographic camera aimed straight down
 * -Z, so the picture is genuinely 2D and can never tilt.
 */
export class FlatDiagram {
  constructor(cube) {
    this.cube = cube;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 5;
    this.camera.position.y = 0.22; // clear of the page header

    this.centres = {}; // face -> the centre of its own circle
    this.radii = {}; // face -> the radius of its own circle
    this.outward = {}; // face -> which way its hub sticker faces
    this.ringMaterials = {};
    this.dots = new Map();
    this.active = null;

    this._buildCircles();
    this._buildDots();
    this.resize(1, 1);
  }

  _buildCircles() {
    const frameGeo = circleGeometry(FLAT.groupRadius);
    const faceGeo = circleGeometry(FLAT.faceRing);
    const hubGeo = circleGeometry(FLAT.hubRing);

    const faint = (opacity) =>
      new THREE.LineBasicMaterial({ color: THEME.ring, transparent: true, opacity });

    const place = (object, at) => {
      object.position.set(at.x, at.y, 0);
      this.scene.add(object);
    };

    for (const group of AXIS_GROUPS) {
      const a = (group.angle * Math.PI) / 180;
      const radial = new THREE.Vector2(Math.cos(a), Math.sin(a));
      const groupCentre = radial.clone().multiplyScalar(FLAT.triRadius);

      // The big circle is the axis itself: a frame, with no dots of its own.
      place(new THREE.LineLoop(frameGeo, faint(0.16)), groupCentre);

      // Its two faces sit inside it side by side, + towards the outside of
      // the triangle and - towards the middle of the diagram.
      for (const [face, sign] of [
        [group.outer, 1],
        [group.inner, -1],
      ]) {
        const outward = radial.clone().multiplyScalar(sign);
        const centre = groupCentre.clone().addScaledVector(outward, FLAT.faceOffset);

        this.centres[face] = centre;
        this.radii[face] = FLAT.faceRing;
        this.outward[face] = outward;

        const material = faint(0.3);
        this.ringMaterials[face] = material;
        place(new THREE.LineLoop(faceGeo, material), centre);
        place(new THREE.LineLoop(hubGeo, faint(0.14)), centre);
      }
    }
  }

  _buildDots() {
    const geo = new THREE.PlaneGeometry(FLAT.dotSize, FLAT.dotSize);
    const tex = dotTexture();
    const mats = new Map();

    for (const sticker of this.cube.stickers) {
      if (!mats.has(sticker.color)) {
        mats.set(
          sticker.color,
          new THREE.MeshBasicMaterial({
            color: sticker.color,
            map: tex,
            transparent: true,
            depthWrite: false,
          })
        );
      }
      const mesh = new THREE.Mesh(geo, mats.get(sticker.color));
      mesh.position.z = 0.05;
      this.scene.add(mesh);
      this.dots.set(sticker, mesh);
    }
  }

  // ------------------------------------------------------------------ layout

  /** A centre cubie is the one sitting directly on the axis. */
  static isCentre(coord) {
    return coord.lengthSq() === 1;
  }

  /** Where a sticker sits: which ring, and where on it. */
  point(face, coord, out = new THREE.Vector2()) {
    const centre = this.centres[face];
    if (FlatDiagram.isCentre(coord)) {
      // The fixed centre sticker rests on its face's tiny hub ring.
      return out.copy(centre).addScaledVector(this.outward[face], FLAT.hubRing);
    }
    const theta = this.angleOn(face, coord);
    const r = this.radii[face];
    return out.set(centre.x + Math.cos(theta) * r, centre.y + Math.sin(theta) * r);
  }

  /** The angle of a sticker on its ring, read through the face's own frame. */
  angleOn(face, coord) {
    const u = U_AXIS[face];
    const v = NORMALS[face].clone().cross(u); // (u, v, n) right handed
    return Math.atan2(coord.dot(v), coord.dot(u));
  }

  resize(width, height) {
    const aspect = width / height;
    const f = FLAT.frustum;
    const halfW = aspect >= 1 ? f * aspect : f;
    const halfH = aspect >= 1 ? f : f / aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------------- animation

  sync() {
    const p = new THREE.Vector2();
    for (const [sticker, mesh] of this.dots) {
      const face = this.cube.stickerFace(sticker);
      this.point(face, sticker.piece.coord, p);
      mesh.position.set(p.x, p.y, mesh.position.z);
    }
  }

  highlight(face, on) {
    const m = this.ringMaterials[face];
    m.color.setHex(on ? THEME.ringActive : THEME.ring);
    m.opacity = on ? 0.9 : 0.3;
  }

  /**
   * Plan one turn: every sticker in the layer either spins along its own
   * circle (the turning face's own eight) or arcs over to a circle inside one
   * of the other two big circles (the twelve on the side band). The fixed
   * centre never changes circle or angle, so it is left where it is.
   */
  beginMove(face, turns) {
    const axis = NORMALS[face];
    const q = new THREE.Quaternion().setFromAxisAngle(axis, (-Math.PI / 2) * turns);
    const dTheta = (-Math.PI / 2) * turns;
    const items = [];

    for (const sticker of this.cube.stickers) {
      const coord = sticker.piece.coord;
      if (coord.dot(axis) !== 1) continue;
      if (FlatDiagram.isCentre(coord)) continue;

      const mesh = this.dots.get(sticker);
      const from = this.cube.stickerFace(sticker);
      const normal = sticker.local.clone().applyQuaternion(sticker.piece.quat).round();
      const to = faceOfNormal(normal.applyQuaternion(q).round());
      const nextCoord = coord.clone().applyQuaternion(q).round();

      if (from === to) {
        items.push({
          mesh,
          spin: true,
          centre: this.centres[from],
          radius: this.radii[from],
          theta: this.angleOn(from, coord),
          dTheta,
        });
      } else {
        const a = this.point(from, coord);
        const b = this.point(to, nextCoord);
        // Bow the flight path away from the middle of the diagram so the
        // crossing streams stay readable.
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const bow = mid.lengthSq() < 1e-6 ? new THREE.Vector2(0, 1) : mid.clone().normalize();
        const control = mid.addScaledVector(bow, a.distanceTo(b) * 0.3);
        items.push({ mesh, spin: false, a, b, control });
      }
    }

    this.highlight(face, true);
    this.active = { face, items };

    return {
      setProgress: (t) => {
        for (const it of this.active.items) {
          if (it.spin) {
            const th = it.theta + it.dTheta * t;
            it.mesh.position.set(
              it.centre.x + Math.cos(th) * it.radius,
              it.centre.y + Math.sin(th) * it.radius,
              it.mesh.position.z
            );
          } else {
            const s = 1 - t;
            const x = s * s * it.a.x + 2 * s * t * it.control.x + t * t * it.b.x;
            const y = s * s * it.a.y + 2 * s * t * it.control.y + t * t * it.b.y;
            it.mesh.position.set(x, y, it.mesh.position.z);
          }
          it.mesh.scale.setScalar(lerp(1, 1.3, Math.sin(Math.PI * t) * (it.spin ? 0.2 : 1)));
        }
      },
      finish: () => {
        for (const it of this.active.items) it.mesh.scale.setScalar(1);
        this.highlight(face, false);
        this.active = null;
        this.sync();
      },
    };
  }
}
