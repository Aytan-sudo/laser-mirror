// Le son — tout ce qui se vérifie sans oreille.
//
// Le piège que cette suite existe pour attraper ne lève aucune erreur et ne se
// voit pas depuis un ordinateur : une note écrite sous 300 Hz part bien, elle
// n'arrive simplement jamais. Un haut-parleur de téléphone ne restitue à peu
// près rien en dessous, et l'oreille y est de surcroît moins sensible à faible
// volume. Compter les notes émises ne dit donc rien de ce qui parvient à
// l'oreille : c'est leur hauteur qu'il faut relever.
//
// On ne relit pas le module au lexique : un contexte audio factice fait tourner
// le vrai code et note ce qui en sort, glissandos compris. Le relevé à la source
// reste en second rideau, pour attraper un timbre ajouté demain sans passer par
// le banc d'essai.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Un haut-parleur de téléphone ne descend pas plus bas. C'est la cible du
// projet : sous ce seuil, la note n'existe pas.
const FLOOR = 300;

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (...chemin) => readFileSync(join(racine, ...chemin), 'utf8');

const emitted = [];
let bench;

// Le banc d'essai : juste assez d'API WebAudio pour que `js/sound.js` tourne, et
// un carnet où chaque oscillateur laisse ses hauteurs.
class Parameter {
  constructor(carnet) {
    this.carnet = carnet;
    this.value = 0;
  }

  setValueAtTime(valeur) {
    this.carnet?.push(valeur);
    return this;
  }

  exponentialRampToValueAtTime(valeur) {
    this.carnet?.push(valeur);
    return this;
  }
}

class Context {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
    this.resumes = 0;
    bench = this;
  }

  createOscillator() {
    const note = { shape: null, pitches: [], start: null, stop: null };
    emitted.push(note);
    return {
      set type(valeur) {
        note.shape = valeur;
      },
      get type() {
        return note.shape;
      },
      frequency: new Parameter(note.pitches),
      connect: (cible) => cible,
      start: (temps) => {
        note.start = temps;
      },
      stop: (temps) => {
        note.stop = temps;
      },
    };
  }

  createGain() {
    return { gain: new Parameter(null), connect: (cible) => cible };
  }

  resume() {
    this.resumes += 1;
    this.state = 'running';
  }
}

globalThis.AudioContext = Context;
const sound = await import('../js/sound.js');

function play(timbre) {
  const depart = emitted.length;
  timbre();
  return emitted.slice(depart);
}

const rotate = play(sound.soundRotate);
const locked = play(sound.soundLocked);
const win = play(sound.soundWin);
const perfect = play(sound.soundPerfect);

test('les quatre timbres sonnent', () => {
  for (const [nom, timbre] of Object.entries({ rotate, locked, win, perfect })) {
    assert.ok(timbre.length > 0, `${nom} n’émet rien`);
  }
  assert.equal(rotate.length, 1);
  assert.equal(locked.length, 1);
  assert.equal(win.length, 4);
  assert.equal(perfect.length, 5);
});

test('aucune note ne passe sous le plancher du haut-parleur', () => {
  const sous = emitted.flatMap((note) => note.pitches).filter((hauteur) => hauteur < FLOOR);
  assert.deepEqual(sous.map((hauteur) => Math.round(hauteur)), []);
});

test('le miroir verrouillé dit non par sa chute, pas par sa profondeur', () => {
  const [depart, arrivee] = locked[0].pitches;
  assert.ok(depart > arrivee, `${depart} → ${arrivee}`);
  assert.ok(arrivee >= FLOOR, `${arrivee} Hz sous le plancher`);
  // Et il ne se confond pas avec le clic de rotation, qui est plus haut et net :
  // c'est le geste habituel qui n'aboutit pas.
  assert.ok(depart < rotate[0].pitches[0], `${depart} ≥ ${rotate[0].pitches[0]}`);
  assert.equal(rotate[0].pitches.length, 1, 'le clic de rotation ne glisse pas');
});

test('la victoire monte, et s’égrène au lieu de plaquer un accord', () => {
  const montee = win.map((note) => note.pitches[0]);
  assert.ok(montee.every((h, rang) => rang === 0 || h > montee[rang - 1]), montee.join(' '));
  assert.ok(win.every((note, rang) => rang === 0 || note.start > win[rang - 1].start));
});

test('la trajectoire parfaite prolonge la victoire d’un degré plus haut', () => {
  const sommetVictoire = Math.max(...win.map((note) => note.pitches[0]));
  const sommetParfait = Math.max(...perfect.map((note) => note.pitches[0]));
  assert.ok(sommetParfait > sommetVictoire, `${sommetParfait} ≤ ${sommetVictoire}`);
  assert.ok(perfect.length > win.length);
});

test('aucune fréquence écrite dans le module ne passe sous le plancher', () => {
  // Second rideau : un timbre ajouté demain sans être joué ci-dessus
  // échapperait au banc d'essai. Les commentaires sont retirés d'abord — ils
  // citent justement les hauteurs abandonnées.
  const source = lire('js', 'sound.js').replace(/^\s*\/\/.*$/gm, '');
  const ecrites = [...source.matchAll(/(?<![\d.])\d{3,4}(?![\d.])/g)].map(([valeur]) => Number(valeur));
  assert.ok(ecrites.length >= 8, `${ecrites.length} fréquences relevées`);
  assert.deepEqual(ecrites.filter((hauteur) => hauteur < FLOOR), []);
});

test('le contexte audio se réveille sur un geste d’activation', () => {
  // Second piège du son sur téléphone : iOS ne démarre un contexte audio que
  // depuis pointerdown/touchstart/pointerup/touchend/keydown/click. Revenir de
  // l'écran d'accueil laisse par ailleurs le contexte suspendu.
  const poses = new Map();
  const cible = { addEventListener: (type, ecouteur) => poses.set(type, ecouteur) };
  let autorise = true;
  sound.prepareSound(cible, () => autorise);

  for (const geste of ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click']) {
    assert.ok(poses.has(geste), `aucun réveil sur ${geste}`);
  }
  assert.ok(!poses.has('pointermove'), 'pointermove n’est pas une activation');

  bench.state = 'suspended';
  autorise = false;
  poses.get('pointerdown')();
  assert.equal(bench.state, 'suspended', 'le son coupé n’ouvre pas de contexte');

  autorise = true;
  poses.get('pointerdown')();
  assert.equal(bench.state, 'running');
});

test('le filet du réveil est posé sur le document, avant tout autre écouteur', () => {
  const app = lire('js', 'app.js');
  assert.match(app, /prepareSound\(document, \(\) => preferences\.sounds\)/);
  assert.ok(
    app.indexOf('prepareSound(document') < app.indexOf('bindEvents()'),
    'le réveil doit précéder les écouteurs du jeu',
  );
});
