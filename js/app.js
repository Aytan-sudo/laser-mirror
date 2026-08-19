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

const COLOR_LABELS = { red: 'rouge', blue: 'bleu', yellow: 'jaune' };

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
  daily: document.querySelector('#daily-button'),
  share: document.querySelector('#share-button'),
  seedLabel: document.querySelector('#seed-label'),
  stats: document.querySelector('#stats-button'),
  dailyBadge: document.querySelector('#daily-badge'),
  winDialog: document.querySelector('#win-dialog'),
  winTitle: document.querySelector('#win-title'),
  winResult: document.querySelector('#win-result'),
  winDetail: document.querySelector('#win-detail'),
  winSolution: document.querySelector('#win-solution'),
  winNew: document.querySelector('#win-new'),
  winClose: document.querySelector('#win-close'),
  statsDialog: document.querySelector('#stats-dialog'),
  statsClose: document.querySelector('#stats-close'),
  statsTotal: document.querySelector('#stats-total'),
  statsPerfect: document.querySelector('#stats-perfect'),
  statsDelta: document.querySelector('#stats-delta'),
  statsStreak: document.querySelector('#stats-streak'),
  statsBestStreak: document.querySelector('#stats-best-streak'),
  status: document.querySelector('#status'),
};

let state = {
  puzzle: null,
  mask: 0,
  moves: 0,
  won: false,
  demonstrating: false,
  mode: 'random',
  dailyDate: null,
  difficulty: loadValue('difficulty', 'normal'),
};
let solutionToken = 0;

init();

