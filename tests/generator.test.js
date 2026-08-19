import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, DIFFICULTIES } from '../js/generator.js';
import { solvePuzzle, traceLaser } from '../js/engine.js';

for (const difficulty of Object.keys(DIFFICULTIES)) {
  test(`le générateur ${difficulty} est déterministe, coloré, solvable et dans sa plage de PAR`, () => {
    for (let i = 0; i < 20; i += 1) {
      const seed = `test-${difficulty}-${i}`;
      const first = generatePuzzle(seed, difficulty);
      const second = generatePuzzle(seed, difficulty);
      assert.deepEqual(first, second);
      assert.equal(traceLaser(first, first.initialMask).hit, false);
      assert.equal(traceLaser(first, first.optimalMask).hit, true);
      assert.equal(first.target.color, first.laserColor);
      assert.ok(first.filters.length >= DIFFICULTIES[difficulty].filters[0]);
      assert.ok(first.filters.some((filter) => filter.color === first.laserColor));

      const solved = solvePuzzle(first);
      assert.equal(solved.solvable, true);
      assert.equal(solved.par, first.par);
      assert.ok(first.par >= DIFFICULTIES[difficulty].par[0]);
      assert.ok(first.par <= DIFFICULTIES[difficulty].par[1]);
      assert.ok(first.mirrors.length <= 12);

      const lockedToggle = first.mirrors.some((mirror, index) => (
        mirror.locked && ((first.initialMask ^ first.optimalMask) & (1 << index)) !== 0
      ));
      assert.equal(lockedToggle, false);
    }
  });
}

test('la seed du défi quotidien est reproductible', () => {
  const a = generatePuzzle('daily-2026-08-19', 'normal');
  const b = generatePuzzle('daily-2026-08-19', 'normal');
  assert.deepEqual(a, b);
});
