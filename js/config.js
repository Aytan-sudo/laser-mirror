// Le numéro de version vit à trois endroits — ici, dans package.json et dans
// le nom du cache de sw.js — et un test compare les trois. Il est affiché au
// bas des Options : si le service worker sert encore une vieille coquille,
// c'est le vieux numéro qui apparaît, et la mise à jour se voit d'un coup.
export const VERSION = '1.4.0';

// Adresse publique du jeu : le message de partage doit pointer vers la page
// en ligne même quand la partie se joue sur un serveur local.
export const GAME_URL = 'https://aytan-sudo.github.io/laser-mirror/';
