const PREFIX = 'laser-mirror:';
const memory = new Map();
let backend = null;

function getBackend() {
  if (backend) return backend;
  // Ouvert depuis le hub avec un passeport, le jeu range tout dans l'espace du
  // joueur ; en mode invité, dans le localStorage, comme avant.
  const passeport = globalThis.Passeport?.stockageJeu('lasers');
  if (passeport) { backend = passeport; return backend; }
  try {
    const probe = `${PREFIX}probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    backend = localStorage;
  } catch {
    backend = {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
    };
  }
  return backend;
}

export function loadValue(key, fallback = null) {
  try {
    const value = getBackend().getItem(PREFIX + key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function saveValue(key, value) {
  try {
    getBackend().setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Le jeu reste jouable même si le stockage est indisponible ou saturé.
  }
}

export function removeValue(key) {
  try {
    getBackend().removeItem(PREFIX + key);
  } catch {
    // Rien à faire : l'état en mémoire reste la source de vérité de la partie.
  }
}

// --------------------------------------------------------------- le passeport
//
// Les rotations de la journée, pour le tampon à l'effort. Le compte ne vit que
// dans l'espace d'un joueur : en mode invité, rien n'est compté ni écrit, et le
// stockage du jeu reste ce qu'il était avant le raccordement.

export function compterRotationPasseport(jour, espace = globalThis.Passeport?.stockageJeu('lasers') ?? null) {
  if (!espace) return null;
  let compte = null;
  try { compte = JSON.parse(espace.getItem('laser-mirror:passeport')); } catch { /* illisible : on repart */ }
  const rotations = compte?.jour === jour && Number.isInteger(compte.rotations) ? compte.rotations + 1 : 1;
  try { espace.setItem('laser-mirror:passeport', JSON.stringify({ jour, rotations })); } catch { /* le passeport signale l'échec */ }
  return rotations;
}
