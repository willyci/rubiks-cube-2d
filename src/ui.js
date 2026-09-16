import { FACES } from './config.js';
import { parseMove, formatMove } from './moveEngine.js';

export function initUI({ cube, engine, controls, setView }) {
  const movesBox = document.getElementById('moves');
  const ticker = document.getElementById('lastMove');
  const speed = document.getElementById('speed');
  const speedVal = document.getElementById('speedVal');
  const spin = document.getElementById('spin');

  // R R' U U' ... in one grid
  for (const face of FACES) {
    for (const suffix of ['', "'"]) {
      const b = document.createElement('button');
      b.className = 'move';
      b.dataset.face = face;
      b.textContent = face + suffix;
      b.addEventListener('click', () => run(face + suffix));
      movesBox.appendChild(b);
    }
  }

  function run(token) {
    engine.push(parseMove(token), 'user');
  }

  const actions = {
    scramble: () => engine.scramble(),
    solve: () => engine.solve(),
    undo: () => engine.undo(),
    reset: () => {
      engine.clear();
      cube.reset();
      ticker.textContent = '—';
    },
  };

  document.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => actions[btn.dataset.act]());
  });

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      setView(btn.dataset.view);
    });
  });

  speed.addEventListener('input', () => {
    engine.speed = parseFloat(speed.value);
    speedVal.textContent = engine.speed.toFixed(2).replace(/0$/, '') + '×';
  });

  spin.addEventListener('change', () => {
    controls.autoRotate = spin.checked;
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toUpperCase();
    if (FACES.includes(key)) {
      run(key + (e.shiftKey ? "'" : ''));
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') actions.scramble();
    else if (e.key === 'Backspace') actions.undo();
    else if (e.key === 'Escape') actions.reset();
  });

  engine.onMove = (move) => {
    ticker.textContent = formatMove(move) + (cube.isSolved() ? '   ·   SOLVED' : '');
  };
}
