import { createRng } from './rng.js';
import {
  DIRECTIONS,
  LASER_COLORS,
  compilePuzzle,
  maskFromOrientations,
  orientationForTurn,
  popcount,
  solvePuzzle,
  traceLaser,
} from './engine.js';

// Le balayage exhaustif des configurations coûte 2^miroirs tracés : la borne
// garde la génération sous la dizaine de millisecondes, même sur téléphone.
const MAX_MIRRORS = 14;

export const DIFFICULTIES = Object.freeze({
  facile: Object.freeze({
    label: 'Facile', size: 6, mirrors: [5, 8], decoys: [1, 2], pathTurns: [4, 6], par: [3, 4],
    maxOptimal: 6, locked: [1, 1], filters: [1, 2],
  }),
  normal: Object.freeze({
    label: 'Normal', size: 6, mirrors: [8, 11], decoys: [2, 3], pathTurns: [6, 9], par: [5, 7],
    maxOptimal: 5, locked: [1, 2], filters: [2, 3],
  }),
  difficile: Object.freeze({
    label: 'Difficile', size: 6, mirrors: [11, 14], decoys: [2, 4], pathTurns: [9, 12], par: [8, 10],
    maxOptimal: 4, locked: [2, 3], filters: [2, 4],
  }),
});

const SIDES = ['left', 'right', 'top', 'bottom'];

export function generatePuzzle(seed, difficultyKey = 'normal') {
  const config = DIFFICULTIES[difficultyKey];
  if (!config) throw new Error(`Difficulté inconnue: ${difficultyKey}`);

  const rng = createRng(`${seed}|${difficultyKey}|v3`);
  const maxAttempts = 600;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const puzzle = buildCandidate(config, difficultyKey, seed, rng);
    if (puzzle) return { ...puzzle, analysis: { ...puzzle.analysis, attempts: attempt } };
  }

  throw new Error(`Impossible de générer un puzzle ${difficultyKey} avec la seed ${seed}.`);
}

// Une tentative complète : trajet, miroirs, verrous, puis calibration par les
// filtres. Renvoie null dès qu'un critère de qualité n'est pas tenu.
function buildCandidate(config, difficultyKey, seed, rng) {
  const size = config.size;
  const desiredTurns = rng.int(config.pathTurns[0], config.pathTurns[1]);
  const pathData = buildPath(size, desiredTurns, rng);
  if (!pathData) return null;

  const intendedMirrors = mirrorsFromPath(pathData.path);
  if (intendedMirrors.length < config.par[0]) return null;

  // Les leurres s'ajoutent au trajet : ils peuplent le plateau et donnent des
  // cadenas à poser ailleurs que sur la solution.
  const decoyCount = rng.int(config.decoys[0], config.decoys[1]);
  const totalMirrorCount = intendedMirrors.length + decoyCount;
  if (totalMirrorCount > MAX_MIRRORS || totalMirrorCount < config.mirrors[0]) return null;
  if (totalMirrorCount > config.mirrors[1]) return null;

  const pathCells = new Set(pathData.path.map((step) => `${step.row},${step.col}`));
  const targetKey = `${pathData.target.row},${pathData.target.col}`;
  const freeCells = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const key = `${row},${col}`;
      if (!pathCells.has(key) && key !== targetKey) freeCells.push({ row, col });
    }
  }

  const decoys = rng.shuffle(freeCells)
    .slice(0, totalMirrorCount - intendedMirrors.length)
    .map((cell) => ({
      ...cell,
      orientation: rng() < 0.5 ? '/' : '\\',
      intended: false,
    }));

  const laserColor = rng.pick(LASER_COLORS);
  const base = {
    size,
    entry: pathData.entry,
    target: { ...pathData.target, color: laserColor },
    laserColor,
  };

  let mirrors = [...intendedMirrors, ...decoys].sort((a, b) => a.row - b.row || a.col - b.col);
  let sweep = sweepConfigurations(base, mirrors);

  // Un miroir qu'aucune configuration n'éclaire n'est pas un leurre, c'est du
  // mobilier : on le retire. Comme il n'est jamais traversé, l'enlever ne
  // change aucune trajectoire.
  const lit = litMirrors(base, mirrors, sweep);
  if (lit.length !== mirrors.length) {
    if (lit.length < intendedMirrors.length) return null;
    mirrors = lit;
    sweep = sweepConfigurations(base, mirrors);
  }

  const intendedIndexes = mirrors.map((m, i) => (m.intended ? i : -1)).filter((i) => i >= 0);
  const decoyIndexes = mirrors.map((m, i) => (m.intended ? -1 : i)).filter((i) => i >= 0);
  if (intendedIndexes.length / mirrors.length < 0.55) return null;

  const lockedIndexes = chooseLocks(config, rng, intendedIndexes, decoyIndexes);
  if (lockedIndexes.size < config.locked[0]) return null;

  const mutableIntended = intendedIndexes.filter((index) => !lockedIndexes.has(index));
  if (mutableIntended.length < config.par[0]) return null;

  mirrors = mirrors.map((mirror, index) => ({ ...mirror, locked: lockedIndexes.has(index) }));
  const lockedMask = [...lockedIndexes].reduce((mask, index) => mask | (1 << index), 0);
  const solutionMask = maskFromOrientations(mirrors);
  const highestPar = Math.min(config.par[1], mutableIntended.length);

  // Le trajet construit garantit une solution à `targetPar` rotations. Reste à
  // supprimer les raccourcis pour que ce soit vraiment le minimum.
  for (let draw = 0; draw < 12; draw += 1) {
    const targetPar = rng.int(config.par[0], highestPar);
    const initialMask = rng.shuffle(mutableIntended)
      .slice(0, targetPar)
      .reduce((mask, index) => mask ^ (1 << index), solutionMask);

    const calibrated = calibrate({
      base, config, mirrors, sweep, rng,
      initialMask, lockedMask, solutionMask, targetPar,
      pathData, pathCells,
    });
    if (!calibrated) continue;

    const puzzle = {
      version: 3,
      seed: String(seed),
      difficulty: difficultyKey,
      size,
      entry: base.entry,
      target: base.target,
      laserColor,
      filters: calibrated.filters,
      mirrors: mirrors.map(({ row, col, locked }) => ({ row, col, locked })),
      initialMask,
    };

    // Filet de sécurité : le solver du moteur est la référence, la simulation
    // par masques de cases n'est qu'une accélération.
    if (traceLaser(puzzle, initialMask).hit) continue;
    const solved = solvePuzzle(puzzle);
    if (!solved.solvable || solved.par !== targetPar) continue;
    if (solved.optimalCount > config.maxOptimal) continue;
    // Verrous et filtres restreignent l'éclairage : un miroir que plus aucune
    // configuration jouable n'atteint redeviendrait du mobilier.
    if (!everyMirrorLit(puzzle)) continue;

    return {
      ...puzzle,
      par: solved.par,
      optimalMask: solutionMask,
      analysis: {
        optimalCount: solved.optimalCount,
        intendedMirrors: intendedIndexes.length,
        lockedMirrors: lockedIndexes.size,
        lockedOnPath: [...lockedIndexes].filter((i) => mirrors[i].intended).length,
        filters: calibrated.filters.length,
        blockingFilters: calibrated.blocking,
        shortcutsCut: calibrated.shortcutsCut,
      },
    };
  }

  return null;
}

