export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ dx: 0, dy: -1, name: 'up' }),
  right: Object.freeze({ dx: 1, dy: 0, name: 'right' }),
  down: Object.freeze({ dx: 0, dy: 1, name: 'down' }),
  left: Object.freeze({ dx: -1, dy: 0, name: 'left' }),
});

export const LASER_COLORS = Object.freeze(['red', 'blue', 'yellow']);

const DIRECTION_LIST = Object.values(DIRECTIONS);

export function reflect(direction, orientation) {
  const { dx, dy } = direction;
  if (orientation === '/') return directionFromDelta(-dy, -dx);
  if (orientation === '\\') return directionFromDelta(dy, dx);
  throw new Error(`Orientation de miroir inconnue: ${orientation}`);
}

export function orientationForTurn(incoming, outgoing) {
  for (const orientation of ['/', '\\']) {
    if (sameDirection(reflect(incoming, orientation), outgoing)) return orientation;
  }
  throw new Error('Le virage demandé ne peut pas être produit par un miroir.');
}

export function orientationAt(mask, mirrorIndex) {
  return (mask & (1 << mirrorIndex)) !== 0 ? '\\' : '/';
}

export function maskFromOrientations(mirrors) {
  return mirrors.reduce(
    (mask, mirror, index) => mask | (mirror.orientation === '\\' ? (1 << index) : 0),
    0,
  );
}

export function traceLaser(puzzle, mask = puzzle.initialMask) {
  const { size, entry, target, mirrors, filters = [] } = puzzle;
  const laserColor = puzzle.laserColor ?? target.color ?? 'red';
  const mirrorAt = new Map(mirrors.map((mirror, index) => [`${mirror.row},${mirror.col}`, index]));
  const filterAt = new Map(filters.map((filter) => [`${filter.row},${filter.col}`, filter]));

  let { row, col, direction } = entryState(size, entry);
  let currentDirection = direction;
  const points = [entryPoint(size, entry)];
  const visitedCells = [];
  const seenStates = new Set();

  while (inside(size, row, col)) {
    const stateKey = `${row},${col},${currentDirection.name}`;
    if (seenStates.has(stateKey)) {
      return { hit: false, loop: true, blocked: false, color: laserColor, points, visitedCells, exit: null };
    }
    seenStates.add(stateKey);

    visitedCells.push({ row, col });
    points.push({ x: col + 0.5, y: row + 0.5 });

    const filter = filterAt.get(`${row},${col}`);
    if (filter && filter.color !== laserColor) {
      return {
        hit: false,
        loop: false,
        blocked: true,
        blockedAt: { row, col, color: filter.color },
        color: laserColor,
        points,
        visitedCells,
        exit: null,
      };
    }

    if (row === target.row && col === target.col) {
      const targetAccepts = !target.color || target.color === laserColor;
      return {
        hit: targetAccepts,
        loop: false,
        blocked: !targetAccepts,
        blockedAt: targetAccepts ? null : { row, col, color: target.color },
        color: laserColor,
        points,
        visitedCells,
        exit: null,
      };
    }

    const mirrorIndex = mirrorAt.get(`${row},${col}`);
    if (mirrorIndex !== undefined) {
      currentDirection = reflect(currentDirection, orientationAt(mask, mirrorIndex));
    }

    row += currentDirection.dy;
    col += currentDirection.dx;
  }

  points.push(exitPoint(size, row, col, currentDirection));
  return {
    hit: false,
    loop: false,
    blocked: false,
    color: laserColor,
    points,
    visitedCells,
    exit: { row, col, direction: currentDirection.name },
  };
}

export function solvePuzzle(puzzle, options = {}) {
  const maxOptimalMasks = options.maxOptimalMasks ?? 16;
  const initialMask = puzzle.initialMask;
  const mutableIndexes = puzzle.mirrors
    .map((mirror, index) => (mirror.locked ? -1 : index))
    .filter((index) => index >= 0);
  let explored = 0;

  for (let distance = 0; distance <= mutableIndexes.length; distance += 1) {
    const optimalMasks = [];
    let optimalCount = 0;

    forEachCombination(mutableIndexes.length, distance, (localToggleMask) => {
      let toggleMask = 0;
      for (let localIndex = 0; localIndex < mutableIndexes.length; localIndex += 1) {
        if (localToggleMask & (1 << localIndex)) toggleMask |= (1 << mutableIndexes[localIndex]);
      }
      const candidateMask = initialMask ^ toggleMask;
      explored += 1;
      if (!traceLaser(puzzle, candidateMask).hit) return;
      optimalCount += 1;
      if (optimalMasks.length < maxOptimalMasks) optimalMasks.push(candidateMask);
    });

    if (optimalCount > 0) {
      return {
        solvable: true,
        par: distance,
        explored,
        optimalCount,
        optimalMasks,
      };
    }
  }

  return { solvable: false, par: null, explored, optimalCount: 0, optimalMasks: [] };
}

export function popcount(value) {
  let n = value >>> 0;
  let count = 0;
  while (n) {
    n &= n - 1;
    count += 1;
  }
  return count;
}

function forEachCombination(bitCount, choose, callback) {
  if (choose === 0) {
    callback(0);
    return;
  }

  const visit = (start, left, mask) => {
    if (left === 0) {
      callback(mask);
      return;
    }
    for (let bit = start; bit <= bitCount - left; bit += 1) {
      visit(bit + 1, left - 1, mask | (1 << bit));
    }
  };

  visit(0, choose, 0);
}

function entryState(size, entry) {
  switch (entry.side) {
    case 'left': return { row: entry.index, col: 0, direction: DIRECTIONS.right };
    case 'right': return { row: entry.index, col: size - 1, direction: DIRECTIONS.left };
    case 'top': return { row: 0, col: entry.index, direction: DIRECTIONS.down };
    case 'bottom': return { row: size - 1, col: entry.index, direction: DIRECTIONS.up };
    default: throw new Error(`Bord d'entrée inconnu: ${entry.side}`);
  }
}

function entryPoint(size, entry) {
  switch (entry.side) {
    case 'left': return { x: 0, y: entry.index + 0.5 };
    case 'right': return { x: size, y: entry.index + 0.5 };
    case 'top': return { x: entry.index + 0.5, y: 0 };
    case 'bottom': return { x: entry.index + 0.5, y: size };
    default: throw new Error(`Bord d'entrée inconnu: ${entry.side}`);
  }
}

function exitPoint(size, row, col, direction) {
  if (col < 0) return { x: 0, y: row + 0.5 };
  if (col >= size) return { x: size, y: row + 0.5 };
  if (row < 0) return { x: col + 0.5, y: 0 };
  if (row >= size) return { x: col + 0.5, y: size };
  return { x: col + 0.5 - direction.dx * 0.5, y: row + 0.5 - direction.dy * 0.5 };
}

function directionFromDelta(dx, dy) {
  const direction = DIRECTION_LIST.find((candidate) => candidate.dx === dx && candidate.dy === dy);
  if (!direction) throw new Error(`Direction invalide: ${dx},${dy}`);
  return direction;
}

function sameDirection(a, b) {
  return a.dx === b.dx && a.dy === b.dy;
}

function inside(size, row, col) {
  return row >= 0 && row < size && col >= 0 && col < size;
}
