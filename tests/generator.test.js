import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, DIFFICULTIES } from '../js/generator.js';
import { popcount, solvePuzzle, traceLaser } from '../js/engine.js';

const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

// Rejoue toutes les configurations possibles d'un puzzle : sert à vérifier ce
// que le joueur peut réellement rencontrer, pas seulement la solution.
function everyConfiguration(puzzle) {
  const mutable = puzzle.mirrors
    .map((mirror, index) => (mirror.locked ? -1 : index))
    .filter((index) => index >= 0);
  const traces = [];
  for (let combination = 0; combination < (1 << mutable.length); combination += 1) {
    let mask = puzzle.initialMask;
    for (let bit = 0; bit < mutable.length; bit += 1) {
      if (combination & (1 << bit)) mask ^= (1 << mutable[bit]);
    }
    traces.push({ mask, trace: traceLaser(puzzle, mask) });
  }
  return traces;
}

function withoutBlockingFilters(puzzle) {
  return { ...puzzle, filters: puzzle.filters.filter((filter) => filter.color === puzzle.laserColor) };
}

for (const difficulty of DIFFICULTY_KEYS) {
  test(`le générateur ${difficulty} est déterministe, solvable et dans sa plage de PAR`, () => {
    for (let i = 0; i < 20; i += 1) {
      const seed = `test-${difficulty}-${i}`;
      const puzzle = generatePuzzle(seed, difficulty);
      assert.deepEqual(generatePuzzle(seed, difficulty), puzzle);

      assert.equal(traceLaser(puzzle, puzzle.initialMask).hit, false);
      assert.equal(traceLaser(puzzle, puzzle.optimalMask).hit, true);
      assert.equal(puzzle.target.color, puzzle.laserColor);

      const solved = solvePuzzle(puzzle);
      assert.equal(solved.solvable, true);
      assert.equal(solved.par, puzzle.par);
      assert.ok(puzzle.par >= DIFFICULTIES[difficulty].par[0]);
      assert.ok(puzzle.par <= DIFFICULTIES[difficulty].par[1]);
      assert.equal(popcount(puzzle.initialMask ^ puzzle.optimalMask), puzzle.par);
      assert.ok(solved.optimalCount <= DIFFICULTIES[difficulty].maxOptimal);
    }
  });

  test(`le générateur ${difficulty} ne tourne jamais un miroir verrouillé`, () => {
    for (let i = 0; i < 20; i += 1) {
      const puzzle = generatePuzzle(`locks-${difficulty}-${i}`, difficulty);
      const locked = puzzle.mirrors.filter((mirror) => mirror.locked).length;
      assert.ok(locked >= DIFFICULTIES[difficulty].locked[0], `${locked} verrou(s) en ${difficulty}`);
      assert.ok(locked <= DIFFICULTIES[difficulty].locked[1]);

      const turned = puzzle.mirrors.some((mirror, index) => (
        mirror.locked && ((puzzle.initialMask ^ puzzle.optimalMask) & (1 << index)) !== 0
      ));
      assert.equal(turned, false);
    }
  });

  test(`en ${difficulty}, retirer les filtres colorés change le puzzle`, () => {
    for (let i = 0; i < 8; i += 1) {
      const puzzle = generatePuzzle(`filters-${difficulty}-${i}`, difficulty);
      assert.ok(
        puzzle.filters.some((filter) => filter.color !== puzzle.laserColor),
        'aucun filtre bloquant',
      );

      const solved = solvePuzzle(puzzle);
      const naked = solvePuzzle(withoutBlockingFilters(puzzle));
      assert.ok(
        naked.par < solved.par || naked.optimalCount > solved.optimalCount,
        `les filtres de ${puzzle.seed} ne décident de rien (PAR ${naked.par} → ${solved.par})`,
      );
    }
  });

  test(`en ${difficulty}, chaque miroir est éclairé par au moins une configuration`, () => {
    for (let i = 0; i < 4; i += 1) {
      const puzzle = generatePuzzle(`lit-${difficulty}-${i}`, difficulty);
      const lit = new Set();
      for (const { trace } of everyConfiguration(puzzle)) {
        for (const cell of trace.visitedCells) lit.add(`${cell.row},${cell.col}`);
      }
      for (const mirror of puzzle.mirrors) {
        assert.ok(lit.has(`${mirror.row},${mirror.col}`), `miroir mort en ${mirror.row},${mirror.col}`);
      }
    }
  });
}

test('un cadenas ne trahit pas la position de la solution', () => {
  let onPath = 0;
  let total = 0;
  for (const difficulty of DIFFICULTY_KEYS) {
    for (let i = 0; i < 40; i += 1) {
      const puzzle = generatePuzzle(`hint-${difficulty}-${i}`, difficulty);
      const solutionCells = new Set(
        traceLaser(puzzle, puzzle.optimalMask).visitedCells.map((cell) => `${cell.row},${cell.col}`),
      );
      for (const mirror of puzzle.mirrors) {
        if (!mirror.locked) continue;
        total += 1;
        if (solutionCells.has(`${mirror.row},${mirror.col}`)) onPath += 1;
      }
    }
  }
  const ratio = onPath / total;
  assert.ok(ratio > 0.35 && ratio < 0.72, `${Math.round(ratio * 100)} % des verrous sur le trajet gagnant`);
});

test('la seed du défi quotidien est reproductible', () => {
  const a = generatePuzzle('daily-2026-08-19', 'normal');
  const b = generatePuzzle('daily-2026-08-19', 'normal');
  assert.deepEqual(a, b);
});

test('une difficulté inconnue est refusée', () => {
  assert.throws(() => generatePuzzle('x', 'impossible'), /Difficulté inconnue/);
});