// Dernier contrôle, avec le moteur : chaque miroir doit être atteignable dans
// au moins une configuration réellement jouable (verrous figés, filtres posés).
function everyMirrorLit(puzzle) {
  const compiled = compilePuzzle(puzzle);
  const mutable = puzzle.mirrors
    .map((mirror, index) => (mirror.locked ? -1 : index))
    .filter((index) => index >= 0);
  const missing = new Set(puzzle.mirrors.map((mirror) => `${mirror.row},${mirror.col}`));

  for (let combination = 0; combination < (1 << mutable.length) && missing.size; combination += 1) {
    let mask = puzzle.initialMask;
    for (let bit = 0; bit < mutable.length; bit += 1) {
      if (combination & (1 << bit)) mask ^= (1 << mutable[bit]);
    }
    for (const cell of traceLaser(puzzle, mask, compiled).visitedCells) missing.delete(`${cell.row},${cell.col}`);
  }

  return missing.size === 0;
}

// Choisit les verrous moitié sur le trajet, moitié sur les leurres : un cadenas
// ne doit rien apprendre au joueur sur l'emplacement de la solution.
function chooseLocks(config, rng, intendedIndexes, decoyIndexes) {
  const wanted = rng.int(config.locked[0], config.locked[1]);
  const maxOnPath = Math.max(0, intendedIndexes.length - config.par[0]);
  const onPath = rng.shuffle(intendedIndexes);
  const offPath = rng.shuffle(decoyIndexes);
  const locked = new Set();
  let onPathUsed = 0;

  for (let i = 0; i < wanted; i += 1) {
    const preferDecoy = rng() < 0.72;
    if (preferDecoy && offPath.length) locked.add(offPath.pop());
    else if (onPath.length && onPathUsed < maxOnPath) { locked.add(onPath.pop()); onPathUsed += 1; }
    else if (offPath.length) locked.add(offPath.pop());
  }

  return locked;
}

