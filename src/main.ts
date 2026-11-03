// Punto de entrada: crea el juego y corre el bucle principal.

import { Game } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
