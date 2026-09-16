# 换个角度，解开魔方 · Rubik's Circles

A Three.js scene that shows one Rubik's cube twice at the same time:

- **below** — the familiar solid 3×3 puzzle, in 3D;
- **above** — the same cube drawn flat: three big circles, one per axis,
  sitting on a triangle and overlapping. A big circle is only the frame of its
  axis; the two faces of that axis are two smaller circles side by side inside
  it, the + face towards the outside of the triangle and the − face towards the
  middle, each carrying that face's eight stickers. The ninth, the fixed centre
  sticker, rests on a tiny hub ring at the heart of its own circle — so all 54
  dots are on a circle and none float free. Turning a face spins its own circle
  and sends the side band arcing across to circles inside the other two big
  ones. The circle in motion lights up orange.

The diagram is genuinely 2D: it lives in its own scene with an orthographic
camera aimed straight down −Z and is drawn into its own viewport, so it stays
square-on no matter how you orbit the cube underneath.

## Run it

```bash
node server.mjs
```

Then open <http://localhost:5173>. `npm run dev` does the same thing. There is
no build step and no `npm install` — `index.html` pulls Three.js r169 from a CDN
through an import map, and `server.mjs` is a small static file server built on
`node:http`.

## Controls

| Input | Action |
| --- | --- |
| `U` `D` `L` `R` `F` `B` | quarter turn of that face, clockwise from outside |
| `Shift` + face key | the same turn reversed (`R'`) |
| `Enter` / `Backspace` / `Esc` | scramble / undo one move / reset to solved |
| drag, scroll | orbit and zoom the 3D cube |
| Both · Cube · Circles | one representation or both |
| Solve | replays every recorded move backwards until the cube unwinds |

From the devtools console: `cube.push("R U R' U'")`, `cube.scramble()`,
`cube.solve()`.

## How it is put together

```
index.html         markup, import map, HUD
styles.css         HUD + title styling
server.mjs         dependency-free static server
src/config.js      colours, lattice spacing, diagram layout
src/cube.js        the state of the cube, and the solid 3D body
src/flat.js        the flat circle diagram, in its own 2D scene
src/moveEngine.js  move parsing, animation queue, scramble / undo / solve
src/ui.js          buttons, keyboard, ticker
src/main.js        scene, lights, the two viewports, render loop
```

### One state, two pictures

`cube.js` owns the only state there is: each of the 26 cubies carries integer
lattice coordinates plus a quaternion, rewritten exactly after every turn so
nothing drifts however long you play. A quarter turn is −90° about the face's
*outward* normal, which is "clockwise seen from outside" for all six faces with
no special cases. Other views register through `cube.addView()` and are handed
the same turn to animate, so the two pictures cannot disagree.

### Laying out the circles

The cube has three axes, so the diagram has three big circles: U/D at the top,
R/L lower left, F/B lower right. Each is a bare frame holding its axis's two
faces as a side-by-side pair — U outward and D inward, R outward and L inward,
F outward and B inward — which leaves the three − faces meeting in the middle
of the triangle and the three + faces around the rim. Six face circles, six hub
rings and three frames: fifteen circles, every dot on one of them.

Where a sticker lands on its ring comes from the cube, not from a table. Each
face has a right-handed in-plane frame (u, v, n): a cubie's coordinates read
through it give an angle, and that angle is used directly as the angle on the
ring. Because the frame is right-handed, every face is drawn as seen from
*outside* — no face comes out mirrored, and a clockwise turn slides dots
clockwise on all six rings.

### Animating a turn

For each sticker in the turning layer the move quaternion says both where the
cubie goes and which face the sticker will then show. If the face is unchanged
— the turning face's own eight — the dot is swept along its circle by exactly
90°. If it changes, the dot flies to its new circle along a quadratic Bézier
bowed away from the middle of the diagram, so the crossing streams stay
readable. A fixed centre sticker never changes circle or angle, so it is left
where it is.