// Pose les filtres : d'abord ceux qui coupent les raccourcis (le PAR visé
// devient le minimum réel), puis ceux qui lèvent les solutions ex æquo, et
// enfin un laissez-passer de la couleur du laser si le budget le permet.
function calibrate(context) {
  const { base, config, mirrors, sweep, rng, initialMask, lockedMask, solutionMask, targetPar } = context;
  const size = base.size;
  const budget = rng.int(config.filters[0], config.filters[1]);

  const solutions = [];
  for (let mask = 0; mask < sweep.total; mask += 1) {
    if (!sweep.hit[mask]) continue;
    if ((mask & lockedMask) !== (initialMask & lockedMask)) continue;
    solutions.push({ mask, distance: popcount(mask ^ initialMask) });
  }

  const shortcuts = solutions.filter((entry) => entry.distance < targetPar);
  if (!shortcuts.length) return null; // sans raccourci à couper, les filtres ne décideraient de rien

  // Le trajet voulu est intouchable : aucun filtre ne peut se poser dessus.
  const safeLo = sweep.lo[solutionMask];
  const safeHi = sweep.hi[solutionMask];
  const mirrorCells = new Set(mirrors.map((mirror) => `${mirror.row},${mirror.col}`));

  const blocked = { lo: 0, hi: 0 };
  const isBlocked = (mask) => (sweep.lo[mask] & blocked.lo) !== 0 || (sweep.hi[mask] & blocked.hi) !== 0;
  const cut = (list) => list.filter((entry) => !isBlocked(entry.mask));

  const filterCells = [];
  let shortcutsCut = 0;

  const placeAgainst = (targets) => {
    const counts = new Map();
    for (const entry of targets) {
      forEachCell(sweep.lo[entry.mask], sweep.hi[entry.mask], size, (row, col, index) => {
        if (isCellSet(safeLo, safeHi, index)) return;
        if (mirrorCells.has(`${row},${col}`)) return;
        counts.set(index, (counts.get(index) ?? 0) + 1);
      });
    }
    if (!counts.size) return false;

    const best = Math.max(...counts.values());
    const tied = [...counts.entries()].filter(([, count]) => count === best).map(([index]) => index);
    const index = rng.pick(rng.shuffle(tied));
    filterCells.push({ row: Math.floor(index / size), col: index % size });
    if (index < 32) blocked.lo |= (1 << index); else blocked.hi |= (1 << (index - 32));
    return true;
  };

  while (filterCells.length < budget && cut(shortcuts).length) {
    const before = cut(shortcuts).length;
    if (!placeAgainst(cut(shortcuts))) break;
    shortcutsCut += before - cut(shortcuts).length;
  }
  if (cut(shortcuts).length) return null;

  const ties = () => cut(solutions.filter((entry) => entry.distance === targetPar));
  while (filterCells.length < budget && ties().length > config.maxOptimal) {
    if (!placeAgainst(ties().slice(1))) break;
  }
  if (ties().length > config.maxOptimal) return null;

  const blocking = filterCells.length;
  const filters = filterCells.map((cell) => ({
    ...cell,
    color: rng.pick(LASER_COLORS.filter((color) => color !== base.laserColor)),
  }));

  // Laissez-passer : un filtre de la couleur du laser posé sur le trajet. Il ne
  // bloque rien, mais il oblige à lire la couleur avant de conclure.
  if (filters.length < budget) {
    const straight = context.pathData.path
      .slice(1, -1)
      .filter((step) => !mirrorCells.has(`${step.row},${step.col}`))
      .filter((step) => !filterCells.some((cell) => cell.row === step.row && cell.col === step.col));
    if (straight.length) {
      const cell = rng.pick(straight);
      filters.push({ row: cell.row, col: cell.col, color: base.laserColor });
    }
  }

  return { filters, blocking, shortcutsCut };
}

// Trace les 2^miroirs configurations une fois pour toutes : pour chacune, le
// cristal est-il atteint et quelles cases le rayon traverse-t-il ? Un filtre de
// la mauvaise couleur ne dévie jamais le rayon, il l'arrête : il suffit donc
// d'intersecter ces masques de cases pour simuler n'importe quelle pose.
function sweepConfigurations(base, mirrors) {
  const puzzle = { ...base, mirrors, filters: [] };
  const compiled = compilePuzzle(puzzle);
  const total = 1 << mirrors.length;
  const hit = new Uint8Array(total);
  const lo = new Uint32Array(total);
  const hi = new Uint32Array(total);

  for (let mask = 0; mask < total; mask += 1) {
    const trace = traceLaser(puzzle, mask, compiled);
    if (trace.hit) hit[mask] = 1;
    let low = 0;
    let high = 0;
    for (const cell of trace.visitedCells) {
      const index = cell.row * base.size + cell.col;
      if (index < 32) low |= (1 << index); else high |= (1 << (index - 32));
    }
    lo[mask] = low >>> 0;
    hi[mask] = high >>> 0;
  }

  return { hit, lo, hi, total };
}

