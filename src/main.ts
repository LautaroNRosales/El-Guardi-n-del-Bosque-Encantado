// Punto de entrada mínimo (se completa en hito 3).
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

ctx.fillStyle = '#07130c';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#cfe8d4';
ctx.font = '20px Georgia';
ctx.textAlign = 'center';
ctx.fillText('El Guardián del Bosque Encantado', canvas.width / 2, canvas.height / 2 - 10);
ctx.font = '13px Georgia';
ctx.fillStyle = '#7ea487';
ctx.fillText('(andamiaje en construcción — hito 1)', canvas.width / 2, canvas.height / 2 + 16);
