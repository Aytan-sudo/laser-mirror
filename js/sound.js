// Sons de synthèse : quatre timbres courts fabriqués à la volée par WebAudio,
// aucun fichier audio à télécharger. Le contexte n'est créé qu'au premier son,
// c'est-à-dire après un geste du joueur — les navigateurs l'exigent.
//
// Tout vit au-dessus de 300 Hz. Un haut-parleur de téléphone ne restitue à peu
// près rien en dessous, et l'oreille y est de surcroît bien moins sensible à
// faible volume : une note écrite plus bas ne lève aucune erreur, elle part
// simplement sans arriver, et rien ne s'en voit depuis un ordinateur. Le jeu se
// voulant mobile d'abord, c'est un défaut et pas un réglage — `tests/sound.test.js`
// garde le plancher.
let context;

function audioContext() {
  if (context) return context;
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (AudioContext) context = new AudioContext();
  return context;
}

// `glideTo` fait glisser la note de sa hauteur de départ vers celle-là pendant
// toute sa durée : c'est ce qui permet à un timbre de dire quelque chose par
// son mouvement plutôt que par sa gravité.
function note(frequency, duration = 0.06, volume = 0.03, delay = 0, glideTo = null) {
  // Un onglet passé à l'arrière-plan reste silencieux.
  if (globalThis.document?.hidden) return;
  const audio = audioContext();
  if (!audio) return;
  // Revenir d'un autre onglet, ou de l'écran d'accueil sur téléphone, laisse le
  // contexte suspendu : sans ça le jeu redevient muet pour le reste de la partie.
  if (audio.state === 'suspended') audio.resume?.();
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

// Le clic de verre du miroir qui pivote : c'est le geste le plus répété du
// jeu, il doit s'effacer derrière lui.
export const soundRotate = () => note(480, 0.045, 0.02);

// Un cadenas refuse la rotation. Le refus disait non par sa profondeur — 150 Hz,
// c'est-à-dire rien du tout sur la cible du projet, alors qu'il s'entendait
// parfaitement sur un ordinateur. Il le dit maintenant par sa chute : la note
// part juste sous le clic de rotation et décroche jusqu'au ras du plancher.
// C'est le geste habituel qui n'aboutit pas, et ce mouvement-là, lui, survit au
// haut-parleur d'un téléphone.
export const soundLocked = () => note(440, 0.09, 0.022, 0, 320);

export function soundWin() {
  [392, 494, 587, 784].forEach((frequency, index) => note(frequency, 0.16, 0.032, index * 0.075));
}

// La trajectoire parfaite prolonge l'accord d'une note plus haute : la
// perfection s'entend sans avoir à lire le dialogue.
export function soundPerfect() {
  [392, 494, 587, 784, 1046].forEach((frequency, index) => note(frequency, 0.18, 0.032, index * 0.072));
}

// Le déblocage au geste.
//
// iOS ne laisse démarrer un contexte audio que depuis un événement
// d'activation : `pointerdown`, `touchstart`, `pointerup`, `touchend`,
// `keydown`, `click`. Lasers y échappe aujourd'hui — tourner un miroir est un
// `click`, et la victoire tombe dans ce même clic — mais la démonstration de la
// solution optimale, elle, égrène ses rotations depuis un `setTimeout`, qui
// n'est pas une activation : il suffirait qu'un chemin y mène avant le premier
// clic sonore pour que le jeu s'ouvre un contexte suspendu et reste muet toute
// la partie, sans lever la moindre erreur ni se voir depuis un ordinateur. Le
// contexte se prépare donc au premier geste, avant que le jeu n'ait une note à
// demander. `allowed` évite d'en ouvrir un chez qui a coupé le son.
const ACTIVATIONS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click'];

export function prepareSound(target, allowed = () => true) {
  const wake = () => {
    if (!allowed()) return;
    const audio = audioContext();
    if (audio && audio.state !== 'running') audio.resume?.();
  };
  for (const activation of ACTIVATIONS) {
    target.addEventListener(activation, wake, { capture: true, passive: true });
  }
}
