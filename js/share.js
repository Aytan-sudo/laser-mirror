// Partage : l'adresse de la grille, et le résumé du résultat une fois le
// cristal atteint. Le lien ne porte jamais le score, seulement de quoi
// refabriquer la même grille chez le destinataire.
import { GAME_URL } from './config.js';

const BEAM_SQUARES = { red: '🟥', blue: '🟦', yellow: '🟨' };
const MAX_SQUARES = 20;

export function shareLink({ dailyDate, seed, difficulty }) {
  const url = new URL(GAME_URL);
  if (dailyDate) {
    url.searchParams.set('jour', dailyDate);
  } else {
    url.searchParams.set('seed', seed);
    url.searchParams.set('niveau', difficulty);
  }
  return url.href;
}

export function shareMessage(result) {
  const { dailyDate, difficultyLabel, won, moves, par, laserColor } = result;
  const lines = [dailyDate
    ? `Laser & Miroirs ${dailyDate.split('-').reverse().join('/')}`
    : `Laser & Miroirs · ${difficultyLabel}`];

  if (won) {
    lines.push(moves === par
      ? `Trajectoire parfaite · ${rotations(moves)}`
      : `${rotations(moves)} · PAR ${par}`);
    lines.push(beamBar(laserColor, moves, par));
  } else {
    lines.push(`Le cristal est à ${rotations(par)} d'ici.`);
  }

  lines.push(shareLink(result));
  return lines.join('\n');
}

function rotations(count) {
  return `${count} rotation${count > 1 ? 's' : ''}`;
}

// Le PAR en couleur du laser, les rotations en trop en blanc : la ligne dit
// d'un regard à quelle distance de l'optimum la partie s'est terminée.
function beamBar(laserColor, moves, par) {
  const square = BEAM_SQUARES[laserColor] ?? BEAM_SQUARES.red;
  const optimal = Math.min(Math.max(par, 0), MAX_SQUARES);
  const wasted = Math.min(Math.max(moves - par, 0), MAX_SQUARES - optimal);
  return `${square.repeat(optimal)}${'⬜'.repeat(wasted)}💎`;
}
