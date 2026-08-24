// Sons de synthèse : quatre timbres courts fabriqués à la volée par WebAudio,
// aucun fichier audio à télécharger. Le contexte n'est créé qu'au premier son,
// c'est-à-dire après un geste du joueur — les navigateurs l'exigent.
let context;

function audioContext() {
  if (context) return context;
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (AudioContext) context = new AudioContext();
  return context;
}

function note(frequency, duration = 0.06, volume = 0.03, delay = 0) {
  // Un onglet passé à l'arrière-plan reste silencieux.
  if (globalThis.document?.hidden) return;
  const audio = audioContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
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

// Un cadenas refuse la rotation : une note grave, un refus poli.
export const soundLocked = () => note(150, 0.09, 0.022);

export function soundWin() {
  [392, 494, 587, 784].forEach((frequency, index) => note(frequency, 0.16, 0.032, index * 0.075));
}

// La trajectoire parfaite prolonge l'accord d'une note plus haute : la
// perfection s'entend sans avoir à lire le dialogue.
export function soundPerfect() {
  [392, 494, 587, 784, 1046].forEach((frequency, index) => note(frequency, 0.18, 0.032, index * 0.072));
}
