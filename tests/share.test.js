import test from 'node:test';
import assert from 'node:assert/strict';
import { shareLink, shareMessage } from '../js/share.js';

const daily = {
  dailyDate: '2026-08-24',
  seed: 'daily-2026-08-24',
  difficulty: 'normal',
  difficultyLabel: 'Normal',
  laserColor: 'red',
  par: 5,
  moves: 7,
  won: true,
};

test('le lien du défi du jour porte la date, pas la seed', () => {
  const url = new URL(shareLink(daily));
  assert.equal(url.searchParams.get('jour'), '2026-08-24');
  assert.equal(url.searchParams.get('seed'), null);
});

test('le lien d’un puzzle libre porte la seed et le niveau', () => {
  const url = new URL(shareLink({ ...daily, dailyDate: null }));
  assert.equal(url.searchParams.get('seed'), 'daily-2026-08-24');
  assert.equal(url.searchParams.get('niveau'), 'normal');
  assert.equal(url.searchParams.get('jour'), null);
});

test('le résumé du défi du jour montre le PAR et les rotations perdues', () => {
  const lignes = shareMessage(daily).split('\n');
  assert.equal(lignes[0], 'Laser & Miroirs 24/08/2026');
  assert.equal(lignes[1], '7 rotations · PAR 5');
  assert.equal(lignes[2], '🟥🟥🟥🟥🟥⬜⬜💎');
  assert.match(lignes[3], /\?jour=2026-08-24$/);
});

test('la trajectoire parfaite se dit et se voit', () => {
  const lignes = shareMessage({ ...daily, moves: 5 }).split('\n');
  assert.equal(lignes[1], 'Trajectoire parfaite · 5 rotations');
  assert.equal(lignes[2], '🟥🟥🟥🟥🟥💎');
});

test('la couleur du laser colore la barre', () => {
  assert.ok(shareMessage({ ...daily, laserColor: 'blue' }).includes('🟦'));
  assert.ok(shareMessage({ ...daily, laserColor: 'yellow' }).includes('🟨'));
});

test('un puzzle libre annonce sa difficulté', () => {
  const lignes = shareMessage({ ...daily, dailyDate: null }).split('\n');
  assert.equal(lignes[0], 'Laser & Miroirs · Normal');
});

test('avant la victoire, le message invite sans livrer de résultat', () => {
  const message = shareMessage({ ...daily, won: false, moves: 3 });
  assert.equal(message.split('\n')[1], "Le cristal est à 5 rotations d'ici.");
  assert.ok(!message.includes('💎'));
  assert.ok(!message.includes('3 rotations'));
});

test('une partie très longue ne produit pas une barre interminable', () => {
  const barre = shareMessage({ ...daily, moves: 400 }).split('\n')[2];
  assert.equal([...barre].length, 21);
});