function init() {
  if (!DIFFICULTIES[state.difficulty]) state.difficulty = 'normal';
  applyStoredTheme();
  bindEvents();
  renderDifficulty();

  if (!openSharedPuzzle() && !restoreGame(loadValue('current-game'))) newPuzzle();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function bindEvents() {
  els.difficulty.addEventListener('click', (event) => {
    const button = event.target.closest('[data-difficulty]');
    if (!button) return;
    const next = button.dataset.difficulty;
    if (!DIFFICULTIES[next]) return;
    if (next === state.difficulty && state.mode === 'random') return;
    state.difficulty = next;
    state.mode = 'random';
    state.dailyDate = null;
    saveValue('difficulty', next);
    renderDifficulty();
    newPuzzle();
  });

  els.cells.addEventListener('click', (event) => {
    const mirror = event.target.closest('[data-mirror-index]');
    if (!mirror || mirror.dataset.locked === 'true' || state.won || state.demonstrating) return;
    rotateMirror(Number(mirror.dataset.mirrorIndex));
  });

  els.reset.addEventListener('click', resetPuzzle);
  els.newPuzzle.addEventListener('click', newPuzzle);
  els.daily.addEventListener('click', loadDailyPuzzle);
  els.stats.addEventListener('click', openStats);
  els.share.addEventListener('click', sharePuzzle);
  els.statsClose.addEventListener('click', () => els.statsDialog.close());

  els.winNew.addEventListener('click', () => {
    els.winDialog.close();
    newPuzzle();
  });
  els.winClose.addEventListener('click', () => els.winDialog.close());
  els.winSolution.addEventListener('click', showOptimalSolution);

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
    if (document.querySelector('dialog[open]')) return;
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
  cancelSolutionDemo();
  if (state.mode === 'daily') {
    const preferred = loadValue('difficulty', 'normal');
    state.difficulty = DIFFICULTIES[preferred] ? preferred : 'normal';
    renderDifficulty();
  }
  state.mode = 'random';
  state.dailyDate = null;
  const seed = randomSeed();
  loadPuzzle(seed, state.difficulty);
}

function loadDailyPuzzle() {
  cancelSolutionDemo();
  const date = todayKey();
  state.mode = 'daily';
  state.dailyDate = date;
  state.difficulty = 'normal';
  renderDifficulty();
  loadPuzzle(`daily-${date}`, 'normal');
  announce(`Défi du jour ${formatDate(date)}.`);
}

function loadPuzzle(seed, difficulty, restored = null, retriesLeft = 3) {
  let puzzle;
  try {
    puzzle = generatePuzzle(seed, difficulty);
  } catch (error) {
    console.error(error);
    if (restored || retriesLeft <= 0) return false;
    // Une seed de secours ne produit pas la grille du jour : on quitte le mode
    // plutôt que d'afficher un puzzle libre sous l'étiquette du défi.
    if (state.mode === 'daily') {
      state.mode = 'random';
      state.dailyDate = null;
      announce("Le défi du jour n'a pas pu être engendré, voici un puzzle libre.");
    }
    return loadPuzzle(randomSeed(), difficulty, null, retriesLeft - 1);
  }

  state = {
    ...state,
    puzzle,
    difficulty,
    mode: restored?.mode ?? state.mode,
    dailyDate: restored?.dailyDate ?? state.dailyDate,
    mask: restored?.mask ?? puzzle.initialMask,
    moves: restored?.moves ?? 0,
    won: false,
    demonstrating: false,
  };

  // Un miroir verrouillé garde toujours son orientation d'origine : une partie
  // restaurée qui prétend le contraire est corrompue.
  const lockedMask = puzzle.mirrors.reduce((mask, mirror, index) => (
    mirror.locked ? mask | (1 << index) : mask
  ), 0);
  const inconsistent = (state.mask & lockedMask) !== (puzzle.initialMask & lockedMask);
  if (state.mask < 0 || state.mask >= (1 << puzzle.mirrors.length) || inconsistent) {
    state.mask = puzzle.initialMask;
    state.moves = 0;
  }

  renderPuzzle();
  renderMode();
  syncUrl();
  persistGame();
  return true;
}

function restoreGame(saved) {
  if (!saved || saved.version !== 3 || saved.won) return false;
  if (!DIFFICULTIES[saved.difficulty] || typeof saved.seed !== 'string') return false;
  if (!Number.isInteger(saved.mask) || !Number.isInteger(saved.moves) || saved.moves < 0) return false;
  if (saved.mode === 'daily' && saved.dailyDate !== todayKey()) return false;

  state.difficulty = saved.difficulty;
  state.mode = saved.mode === 'daily' ? 'daily' : 'random';
  state.dailyDate = state.mode === 'daily' ? saved.dailyDate : null;
  if (state.mode === 'random') saveValue('difficulty', saved.difficulty);
  renderDifficulty();
  return loadPuzzle(saved.seed, saved.difficulty, saved);
}

function resetPuzzle() {
  if (!state.puzzle) return;
  cancelSolutionDemo();
  state.mask = state.puzzle.initialMask;
  state.moves = 0;
  state.won = false;
  state.demonstrating = false;
  if (els.winDialog.open) els.winDialog.close();
  renderState();
  persistGame();
  announce('Puzzle recommencé.');
}

function rotateMirror(index) {
  if (state.puzzle.mirrors[index]?.locked) return;
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
  recordCompletion();

  const perfect = state.moves === state.puzzle.par;
  els.winTitle.textContent = perfect ? 'Trajectoire parfaite !' : 'Cristal atteint !';
  els.winResult.textContent = `${state.moves} rotation${state.moves > 1 ? 's' : ''} · PAR ${state.puzzle.par}`;
  const dailyText = state.mode === 'daily' ? ' Défi du jour enregistré.' : '';
  els.winDetail.textContent = perfect
    ? `Tu as trouvé une solution optimale.${dailyText}`
    : `La solution optimale demande ${state.puzzle.par} rotation${state.puzzle.par > 1 ? 's' : ''}.${dailyText}`;

  announce(perfect ? 'Cristal atteint avec une solution optimale.' : 'Cristal atteint.');
  window.setTimeout(() => {
    if (!els.winDialog.open) els.winDialog.showModal();
  }, 220);
}

function renderPuzzle() {
  const { puzzle } = state;
  els.board.style.setProperty('--size', puzzle.size);
  els.board.dataset.laserColor = puzzle.laserColor;
  els.board.setAttribute(
    'aria-label',
    `Puzzle ${DIFFICULTIES[puzzle.difficulty].label}, grille ${puzzle.size} par ${puzzle.size}, laser ${COLOR_LABELS[puzzle.laserColor]}, PAR ${puzzle.par}`,
  );

  const svg = els.beam.ownerSVGElement;
  svg.setAttribute('viewBox', `0 0 ${puzzle.size} ${puzzle.size}`);

  els.cells.replaceChildren();
  const mirrorByCell = new Map(puzzle.mirrors.map((mirror, index) => [`${mirror.row},${mirror.col}`, index]));
  const filterByCell = new Map((puzzle.filters ?? []).map((filter) => [`${filter.row},${filter.col}`, filter]));

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const key = `${row},${col}`;
      const mirrorIndex = mirrorByCell.get(key);
      const filter = filterByCell.get(key);
      const isTarget = row === puzzle.target.row && col === puzzle.target.col;
      let cell;

      if (isTarget) {
        cell = document.createElement('div');
        cell.className = 'cell target-cell';
        cell.dataset.color = puzzle.target.color;
        cell.setAttribute('role', 'img');
        cell.setAttribute('aria-label', `Cristal ${COLOR_LABELS[puzzle.target.color]}`);
        cell.innerHTML = '<span class="crystal" aria-hidden="true"></span>';
      } else if (mirrorIndex !== undefined) {
        const mirror = puzzle.mirrors[mirrorIndex];
        cell = document.createElement(mirror.locked ? 'div' : 'button');
        if (!mirror.locked) cell.type = 'button';
        cell.className = `cell mirror${mirror.locked ? ' mirror--locked' : ''}`;
        cell.dataset.mirrorIndex = String(mirrorIndex);
        cell.dataset.locked = String(Boolean(mirror.locked));
        cell.innerHTML = '<span class="mirror-bar" aria-hidden="true"></span>'
          + (mirror.locked ? '<span class="mirror-lock" aria-hidden="true"></span>' : '');
      } else if (filter) {
        cell = document.createElement('div');
        cell.className = 'cell filter-cell';
        cell.dataset.filterColor = filter.color;
        cell.setAttribute('role', 'img');
        cell.setAttribute('aria-label', `Filtre ${COLOR_LABELS[filter.color]}`);
        cell.innerHTML = `<span class="filter-disc" aria-hidden="true"><span>${COLOR_LABELS[filter.color][0].toUpperCase()}</span></span>`;
      } else {
        cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('aria-hidden', 'true');
      }

      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(col + 1);
      els.cells.append(cell);
    }
  }

  renderState();
}

