const PREFIX = 'laser-mirror:';
const memory = new Map();
let backend = null;

function getBackend() {
  if (backend) return backend;
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
