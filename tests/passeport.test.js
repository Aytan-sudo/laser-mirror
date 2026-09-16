// Le compteur de rotations du passeport.
//
// Il ne vit que dans l'espace d'un joueur : en mode invité il rend `null` et
// n'écrit rien, pour que le stockage du jeu reste exactement ce qu'il était
// avant le raccordement.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compterRotationPasseport } from '../js/storage.js';

const espaceDeTest = () => {
  const memoire = new Map();
  return {
    getItem: (cle) => memoire.get(cle) ?? null,
    setItem: (cle, valeur) => memoire.set(cle, String(valeur)),
    removeItem: (cle) => memoire.delete(cle),
  };
};

test('en mode invité, rien n’est compté ni écrit', () => {
  assert.equal(compterRotationPasseport('2026-09-16', null), null);
});

test('les rotations de la journée s’additionnent, et repartent le lendemain', () => {
  const espace = espaceDeTest();
  assert.equal(compterRotationPasseport('2026-09-16', espace), 1);
  for (let i = 2; i <= 20; i++) compterRotationPasseport('2026-09-16', espace);
  assert.equal(JSON.parse(espace.getItem('laser-mirror:passeport')).rotations, 20);
  assert.equal(compterRotationPasseport('2026-09-17', espace), 1);
});

test('un compteur illisible ou incohérent repart de un', () => {
  const espace = espaceDeTest();
  espace.setItem('laser-mirror:passeport', '{ abîmé');
  assert.equal(compterRotationPasseport('2026-09-17', espace), 1);
  espace.setItem('laser-mirror:passeport', JSON.stringify({ jour: '2026-09-17', rotations: 'beaucoup' }));
  assert.equal(compterRotationPasseport('2026-09-17', espace), 1);
});
