// Les cinq vérifications structurelles de la convention : elles attrapent les
// fautes qui ne lèvent aucune erreur — un fichier oublié dans la coquille du
// service worker, un id disparu de la page, une variable manquante dans une
// palette, une version qui ne concorde plus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../js/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const page = read('index.html');
const app = read('js/app.js');
const worker = read('sw.js');
const palettes = read('css/palettes.css');
const manifest = JSON.parse(read('manifest.webmanifest'));
const pkg = JSON.parse(read('package.json'));

// L'ordre compte : la première est le défaut, celle que le CSS sert sans attribut.
const THEMES = ['chambre-noire', 'nuit', 'crepuscule', 'sable', 'ardoise', 'sauge'];

test('le service worker liste tous les fichiers du jeu', () => {
  const shell = [...worker.matchAll(/^\s+'([^']+)',$/gm)].map(([, path]) => path);
  const files = [
    ...readdirSync(join(root, 'js')).map((name) => `js/${name}`),
    ...readdirSync(join(root, 'css')).map((name) => `css/${name}`),
    ...readdirSync(join(root, 'assets')).map((name) => `assets/${name}`),
    'index.html',
    'manifest.webmanifest',
  ];
  for (const file of files) assert.ok(shell.includes(file), `${file} manque dans la coquille`);
  for (const path of shell) {
    if (path === './') continue;
    assert.ok(existsSync(join(root, path)), `${path} est mis en cache mais n'existe pas`);
  }
});

test('tous les modules sont reliés à l’application', () => {
  const seen = new Set();
  const queue = ['app.js'];
  while (queue.length) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    for (const [, target] of read(`js/${name}`).matchAll(/from '\.\/([\w-]+\.js)'/g)) queue.push(target);
  }
  for (const name of readdirSync(join(root, 'js'))) {
    assert.ok(seen.has(name), `js/${name} n'est importé par personne`);
  }
});

test('tous les identifiants cherchés par l’application existent dans la page', () => {
  const ids = [...app.matchAll(/querySelector\('#([\w-]+)'\)/g)].map(([, id]) => id);
  assert.ok(ids.length > 20);
  for (const id of new Set(ids)) {
    assert.ok(page.includes(`id="${id}"`), `#${id} est cherché mais absent de la page`);
  }
});

test('chaque palette définit toutes les variables de la palette de référence', () => {
  const bloc = (theme) => {
    const debut = palettes.indexOf(`:root[data-theme="${theme}"] {`);
    assert.notEqual(debut, -1, `la palette ${theme} n'existe pas`);
    return palettes.slice(debut, palettes.indexOf('}', debut));
  };
  const reference = [...bloc(THEMES[0]).matchAll(/^\s+(--[\w-]+):/gm)].map(([, nom]) => nom);
  assert.ok(reference.length > 20);
  for (const theme of THEMES.slice(1)) {
    const defines = bloc(theme);
    for (const nom of reference) {
      assert.ok(defines.includes(`${nom}:`), `${nom} manque à la palette ${theme}`);
    }
  }
});

test('la version concorde entre le paquet, l’interface et le cache', () => {
  assert.equal(pkg.version, VERSION);
  assert.ok(page.includes(`Laser &amp; Miroirs ${VERSION}`), 'la version est absente des Options');
  assert.ok(worker.includes(`const VERSION = 'laser-mirror-${VERSION}'`), 'le cache ne porte pas la version');
});

test('la page respecte le socle mobile et PWA', () => {
  assert.match(page, /<html lang="fr"/);
  assert.match(page, /width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no/);
  assert.ok(page.includes('id="couleur-barre"'), 'la barre système ne suit pas la palette');
  assert.ok(page.includes('rel="apple-touch-icon" href="assets/icon-180.png"'), 'iOS n’accepte pas le SVG');
  // Avec un passeport, la palette est celle du joueur ; sans, celle de
  // l'appareil. Les deux chemins visent la même clé.
  assert.ok(page.includes("getItem('laser-mirror:theme')"), 'la palette n’est pas posée avant le premier rendu');
  assert.ok(page.includes("Passeport?.stockageJeu('lasers')"), 'le script ignore le passeport');
  assert.ok(page.includes('<script type="module" src="js/app.js">'));
  assert.ok(page.includes(`content="${manifest.theme_color}"`), 'page et manifeste divergent sur la couleur initiale');
  assert.equal(manifest.icons.length, 3);
  for (const icon of manifest.icons) assert.ok(existsSync(join(root, icon.src)), `${icon.src} manque`);
  assert.ok(manifest.orientation, 'le manifeste ne dit pas son orientation');
  assert.ok(manifest.description.length > 80);
});

test('le passeport est branché à la page et au cache hors ligne', () => {
  // Sans `data-jeu`, le bandeau s'affiche mais aucun tampon n'est attribué ;
  // sans les fichiers dans la coquille, la page hors ligne perd l'espace du
  // joueur.
  assert.ok(page.includes('data-passeport-ruban data-jeu="laser-mirror"'), 'pas de bandeau');
  for (const fichier of ['passeport.js', 'liaison.js', 'passeport.css']) {
    assert.ok(page.includes(`commun/${fichier}`), `${fichier} absent de la page`);
    assert.ok(worker.includes(`commun/${fichier}`), `${fichier} absent du cache`);
  }
});

test('le script inline connaît exactement les palettes disponibles', () => {
  const inline = page.slice(page.indexOf('laser-mirror:theme'));
  for (const theme of THEMES) assert.ok(inline.includes(theme), `${theme} manque au script inline`);
  for (const theme of THEMES) assert.ok(page.includes(`data-theme-choice="${theme}"`), `${theme} manque aux Options`);
});

test('la palette par défaut est celle que le CSS sert sans attribut', () => {
  // Le piège que Diamants a payé en v1.3.0 : si le `:root` nu ne porte pas la
  // palette par défaut, un joueur sans préférence enregistrée voit une ambiance
  // au premier rendu et une autre juste après. Rien ne lève d'erreur.
  const defaut = THEMES[0];
  assert.ok(
    palettes.includes(`:root,\n:root[data-theme="${defaut}"] {`),
    `le \`:root\` nu ne sert pas ${defaut}`,
  );
  assert.doesNotMatch(page, /<html lang="fr"[^>]*data-theme/, 'la page fige une palette en dur');
  assert.ok(app.includes(`const DEFAULT_THEME = '${defaut}';`), 'app.js ne connaît pas le même défaut');

  // Et la barre système doit s'ouvrir sur la même couleur que cette palette.
  const couleur = app.match(new RegExp(`'${defaut}':[^}]*themeColor: '(#[0-9a-f]{6})'`))?.[1];
  assert.ok(couleur, 'la palette par défaut ne déclare pas sa couleur de barre');
  assert.equal(manifest.theme_color, couleur);
  assert.ok(page.includes(`content="${couleur}" id="couleur-barre"`), 'la balise theme-color diverge');
});

test('le son se commande depuis l’en-tête, comme le veut la convention', () => {
  // Convention §1 : un bouton d'activation du son à côté des Options. Il a
  // manqué à Lasers jusqu'à la v1.5.
  assert.ok(page.includes('id="sound-button"'), 'pas de bouton son dans la page');
  assert.match(app, /els\.sound\.addEventListener\('click'/, 'le bouton son n’est pas câblé');
  // Bouton d'en-tête et case des Options doivent passer par le même chemin,
  // sinon l'un des deux affiche un état faux.
  assert.match(app, /function setSounds\(/);
  assert.match(app, /els\.optionSounds\.addEventListener\('change', \(\) => setSounds\(/);
});
