import { orientationAt, traceLaser } from './engine.js';
import { DIFFICULTIES, generatePuzzle } from './generator.js';
import { randomSeed } from './rng.js';
import { loadValue, removeValue, saveValue } from './storage.js';

const THEMES = {
  sable: { label: 'Sable', themeColor: '#f7f2e8' },
  ardoise: { label: 'Ardoise', themeColor: '#edf1f4' },
  sauge: { label: 'Sauge', themeColor: '#f1f2e9' },
  rose: { label: 'Rose', themeColor: '#f8eff1' },
  nuit: { label: 'Nuit', themeColor: '#16120e' },
  crepuscule: { label: 'Crépuscule', themeColor: '#19151b' },
};

const els = {
  board: document.querySelector('#board'),
  cells: document.querySelector('#cells'),
  beam: document.querySelector('#beam'),
  beamGlow: document.querySelector('#beam-glow'),
  emitter: document.querySelector('#emitter'),
  moves: document.querySelector('#moves'),
  par: document.querySelector('#par'),
  difficulty: document.querySelector('#difficulty'),
  reset: document.querySelector('#reset-button'),
  theme: document.querySelector('#theme-button'),
  paletteMenu: document.querySelector('#palette-menu'),
  newPuzzle: document.querySelector('#new-button'),
  winDialog: document.querySelector('#win-dialog'),
  winTitle: document.querySelector('#win-title'),
  winResult: document.querySelector('#win-result'),
  winDetail: document.querySelector('#win-detail'),
  winNew: document.querySelector('#win-new'),
  winClose: document.querySelector('#win-close'),
  status: document.querySelector('#status'),
};

let state = {
  puzzle: null,
  mask: 0,
  moves: 0,
  won: false,
  difficulty: loadValue('difficulty', 'normal'),
};

init();

function init() {
  if (!DIFFICULTIES[state.difficulty]) state.difficulty = 'normal';
  applyStoredTheme();
  bindEvents();
  renderDifficulty();

  const saved = loadValue('current-game');
  if (!restoreGame(saved)) newPuzzle();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function bindEvents() {
  els.difficulty.addEventListener('click', (event) => {
    const button = event.target.closest('[data-difficulty]');
    if (!button) return;
    const next = button.dataset.difficulty;
    if (!DIFFICULTIES[next] || next === state.difficulty) return;
    state.difficulty = next;
    saveValue('difficulty', next);
    renderDifficulty();
    newPuzzle();
  });

  els.cells.addEventListener('click', (event) => {
    const mirror = event.target.closest('[data-mirror-index]');
    if (!mirror || state.won) return;
    rotateMirror(Number(mirror.dataset.mirrorIndex));
  });

  els.reset.addEventListener('click', resetPuzzle);
  els.newPuzzle.addEventListener('click', newPuzzle);
  els.winNew.addEventListener('click', () => {
    els.winDialog.close();
    newPuzzle();
  });
  els.winClose.addEventListener('click', () => els.winDialog.close());

  els.theme.addEventListener('click', togglePaletteMenu);
  els.paletteMenu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-choice]');
    if (!button) return;
    const next = button.dataset.themeChoice;
    if (!THEMES[next]) return;
    setTheme(next);
    saveValue('theme', next);
    closePaletteMenu();
  });

  document.addEventListener('click', (event) => {
    if (els.paletteMenu.hidden) return;
    if (els.paletteMenu.contains(event.target) || els.theme.contains(event.target)) return;
    closePaletteMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.paletteMenu.hidden) {
      event.preventDefault();
      closePaletteMenu();
      els.theme.focus();
      return;
    }
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === 'n' && !isTypingTarget(event.target)) {
      event.preventDefault();
      newPuzzle();
    }
    if (event.key.toLowerCase() === 'r' && !isTypingTarget(event.target)) {
      event.preventDefault();
      resetPuzzle();
    }
  });
}

function newPuzzle() {
  const seed = randomSeed();
  loadPuzzle(seed, state.difficulty);
}

function loadPuzzle(seed, difficulty, restored = null) {
  let puzzle;
  try {
    puzzle = generatePuzzle(seed, difficulty);
  } catch (error) {
    console.error(error);
    if (!restored) return loadPuzzle(randomSeed(), difficulty);
    return false;
  }

  state = {
    ...state,
    puzzle,
    difficulty,
    mask: restored?.mask ?? puzzle.initialMask,
    moves: restored?.moves ?? 0,
    won: restored?.won ?? false,
  };

  if (state.mask < 0 || state.mask >= (1 << puzzle.mirrors.length)) {
    state.mask = puzzle.initialMask;
    state.moves = 0;
    state.won = false;
  }

  renderPuzzle();
  persistGame();
  return true;
}

function restoreGame(saved) {
  if (!saved || saved.version !== 1 || saved.won) return false;
  if (!DIFFICULTIES[saved.difficulty] || typeof saved.seed !== 'string') return false;
  if (!Number.isInteger(saved.mask) || !Number.isInteger(saved.moves) || saved.moves < 0) return false;

  state.difficulty = saved.difficulty;
  saveValue('difficulty', saved.difficulty);
  renderDifficulty();
  return loadPuzzle(saved.seed, saved.difficulty, saved);
}

function resetPuzzle() {
  if (!state.puzzle) return;
  state.mask = state.puzzle.initialMask;
  state.moves = 0;
  state.won = false;
  if (els.winDialog.open) els.winDialog.close();
  renderState();
  persistGame();
  announce('Puzzle recommencé.');
}

