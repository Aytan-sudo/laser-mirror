import { createRng } from './rng.js';
import {
  DIRECTIONS,
  maskFromOrientations,
  orientationForTurn,
  solvePuzzle,
  traceLaser,
} from './engine.js';

export const DIFFICULTIES = Object.freeze({
  facile: Object.freeze({ label: 'Facile', size: 6, mirrors: [5, 7], pathTurns: [3, 5], par: [2, 4], maxOptimal: 8 }),
  normal: Object.freeze({ label: 'Normal', size: 6, mirrors: [7, 10], pathTurns: [5, 8], par: [4, 7], maxOptimal: 5 }),
  difficile: Object.freeze({ label: 'Difficile', size: 6, mirrors: [9, 12], pathTurns: [7, 10], par: [6, 10], maxOptimal: 4 }),
});

const SIDES = ['left', 'right', 'top', 'bottom'];

export function generatePuzzle(seed, difficultyKey = 'normal') {
  const config = DIFFICULTIES[difficultyKey];
  if (!config) throw new Error(`Difficulté inconnue: ${difficultyKey}`);

  const rng = createRng(`${seed}|${difficultyKey}`);
  const maxAttempts = 220;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const desiredTurns = rng.int(config.pathTurns[0], config.pathTurns[1]);
    const pathData = buildPath(config.size, desiredTurns, rng);
    if (!pathData) continue;

    const intendedMirrors = mirrorsFromPath(pathData.path);
    if (intendedMirrors.length < config.par[0]) continue;

    const totalMirrorCount = Math.max(
      intendedMirrors.length,
      rng.int(config.mirrors[0], config.mirrors[1]),
    );
    if (totalMirrorCount > 12) continue;

    const intendedCells = new Set(pathData.path.map((step) => `${step.row},${step.col}`));
    const targetKey = `${pathData.target.row},${pathData.target.col}`;
    const candidates = [];
    for (let row = 0; row < config.size; row += 1) {
      for (let col = 0; col < config.size; col += 1) {
        const key = `${row},${col}`;
        if (!intendedCells.has(key) && key !== targetKey) candidates.push({ row, col });
      }
    }

    const decoysNeeded = totalMirrorCount - intendedMirrors.length;
    const decoys = rng.shuffle(candidates).slice(0, decoysNeeded).map((cell) => ({
      ...cell,
      orientation: rng() < 0.5 ? '/' : '\\',
      intended: false,
    }));

    let mirrors = [...intendedMirrors, ...decoys]
      .sort((a, b) => a.row - b.row || a.col - b.col);

    const solutionMask = maskFromOrientations(mirrors);
    const intendedIndexes = mirrors
      .map((mirror, index) => (mirror.intended ? index : -1))
      .filter((index) => index >= 0);

    const desiredDistance = rng.int(
      config.par[0],
      Math.min(config.par[1], intendedIndexes.length),
    );
    const wrongIndexes = rng.shuffle(intendedIndexes).slice(0, desiredDistance);
    let initialMask = solutionMask;
    for (const index of wrongIndexes) initialMask ^= (1 << index);

    mirrors.forEach((mirror, index) => {
      if (!mirror.intended && rng() < 0.5) initialMask ^= (1 << index);
    });

    const puzzle = {
      version: 1,
      seed: String(seed),
      difficulty: difficultyKey,
      size: config.size,
      entry: pathData.entry,
      target: pathData.target,
      mirrors: mirrors.map(({ row, col }) => ({ row, col })),
      initialMask,
    };

    const initialTrace = traceLaser(puzzle, initialMask);
    if (initialTrace.hit || initialTrace.visitedCells.length < 3) continue;

    const solved = solvePuzzle(puzzle);
    if (!solved.solvable) continue;
    if (solved.par < config.par[0] || solved.par > config.par[1]) continue;
    if (solved.optimalCount > config.maxOptimal) continue;
    if (intendedMirrors.length / mirrors.length < 0.6) continue;

    return {
      ...puzzle,
      par: solved.par,
      analysis: {
        explored: solved.explored,
        optimalCount: solved.optimalCount,
        intendedMirrors: intendedMirrors.length,
        attempts: attempt,
      },
    };
  }

  throw new Error(`Impossible de générer un puzzle ${difficultyKey} avec la seed ${seed}.`);
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
  const {
    size, rng, path, visited, direction, turns, desiredTurns, stepsSinceTurn,
  } = state;
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

    const next = {
      row: current.row + nextDirection.dy,
      col: current.col + nextDirection.dx,
    };
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
