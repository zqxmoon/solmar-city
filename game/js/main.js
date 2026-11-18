// Solmar City — boot: find the canvas, build the game, start the loop.

import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.solmar = game; // handy for debugging and for the playtest driver
game.run();
