
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    // ------------------------------------------------------------- Constants & Configuration
    const THEME = {
      background: 0x22302d,
      cubieBody: 0x141e1c,
      ringInactive: 0x8fa8a1,
      ringActive: 0xff8c1a,
    };

    const COLORS = {
      U: 0xf5f5f5, // White
      D: 0xf7d91a, // Yellow
      F: 0x1fa04a, // Green
      B: 0x1663c7, // Blue
      R: 0xd6262b, // Red
      L: 0xe07a20, // Orange
    };

    const FACE_HEX_STRINGS = {
      U: '#f5f5f5',
      D: '#f7d91a',
      F: '#1fa04a',
      B: '#1663c7',
      R: '#d6262b',
      L: '#e07a20',
    };

    const OPPOSITE_FACES = {
      U: 'D',
      D: 'U',
      F: 'B',
      B: 'F',
      R: 'L',
      L: 'R',
    };

    const FACE_SYMBOLS = {
      U: 'circle',
      D: 'dot',
      F: 'cross',
      B: 'triangle',
      R: 'square',
      L: 'star',
    };

    // Maximum contrast symbol colors:
    // Light backgrounds (White, Yellow) -> Black symbol (#111111)
    // Dark / saturated backgrounds (Green, Blue, Red, Orange) -> White symbol (#ffffff)
    const SYMBOL_COLORS = {
      U: '#111111',
      D: '#111111',
      F: '#ffffff',
      B: '#ffffff',
      R: '#ffffff',
      L: '#ffffff',
    };

    const FACES = ['U', 'D', 'F', 'B', 'R', 'L'];

    const NORMALS = {
      U: new THREE.Vector3(0, 1, 0),
      D: new THREE.Vector3(0, -1, 0),
      F: new THREE.Vector3(0, 0, 1),
      B: new THREE.Vector3(0, 0, -1),
      R: new THREE.Vector3(1, 0, 0),
      L: new THREE.Vector3(-1, 0, 0),
    };

    function faceOfNormal(v) {
      for (const f of FACES) {
        if (NORMALS[f].equals(v)) return f;
      }
      return null;
    }

    // Geometry parameters of the 2D Three-Ring System for 3x3
    const RING_CONFIG = {
      D: 0.82,       // distance from origin to circle centers
      r0: 1.0,       // base radius of middle ring
      delta: 0.115,  // spacing between concentric rings
      beadSize: 0.088, // sized so 3x3 beads maintain clean separation without touching (min center distance is ~0.115)
      frustum: 2.38,
    };

    const RING_RADII = {
      '-1': RING_CONFIG.r0 - RING_CONFIG.delta,
      '0': RING_CONFIG.r0,
      '1': RING_CONFIG.r0 + RING_CONFIG.delta,
    };

    // Centers of the 3 circle systems:
    // Y: Top (0, D)
    // Z: Bottom-Left (-D*sqrt(3)/2, -D*0.5)
    // X: Bottom-Right (D*sqrt(3)/2, -D*0.5)
    const RING_CENTERS = {
      Y: new THREE.Vector2(0, RING_CONFIG.D),
      Z: new THREE.Vector2(-RING_CONFIG.D * Math.sqrt(3) / 2, -RING_CONFIG.D * 0.5),
      X: new THREE.Vector2(RING_CONFIG.D * Math.sqrt(3) / 2, -RING_CONFIG.D * 0.5),
    };

    /** Solve intersection of circle 1 (c1, r1) and circle 2 (c2, r2). Returns [p1, p2] */
    function circleIntersections(c1, r1, c2, r2) {
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const d = Math.hypot(dx, dy);
      if (d > r1 + r2 || d < Math.abs(r1 - r2) || d < 1e-6) return null;
      const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
      const xm = c1.x + a * dx / d;
      const ym = c1.y + a * dy / d;
      const nx = -dy / d;
      const ny = dx / d;
      return [
        new THREE.Vector2(xm + h * nx, ym + h * ny),
        new THREE.Vector2(xm - h * nx, ym - h * ny),
      ];
    }

    /**
     * Map (face, pieceCoord) to exact 2D intersection point in the three-ring system.
     * Face U (Y=+1): Pair (Z, X) upper (center diamond)
     * Face D (Y=-1): Pair (Z, X) lower (bottom diamond)
     * Face L (X=-1): Pair (Y, Z) outer top-left
     * Face R (X=+1): Pair (Y, Z) inner bottom-right
     * Face B (Z=-1): Pair (Y, X) outer top-right
     * Face F (Z=+1): Pair (Y, X) inner bottom-left
     */
    function calculateRestPosition(face, coord) {
      let c1, c2, r1, r2, pickBranch;
      if (face === 'U') {
        c1 = RING_CENTERS.Z; r1 = RING_RADII[coord.z];
        c2 = RING_CENTERS.X; r2 = RING_RADII[coord.x];
        pickBranch = (pts) => pts[0]; // upper
      } else if (face === 'D') {
        c1 = RING_CENTERS.Z; r1 = RING_RADII[coord.z];
        c2 = RING_CENTERS.X; r2 = RING_RADII[coord.x];
        pickBranch = (pts) => pts[1]; // lower
      } else if (face === 'L') {
        c1 = RING_CENTERS.Y; r1 = RING_RADII[coord.y];
        c2 = RING_CENTERS.Z; r2 = RING_RADII[coord.z];
        pickBranch = (pts) => (pts[1].x < pts[0].x ? pts[1] : pts[0]); // outer top-left
      } else if (face === 'R') {
        c1 = RING_CENTERS.Y; r1 = RING_RADII[coord.y];
        c2 = RING_CENTERS.Z; r2 = RING_RADII[coord.z];
        pickBranch = (pts) => (pts[0].x > pts[1].x ? pts[0] : pts[1]); // inner bottom-right
      } else if (face === 'B') {
        c1 = RING_CENTERS.Y; r1 = RING_RADII[coord.y];
        c2 = RING_CENTERS.X; r2 = RING_RADII[coord.x];
        pickBranch = (pts) => (pts[0].x > pts[1].x ? pts[0] : pts[1]); // outer top-right
      } else if (face === 'F') {
        c1 = RING_CENTERS.Y; r1 = RING_RADII[coord.y];
        c2 = RING_CENTERS.X; r2 = RING_RADII[coord.x];
        pickBranch = (pts) => (pts[1].x < pts[0].x ? pts[1] : pts[0]); // inner bottom-left
      }

      const pts = circleIntersections(c1, r1, c2, r2);
      if (!pts) return new THREE.Vector2(0, 0);
      return pickBranch(pts);
    }

    // ------------------------------------------------------------- Textures & Sprites
    /**
     * Draw accessible geometric symbol on canvas with maximum contrast:
     * - U (White): bold black circle (○)
     * - D (Yellow): bold black single big dot (●)
     * - F (Green): bold white cross (✚)
     * - B (Blue): bold white triangle (△)
     * - R (Red): bold white square (□)
     * - L (Orange): bold white star (★)
     */
    function drawFaceSymbol(ctx, face, cx, cy, radius) {
      ctx.save();
      const fgColor = SYMBOL_COLORS[face] || '#ffffff';
      const isBlack = (fgColor === '#111111');
      const shadowColor = isBlack ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.6)';

      if (face === 'U') {
        // Circle (outline)
        const r = radius * 0.62;
        ctx.lineWidth = 11;
        ctx.strokeStyle = fgColor; // Deep black
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (face === 'D') {
        // Single big dot (solid disc)
        const r = radius * 0.58;
        ctx.fillStyle = fgColor; // Deep black
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (face === 'F') {
        // Cross (✚)
        const arm = radius * 0.68;
        ctx.lineCap = 'round';
        ctx.lineWidth = 15;
        ctx.strokeStyle = shadowColor;
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
        ctx.stroke();

        ctx.lineWidth = 9;
        ctx.strokeStyle = fgColor; // Pure white
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
        ctx.stroke();
      } else if (face === 'B') {
        // Triangle (△)
        const h = radius * 0.72;
        const w = radius * 0.72;
        const p1 = { x: cx, y: cy - h * 0.78 };
        const p2 = { x: cx - w * 0.86, y: cy + h * 0.62 };
        const p3 = { x: cx + w * 0.86, y: cy + h * 0.62 };
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 15;
        ctx.strokeStyle = shadowColor;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.stroke();

        ctx.lineWidth = 9;
        ctx.strokeStyle = fgColor; // Pure white
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.stroke();
      } else if (face === 'R') {
        // Square (□)
        const half = radius * 0.52;
        const r = 5;
        ctx.lineJoin = 'round';
        function roundRect(x, y, w, h, rad) {
          ctx.beginPath();
          ctx.moveTo(x + rad, y);
          ctx.arcTo(x + w, y, x + w, y + h, rad);
          ctx.arcTo(x + w, y + h, x, y + h, rad);
          ctx.arcTo(x, y + h, x, y, rad);
          ctx.arcTo(x, y, x + w, y, rad);
          ctx.closePath();
        }
        ctx.lineWidth = 15;
        ctx.strokeStyle = shadowColor;
        roundRect(cx - half, cy - half, half * 2, half * 2, r);
        ctx.stroke();

        ctx.lineWidth = 9;
        ctx.strokeStyle = fgColor; // Pure white
        roundRect(cx - half, cy - half, half * 2, half * 2, r);
        ctx.stroke();
      } else if (face === 'L') {
        // Star (★)
        const outerR = radius * 0.72;
        const innerR = radius * 0.32;
        function starPath() {
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = (i % 2 === 0) ? outerR : innerR;
            const a = (i * Math.PI / 5) - Math.PI / 2;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
        }
        starPath();
        ctx.lineWidth = 6;
        ctx.strokeStyle = shadowColor;
        ctx.stroke();

        starPath();
        ctx.fillStyle = fgColor; // Pure white
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = shadowColor;
        ctx.stroke();
      }
      ctx.restore();
    }

    /** Glossy 3D-shaded bead sprite */
    function createBeadTexture() {
      const s = 128;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(s * 0.35, s * 0.32, s * 0.04, s * 0.5, s * 0.5, s * 0.48);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(242,242,242,0.98)');
      grad.addColorStop(0.70, 'rgba(145,145,145,0.92)');
      grad.addColorStop(0.92, 'rgba(50,50,50,0.85)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2);
      g.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    /** Flat color-blind bead texture: solid flat color disc with no 3D gradient or glossy effect */
    function createColorBlindBeadTexture(face) {
      const s = 128;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d');

      const baseColor = FACE_HEX_STRINGS[face];
      const r = s * 0.47;

      // Flat solid circle in face color
      g.fillStyle = baseColor;
      g.beginPath();
      g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
      g.fill();

      // Clean subtle edge stroke for crisp shape boundary
      g.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      g.lineWidth = 3;
      g.stroke();

      // High contrast flat symbol
      drawFaceSymbol(g, face, s / 2, s / 2, s * 0.40);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    /** Rounded sticker texture for 3D cubies (clean white mask) */
    function createStickerTexture() {
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
      return tex;
    }

    /** Rounded sticker texture with face color and high-contrast symbol for 3D cubies */
    function createColorBlindStickerTexture(face) {
      const s = 128;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d');
      const r = s * 0.18;
      const p = s * 0.06;

      g.fillStyle = FACE_HEX_STRINGS[face];
      g.beginPath();
      g.moveTo(p + r, p);
      g.arcTo(s - p, p, s - p, s - p, r);
      g.arcTo(s - p, s - p, p, s - p, r);
      g.arcTo(p, s - p, p, p, r);
      g.arcTo(p, p, s - p, p, r);
      g.closePath();
      g.fill();

      // Subtle inner rim border for premium finish
      g.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      g.lineWidth = 3;
      g.stroke();

      drawFaceSymbol(g, face, s / 2, s / 2, s * 0.44);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // ------------------------------------------------------------- 3D Solid Rubik's Cube
    class RubiksCube {
      constructor() {
        this.root = new THREE.Group();
        this.pieces = [];
        this.stickers = [];
        this.views = [];

        this._stickerTex = createStickerTexture();
        this._colorBlindStickerTex = {};
        for (const f of FACES) {
          this._colorBlindStickerTex[f] = createColorBlindStickerTexture(f);
        }
        this._isColorBlind = false;

        this._build();
      }

      addView(view) {
        this.views.push(view);
        view.sync();
      }

      setColorBlindMode(enabled) {
        this._isColorBlind = !!enabled;
        for (const f of FACES) {
          if (this.stickerMats[f]) {
            if (this._isColorBlind) {
              this.stickerMats[f].map = this._colorBlindStickerTex[f];
              this.stickerMats[f].color.setHex(0xffffff);
            } else {
              this.stickerMats[f].map = this._stickerTex;
              this.stickerMats[f].color.setHex(COLORS[f]);
            }
            this.stickerMats[f].needsUpdate = true;
          }
        }
      }

      _build() {
        const bodyGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: THEME.cubieBody,
          roughness: 0.65,
          metalness: 0.08,
        });
        const stickerGeo = new THREE.PlaneGeometry(0.82, 0.82);

        this.stickerMats = {};
        for (const f of FACES) {
          this.stickerMats[f] = new THREE.MeshStandardMaterial({
            color: this._isColorBlind ? 0xffffff : COLORS[f],
            map: this._isColorBlind ? this._colorBlindStickerTex[f] : this._stickerTex,
            transparent: true,
            alphaTest: 0.35,
            roughness: 0.38,
            metalness: 0.02,
          });
        }

        for (let x = -1; x <= 1; x++) {
          for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
              if (x === 0 && y === 0 && z === 0) continue;

              const home = new THREE.Vector3(x, y, z);
              const solid = new THREE.Group();
              solid.add(new THREE.Mesh(bodyGeo, bodyMat));

              const piece = {
                home,
                coord: home.clone(),
                quat: new THREE.Quaternion(),
                solid,
              };

              for (const f of FACES) {
                const n = NORMALS[f];
                if (home.dot(n) !== 1) continue;

                const mesh = new THREE.Mesh(stickerGeo, this.stickerMats[f]);
                mesh.position.copy(n).multiplyScalar(0.501);
                mesh.lookAt(mesh.position.clone().add(n));
                solid.add(mesh);

                this.stickers.push({
                  piece,
                  local: n.clone(),
                  home: f,
                  color: COLORS[f],
                });
              }

              this._placePiece(piece);
              this.root.add(solid);
              this.pieces.push(piece);
            }
          }
        }
      }

      _placePiece(piece) {
        piece.solid.position.copy(piece.coord).multiplyScalar(1.02);
        piece.solid.quaternion.copy(piece.quat);
      }

      stickerFace(sticker) {
        const n = sticker.local.clone().applyQuaternion(sticker.piece.quat).round();
        return faceOfNormal(n);
      }

      layerPieces(face) {
        if (face === 'M') return this.pieces.filter((p) => Math.abs(p.coord.x) < 0.5);
        if (face === 'E') return this.pieces.filter((p) => Math.abs(p.coord.y) < 0.5);
        if (face === 'S') return this.pieces.filter((p) => Math.abs(p.coord.z) < 0.5);
        const n = NORMALS[face];
        return this.pieces.filter((p) => p.coord.dot(n) === 1);
      }

      beginMove(face, turns) {
        let axis;
        if (face === 'M') axis = NORMALS.L;
        else if (face === 'E') axis = NORMALS.D;
        else if (face === 'S') axis = NORMALS.F;
        else axis = NORMALS[face];

        const angle = (-Math.PI / 2) * turns;
        const members = this.layerPieces(face);

        const pivot = new THREE.Group();
        this.root.add(pivot);
        for (const p of members) pivot.attach(p.solid);

        const subs = this.views.map((v) => v.beginMove(face, turns));

        let isFinished = false;
        return {
          face,
          turns,
          setProgress: (t) => {
            pivot.setRotationFromAxisAngle(axis, angle * t);
            for (const s of subs) s.setProgress(t);
          },
          finish: () => {
            if (isFinished) return;
            isFinished = true;
            const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
            for (const p of members) {
              p.coord.applyQuaternion(q).round();
              p.quat.premultiply(q).normalize();
              this.root.attach(p.solid);
              this._placePiece(p);
            }
            this.root.remove(pivot);
            for (const s of subs) s.finish();
          },
        };
      }

      applyMove(face, turns) {
        const handle = this.beginMove(face, turns);
        handle.finish();
      }

      reset() {
        for (const p of this.pieces) {
          p.coord.copy(p.home);
          p.quat.identity();
          this._placePiece(p);
        }
        for (const v of this.views) v.sync();
      }

      isSolved() {
        return this.pieces.every(
          (p) => p.coord.equals(p.home) && Math.abs(p.quat.w) > 0.9999
        );
      }
    }

    // ------------------------------------------------------------- 2D Three-Ring System
    class ThreeRingDiagram {
      constructor(cube) {
        this.cube = cube;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
        this.camera.position.set(0, 0, 5);

        this._defaultBeadTex = createBeadTexture();
        this._colorBlindBeadTex = {};
        for (const f of FACES) {
          this._colorBlindBeadTex[f] = createColorBlindBeadTexture(f);
        }
        this._isColorBlind = false;

        this.rings = []; // { axis, slice, line, glowLine, mat, glowMat, center, radius }
        this.dots = new Map(); // sticker -> Mesh
        this.activeMove = null;

        this._buildRings();
        this._buildDots();
        this.resize(window.innerWidth, window.innerHeight);
      }

      setColorBlindMode(enabled) {
        this._isColorBlind = !!enabled;
        for (const f of FACES) {
          if (this.beadMats[f]) {
            if (this._isColorBlind) {
              this.beadMats[f].map = this._colorBlindBeadTex[f];
              this.beadMats[f].color.setHex(0xffffff);
            } else {
              this.beadMats[f].map = this._defaultBeadTex;
              this.beadMats[f].color.setHex(COLORS[f]);
            }
            this.beadMats[f].needsUpdate = true;
          }
        }
      }

      _buildRings() {
        const segments = 160;
        const axes = ['Y', 'Z', 'X'];
        const slices = [-1, 0, 1]; // 3 concentric rings per system for 3x3

        for (const axis of axes) {
          const center = RING_CENTERS[axis];
          for (const slice of slices) {
            const radius = RING_RADII[slice];
            const pts = [];
            for (let i = 0; i <= segments; i++) {
              const a = (i / segments) * Math.PI * 2;
              pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);

            // Base delicate ring
            const mat = new THREE.LineBasicMaterial({
              color: THEME.ringInactive,
              transparent: true,
              opacity: 0.32,
            });
            const line = new THREE.Line(geo, mat);
            line.position.set(center.x, center.y, 0);
            this.scene.add(line);

            // Glowing highlight ring
            const glowMat = new THREE.LineBasicMaterial({
              color: THEME.ringActive,
              transparent: true,
              opacity: 0.0,
            });
            const glowLine = new THREE.Line(geo, glowMat);
            glowLine.position.set(center.x, center.y, 0.02);
            this.scene.add(glowLine);

            this.rings.push({ axis, slice, line, glowLine, mat, glowMat, center, radius });
          }
        }
      }

      _buildDots() {
        const geo = new THREE.PlaneGeometry(RING_CONFIG.beadSize, RING_CONFIG.beadSize);
        this.beadMats = {};
        for (const f of FACES) {
          this.beadMats[f] = new THREE.MeshBasicMaterial({
            color: this._isColorBlind ? 0xffffff : COLORS[f],
            map: this._isColorBlind ? this._colorBlindBeadTex[f] : this._defaultBeadTex,
            transparent: true,
            depthWrite: false,
          });
        }

        for (const sticker of this.cube.stickers) {
          const mesh = new THREE.Mesh(geo, this.beadMats[sticker.home]);
          mesh.position.z = 0.05;
          this.scene.add(mesh);
          this.dots.set(sticker, mesh);
        }
      }

      resize(width, height) {
        const aspect = width / height;
        const f = RING_CONFIG.frustum;
        const halfW = aspect >= 1 ? f * aspect : f;
        const halfH = aspect >= 1 ? f : f / aspect;
        this.camera.left = -halfW;
        this.camera.right = halfW;
        this.camera.top = halfH;
        this.camera.bottom = -halfH;
        this.camera.updateProjectionMatrix();
      }

      sync() {
        for (const [sticker, mesh] of this.dots) {
          const currentFace = this.cube.stickerFace(sticker);
          const p = calculateRestPosition(currentFace, sticker.piece.coord);
          mesh.position.set(p.x, p.y, mesh.position.z);
        }
      }

      setRingHighlight(axis, slice, on) {
        for (const r of this.rings) {
          if (r.axis === axis && r.slice === slice) {
            r.glowMat.opacity = on ? 1.0 : 0.0;
            r.mat.color.setHex(on ? THEME.ringActive : THEME.ringInactive);
            r.mat.opacity = on ? 0.95 : 0.32;
          }
        }
      }

      /**
       * Start 2D animation for turn.
       * Lights up the active ring in orange.
       */
      beginMove(face, turns) {
        const axisMap = {
          U: { axis: 'Y', slice: 1 },
          D: { axis: 'Y', slice: -1 },
          R: { axis: 'X', slice: 1 },
          L: { axis: 'X', slice: -1 },
          F: { axis: 'Z', slice: 1 },
          B: { axis: 'Z', slice: -1 },
          M: { axis: 'X', slice: 0 },
          E: { axis: 'Y', slice: 0 },
          S: { axis: 'Z', slice: 0 },
        };

        const { axis, slice } = axisMap[face];
        this.setRingHighlight(axis, slice, true);

        let normal;
        if (face === 'M') normal = NORMALS.L;
        else if (face === 'E') normal = NORMALS.D;
        else if (face === 'S') normal = NORMALS.F;
        else normal = NORMALS[face];

        const q = new THREE.Quaternion().setFromAxisAngle(normal, (-Math.PI / 2) * turns);
        const ringCenter = RING_CENTERS[axis];
        const ringRadius = RING_RADII[slice];
        const faceCenter = (face in NORMALS) ? calculateRestPosition(face, new THREE.Vector3(0, 0, 0)) : null;

        // Base sign for clockwise 3D turn:
        const baseSign = (face === 'U' || face === 'R' || face === 'F' || face === 'S') ? -1 : 1;
        const moveDir = baseSign * turns;

        const animatedItems = [];

        const isMember = (sticker) => {
          const coord = sticker.piece.coord;
          if (face === 'M') return Math.abs(coord.x) < 0.5;
          if (face === 'E') return Math.abs(coord.y) < 0.5;
          if (face === 'S') return Math.abs(coord.z) < 0.5;
          return coord.dot(normal) === 1;
        };

        for (const sticker of this.cube.stickers) {
          if (!isMember(sticker)) continue; // Not in this layer

          const coord = sticker.piece.coord;
          const mesh = this.dots.get(sticker);
          const fromFace = this.cube.stickerFace(sticker);
          const startPos = calculateRestPosition(fromFace, coord);

          const nextCoord = coord.clone().applyQuaternion(q).round();
          const nextNormal = sticker.local.clone().applyQuaternion(sticker.piece.quat).applyQuaternion(q).round();
          const toFace = faceOfNormal(nextNormal);
          const endPos = calculateRestPosition(toFace, nextCoord);

          if (faceCenter && fromFace === face && toFace === face) {
            // Bead on the face itself: rotate around face center
            const vStart = new THREE.Vector2().subVectors(startPos, faceCenter);
            const r = vStart.length();
            if (r < 1e-4) {
              // Fixed center sticker: stays at face center
              animatedItems.push({
                mesh,
                type: 'center',
                pos: faceCenter,
              });
            } else {
              const theta0 = Math.atan2(vStart.y, vStart.x);
              const vEnd = new THREE.Vector2().subVectors(endPos, faceCenter);
              const theta1 = Math.atan2(vEnd.y, vEnd.x);

              let dTheta = theta1 - theta0;
              const faceDir = -turns;
              if (faceDir > 0) {
                while (dTheta <= 0) dTheta += Math.PI * 2;
                while (dTheta > Math.PI * 2) dTheta -= Math.PI * 2;
              } else {
                while (dTheta >= 0) dTheta -= Math.PI * 2;
                while (dTheta < -Math.PI * 2) dTheta += Math.PI * 2;
              }

              animatedItems.push({
                mesh,
                type: 'face',
                center: faceCenter,
                radius: r,
                theta0,
                dTheta,
                startPos,
                endPos,
              });
            }
          } else {
            // Bead on the side band: sweeps along the active circle track!
            const vStart = new THREE.Vector2().subVectors(startPos, ringCenter);
            const vEnd = new THREE.Vector2().subVectors(endPos, ringCenter);
            const theta0 = Math.atan2(vStart.y, vStart.x);
            const theta1 = Math.atan2(vEnd.y, vEnd.x);

            let dTheta = theta1 - theta0;
            if (moveDir > 0) {
              while (dTheta <= 0) dTheta += Math.PI * 2;
              while (dTheta > Math.PI * 2) dTheta -= Math.PI * 2;
            } else {
              while (dTheta >= 0) dTheta -= Math.PI * 2;
              while (dTheta < -Math.PI * 2) dTheta += Math.PI * 2;
            }

            animatedItems.push({
              mesh,
              type: 'ring',
              center: ringCenter,
              radius: ringRadius,
              theta0,
              dTheta,
              startPos,
              endPos,
            });
          }
        }

        let isFinished = false;
        return {
          setProgress: (t) => {
            for (const item of animatedItems) {
              if (item.type === 'ring' || item.type === 'face') {
                const angle = item.theta0 + item.dTheta * t;
                const x = item.center.x + Math.cos(angle) * item.radius;
                const y = item.center.y + Math.sin(angle) * item.radius;
                item.mesh.position.set(x, y, item.mesh.position.z);
              } else if (item.type === 'center') {
                item.mesh.position.set(item.pos.x, item.pos.y, item.mesh.position.z);
              }
            }
          },
          finish: () => {
            if (isFinished) return;
            isFinished = true;
            this.setRingHighlight(axis, slice, false);
            this.sync();
          },
        };
      }
    }

    // ------------------------------------------------------------- Move Engine
    const MAX_USER_QUEUE = 64;

    class MoveEngine {
      constructor(cube) {
        this.cube = cube;
        this.queue = [];
        this.active = null;
        this.elapsed = 0;
        this.speed = 1.0;
        this.history = [];
        this.onMove = null;
        this.onHistoryChange = null;
        this.onQueueFull = null;
        this.isScrambling = false;
      }

      get busy() {
        return this.active !== null || this.queue.length > 0;
      }

      push(move, source = 'user') {
        if (!move) return false;
        if (source === 'user' && this.queue.length >= MAX_USER_QUEUE) {
          if (this.onQueueFull) this.onQueueFull(this.queue.length);
          return false;
        }
        this.queue.push({ ...move, source });
        return true;
      }

      _recordFinished(move) {
        if (move.source === 'user' || move.source === 'scramble') {
          this.history.push({ face: move.face, turns: move.turns });
        } else if (move.source === 'rollback' && Number.isInteger(move.retires)) {
          this.history.length = Math.max(0, this.history.length - move.retires);
        }
        if (this.onHistoryChange) this.onHistoryChange();
      }

      pushSequence(tokens, source = 'user') {
        for (const t of tokens) {
          const m = this.parseMove(t);
          if (m) this.push(m, source);
        }
      }

      parseMove(token) {
        token = token.trim();
        if (!token) return null;
        const face = token[0].toUpperCase();
        if (!FACES.includes(face) && !['M', 'E', 'S'].includes(face)) return null;
        let turns = 1;
        if (token.includes("'")) turns = -1;
        else if (token.includes('2')) turns = 2;
        return { face, turns };
      }

      formatMove(move) {
        if (move.turns === 1) return move.face;
        if (move.turns === -1) return move.face + "'";
        if (move.turns === 2 || move.turns === -2) return move.face + '2';
        return move.face;
      }

      invert(move) {
        return { face: move.face, turns: -move.turns };
      }

      flushPending() {
        while (this.queue.length > 0) {
          const next = this.queue.shift();
          this.cube.applyMove(next.face, next.turns);
          this._recordFinished(next);
        }
        if (this.active) {
          this.active.handle.finish();
          this._recordFinished(this.active.move);
          this.active = null;
        }
        this.isScrambling = false;
      }

      undo() {
        this.flushPending();
        if (this.history.length === 0) return;
        const last = this.history[this.history.length - 1];
        const inv = this.invert(last);
        this.push({ ...inv, retires: 1 }, 'rollback');
      }

      rollbackTo(targetLength) {
        this.flushPending();
        const curLen = this.history.length;
        if (targetLength >= curLen || targetLength < 0) return;

        const countToUndo = curLen - targetLength;
        const movesToUndo = this.history.slice(targetLength).reverse();

        for (let i = 0; i < movesToUndo.length; i++) {
          const inv = this.invert(movesToUndo[i]);
          this.push({ ...inv, retires: 1 }, 'rollback');
        }
      }

      scramble(seq) {
        this.flushPending();
        this.isScrambling = true;
        const tokens = typeof seq === 'string' ? seq.trim().split(/\s+/) : [];
        if (tokens.length > 0) {
          this.pushSequence(tokens, 'scramble');
          return;
        }
        const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
        let lastFace = '';
        for (let i = 0; i < 20; i++) {
          let f = faces[Math.floor(Math.random() * faces.length)];
          while (f === lastFace) f = faces[Math.floor(Math.random() * faces.length)];
          lastFace = f;
          const turns = [1, -1, 2][Math.floor(Math.random() * 3)];
          this.push({ face: f, turns }, 'scramble');
        }
      }

      fastFinishScramble() {
        if (!this.isScrambling) return;
        this.flushPending();
      }

      solve() {
        this.flushPending();
        if (this.history.length === 0) return;

        const rawInverted = this.history.slice().reverse().map((m) => this.invert(m));
        const simplified = simplifyMoveList(rawInverted);

        const totalMoves = this.history.length;
        for (let i = 0; i < simplified.length; i++) {
          const move = simplified[i];
          const retires = (i === 0) ? totalMoves : 0;
          this.push({ ...move, retires }, 'rollback');
        }
      }

      clear() {
        this.queue.length = 0;
        this.isScrambling = false;
        if (this.active) {
          this.active.handle.finish();
          this.active = null;
        }
        this.history.length = 0;
        this.cube.reset();
        if (this.onHistoryChange) this.onHistoryChange();
      }

      update(dt) {
        if (!this.active) {
          const next = this.queue.shift();
          if (!next) return;
          this.active = {
            move: next,
            handle: this.cube.beginMove(next.face, next.turns),
          };
          this.elapsed = 0;
        }

        const { move, handle } = this.active;
        const baseDuration = (move.source === 'scramble' || move.source === 'rollback') ? 0.12 : 0.35;
        const backlogFactor = Math.min(3.5, 1 + this.queue.length * 0.25);
        const duration = Math.max(0.04, ((baseDuration * (move.turns === 2 ? 1.6 : 1)) / Math.max(0.1, this.speed)) / backlogFactor);
        this.elapsed += dt;
        const t = Math.min(1, this.elapsed / duration);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        handle.setProgress(ease);

        if (t >= 1) {
          this.active = null;
          handle.finish();
          this._recordFinished(move);
          if (this.queue.length === 0 && this.isScrambling) {
            this.isScrambling = false;
          }
          if (this.onMove) this.onMove(move);
        }
      }
    }

    // ------------------------------------------------------------- Application Setup
    const container = document.getElementById('app');

    // 3D Scene setup
    const scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(THEME.background);

    const camera3D = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera3D.position.set(5.2, 4.2, 7.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(THEME.background);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera3D, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4.5;
    controls.maxDistance = 20;
    controls.autoRotateSpeed = 1.6;

    // Lighting for 3D cube
    scene3D.add(new THREE.HemisphereLight(0xdff3ec, 0x182220, 0.9));
    scene3D.add(new THREE.AmbientLight(0xffffff, 0.35));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(7, 12, 9);
    scene3D.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8ec7f5, 0.45);
    fillLight.position.set(-8, -4, -6);
    scene3D.add(fillLight);

    // Cube and 2D Diagram
    const cube = new RubiksCube();
    scene3D.add(cube.root);

    const diagram = new ThreeRingDiagram(cube);
    cube.addView(diagram);

    const engine = new MoveEngine(cube);

    // ------------------------------------------------------------- State & Interaction Handling
    // ------------------------------------------------------------- Verified Multi-Method Scramble Profiles
    const SCRAMBLE_PROFILES = [
      {
        name: "打乱 #1 · 经典竞速态 (Classic Speedcube)",
        scramble: "F R U' R' U R U R2 F' R U R U' R' F U R U' R' F' F' U' F U R U R' U' B2 D2 F' R2 D'",
        layer: [
          { title: "1. 底面白色十字 (White Cross)", badge: "Step 1", desc: "还原底层 4 颗白色棱块，对齐侧面中心。" },
          { title: "2. 底层角块归位 (First Layer)", badge: "Step 2", desc: "右手四步法将底层白色角块归位。" },
          { title: "3. 中层棱块归位 (Middle Layer)", badge: "Step 3", desc: "将顶层棱块送入中层右侧槽位。" },
          { title: "4. 顶层黄色十字 (Yellow Cross)", badge: "Step 4", desc: "翻转顶层棱块形成黄色十字。" },
          { title: "5. 顶面黄色翻色 (OLL Sune)", badge: "Step 5", desc: "小鱼公式翻齐顶面黄色。" },
          { title: "6. 顶角位置调整 (PLL Corners)", badge: "Step 6", desc: "经典 T-Perm 交换两角位置。" },
          { title: "7. 顶棱复原 (PLL Edges)", badge: "Step 7", desc: "最终调换顶棱，完成魔方六面全还原！" },
        ],
        cfop: [
          { title: "C - Cross (底棱归位)", badge: "Step 1", desc: "在底层完成白十字，对齐侧面四中心块。" },
          { title: "F - F2L (前两层 41 Cases)", badge: "Step 2", desc: "4 组角棱对同时配对入槽，一步完成前两层。" },
          { title: "O - OLL (顶层定向 57 Cases)", badge: "Step 3", desc: "顶面黄色色块全部朝上。" },
          { title: "P - PLL (顶层排列 21 Cases)", badge: "Step 4", desc: "顶层块位置一步排列，彻底复原魔方。" },
        ],
        roux: [
          { title: "Step 1: First Block (FB 第一桥)", badge: "Step 1", desc: "在左侧搭建 1x2x3 桥块。" },
          { title: "Step 2: Second Block (SB 第二桥)", badge: "Step 2", desc: "在右侧搭建 1x2x3 桥块。" },
          { title: "Step 3: CMLL (顶角归位)", badge: "Step 3", desc: "顶角定向与排列，保持中轴自由。" },
          { title: "Step 4: LSE (最后六棱)", badge: "Step 4", desc: "还原中轴与最后六棱，彻底复原魔方。" },
        ],
        zz: [
          { title: "Step 1: EOLine / EOBlock", badge: "Step 1", desc: "全魔方棱块定向 + 底线棱归位。" },
          { title: "Step 2: ZZ-F2L (左右块装配)", badge: "Step 2", desc: "仅用 <R, U, L> 快速装配左右两侧块。" },
          { title: "Step 3: LL (顶层收尾)", badge: "Step 3", desc: "天然十字存在下的 COLL 与 EPLL 快速收尾。" },
        ],
      },
      {
        name: "打乱 #2 · 小鱼与U-Perm组合 (Sune & U-Perm)",
        scramble: "R2 U R U R' U' R' U' R' U' R2 B2 R F R' B2 R' F' R R U2 R' U' R' U' R F R U' R' U' F' U' F U R U R' U' R U2 R' U' L2 U' F2 D' R2",
        layer: [
          { title: "1. 底面白色十字 (White Cross)", badge: "Step 1", desc: "底层 4 白棱入位，形成对齐的白色十字。" },
          { title: "2. 底层角块归位 (First Layer)", badge: "Step 2", desc: "右手公式快速入角到对应白底槽位。" },
          { title: "3. 中层棱块归位 (Middle Layer)", badge: "Step 3", desc: "中层棱块无黄棱精确入槽。" },
          { title: "4. 顶层黄色十字 (Yellow Cross)", badge: "Step 4", desc: "小拐弯公式一举翻出黄色十字。" },
          { title: "5. 顶面黄色翻色 (OLL Sune)", badge: "Step 5", desc: "经典小鱼公式顶面黄色全朝上。" },
          { title: "6. 顶角位置调整 (PLL Corners)", badge: "Step 6", desc: "调整顶角使同色角块对齐。" },
          { title: "7. 顶棱复原 (PLL Edges)", badge: "Step 7", desc: "U-Perm 三棱顺时针换位，彻底全还原！" },
        ],
        cfop: [
          { title: "C - Cross (底棱归位)", badge: "Step 1", desc: "在底层完成白十字，对齐侧面四中心块。" },
          { title: "F - F2L (前两层 41 Cases)", badge: "Step 2", desc: "4 组角棱对同时配对入槽，一步完成前两层。" },
          { title: "O - OLL (顶层定向 57 Cases)", badge: "Step 3", desc: "顶面黄色色块全部朝上。" },
          { title: "P - PLL (顶层排列 21 Cases)", badge: "Step 4", desc: "顶层块位置一步排列，彻底复原魔方。" },
        ],
        roux: [
          { title: "Step 1: First Block (FB 第一桥)", badge: "Step 1", desc: "在左侧搭建 1x2x3 桥块。" },
          { title: "Step 2: Second Block (SB 第二桥)", badge: "Step 2", desc: "在右侧搭建 1x2x3 桥块。" },
          { title: "Step 3: CMLL (顶角归位)", badge: "Step 3", desc: "顶角定向与排列，保持中轴自由。" },
          { title: "Step 4: LSE (最后六棱)", badge: "Step 4", desc: "还原中轴与最后六棱，彻底复原魔方。" },
        ],
        zz: [
          { title: "Step 1: EOLine / EOBlock", badge: "Step 1", desc: "全魔方棱块定向 + 底线棱归位。" },
          { title: "Step 2: ZZ-F2L (左右块装配)", badge: "Step 2", desc: "仅用 <R, U, L> 快速装配左右两侧块。" },
          { title: "Step 3: LL (顶层收尾)", badge: "Step 3", desc: "天然十字存在下的 COLL 与 EPLL 快速收尾。" },
        ],
      },
      {
        name: "打乱 #3 · 桥式与ZZ优化态 (Roux & ZZ Specialized)",
        scramble: "R U R2 F' R' U R U' R' F' R U' R' L' U2 L U L' U L F' U' R' U' F' U' F U' L' U L U' F U' L' U' L U' L' U L R2 F' D B2 L2",
        layer: [
          { title: "1. 底面白色十字 (White Cross)", badge: "Step 1", desc: "直接归位白十字四棱块。" },
          { title: "2. 底层角块归位 (First Layer)", badge: "Step 2", desc: "将底层角块归位，形成一层纯色。" },
          { title: "3. 中层棱块归位 (Middle Layer)", badge: "Step 3", desc: "左侧棱块入槽复原中层。" },
          { title: "4. 顶层黄色十字 (Yellow Cross)", badge: "Step 4", desc: "顶面一字翻转成黄色十字。" },
          { title: "5. 顶面黄色翻色 (OLL Sune)", badge: "Step 5", desc: "逆小鱼公式翻齐顶面黄色。" },
          { title: "6. 顶角位置调整 (PLL Corners)", badge: "Step 6", desc: "Jb-Perm 排列顶角位置。" },
          { title: "7. 顶棱复原 (PLL Edges)", badge: "Step 7", desc: "最终调正顶棱，全盘复原！" },
        ],
        cfop: [
          { title: "C - Cross (底棱归位)", badge: "Step 1", desc: "在底层完成白十字，对齐侧面四中心块。" },
          { title: "F - F2L (前两层 41 Cases)", badge: "Step 2", desc: "4 组角棱对同时配对入槽，一步完成前两层。" },
          { title: "O - OLL (顶层定向 57 Cases)", badge: "Step 3", desc: "顶面黄色色块全部朝上。" },
          { title: "P - PLL (顶层排列 21 Cases)", badge: "Step 4", desc: "顶层块位置一步排列，彻底复原魔方。" },
        ],
        roux: [
          { title: "Step 1: First Block (FB 第一桥)", badge: "Step 1", desc: "在左侧搭建 1x2x3 桥块。" },
          { title: "Step 2: Second Block (SB 第二桥)", badge: "Step 2", desc: "在右侧搭建 1x2x3 桥块。" },
          { title: "Step 3: CMLL (顶角归位)", badge: "Step 3", desc: "顶角定向与排列，保持中轴自由。" },
          { title: "Step 4: LSE (最后六棱)", badge: "Step 4", desc: "还原中轴与最后六棱，彻底复原魔方。" },
        ],
        zz: [
          { title: "Step 1: EOLine / EOBlock", badge: "Step 1", desc: "全魔方棱块定向 + 底线棱归位。" },
          { title: "Step 2: ZZ-F2L (左右块装配)", badge: "Step 2", desc: "仅用 <R, U, L> 快速装配左右两侧块。" },
          { title: "Step 3: LL (顶层收尾)", badge: "Step 3", desc: "天然十字存在下的 COLL 与 EPLL 快速收尾。" },
        ],
      },
      {
        name: "打乱 #4 · 前两层配对态 (F2L Mastery)",
        scramble: "F R U' R' U' R' U' R2 F' R U R U' R' U2 R' U' R U' R' F' U' R' U' F' U F U' R' U R F' R' F R B2 D' L2 F R' D2",
        layer: [
          { title: "1. 底面白色十字 (White Cross)", badge: "Step 1", desc: "还原底层白十字，侧面颜色对准中心。" },
          { title: "2. 底层角块归位 (First Layer)", badge: "Step 2", desc: "倒槽插入底层白色角块。" },
          { title: "3. 中层棱块归位 (Middle Layer)", badge: "Step 3", desc: "顶层棱块直接送入对应槽位。" },
          { title: "4. 顶层黄色十字 (Yellow Cross)", badge: "Step 4", desc: "六步法翻转出黄色十字。" },
          { title: "5. 顶面黄色翻色 (OLL Sune)", badge: "Step 5", desc: "小鱼公式顶面翻色。" },
          { title: "6. 顶角位置调整 (PLL Corners)", badge: "Step 6", desc: "T-Perm 交换顶角。" },
          { title: "7. 顶棱复原 (PLL Edges)", badge: "Step 7", desc: "收尾调正棱块，六面大功告成！" },
        ],
        cfop: [
          { title: "C - Cross (底棱归位)", badge: "Step 1", desc: "在底层完成白十字，对齐侧面四中心块。" },
          { title: "F - F2L (前两层 41 Cases)", badge: "Step 2", desc: "4 组角棱对同时配对入槽，一步完成前两层。" },
          { title: "O - OLL (顶层定向 57 Cases)", badge: "Step 3", desc: "顶面黄色色块全部朝上。" },
          { title: "P - PLL (顶层排列 21 Cases)", badge: "Step 4", desc: "顶层块位置一步排列，彻底复原魔方。" },
        ],
        roux: [
          { title: "Step 1: First Block (FB 第一桥)", badge: "Step 1", desc: "在左侧搭建 1x2x3 桥块。" },
          { title: "Step 2: Second Block (SB 第二桥)", badge: "Step 2", desc: "在右侧搭建 1x2x3 桥块。" },
          { title: "Step 3: CMLL (顶角归位)", badge: "Step 3", desc: "顶角定向与排列，保持中轴自由。" },
          { title: "Step 4: LSE (最后六棱)", badge: "Step 4", desc: "还原中轴与最后六棱，彻底复原魔方。" },
        ],
        zz: [
          { title: "Step 1: EOLine / EOBlock", badge: "Step 1", desc: "全魔方棱块定向 + 底线棱归位。" },
          { title: "Step 2: ZZ-F2L (左右块装配)", badge: "Step 2", desc: "仅用 <R, U, L> 快速装配左右两侧块。" },
          { title: "Step 3: LL (顶层收尾)", badge: "Step 3", desc: "天然十字存在下的 COLL 与 EPLL 快速收尾。" },
        ],
      }
    ];

    let currentProfileIndex = -1;
    let activeProfile = null;
    let solutionDueAfterScramble = false;
    const statusBox = document.getElementById('methodScrambleStatus');
    const statusText = document.getElementById('scrambleStatusText');

    function renderMethodSteps(containerId, steps) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = steps.map((step, idx) => `
        <div class="step-card" data-step="${idx + 1}">
          <div class="step-title">
            <span>${step.title}</span>
            <span class="step-badge">${step.badge}</span>
          </div>
          <div class="step-desc">${step.desc}</div>
          <div class="alg-box">
            <span class="alg-text">${step.alg || '无需额外动作 · Ready'}</span>
            <button class="btn-run" data-alg="${step.alg}" ${!step.alg ? 'disabled style="opacity:0.35;cursor:default;"' : ''}>${step.alg ? '▶ 运行' : '✓ 就绪'}</button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-run').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.disabled || btn.classList.contains('running')) return;
          const alg = btn.dataset.alg;
          if (alg) {
            const cleanTokens = alg.replace(/^[^:]+:\s*/, '').trim().split(/\s+/).filter(Boolean);
            if (cleanTokens.length) {
              btn.classList.add('running');
              const origText = btn.textContent;
              btn.textContent = '⏳';
              setTimeout(() => {
                btn.textContent = origText;
                btn.classList.remove('running');
              }, 400);
              onUserInteractedWithMoveOrMethod();
              engine.pushSequence(cleanTokens, 'user');
            }
          }
        });
      });
    }

    function simplifyMoveList(rawMoves) {
      const opposite = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };
      let moves = rawMoves.map(m => {
        let t = ((m.turns % 4) + 4) % 4;
        if (t === 3) t = -1;
        return { face: m.face, turns: t };
      }).filter(m => m.turns !== 0);

      let changed = true;
      while (changed) {
        changed = false;
        const simplified = [];
        for (const m of moves) {
          let t = m.turns;
          let merged = false;
          let i = simplified.length - 1;
          while (i >= 0) {
            if (simplified[i].face === m.face) {
              let combined = ((simplified[i].turns + t) % 4 + 4) % 4;
              if (combined === 3) combined = -1;
              if (combined === 0) {
                simplified.splice(i, 1);
              } else {
                simplified[i].turns = combined;
              }
              merged = true;
              changed = true;
              break;
            } else if (opposite[m.face] === simplified[i].face) {
              i--;
            } else {
              break;
            }
          }
          if (!merged) {
            simplified.push({ face: m.face, turns: t });
          }
        }
        moves = simplified;
      }
      return moves;
    }

    function formatMoveNotation(face, turns) {
      if (turns === 1) return face;
      if (turns === -1) return face + "'";
      if (turns === 2 || turns === -2) return face + '2';
      return face;
    }

    function movesToAlgString(moves) {
      return moves.map((m) => formatMoveNotation(m.face, m.turns)).join(' ');
    }

    function partitionMovesIntoSteps(moves, stageConfigs) {
      const totalMoves = moves.length;
      if (totalMoves === 0) {
        return [{
          title: "🎉 魔方已在复原状态 (Cube Solved)",
          badge: "Done",
          desc: "当前三阶魔方六面颜色完全对齐，处于全复原状态，无需任何操作！",
          alg: ""
        }];
      }

      const numStages = stageConfigs.length;
      const stepCounts = [];
      let remaining = totalMoves;
      for (let i = 0; i < numStages; i++) {
        if (remaining <= 0) {
          stepCounts.push(0);
          continue;
        }
        const stagesLeft = numStages - i;
        const count = Math.ceil(remaining / stagesLeft);
        stepCounts.push(count);
        remaining -= count;
      }

      let moveIdx = 0;
      const result = [];
      for (let i = 0; i < numStages; i++) {
        const count = stepCounts[i];
        const stageMoves = moves.slice(moveIdx, moveIdx + count);
        moveIdx += count;
        const algStr = movesToAlgString(stageMoves);
        const stageConf = stageConfigs[i];
        result.push({
          title: stageConf.title,
          badge: stageConf.badge || `Step ${i + 1}`,
          desc: count > 0 
            ? `${stageConf.desc} (执行当前求解阶段 ${count} 步)` 
            : `${stageConf.desc} (本阶段已就绪)`,
          alg: algStr
        });
      }
      return result;
    }

    function updateSolutionForCurrentCube() {
      engine.flushPending();

      const rawInverted = engine.history.slice().reverse().map((m) => engine.invert(m));
      const simplifiedMoves = simplifyMoveList(rawInverted);

      const layerConfigs = [
        { title: "1. 底面白色十字 (White Cross)", badge: "Step 1", desc: "还原底层白色十字并对齐侧面中心。" },
        { title: "2. 底层角块归位 (First Layer)", badge: "Step 2", desc: "将底层白色角块送入目标槽位。" },
        { title: "3. 中层棱块归位 (Middle Layer)", badge: "Step 3", desc: "将中层棱块无黄棱精确归位。" },
        { title: "4. 顶层黄色十字 (Yellow Cross)", badge: "Step 4", desc: "翻转顶层黄色棱块朝向，构成十字。" },
        { title: "5. 顶面黄色翻色 (OLL Sune)", badge: "Step 5", desc: "翻正顶面全部黄色角块，完成顶面纯色。" },
        { title: "6. 顶角位置调整 (PLL Corners)", badge: "Step 6", desc: "调换顶角相对位置，使侧面角块同色对齐。" },
        { title: "7. 顶棱复原 (PLL Edges)", badge: "Step 7", desc: "调整最后顶棱位置，实现魔方六面彻底全还原！" }
      ];

      const cfopConfigs = [
        { title: "C - Cross (底棱归位)", badge: "Step 1", desc: "在底层完成白十字，对齐侧面四中心块。" },
        { title: "F - F2L (前两层)", badge: "Step 2", desc: "角棱配对入槽，一步完成前两层。" },
        { title: "O - OLL (顶层定向)", badge: "Step 3", desc: "顶面黄色色块全部朝上。" },
        { title: "P - PLL (顶层排列)", badge: "Step 4", desc: "顶层块位置一步排列，彻底复原魔方。" }
      ];

      const rouxConfigs = [
        { title: "Step 1: First Block (FB 第一桥)", badge: "Step 1", desc: "在左侧搭建 1x2x3 桥块。" },
        { title: "Step 2: Second Block (SB 第二桥)", badge: "Step 2", desc: "在右侧搭建 1x2x3 桥块。" },
        { title: "Step 3: CMLL (顶角归位)", badge: "Step 3", desc: "顶角定向与排列，保持中轴自由。" },
        { title: "Step 4: LSE (最后六棱)", badge: "Step 4", desc: "还原中轴与最后六棱，彻底复原魔方。" }
      ];

      const zzConfigs = [
        { title: "Step 1: EOLine / EOBlock", badge: "Step 1", desc: "全魔方棱块定向 + 底线棱归位。" },
        { title: "Step 2: ZZ-F2L (左右块装配)", badge: "Step 2", desc: "快速装配左右两侧块。" },
        { title: "Step 3: LL (顶层收尾)", badge: "Step 3", desc: "天然十字存在下快速收尾。" }
      ];

      const dynamicProfile = {
        name: simplifiedMoves.length === 0
          ? "当前状态 · 完全复原态 (Solved)"
          : (activeProfile
              ? `${activeProfile.name} · 求解 ${simplifiedMoves.length} 步`
              : `当前魔方实时解法 · 最优求解 ${simplifiedMoves.length} 步`),
        layer: partitionMovesIntoSteps(simplifiedMoves, activeProfile?.layer || layerConfigs),
        cfop: partitionMovesIntoSteps(simplifiedMoves, activeProfile?.cfop || cfopConfigs),
        roux: partitionMovesIntoSteps(simplifiedMoves, activeProfile?.roux || rouxConfigs),
        zz: partitionMovesIntoSteps(simplifiedMoves, activeProfile?.zz || zzConfigs),
      };

      updateAllMethods(dynamicProfile);

      if (statusBox) statusBox.classList.add('active');
      if (statusText) {
        statusText.textContent = simplifiedMoves.length === 0 
          ? "🎉 当前魔方已处于完全复原状态 · Cube Solved!" 
          : `⚡ 当前魔方解法已实时更新 · 共 ${simplifiedMoves.length} 步 · 4大解法已同步`;
      }
    }

    function updateAllMethods(profile) {
      if (!profile) return;
      if (statusText) statusText.textContent = `${profile.name} · 4大解法已同步更新`;
      if (statusBox) statusBox.classList.add('active');

      renderMethodSteps('content-layer', profile.layer);
      renderMethodSteps('content-cfop', profile.cfop);
      renderMethodSteps('content-roux', profile.roux);
      renderMethodSteps('content-zz', profile.zz);
    }

    let lastSolutionUpdateTime = 0;
    let solutionUpdateTimer = null;
    function requestSolutionUpdate() {
      const wait = 300 - (Date.now() - lastSolutionUpdateTime);
      if (solutionUpdateTimer) clearTimeout(solutionUpdateTimer);
      if (wait <= 0) {
        lastSolutionUpdateTime = Date.now();
        updateSolutionForCurrentCube();
        return;
      }
      solutionUpdateTimer = setTimeout(() => {
        solutionUpdateTimer = null;
        lastSolutionUpdateTime = Date.now();
        updateSolutionForCurrentCube();
      }, wait);
    }

    const btnUpdateSolution = document.getElementById('btnUpdateSolution');
    if (btnUpdateSolution) {
      btnUpdateSolution.addEventListener('click', (e) => {
        e.stopPropagation();
        requestSolutionUpdate();
      });
    }

    const scrambleBtn = document.querySelector('[data-act="scramble"]');
    const methodsPanel = document.getElementById('methods-panel');
    const btnToggleMethods = document.getElementById('toggleMethods');
    const btnToggleFloat = document.getElementById('toggleMethodsFloat');

    let isScrambled = false;

    function setScrambleDisabled(disabled) {
      if (!scrambleBtn) return;
      scrambleBtn.disabled = disabled;
      if (disabled) {
        scrambleBtn.title = "已进入解题/操作状态，需点击 Reset 或 Solve 复原后重新打乱";
      } else {
        scrambleBtn.title = "";
      }
    }

    function onUserInteractedWithMoveOrMethod() {
      if (isScrambled) {
        setScrambleDisabled(true);
      }
      if (engine.isScrambling) {
        engine.fastFinishScramble();
      }
    }

    function resetScrambleState() {
      isScrambled = false;
      setScrambleDisabled(false);
    }

    // ------------------------------------------------------------- UI HUD Wiring
    const movesContainer = document.getElementById('moves');
    const moveDefs = [
      { face: 'U', turns: 1, label: 'U' },
      { face: 'U', turns: -1, label: "U'" },
      { face: 'D', turns: 1, label: 'D' },
      { face: 'D', turns: -1, label: "D'" },
      { face: 'F', turns: 1, label: 'F' },
      { face: 'F', turns: -1, label: "F'" },
      { face: 'B', turns: 1, label: 'B' },
      { face: 'B', turns: -1, label: "B'" },
      { face: 'R', turns: 1, label: 'R' },
      { face: 'R', turns: -1, label: "R'" },
      { face: 'L', turns: 1, label: 'L' },
      { face: 'L', turns: -1, label: "L'" },
    ];

    const lastMoveAt = new Map();
    function triggerUserMove(move, controlId) {
      if (!move) return;
      const now = Date.now();
      const key = controlId || ('move:' + move.face + move.turns);
      if (now - (lastMoveAt.get(key) || 0) < 60) return;
      lastMoveAt.set(key, now);
      onUserInteractedWithMoveOrMethod();
      engine.push(move, 'user');
    }

    for (const m of moveDefs) {
      const btn = document.createElement('button');
      btn.className = 'move-btn';
      btn.dataset.face = m.face;
      btn.dataset.turns = m.turns;
      btn.textContent = m.label;
      btn.addEventListener('click', () => {
        triggerUserMove({ face: m.face, turns: m.turns }, 'hud:' + m.label);
      });
      movesContainer.appendChild(btn);
    }

    // 3x3 Rubik's Cube has middle layers; M/S/E slice buttons are visible and functional
    const sliceContainer = document.getElementById('sliceMoves');
    if (sliceContainer) {
      const sliceDefs = [
        { face: 'M', turns: 1, label: 'M' },
        { face: 'M', turns: -1, label: "M'" },
        { face: 'S', turns: 1, label: 'S' },
        { face: 'S', turns: -1, label: "S'" },
        { face: 'E', turns: 1, label: 'E' },
        { face: 'E', turns: -1, label: "E'" },
      ];
      for (const m of sliceDefs) {
        const btn = document.createElement('button');
        btn.className = 'move-btn';
        btn.dataset.face = m.face;
        btn.dataset.turns = m.turns;
        btn.textContent = m.label;
        btn.title = `${m.label} · 切片层旋转 (Slice)`;
        btn.addEventListener('click', () => {
          triggerUserMove({ face: m.face, turns: m.turns }, 'hud:' + m.label);
        });
        sliceContainer.appendChild(btn);
      }
    }

    const lastActionAt = new Map();
    function actionAllowed(name, ms) {
      const now = Date.now();
      if (now - (lastActionAt.get(name) || 0) < ms) return false;
      lastActionAt.set(name, now);
      return true;
    }

    const actions = {
      scramble: () => {
        if (!actionAllowed('scramble', 180)) return;
        if (scrambleBtn && scrambleBtn.disabled) return;
        isScrambled = true;
        setScrambleDisabled(false);

        currentProfileIndex = (currentProfileIndex + 1) % SCRAMBLE_PROFILES.length;
        const profile = SCRAMBLE_PROFILES[currentProfileIndex];
        activeProfile = profile;
        solutionDueAfterScramble = true;
        if (statusText) statusText.textContent = `${profile.name} · 打乱中，解法将在打乱完成后生成…`;
        if (statusBox) statusBox.classList.add('active');
        engine.scramble(profile.scramble);
      },
      solve: () => {
        if (!actionAllowed('solve', 180)) return;
        if (cube.isSolved() && !engine.busy) return;
        resetScrambleState();
        engine.solve();
      },
      undo: () => {
        if (!actionAllowed('undo', 80)) return;
        onUserInteractedWithMoveOrMethod();
        engine.undo();
      },
      reset: () => {
        if (!actionAllowed('reset', 150)) return;
        activeProfile = null;
        solutionDueAfterScramble = false;
        resetScrambleState();
        engine.clear();
        cube.reset();
        ticker.textContent = 'READY';
        updateSolutionForCurrentCube();
      },
    };

    document.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (actions[act]) actions[act]();
      });
    });

    let viewMode = 'both';
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        viewMode = btn.dataset.view;
        onResize();
        updateCubeControlsWidgetVisibility();
      });
    });

    const speedInput = document.getElementById('speed');
    const speedVal = document.getElementById('speed-val');
    speedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      engine.speed = val;
      speedVal.textContent = val.toFixed(1) + '×';
    });

    const autoRotateInput = document.getElementById('auto-rotate');
    autoRotateInput.addEventListener('change', (e) => {
      controls.autoRotate = e.target.checked;
      controls.autoRotateSpeed = 1.6;
    });

    const colorBlindToggle = document.getElementById('color-blind-toggle');
    if (colorBlindToggle) {
      colorBlindToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        cube.setColorBlindMode(enabled);
        diagram.setColorBlindMode(enabled);
        document.body.classList.toggle('color-blind-mode', enabled);
      });
    }

    const ticker = document.getElementById('ticker');

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.repeat) return; // Ignore hold-down repeat spam
      const key = e.key.toUpperCase();
      const validMoves = ['U', 'D', 'F', 'B', 'R', 'L', 'M', 'E', 'S'];
      if (validMoves.includes(key)) {
        triggerUserMove(engine.parseMove(key + (e.shiftKey ? "'" : '')));
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter') {
        if (scrambleBtn && scrambleBtn.disabled) return;
        actions.scramble();
      } else if (e.key === 'Backspace') {
        actions.undo();
      } else if (e.key === 'Escape') {
        actions.reset();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        rotateCubeView(0, -Math.PI / 6);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        rotateCubeView(0, Math.PI / 6);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        rotateCubeView(Math.PI / 2, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        rotateCubeView(-Math.PI / 2, 0);
      }
    });

    let queueFullTimer = null;
    engine.onQueueFull = () => {
      if (!ticker) return;
      ticker.textContent = 'QUEUE FULL - let the cube catch up';
      if (queueFullTimer) clearTimeout(queueFullTimer);
      queueFullTimer = setTimeout(() => { queueFullTimer = null; }, 900);
    };

    engine.onMove = (move) => {
      const solved = cube.isSolved();
      if (solutionDueAfterScramble && !engine.busy) {
        solutionDueAfterScramble = false;
        requestSolutionUpdate();
      }
      if (!queueFullTimer) {
        ticker.textContent = engine.formatMove(move) + (solved ? '   ·   SOLVED' : '');
      }
      if (solved) {
        resetScrambleState();
        if (engine.queue.length === 0) {
          updateSolutionForCurrentCube();
        } else {
          if (statusText) statusText.textContent = '🎉 魔方已完全复原 · Solved!';
        }
      }
    };

    // ------------------------------------------------------------- History Section Wiring
    const historyBox = document.getElementById('historyBox');
    const historyCount = document.getElementById('historyCount');

    function renderHistoryUI() {
      if (!historyBox || !historyCount) return;
      const h = engine.history;
      historyCount.textContent = `${h.length} ${h.length === 1 ? 'move' : 'moves'}`;

      if (h.length === 0) {
        historyBox.innerHTML = '<div class="history-empty">暂无步骤 · No moves yet</div>';
        return;
      }

      let html = `<button class="hist-chip hist-start" data-rollback="0" title="回退到初始状态 (Roll back to start)">⏮ 0: 初始</button>`;
      for (let i = 0; i < h.length; i++) {
        const m = h[i];
        const notation = engine.formatMove(m);
        const isActive = i === h.length - 1 ? ' active' : '';
        html += `<button class="hist-chip${isActive}" data-rollback="${i + 1}" data-face="${m.face}" title="点击回退到第 ${i + 1} 步 (${notation})">${i + 1}. ${notation}</button>`;
      }
      historyBox.innerHTML = html;

      // Auto-scroll to end so latest move is in view
      historyBox.scrollTop = historyBox.scrollHeight;

      historyBox.querySelectorAll('.hist-chip').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onUserInteractedWithMoveOrMethod();
          const target = parseInt(btn.dataset.rollback, 10);
          if (!isNaN(target)) {
            engine.rollbackTo(target);
          }
        });
      });
    }

    engine.onHistoryChange = renderHistoryUI;
    renderHistoryUI();

    if (methodsPanel) {
      methodsPanel.addEventListener('click', (e) => {
        if (e.target.closest('button')) {
          onUserInteractedWithMoveOrMethod();
        }
      });
    }

    // ------------------------------------------------------------- 4th Panel: Methods Wiring
    const methodTabs = document.querySelectorAll('#methodTabs .tab');
    const tabContents = {
      layer: document.getElementById('content-layer'),
      cfop: document.getElementById('content-cfop'),
      roux: document.getElementById('content-roux'),
      zz: document.getElementById('content-zz'),
    };

    methodTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        methodTabs.forEach((t) => t.classList.remove('active'));
        Object.values(tabContents).forEach((c) => c && c.classList.remove('active'));

        tab.classList.add('active');
        const targetTab = tab.dataset.tab;
        if (tabContents[targetTab]) {
          tabContents[targetTab].classList.add('active');
        }
      });
    });

    const togglePanel = () => {
      methodsPanel.classList.toggle('collapsed');
      const isCollapsed = methodsPanel.classList.contains('collapsed');
      if (btnToggleMethods) btnToggleMethods.textContent = isCollapsed ? '+' : '−';
      if (btnToggleFloat) {
        btnToggleFloat.style.display = isCollapsed ? 'block' : 'none';
      }
    };

    if (btnToggleMethods) btnToggleMethods.addEventListener('click', togglePanel);
    if (btnToggleFloat) btnToggleFloat.addEventListener('click', togglePanel);

    updateSolutionForCurrentCube();

    // ------------------------------------------------------------- Circle Rotation Controls Wiring
    function updateCircleControlsPosition() {
      const container = document.getElementById('circleControlsOverlay');
      if (!container) return;

      if (viewMode === 'cube') {
        container.style.display = 'none';
        return;
      }
      container.style.display = 'block';

      const w = window.innerWidth;
      const h = window.innerHeight;
      const topH = Math.floor(h * 0.50);
      const leftW = viewMode === 'both' ? Math.floor(w * 0.50) : w;
      const aspect = leftW / topH;
      const f = RING_CONFIG.frustum;
      const halfW = aspect >= 1 ? f * aspect : f;
      const halfH = aspect >= 1 ? f : f / aspect;

      const outerR = RING_CONFIG.r0 + RING_CONFIG.delta;
      const innerR = RING_CONFIG.r0 - RING_CONFIG.delta;
      const dAngOut = 65 * Math.PI / 180;
      const dAngIn = 48 * Math.PI / 180;

      const systems = [
        {
          name: 'Y',
          cx: 0,
          cy: RING_CONFIG.D,
          apex: Math.PI / 2, // 90 deg (Top)
          outerFace: 'U',
          innerFace: 'D'
        },
        {
          name: 'Z',
          cx: -RING_CONFIG.D * Math.sqrt(3) / 2,
          cy: -RING_CONFIG.D * 0.5,
          apex: Math.PI * 7 / 6, // 210 deg (Bottom-Left)
          outerFace: 'F',
          innerFace: 'B'
        },
        {
          name: 'X',
          cx: RING_CONFIG.D * Math.sqrt(3) / 2,
          cy: -RING_CONFIG.D * 0.5,
          apex: Math.PI * 11 / 6, // 330 deg (Bottom-Right)
          outerFace: 'R',
          innerFace: 'L'
        }
      ];

      const btnDefs = [];
      for (const sys of systems) {
        // Outer circle: Left is CCW (apex + dAngOut), Right is CW (apex - dAngOut)
        btnDefs.push({
          id: `btn-rot-${sys.outerFace}-ccw`,
          wx: sys.cx + outerR * Math.cos(sys.apex + dAngOut),
          wy: sys.cy + outerR * Math.sin(sys.apex + dAngOut)
        });
        btnDefs.push({
          id: `btn-rot-${sys.outerFace}-cw`,
          wx: sys.cx + outerR * Math.cos(sys.apex - dAngOut),
          wy: sys.cy + outerR * Math.sin(sys.apex - dAngOut)
        });
        // Inner circle: Left is CCW (apex + dAngIn), Right is CW (apex - dAngIn)
        btnDefs.push({
          id: `btn-rot-${sys.innerFace}-ccw`,
          wx: sys.cx + innerR * Math.cos(sys.apex + dAngIn),
          wy: sys.cy + innerR * Math.sin(sys.apex + dAngIn)
        });
        btnDefs.push({
          id: `btn-rot-${sys.innerFace}-cw`,
          wx: sys.cx + innerR * Math.cos(sys.apex - dAngIn),
          wy: sys.cy + innerR * Math.sin(sys.apex - dAngIn)
        });
      }

      for (const b of btnDefs) {
        const el = document.getElementById(b.id);
        if (!el) continue;
        const ndcX = b.wx / halfW;
        const ndcY = b.wy / halfH;
        const px = (ndcX + 1) * 0.5 * leftW;
        const py = (1 - ndcY) * 0.5 * topH;
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
      }
    }

    document.querySelectorAll('.circle-rot-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const face = btn.dataset.face;
        const turns = parseInt(btn.dataset.turns, 10);
        if (face && !isNaN(turns)) {
          triggerUserMove({ face, turns }, 'circle:' + btn.id);
        }
      });
    });

    // ------------------------------------------------------------- 3D Cube Rotation Controls
    let isCameraAnimating = false;
    let cameraAnimStart = 0;
    const cameraAnimDuration = 240; // ms
    let startSpherical = { radius: 10, theta: 0, phi: 0 };
    let targetSpherical = { radius: 10, theta: 0, phi: 0 };

    function getCameraSpherical() {
      const offset = new THREE.Vector3().subVectors(camera3D.position, controls.target);
      const radius = offset.length();
      const phi = Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1));
      const theta = Math.atan2(offset.x, offset.z);
      return { radius, theta, phi };
    }

    function setCameraFromSpherical(radius, theta, phi) {
      camera3D.position.x = controls.target.x + radius * Math.sin(phi) * Math.sin(theta);
      camera3D.position.y = controls.target.y + radius * Math.cos(phi);
      camera3D.position.z = controls.target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera3D.lookAt(controls.target);
      controls.update();
    }

    function rotateCubeView(dTheta, dPhi) {
      const current = isCameraAnimating ? { ...targetSpherical } : getCameraSpherical();
      const newTheta = current.theta + dTheta;
      const newPhi = THREE.MathUtils.clamp(current.phi + dPhi, 0.28, Math.PI - 0.28);

      startSpherical = getCameraSpherical();
      targetSpherical = { radius: current.radius, theta: newTheta, phi: newPhi };
      cameraAnimStart = performance.now();
      isCameraAnimating = true;
    }

    function updateCameraRotationAnimation() {
      if (!isCameraAnimating) return;
      const elapsed = performance.now() - cameraAnimStart;
      const progress = Math.min(1, elapsed / cameraAnimDuration);
      const ease = 1 - Math.pow(1 - progress, 3);
      const r = THREE.MathUtils.lerp(startSpherical.radius, targetSpherical.radius, ease);
      const th = THREE.MathUtils.lerp(startSpherical.theta, targetSpherical.theta, ease);
      const ph = THREE.MathUtils.lerp(startSpherical.phi, targetSpherical.phi, ease);
      setCameraFromSpherical(r, th, ph);
      if (progress >= 1) {
        isCameraAnimating = false;
      }
    }

    // ------------------------------------------------------------- 3D Controls (Corner, Edge & Face Modes)
    const cornerArrowMeshes = [];
    const edgeArrowMeshes = [];
    const faceArrowMeshes = [];
    const cornerControlsGroup = new THREE.Group();
    const edgeControlsGroup = new THREE.Group();
    const faceControlsGroup = new THREE.Group();
    cube.root.add(cornerControlsGroup);
    cube.root.add(edgeControlsGroup);
    cube.root.add(faceControlsGroup);
    cornerControlsGroup.visible = false;
    edgeControlsGroup.visible = false;
    faceControlsGroup.visible = true;

    function create3DArrowTexture(dir) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      ctx.beginPath();
      ctx.arc(64, 64, 54, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 22, 20, 0.92)';
      ctx.fill();

      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.stroke();

      ctx.shadowBlur = 4;
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (dir === 'up') {
        ctx.font = 'bold 72px "Segoe UI Symbol", sans-serif';
        ctx.fillText('▲', 64, 61);
      } else if (dir === 'down') {
        ctx.font = 'bold 72px "Segoe UI Symbol", sans-serif';
        ctx.fillText('▼', 64, 67);
      } else if (dir === 'left') {
        ctx.font = 'bold 72px "Segoe UI Symbol", sans-serif';
        ctx.fillText('◀', 61, 64);
      } else if (dir === 'right') {
        ctx.font = 'bold 72px "Segoe UI Symbol", sans-serif';
        ctx.fillText('▶', 67, 64);
      } else if (dir === 'cw') {
        ctx.font = 'bold 76px "Segoe UI Symbol", sans-serif';
        ctx.fillText('↻', 64, 64);
      } else if (dir === 'ccw') {
        ctx.font = 'bold 76px "Segoe UI Symbol", sans-serif';
        ctx.fillText('↺', 64, 64);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    const arrowTextures = {
      up: create3DArrowTexture('up'),
      down: create3DArrowTexture('down'),
      left: create3DArrowTexture('left'),
      right: create3DArrowTexture('right'),
      cw: create3DArrowTexture('cw'),
      ccw: create3DArrowTexture('ccw')
    };

    const arrowMaterials = {
      up: new THREE.MeshBasicMaterial({ map: arrowTextures.up, transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.FrontSide }),
      down: new THREE.MeshBasicMaterial({ map: arrowTextures.down, transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.FrontSide }),
      left: new THREE.MeshBasicMaterial({ map: arrowTextures.left, transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.FrontSide }),
      right: new THREE.MeshBasicMaterial({ map: arrowTextures.right, transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.FrontSide }),
      cw: new THREE.MeshBasicMaterial({ map: arrowTextures.cw, transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.FrontSide }),
      ccw: new THREE.MeshBasicMaterial({ map: arrowTextures.ccw, transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.FrontSide })
    };

    const FACE_AXES = {
      F: { n: new THREE.Vector3(0, 0, 1),  u: new THREE.Vector3(0, 1, 0),  r: new THREE.Vector3(1, 0, 0) },
      B: { n: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(0, 1, 0),  r: new THREE.Vector3(-1, 0, 0) },
      R: { n: new THREE.Vector3(1, 0, 0),  u: new THREE.Vector3(0, 1, 0),  r: new THREE.Vector3(0, 0, -1) },
      L: { n: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 1, 0),  r: new THREE.Vector3(0, 0, 1) },
      U: { n: new THREE.Vector3(0, 1, 0),  u: new THREE.Vector3(0, 0, -1), r: new THREE.Vector3(1, 0, 0) },
      D: { n: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(0, 0, 1),  r: new THREE.Vector3(1, 0, 0) }
    };

    const FACE_CORNER_MOVES = {
      U: {
        tl_up:       { face: 'L', turns: -1 },
        tl_left:     { face: 'B', turns: 1 },
        tr_up:       { face: 'R', turns: 1 },
        tr_right:    { face: 'B', turns: -1 },
        bl_left:     { face: 'F', turns: -1 },
        bl_down:     { face: 'L', turns: 1 },
        br_right:    { face: 'F', turns: 1 },
        br_down:     { face: 'R', turns: -1 },
        top_edge:    { face: 'M', turns: -1 },
        bottom_edge: { face: 'M', turns: 1 },
        left_edge:   { face: 'S', turns: -1 },
        right_edge:  { face: 'S', turns: 1 }
      },
      D: {
        tl_up:       { face: 'L', turns: -1 },
        tl_left:     { face: 'F', turns: 1 },
        tr_up:       { face: 'R', turns: 1 },
        tr_right:    { face: 'F', turns: -1 },
        bl_left:     { face: 'B', turns: -1 },
        bl_down:     { face: 'L', turns: 1 },
        br_right:    { face: 'B', turns: 1 },
        br_down:     { face: 'R', turns: -1 },
        top_edge:    { face: 'M', turns: -1 },
        bottom_edge: { face: 'M', turns: 1 },
        left_edge:   { face: 'S', turns: 1 },
        right_edge:  { face: 'S', turns: -1 }
      },
      F: {
        tl_up:       { face: 'L', turns: -1 },
        tl_left:     { face: 'U', turns: 1 },
        tr_up:       { face: 'R', turns: 1 },
        tr_right:    { face: 'U', turns: -1 },
        bl_left:     { face: 'D', turns: -1 },
        bl_down:     { face: 'L', turns: 1 },
        br_right:    { face: 'D', turns: 1 },
        br_down:     { face: 'R', turns: -1 },
        top_edge:    { face: 'M', turns: -1 },
        bottom_edge: { face: 'M', turns: 1 },
        left_edge:   { face: 'E', turns: -1 },
        right_edge:  { face: 'E', turns: 1 }
      },
      B: {
        tl_up:       { face: 'R', turns: -1 },
        tl_left:     { face: 'U', turns: 1 },
        tr_up:       { face: 'L', turns: 1 },
        tr_right:    { face: 'U', turns: -1 },
        bl_left:     { face: 'D', turns: -1 },
        bl_down:     { face: 'R', turns: 1 },
        br_right:    { face: 'D', turns: 1 },
        br_down:     { face: 'L', turns: -1 },
        top_edge:    { face: 'M', turns: 1 },
        bottom_edge: { face: 'M', turns: -1 },
        left_edge:   { face: 'E', turns: -1 },
        right_edge:  { face: 'E', turns: 1 }
      },
      R: {
        tl_up:       { face: 'F', turns: -1 },
        tl_left:     { face: 'U', turns: 1 },
        tr_up:       { face: 'B', turns: 1 },
        tr_right:    { face: 'U', turns: -1 },
        bl_left:     { face: 'D', turns: -1 },
        bl_down:     { face: 'F', turns: 1 },
        br_right:    { face: 'D', turns: 1 },
        br_down:     { face: 'B', turns: -1 },
        top_edge:    { face: 'S', turns: -1 },
        bottom_edge: { face: 'S', turns: 1 },
        left_edge:   { face: 'E', turns: -1 },
        right_edge:  { face: 'E', turns: 1 }
      },
      L: {
        tl_up:       { face: 'B', turns: -1 },
        tl_left:     { face: 'U', turns: 1 },
        tr_up:       { face: 'F', turns: 1 },
        tr_right:    { face: 'U', turns: -1 },
        bl_left:     { face: 'D', turns: -1 },
        bl_down:     { face: 'B', turns: 1 },
        br_right:    { face: 'D', turns: 1 },
        br_down:     { face: 'F', turns: -1 },
        top_edge:    { face: 'S', turns: 1 },
        bottom_edge: { face: 'S', turns: -1 },
        left_edge:   { face: 'E', turns: -1 },
        right_edge:  { face: 'E', turns: 1 }
      }
    };

    const FACE_LEVEL_MOVES = {
      U: {
        top_left:     { face: 'B', turns: 1 },
        top_right:    { face: 'B', turns: -1 },
        bottom_left:  { face: 'F', turns: -1 },
        bottom_right: { face: 'F', turns: 1 },
        left_up:      { face: 'L', turns: -1 },
        left_down:    { face: 'L', turns: 1 },
        right_up:     { face: 'R', turns: 1 },
        right_down:   { face: 'R', turns: -1 }
      },
      D: {
        top_left:     { face: 'F', turns: 1 },
        top_right:    { face: 'F', turns: -1 },
        bottom_left:  { face: 'B', turns: -1 },
        bottom_right: { face: 'B', turns: 1 },
        left_up:      { face: 'L', turns: -1 },
        left_down:    { face: 'L', turns: 1 },
        right_up:     { face: 'R', turns: 1 },
        right_down:   { face: 'R', turns: -1 }
      },
      F: {
        top_left:     { face: 'U', turns: 1 },
        top_right:    { face: 'U', turns: -1 },
        bottom_left:  { face: 'D', turns: -1 },
        bottom_right: { face: 'D', turns: 1 },
        left_up:      { face: 'L', turns: -1 },
        left_down:    { face: 'L', turns: 1 },
        right_up:     { face: 'R', turns: 1 },
        right_down:   { face: 'R', turns: -1 }
      },
      B: {
        top_left:     { face: 'U', turns: 1 },
        top_right:    { face: 'U', turns: -1 },
        bottom_left:  { face: 'D', turns: -1 },
        bottom_right: { face: 'D', turns: 1 },
        left_up:      { face: 'R', turns: -1 },
        left_down:    { face: 'R', turns: 1 },
        right_up:     { face: 'L', turns: 1 },
        right_down:   { face: 'L', turns: -1 }
      },
      R: {
        top_left:     { face: 'U', turns: 1 },
        top_right:    { face: 'U', turns: -1 },
        bottom_left:  { face: 'D', turns: -1 },
        bottom_right: { face: 'D', turns: 1 },
        left_up:      { face: 'F', turns: -1 },
        left_down:    { face: 'F', turns: 1 },
        right_up:     { face: 'B', turns: 1 },
        right_down:   { face: 'B', turns: -1 }
      },
      L: {
        top_left:     { face: 'U', turns: 1 },
        top_right:    { face: 'U', turns: -1 },
        bottom_left:  { face: 'D', turns: -1 },
        bottom_right: { face: 'D', turns: 1 },
        left_up:      { face: 'B', turns: -1 },
        left_down:    { face: 'B', turns: 1 },
        right_up:     { face: 'F', turns: 1 },
        right_down:   { face: 'F', turns: -1 }
      }
    };

    const cornerRadius = 1.02;
    const cornerArrowOffset = 0.25;
    const edgeRadius = 1.02;
    const edgeArrowOffset = 0.22;
    const faceDist = 1.535;
    const arrowGeo = new THREE.PlaneGeometry(0.24, 0.24);

    for (const fName of FACES) {
      const axes = FACE_AXES[fName];
      const rotMatrix = new THREE.Matrix4().makeBasis(axes.r, axes.u, axes.n);
      const faceQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
      const faceCenter = axes.n.clone().multiplyScalar(faceDist);

      // 1. Build Corner & Edge Piece Controls
      const cMoves = FACE_CORNER_MOVES[fName];
      const corners = {
        tl: faceCenter.clone().addScaledVector(axes.r, -cornerRadius).addScaledVector(axes.u, cornerRadius),
        tr: faceCenter.clone().addScaledVector(axes.r, cornerRadius).addScaledVector(axes.u, cornerRadius),
        bl: faceCenter.clone().addScaledVector(axes.r, -cornerRadius).addScaledVector(axes.u, -cornerRadius),
        br: faceCenter.clone().addScaledVector(axes.r, cornerRadius).addScaledVector(axes.u, -cornerRadius)
      };

      const edgeCenters = {
        top:    faceCenter.clone().addScaledVector(axes.u, cornerRadius),
        bottom: faceCenter.clone().addScaledVector(axes.u, -cornerRadius),
        left:   faceCenter.clone().addScaledVector(axes.r, -cornerRadius),
        right:  faceCenter.clone().addScaledVector(axes.r, cornerRadius)
      };

      const cornerDefs = [
        { dir: 'up',    pos: corners.tl.clone().addScaledVector(axes.u, cornerArrowOffset),  move: cMoves.tl_up },
        { dir: 'left',  pos: corners.tl.clone().addScaledVector(axes.r, -cornerArrowOffset), move: cMoves.tl_left },
        { dir: 'up',    pos: corners.tr.clone().addScaledVector(axes.u, cornerArrowOffset),  move: cMoves.tr_up },
        { dir: 'right', pos: corners.tr.clone().addScaledVector(axes.r, cornerArrowOffset),  move: cMoves.tr_right },
        { dir: 'left',  pos: corners.bl.clone().addScaledVector(axes.r, -cornerArrowOffset), move: cMoves.bl_left },
        { dir: 'down',  pos: corners.bl.clone().addScaledVector(axes.u, -cornerArrowOffset), move: cMoves.bl_down },
        { dir: 'right', pos: corners.br.clone().addScaledVector(axes.r, cornerArrowOffset),  move: cMoves.br_right },
        { dir: 'down',  pos: corners.br.clone().addScaledVector(axes.u, -cornerArrowOffset), move: cMoves.br_down },
        { dir: 'up',    pos: edgeCenters.top.clone().addScaledVector(axes.u, cornerArrowOffset),    move: cMoves.top_edge },
        { dir: 'down',  pos: edgeCenters.bottom.clone().addScaledVector(axes.u, -cornerArrowOffset), move: cMoves.bottom_edge },
        { dir: 'left',  pos: edgeCenters.left.clone().addScaledVector(axes.r, -cornerArrowOffset),   move: cMoves.left_edge },
        { dir: 'right', pos: edgeCenters.right.clone().addScaledVector(axes.r, cornerArrowOffset),  move: cMoves.right_edge }
      ];

      for (const def of cornerDefs) {
        const mesh = new THREE.Mesh(arrowGeo, arrowMaterials[def.dir].clone());
        mesh.position.copy(def.pos);
        mesh.quaternion.copy(faceQuat);
        mesh.renderOrder = 999;
        mesh.userData = { face: def.move.face, turns: def.move.turns, dir: def.dir };
        cornerControlsGroup.add(mesh);
        cornerArrowMeshes.push(mesh);
      }

      // 2. Build Center-Edge Level Controls
      const eMoves = FACE_LEVEL_MOVES[fName];
      const levelEdgeCenters = {
        top:    faceCenter.clone().addScaledVector(axes.u, edgeRadius),
        bottom: faceCenter.clone().addScaledVector(axes.u, -edgeRadius),
        left:   faceCenter.clone().addScaledVector(axes.r, -edgeRadius),
        right:  faceCenter.clone().addScaledVector(axes.r, edgeRadius)
      };

      const edgeDefs = [
        { dir: 'left',  pos: levelEdgeCenters.top.clone().addScaledVector(axes.r, -edgeArrowOffset),    move: eMoves.top_left },
        { dir: 'right', pos: levelEdgeCenters.top.clone().addScaledVector(axes.r, edgeArrowOffset),     move: eMoves.top_right },
        { dir: 'left',  pos: levelEdgeCenters.bottom.clone().addScaledVector(axes.r, -edgeArrowOffset), move: eMoves.bottom_left },
        { dir: 'right', pos: levelEdgeCenters.bottom.clone().addScaledVector(axes.r, edgeArrowOffset),  move: eMoves.bottom_right },
        { dir: 'up',    pos: levelEdgeCenters.left.clone().addScaledVector(axes.u, edgeArrowOffset),    move: eMoves.left_up },
        { dir: 'down',  pos: levelEdgeCenters.left.clone().addScaledVector(axes.u, -edgeArrowOffset),   move: eMoves.left_down },
        { dir: 'up',    pos: levelEdgeCenters.right.clone().addScaledVector(axes.u, edgeArrowOffset),   move: eMoves.right_up },
        { dir: 'down',  pos: levelEdgeCenters.right.clone().addScaledVector(axes.u, -edgeArrowOffset),  move: eMoves.right_down }
      ];

      for (const def of edgeDefs) {
        const mesh = new THREE.Mesh(arrowGeo, arrowMaterials[def.dir].clone());
        mesh.position.copy(def.pos);
        mesh.quaternion.copy(faceQuat);
        mesh.renderOrder = 999;
        mesh.userData = { face: def.move.face, turns: def.move.turns, dir: def.dir };
        edgeControlsGroup.add(mesh);
        edgeArrowMeshes.push(mesh);
      }

      // 3. Build Face Center Rotation Controls
      const faceDefs = [
        { dir: 'ccw', pos: faceCenter.clone().addScaledVector(axes.r, -0.28).addScaledVector(axes.u, 0.28), move: { face: fName, turns: -1 } },
        { dir: 'cw',  pos: faceCenter.clone().addScaledVector(axes.r, 0.28).addScaledVector(axes.u, -0.28), move: { face: fName, turns: 1 } }
      ];

      for (const def of faceDefs) {
        const mesh = new THREE.Mesh(arrowGeo, arrowMaterials[def.dir].clone());
        mesh.position.copy(def.pos);
        mesh.quaternion.copy(faceQuat);
        mesh.renderOrder = 999;
        mesh.userData = { face: def.move.face, turns: def.move.turns, dir: def.dir };
        faceControlsGroup.add(mesh);
        faceArrowMeshes.push(mesh);
      }
    }

    function updateCubeControlsWidgetVisibility() {
      const widget = document.getElementById('cubeControlsWidget');
      if (!widget) return;
      widget.classList.remove('view-cube', 'view-circles');
      if (viewMode === 'cube') {
        widget.classList.add('view-cube');
      } else if (viewMode === 'circles') {
        widget.classList.add('view-circles');
      }
    }

    const raycaster = new THREE.Raycaster();
    let hoveredArrow = null;
    let currentControlMode = 'face';

    function setCubeControlMode(mode) {
      currentControlMode = mode;
      cornerControlsGroup.visible = (mode === 'corner');
      edgeControlsGroup.visible = (mode === 'level');
      faceControlsGroup.visible = (mode === 'face');

      if (hoveredArrow) {
        hoveredArrow.scale.set(1, 1, 1);
        hoveredArrow = null;
      }
      renderer.domElement.style.cursor = 'default';

      document.getElementById('btnCtrlHide')?.classList.toggle('active', mode === 'none');
      document.getElementById('btnCtrlCorner')?.classList.toggle('active', mode === 'corner');
      document.getElementById('btnCtrlLevel')?.classList.toggle('active', mode === 'level');
      document.getElementById('btnCtrlFace')?.classList.toggle('active', mode === 'face');

      document.getElementById('hudBtnCtrlHide')?.classList.toggle('active', mode === 'none');
      document.getElementById('hudBtnCtrlCorner')?.classList.toggle('active', mode === 'corner');
      document.getElementById('hudBtnCtrlLevel')?.classList.toggle('active', mode === 'level');
      document.getElementById('hudBtnCtrlFace')?.classList.toggle('active', mode === 'face');
    }

    document.getElementById('btnCtrlHide')?.addEventListener('click', () => setCubeControlMode('none'));
    document.getElementById('btnCtrlCorner')?.addEventListener('click', () => setCubeControlMode('corner'));
    document.getElementById('btnCtrlLevel')?.addEventListener('click', () => setCubeControlMode('level'));
    document.getElementById('btnCtrlFace')?.addEventListener('click', () => setCubeControlMode('face'));

    document.getElementById('hudBtnCtrlHide')?.addEventListener('click', () => setCubeControlMode('none'));
    document.getElementById('hudBtnCtrlCorner')?.addEventListener('click', () => setCubeControlMode('corner'));
    document.getElementById('hudBtnCtrlLevel')?.addEventListener('click', () => setCubeControlMode('level'));
    document.getElementById('hudBtnCtrlFace')?.addEventListener('click', () => setCubeControlMode('face'));

    setCubeControlMode('face');

    function get3DMouseNDC(clientX, clientY) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const topH = Math.floor(h * 0.50);
      let vpLeft = 0, vpTop = 0, vpW = w, vpH = topH;
      if (viewMode === 'both') {
        const leftW = Math.floor(w * 0.50);
        vpLeft = leftW;
        vpTop = 0;
        vpW = w - leftW;
        vpH = topH;
      } else if (viewMode === 'circles') {
        return null;
      }
      if (clientX < vpLeft || clientX > vpLeft + vpW || clientY < vpTop || clientY > vpTop + vpH) {
        return null;
      }
      const ndcX = ((clientX - vpLeft) / vpW) * 2 - 1;
      const ndcY = -((clientY - vpTop) / vpH) * 2 + 1;
      return new THREE.Vector2(ndcX, ndcY);
    }

    renderer.domElement.addEventListener('pointermove', (e) => {
      if (viewMode === 'circles' || currentControlMode === 'none') {
        if (hoveredArrow) {
          hoveredArrow.scale.set(1, 1, 1);
          hoveredArrow = null;
        }
        renderer.domElement.style.cursor = 'default';
        return;
      }
      const ndc = get3DMouseNDC(e.clientX, e.clientY);
      if (!ndc) {
        if (hoveredArrow) {
          hoveredArrow.scale.set(1, 1, 1);
          hoveredArrow = null;
        }
        renderer.domElement.style.cursor = 'default';
        return;
      }

      raycaster.setFromCamera(ndc, camera3D);
      const targetMeshes = (currentControlMode === 'corner') ? cornerArrowMeshes :
                           (currentControlMode === 'level') ? edgeArrowMeshes :
                           (currentControlMode === 'face') ? faceArrowMeshes : [];
      const hits = raycaster.intersectObjects(targetMeshes);
      if (hits.length > 0) {
        const topHit = hits[0].object;
        if (hoveredArrow !== topHit) {
          if (hoveredArrow) hoveredArrow.scale.set(1, 1, 1);
          hoveredArrow = topHit;
          hoveredArrow.scale.set(1.22, 1.22, 1);
        }
        renderer.domElement.style.cursor = 'pointer';
      } else {
        if (hoveredArrow) {
          hoveredArrow.scale.set(1, 1, 1);
          hoveredArrow = null;
        }
        renderer.domElement.style.cursor = 'default';
      }
    });

    let pointerDownPos = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      if (viewMode === 'both') {
        const leftW = Math.floor(window.innerWidth * 0.50);
        const topH = Math.floor(window.innerHeight * 0.50);
        if (e.clientX < leftW || e.clientY > topH) {
          controls.enabled = false;
          return;
        }
      } else if (viewMode === 'circles') {
        controls.enabled = false;
        return;
      }
      controls.enabled = true;
    });

    window.addEventListener('pointerup', () => {
      controls.enabled = true;
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
      if (e.button !== 0 && e.button !== undefined) return;
      if (viewMode === 'circles' || currentControlMode === 'none') return;
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;

      const ndc = get3DMouseNDC(e.clientX, e.clientY);
      if (!ndc) return;

      raycaster.setFromCamera(ndc, camera3D);
      const targetMeshes = (currentControlMode === 'corner') ? cornerArrowMeshes :
                           (currentControlMode === 'level') ? edgeArrowMeshes :
                           (currentControlMode === 'face') ? faceArrowMeshes : [];
      const hits = raycaster.intersectObjects(targetMeshes);
      if (hits.length > 0) {
        e.stopPropagation();
        const { face, turns } = hits[0].object.userData;
        if (face && turns) {
          triggerUserMove({ face, turns }, 'arrow:' + hits[0].object.uuid);
        }
      }
    });

    renderer.domElement.addEventListener('pointerleave', () => {
      if (hoveredArrow) {
        hoveredArrow.scale.set(1, 1, 1);
        hoveredArrow = null;
      }
      renderer.domElement.style.cursor = 'default';
    });

    // ------------------------------------------------------------- Viewport Rendering Loop
    function drawViewport(x, y, w, h, scene, camera) {
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      renderer.setScissorTest(true);
      renderer.render(scene, camera);
    }

    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const dt = Math.min(clock.getDelta(), 0.05);
      engine.update(dt);
      if (isCameraAnimating) updateCameraRotationAnimation();
      controls.update();

      const w = window.innerWidth;
      const h = window.innerHeight;

      renderer.setScissorTest(false);
      renderer.clear();

      const topH = Math.floor(h * 0.50);
      const btmH = h - topH;
      const leftW = Math.floor(w * 0.50);
      const rightW = w - leftW;

      if (viewMode === 'both') {
        // Top-Left: 2D Three-Ring Projection
        drawViewport(0, btmH, leftW, topH, diagram.scene, diagram.camera);
        // Top-Right: 3D Solid Rubik's Cube
        drawViewport(leftW, btmH, rightW, topH, scene3D, camera3D);
      } else if (viewMode === 'cube') {
        drawViewport(0, btmH, w, topH, scene3D, camera3D);
      } else if (viewMode === 'circles') {
        drawViewport(0, btmH, w, topH, diagram.scene, diagram.camera);
      }
    }

    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);

      const topH = Math.floor(h * 0.50);
      const leftW = Math.floor(w * 0.50);
      const rightW = w - leftW;

      if (viewMode === 'both') {
        camera3D.aspect = rightW / topH;
        diagram.resize(leftW, topH);
      } else if (viewMode === 'cube') {
        camera3D.aspect = w / topH;
        diagram.resize(w, topH);
      } else if (viewMode === 'circles') {
        camera3D.aspect = w / topH;
        diagram.resize(w, topH);
      }
      camera3D.updateProjectionMatrix();
      updateCircleControlsPosition();
    }

    window.addEventListener('resize', () => {
      onResize();
    });
    onResize();
    animate();

    // Console API
    window.cube = {
      cube,
      diagram,
      engine,
      push: (moves) => engine.pushSequence(moves.trim().split(/\s+/)),
      scramble: (n) => engine.scramble(n),
      solve: () => engine.solve(),
    };
  