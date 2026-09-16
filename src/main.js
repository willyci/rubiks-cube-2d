import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RubiksCube } from './cube.js';
import { FlatDiagram } from './flat.js';
import { MoveEngine } from './moveEngine.js';
import { initUI } from './ui.js';
import { THEME } from './config.js';

const container = document.getElementById('app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(THEME.background);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
camera.position.set(6.2, 4.6, 9.4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(THEME.background);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 5;
controls.maxDistance = 24;
controls.autoRotateSpeed = 0.9;

scene.add(new THREE.HemisphereLight(0xdff3ec, 0x1a2422, 0.85));
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(8, 12, 10);
scene.add(key);

const fill = new THREE.DirectionalLight(0x9ad7ff, 0.35);
fill.position.set(-9, -4, -7);
scene.add(fill);

const cube = new RubiksCube();
scene.add(cube.root);

const flat = new FlatDiagram(cube);
cube.addView(flat);

const engine = new MoveEngine(cube);

// 'both' stacks the flat diagram over the solid cube, each in its own
// viewport - that is what keeps the diagram square-on and the cube free to
// be orbited.
let view = 'both';
const setView = (mode) => {
  view = mode;
};

initUI({ cube, engine, controls, setView });

const clock = new THREE.Clock();

function draw(x, y, w, h, scene3d, cam) {
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.render(scene3d, cam);
}

function drawCube(x, y, w, h) {
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  draw(x, y, w, h, scene, camera);
}

function drawFlat(x, y, w, h) {
  flat.resize(w, h);
  draw(x, y, w, h, flat.scene, flat.camera);
}

function render() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setScissorTest(true);

  if (view === 'cube') {
    drawCube(0, 0, w, h);
  } else if (view === 'flat') {
    drawFlat(0, 0, w, h);
  } else {
    const lower = Math.round(h * 0.42); // the solid cube sits underneath
    drawCube(0, 0, w, lower);
    drawFlat(0, lower, w, h - lower);
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  engine.update(dt);
  controls.update();
  render();
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handy from the console: cube.push("R U R' U'"), cube.scramble(), cube.solve()
window.cube = {
  cube,
  flat,
  engine,
  push: (tokens) => engine.pushSequence(tokens.trim().split(/\s+/)),
  scramble: (n) => engine.scramble(n),
  solve: () => engine.solve(),
};
