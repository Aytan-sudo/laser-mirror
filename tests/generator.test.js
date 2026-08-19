import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, DIFFICULTIES } from '../js/generator.js';
import { solvePuzzle, traceLaser } from '../js/engine.js';

for (const difficulty of Object.keys(DIFFICULTIES)) {
  test(`le générateur ${difficulty} est déterministe, solvable et dans sa plage de PAR`, () => {
    for (let i = 0; i < 12; i += 1) {
      const seed = `test-${difficulty}-${i}`;
      const first = generatePuzzle(seed, difficulty);
      const second = generatePuzzle(seed, difficulty);
      assert.deepEqual(first, second);
      assert.equal(traceLaser(first, first.initialMask).hit, false);
      const solved = solvePuzzle(first);
      assert.equal(solved.solvable, true);
      assert.equal(solved.par, first.par);
      assert.ok(first.par >= DIFFICULTIES[difficulty].par[0]);
      assert.ok(first.par <= DIFFICULTIES[difficulty].par[1]);
      assert.ok(first.mirrors.length <= 12);
    }
  });
}
