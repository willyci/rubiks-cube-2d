import { FACES } from './config.js';

const BASE_DURATION = 0.34; // seconds per quarter turn at 1x speed

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** "R", "R'", "R2" -> { face, turns } */
export function parseMove(token) {
  const face = token[0].toUpperCase();
  if (!FACES.includes(face)) return null;
  const suffix = token.slice(1);
  const turns = suffix === "'" ? -1 : suffix === '2' ? 2 : 1;
  return { face, turns };
}

export function formatMove(move) {
  return move.face + (move.turns === -1 ? "'" : move.turns === 2 ? '2' : '');
}

const invert = (move) => ({ face: move.face, turns: move.turns === 2 ? 2 : -move.turns });

/**
 * Animates turns one at a time from a queue, and remembers the moves the user
 * made so they can be walked back ("solve" = undo everything, in reverse).
 */
export class MoveEngine {
  constructor(cube) {
    this.cube = cube;
    this.queue = [];
    this.active = null;
    this.elapsed = 0;
    this.speed = 1;
    this.history = [];
    this.onMove = null; // (move, source) => void
  }

  get busy() {
    return this.active !== null || this.queue.length > 0;
  }

  /** source: 'user' moves are recorded, 'replay' moves are not. */
  push(move, source = 'user') {
    if (!move) return;
    this.queue.push({ ...move, source });
  }

  pushSequence(tokens, source = 'user') {
    for (const t of tokens) this.push(parseMove(t), source);
  }

  scramble(length = 22) {
    const axisOf = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };
    const out = [];
    let prev = null;
    let prevPrev = null;
    while (out.length < length) {
      const face = FACES[Math.floor(Math.random() * FACES.length)];
      if (face === prev) continue;
      if (prevPrev === face && axisOf[prev] === axisOf[face]) continue;
      const turns = [1, -1, 2][Math.floor(Math.random() * 3)];
      out.push({ face, turns });
      prevPrev = prev;
      prev = face;
    }
    for (const m of out) this.push(m, 'user');
    return out;
  }

  undo() {
    if (!this.history.length) return;
    const last = this.history.pop();
    this.push(invert(last), 'replay');
  }

  /** Retrace every recorded move backwards - the cube unwinds to solved. */
  solve() {
    const moves = this.history.slice().reverse().map(invert);
    this.history.length = 0;
    for (const m of moves) this.push(m, 'replay');
  }

  clear() {
    this.queue.length = 0;
    if (this.active) {
      this.active.handle.setProgress(1);
      this.active.handle.finish();
      this.active = null;
    }
    this.history.length = 0;
  }

  update(dt) {
    if (!this.active) {
      const next = this.queue.shift();
      if (!next) return;
      this.active = { move: next, handle: this.cube.beginMove(next.face, next.turns) };
      this.elapsed = 0;
    }

    const { move, handle } = this.active;
    const duration = (BASE_DURATION * (move.turns === 2 ? 1.6 : 1)) / this.speed;
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / duration);
    handle.setProgress(easeInOut(t));

    if (t >= 1) {
      handle.finish();
      if (move.source === 'user') this.history.push({ face: move.face, turns: move.turns });
      this.active = null;
      if (this.onMove) this.onMove(move);
    }
  }
}