function rotateMirror(index) {
  state.mask ^= (1 << index);
  state.moves += 1;
  renderState();

  const trace = traceLaser(state.puzzle, state.mask);
  if (trace.hit) finishGame();
  else persistGame();
}

function finishGame() {
  state.won = true;
  removeValue('current-game');

  const perfect = state.moves === state.puzzle.par;
  els.winTitle.textContent = perfect ? 'Trajectoire parfaite !' : 'Cristal atteint !';
  els.winResult.textContent = `${state.moves} rotation${state.moves > 1 ? 's' : ''} · PAR ${state.puzzle.par}`;
  els.winDetail.textContent = perfect
    ? 'Tu as trouvé une solution optimale.'
    : `La solution optimale demande ${state.puzzle.par} rotation${state.puzzle.par > 1 ? 's' : ''}.`;

  announce(perfect ? 'Cristal atteint avec une solution optimale.' : 'Cristal atteint.');
  window.setTimeout(() => {
    if (!els.winDialog.open) els.winDialog.showModal();
  }, 220);
}

function renderPuzzle() {
  const { puzzle } = state;
  els.board.style.setProperty('--size', puzzle.size);
  els.board.setAttribute('aria-label', `Puzzle ${DIFFICULTIES[puzzle.difficulty].label}, grille ${puzzle.size} par ${puzzle.size}, PAR ${puzzle.par}`);

  const svg = els.beam.ownerSVGElement;
  svg.setAttribute('viewBox', `0 0 ${puzzle.size} ${puzzle.size}`);

  els.cells.replaceChildren();
  const mirrorByCell = new Map(puzzle.mirrors.map((mirror, index) => [`${mirror.row},${mirror.col}`, index]));

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const key = `${row},${col}`;
      const mirrorIndex = mirrorByCell.get(key);
      let cell;

      if (mirrorIndex !== undefined) {
        cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell mirror';
        cell.dataset.mirrorIndex = String(mirrorIndex);
        cell.innerHTML = '<span class="mirror-bar" aria-hidden="true"></span>';
      } else {
        cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('aria-hidden', 'true');
      }

      if (row === puzzle.target.row && col === puzzle.target.col) {
        cell.classList.add('target-cell');
        cell.innerHTML = '<span class="crystal" aria-hidden="true"></span>';
        if (cell.tagName === 'BUTTON') cell.disabled = true;
      }

      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(col + 1);
      els.cells.append(cell);
    }
  }

  renderState();
}

function renderState() {
  for (const button of els.cells.querySelectorAll('[data-mirror-index]')) {
    const index = Number(button.dataset.mirrorIndex);
    const orientation = orientationAt(state.mask, index);
    button.dataset.orientation = orientation === '/' ? 'slash' : 'backslash';
    const mirror = state.puzzle.mirrors[index];
    button.setAttribute(
      'aria-label',
      `Miroir ligne ${mirror.row + 1}, colonne ${mirror.col + 1}, orientation ${orientation === '/' ? 'barre oblique' : 'barre oblique inversée'}`,
    );
  }

  const trace = traceLaser(state.puzzle, state.mask);
  const points = trace.points.map((point) => `${point.x},${point.y}`).join(' ');
  els.beam.setAttribute('points', points);
  els.beamGlow.setAttribute('points', points);

  const first = trace.points[0];
  els.emitter.setAttribute('cx', String(first.x));
  els.emitter.setAttribute('cy', String(first.y));

  els.board.classList.toggle('is-hit', trace.hit);
  els.board.classList.toggle('is-loop', trace.loop);
  els.moves.textContent = String(state.moves);
  els.par.textContent = String(state.puzzle.par);
}

function renderDifficulty() {
  for (const button of els.difficulty.querySelectorAll('[data-difficulty]')) {
    const active = button.dataset.difficulty === state.difficulty;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function persistGame() {
  if (!state.puzzle || state.won) return;
  saveValue('current-game', {
    version: 1,
    seed: state.puzzle.seed,
    difficulty: state.difficulty,
    mask: state.mask,
    moves: state.moves,
    won: false,
  });
}

function applyStoredTheme() {
  const stored = loadValue('theme', 'sable');
  const migrated = stored === 'clair' ? 'sable'
    : stored === 'sombre' ? 'nuit'
      : stored === 'system' ? 'sable'
        : stored;
  const theme = THEMES[migrated] ? migrated : 'sable';
  if (theme !== stored) saveValue('theme', theme);
  setTheme(theme);
}

function togglePaletteMenu() {
  const opening = els.paletteMenu.hidden;
  els.paletteMenu.hidden = !opening;
  els.theme.setAttribute('aria-expanded', String(opening));
  if (opening) {
    const active = els.paletteMenu.querySelector('[aria-checked="true"]');
    active?.focus();
  }
}

function closePaletteMenu() {
  els.paletteMenu.hidden = true;
  els.theme.setAttribute('aria-expanded', 'false');
}

function setTheme(theme) {
  const selected = THEMES[theme] ? theme : 'sable';
  document.documentElement.dataset.theme = selected;

  const config = THEMES[selected];
  els.theme?.setAttribute('aria-label', `Choisir une palette. Palette actuelle : ${config.label}`);
  els.theme?.setAttribute('title', `Palette : ${config.label}`);

  for (const button of els.paletteMenu?.querySelectorAll('[data-theme-choice]') ?? []) {
    const active = button.dataset.themeChoice === selected;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', String(active));
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  metaTheme?.setAttribute('content', config.themeColor);
}

function announce(message) {
  els.status.textContent = '';
  requestAnimationFrame(() => { els.status.textContent = message; });
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}