function litMirrors(base, mirrors, sweep) {
  let lo = 0;
  let hi = 0;
  for (let mask = 0; mask < sweep.total; mask += 1) {
    lo |= sweep.lo[mask];
    hi |= sweep.hi[mask];
  }
  return mirrors.filter((mirror) => isCellSet(lo, hi, mirror.row * base.size + mirror.col));
}

function isCellSet(lo, hi, index) {
  return index < 32 ? (lo & (1 << index)) !== 0 : (hi & (1 << (index - 32))) !== 0;
}

function forEachCell(lo, hi, size, callback) {
  for (let index = 0; index < size * size; index += 1) {
    if (isCellSet(lo, hi, index)) callback(Math.floor(index / size), index % size, index);
  }
}

function buildPath(size, desiredTurns, rng) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const side = rng.pick(SIDES);
    const index = rng.int(0, size - 1);
    const entry = { side, index };
    const start = firstCell(size, entry);
    const initialDirection = inwardDirection(side);
    const visited = new Set([`${start.row},${start.col}`]);
    const path = [{ ...start, incoming: initialDirection, outgoing: null }];

    const result = extendPath({
      size,
      rng,
      path,
      visited,
      direction: initialDirection,
      turns: 0,
      desiredTurns,
      stepsSinceTurn: 1,
    });

    if (result) {
      return {
        entry,
        path: result,
        target: { row: result.at(-1).row, col: result.at(-1).col },
      };
    }
  }
  return null;
}

function extendPath(state) {
  const { size, rng, path, visited, direction, turns, desiredTurns, stepsSinceTurn } = state;
  const current = path.at(-1);

  if (turns === desiredTurns && stepsSinceTurn >= 1 && path.length >= desiredTurns + 5) {
    if (rng() < 0.55 || path.length >= desiredTurns + 9) return path;
  }

  const options = [direction];
  if (turns < desiredTurns) options.push(turnLeft(direction), turnRight(direction));

  const ordered = rng.shuffle(options).sort((a, b) => {
    const aTurn = !sameDirection(a, direction);
    const bTurn = !sameDirection(b, direction);
    return Number(bTurn) - Number(aTurn);
  });

  for (const nextDirection of ordered) {
    const turning = !sameDirection(nextDirection, direction);
    const nextTurns = turns + (turning ? 1 : 0);
    if (nextTurns > desiredTurns) continue;

    const next = { row: current.row + nextDirection.dy, col: current.col + nextDirection.dx };
    const key = `${next.row},${next.col}`;
    if (!inside(size, next.row, next.col) || visited.has(key)) continue;

    current.outgoing = nextDirection;
    const nextStep = { ...next, incoming: nextDirection, outgoing: null };
    path.push(nextStep);
    visited.add(key);

    const result = extendPath({
      ...state,
      path,
      visited,
      direction: nextDirection,
      turns: nextTurns,
      stepsSinceTurn: turning ? 0 : stepsSinceTurn + 1,
    });
    if (result) return result;

    visited.delete(key);
    path.pop();
    current.outgoing = null;
  }

  return null;
}

function mirrorsFromPath(path) {
  const mirrors = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const step = path[i];
    if (!step.outgoing || sameDirection(step.incoming, step.outgoing)) continue;
    mirrors.push({
      row: step.row,
      col: step.col,
      orientation: orientationForTurn(step.incoming, step.outgoing),
      intended: true,
    });
  }
  return mirrors;
}

function inwardDirection(side) {
  switch (side) {
    case 'left': return DIRECTIONS.right;
    case 'right': return DIRECTIONS.left;
    case 'top': return DIRECTIONS.down;
    case 'bottom': return DIRECTIONS.up;
    default: throw new Error(`Bord inconnu: ${side}`);
  }
}

function firstCell(size, entry) {
  switch (entry.side) {
    case 'left': return { row: entry.index, col: 0 };
    case 'right': return { row: entry.index, col: size - 1 };
    case 'top': return { row: 0, col: entry.index };
    case 'bottom': return { row: size - 1, col: entry.index };
    default: throw new Error(`Bord inconnu: ${entry.side}`);
  }
}

function turnLeft(direction) {
  if (direction === DIRECTIONS.up) return DIRECTIONS.left;
  if (direction === DIRECTIONS.left) return DIRECTIONS.down;
  if (direction === DIRECTIONS.down) return DIRECTIONS.right;
  return DIRECTIONS.up;
}

function turnRight(direction) {
  if (direction === DIRECTIONS.up) return DIRECTIONS.right;
  if (direction === DIRECTIONS.right) return DIRECTIONS.down;
  if (direction === DIRECTIONS.down) return DIRECTIONS.left;
  return DIRECTIONS.up;
}

function sameDirection(a, b) {
  return a.dx === b.dx && a.dy === b.dy;
}

function inside(size, row, col) {
  return row >= 0 && row < size && col >= 0 && col < size;
}
