import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECTIONS,
  orientationForTurn,
  reflect,
  solvePuzzle,
  traceLaser,
} from '../js/engine.js';

test('les deux miroirs réfléchissent dans les quatre directions', () => {
  assert.equal(reflect(DIRECTIONS.right, '/'), DIRECTIONS.up);
  assert.equal(reflect(DIRECTIONS.down, '/'), DIRECTIONS.left);
  assert.equal(reflect(DIRECTIONS.right, '\\'), DIRECTIONS.down);
  assert.equal(reflect(DIRECTIONS.up, '\\'), DIRECTIONS.left);
});

test('orientationForTurn retrouve le miroir nécessaire', () => {
  assert.equal(orientationForTurn(DIRECTIONS.right, DIRECTIONS.up), '/');
  assert.equal(orientationForTurn(DIRECTIONS.right, DIRECTIONS.down), '\\');
});

test('un trajet simple atteint la cible', () => {
  const puzzle = {
    size: 4,
    entry: { side: 'left', index: 1 },
    target: { row: 3, col: 2 },
    mirrors: [
      { row: 1, col: 2 },
      { row: 3, col: 2 },
    ],
    initialMask: 1,
  };
  assert.equal(traceLaser(puzzle, 1).hit, true);
  assert.equal(traceLaser(puzzle, 0).hit, false);
});

test('le solver retourne la distance minimale depuis la configuration initiale', () => {
  const puzzle = {
    size: 4,
    entry: { side: 'left', index: 1 },
    target: { row: 3, col: 2 },
    mirrors: [{ row: 1, col: 2 }],
    initialMask: 0,
  };
  const solved = solvePuzzle(puzzle);
  assert.equal(solved.solvable, true);
  assert.equal(solved.par, 1);
  assert.equal(solved.optimalCount, 1);
});