function renderState() {
  for (const element of els.cells.querySelectorAll('[data-mirror-index]')) {
    const index = Number(element.dataset.mirrorIndex);
    const orientation = orientationAt(state.mask, index);
    element.dataset.orientation = orientation === '/' ? 'slash' : 'backslash';
    const mirror = state.puzzle.mirrors[index];
    const label = `Miroir ${mirror.locked ? 'verrouillé, ' : ''}ligne ${mirror.row + 1}, colonne ${mirror.col + 1}, orientation ${orientation === '/' ? 'barre oblique' : 'barre oblique inversée'}`;
    element.setAttribute('aria-label', label);
    if (mirror.locked) element.setAttribute('role', 'img');
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
  els.board.classList.toggle('is-blocked', trace.blocked);
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

function renderMode() {
  const daily = state.mode === 'daily';
  els.daily.classList.toggle('is-active', daily);
  els.daily.setAttribute('aria-pressed', String(daily));
  els.dailyBadge.hidden = !daily;
  if (daily) els.dailyBadge.textContent = `Défi du ${formatDate(state.dailyDate)}`;

  const label = daily ? `Défi du jour · ${state.dailyDate}` : `Seed ${state.puzzle.seed}`;
  els.seedLabel.textContent = label;
  els.share.setAttribute('aria-label', `Copier le lien de ce puzzle (${label})`);
}

// L'adresse décrit toujours la grille affichée : recharger la page redonne le
// même puzzle, et partager le lien se réduit à copier l'adresse.
function puzzleUrl() {
  const url = new URL(location.href);
  url.search = state.mode === 'daily'
    ? new URLSearchParams({ jour: state.dailyDate })
    : new URLSearchParams({ seed: state.puzzle.seed, niveau: state.difficulty });
  return url.toString();
}

function syncUrl() {
  try {
    history.replaceState(null, '', puzzleUrl());
  } catch {
    // Protocole file:// ou navigation restreinte : le jeu marche sans l'URL.
  }
}

function openSharedPuzzle() {
  const params = new URLSearchParams(location.search);
  const day = params.get('jour');
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    // Un lien du jour rouvert plus tard redonne la même grille, mais hors mode
    // quotidien : la série ne se nourrit pas de dates choisies à la main.
    const today = day === todayKey();
    state.mode = today ? 'daily' : 'random';
    state.dailyDate = today ? day : null;
    state.difficulty = 'normal';
    renderDifficulty();
    return loadPuzzle(`daily-${day}`, 'normal');
  }

  const seed = params.get('seed');
  const niveau = params.get('niveau');
  if (!seed || seed.length > 64 || !DIFFICULTIES[niveau]) return false;
  state.mode = 'random';
  state.dailyDate = null;
  state.difficulty = niveau;
  renderDifficulty();
  return loadPuzzle(seed, niveau);
}

async function sharePuzzle() {
  const url = puzzleUrl();
  try {
    await navigator.clipboard.writeText(url);
    flashShare('Lien copié !');
    announce('Lien du puzzle copié dans le presse-papiers.');
  } catch {
    flashShare('Copie refusée');
    announce(`Lien du puzzle : ${url}`);
  }
}

let shareTimer = 0;
function flashShare(message) {
  const label = els.share.querySelector('.share-text');
  if (!label) return;
  label.textContent = message;
  window.clearTimeout(shareTimer);
  shareTimer = window.setTimeout(() => { label.textContent = 'Partager'; }, 1800);
}

function persistGame() {
  if (!state.puzzle || state.won || state.demonstrating) return;
  saveValue('current-game', {
    version: 3,
    seed: state.puzzle.seed,
    difficulty: state.difficulty,
    mode: state.mode,
    dailyDate: state.dailyDate,
    mask: state.mask,
    moves: state.moves,
    won: false,
  });
}

function showOptimalSolution() {
  if (!state.puzzle) return;
  els.winDialog.close();
  const token = ++solutionToken;
  state.demonstrating = true;
  state.won = true;
  state.mask = state.puzzle.initialMask;
  state.moves = 0;
  renderState();

  const diff = state.puzzle.initialMask ^ state.puzzle.optimalMask;
  const indexes = state.puzzle.mirrors
    .map((mirror, index) => (!mirror.locked && (diff & (1 << index)) ? index : -1))
    .filter((index) => index >= 0);

  indexes.forEach((index, step) => {
    window.setTimeout(() => {
      if (token !== solutionToken) return;
      state.mask ^= (1 << index);
      state.moves = step + 1;
      renderState();
      if (step === indexes.length - 1) {
        state.demonstrating = false;
        announce(`Solution optimale en ${indexes.length} rotations.`);
      }
    }, 430 * (step + 1));
  });
}

function cancelSolutionDemo() {
  solutionToken += 1;
  state.demonstrating = false;
}

function recordCompletion() {
  const stats = loadStats();
  const key = `${state.puzzle.seed}|${state.difficulty}`;
  if (stats.completed.includes(key)) return;

  stats.total += 1;
  stats.totalDelta += Math.max(0, state.moves - state.puzzle.par);
  if (state.moves === state.puzzle.par) stats.perfect += 1;
  const bucket = stats.byDifficulty[state.difficulty];
  bucket.total += 1;
  if (state.moves === state.puzzle.par) bucket.perfect += 1;

  if (state.mode === 'daily' && state.dailyDate) {
    const last = stats.daily.lastCompleted;
    if (last !== state.dailyDate) {
      stats.daily.currentStreak = last && dayDifference(last, state.dailyDate) === 1
        ? stats.daily.currentStreak + 1
        : 1;
      stats.daily.bestStreak = Math.max(stats.daily.bestStreak, stats.daily.currentStreak);
      stats.daily.lastCompleted = state.dailyDate;
    }
  }

  stats.completed.push(key);
  if (stats.completed.length > 300) stats.completed = stats.completed.slice(-300);
  saveValue('stats', stats);
}

function loadStats() {
  const saved = loadValue('stats');
  if (saved?.version === 1) return saved;
  return {
    version: 1,
    total: 0,
    perfect: 0,
    totalDelta: 0,
    byDifficulty: {
      facile: { total: 0, perfect: 0 },
      normal: { total: 0, perfect: 0 },
      difficile: { total: 0, perfect: 0 },
    },
    daily: { currentStreak: 0, bestStreak: 0, lastCompleted: null },
    completed: [],
  };
}

function openStats() {
  const stats = loadStats();
  els.statsTotal.textContent = String(stats.total);
  els.statsPerfect.textContent = stats.total ? `${Math.round((stats.perfect / stats.total) * 100)} %` : '—';
  els.statsDelta.textContent = stats.total ? `+${(stats.totalDelta / stats.total).toFixed(1)}` : '—';
  const activeStreak = stats.daily.lastCompleted && dayDifference(stats.daily.lastCompleted, todayKey()) <= 1
    ? stats.daily.currentStreak
    : 0;
  els.statsStreak.textContent = String(activeStreak);
  els.statsBestStreak.textContent = String(stats.daily.bestStreak);
  els.statsDialog.showModal();
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

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
    .format(new Date(year, month - 1, day));
}

function dayDifference(from, to) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

function announce(message) {
  els.status.textContent = '';
  requestAnimationFrame(() => { els.status.textContent = message; });
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}
