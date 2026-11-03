// Pantallas: menú principal y overlays de victoria/derrota.

import { CANVAS_H, CANVAS_W, COLORS } from './config';

export interface EndStats {
  altarsLit: number;
  totalAltars: number;
  timeSeconds: number;
  seed: number;
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function drawMenu(
  ctx: CanvasRenderingContext2D,
  time: number,
): void {
  ctx.save();
  // Fondo bosquejo: degradado + siluetas simples.
  const grad = ctx.createRadialGradient(
    CANVAS_W / 2, CANVAS_H * 0.42, 40,
    CANVAS_W / 2, CANVAS_H * 0.42, CANVAS_W * 0.72,
  );
  grad.addColorStop(0, '#14301f');
  grad.addColorStop(1, '#050d08');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Árboles decorativos (siluetas) a los lados.
  ctx.fillStyle = '#0d1f13';
  const trees = [
    [40, 660, 150], [120, 660, 200], [205, 660, 165], [730, 660, 185],
    [815, 660, 140], [890, 660, 210], [290, 660, 125], [640, 660, 160],
  ];
  for (const [x, base, h] of trees) {
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x - h * 0.32, base - h * 0.45);
    ctx.lineTo(x - h * 0.16, base - h * 0.42);
    ctx.lineTo(x - h * 0.30, base - h * 0.75);
    ctx.lineTo(x, base - h);
    ctx.lineTo(x + h * 0.30, base - h * 0.75);
    ctx.lineTo(x + h * 0.16, base - h * 0.42);
    ctx.lineTo(x + h * 0.32, base - h * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  // Portal decorativo central con respiración.
  const pulse = 1 + Math.sin(time * 1.6) * 0.06;
  ctx.save();
  ctx.translate(CANVAS_W / 2, 178);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#8b6cff';
  ctx.lineWidth = 5;
  ctx.shadowColor = '#7b5cff';
  ctx.shadowBlur = 26;
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 74, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#b9a5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 54, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';

  // Título.
  ctx.fillStyle = COLORS.accent;
  ctx.shadowColor = '#3a2c00';
  ctx.shadowBlur = 18;
  ctx.font = 'bold 46px Georgia';
  ctx.fillText('El Guardián', CANVAS_W / 2, 330);
  ctx.font = 'bold 34px Georgia';
  ctx.fillText('del Bosque Encantado', CANVAS_W / 2, 376);
  ctx.shadowBlur = 0;

  ctx.fillStyle = COLORS.textDim;
  ctx.font = 'italic 15px Georgia';
  ctx.fillText('Activá los 3 altares y escapá antes de que el Guardián te encuentre.', CANVAS_W / 2, 414);

  // Botón Jugar.
  const bw = 260;
  const bh = 52;
  const bx = CANVAS_W / 2 - bw / 2;
  const by = 448;
  ctx.fillStyle = '#1d3b28';
  roundRect(ctx, bx, by, bw, bh, 10);
  ctx.fill();
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 10);
  ctx.stroke();
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 22px Georgia';
  ctx.fillText('Jugar  (Enter)', CANVAS_W / 2, by + 34);

  // Controles resumidos.
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px Georgia';
  ctx.fillText('WASD/Flechas moverse  ·  Shift correr  ·  Espacio agacharse  ·  E esconderse / altar  ·  R nueva variante', CANVAS_W / 2, 556);
  ctx.fillText('F1 cono de visión  ·  F2 waypoints y rutas  ·  F3 grilla  ·  M silencio', CANVAS_W / 2, 578);

  ctx.fillStyle = '#4b6b54';
  ctx.font = '11px Georgia';
  ctx.fillText('PIAPC · Programación de IA para Videojuegos · Lautaro Rosales · 2026', CANVAS_W / 2, 628);
  ctx.restore();
}

export function drawEndOverlay(
  ctx: CanvasRenderingContext2D,
  won: boolean,
  stats: EndStats,
): void {
  ctx.save();
  ctx.fillStyle = won ? 'rgba(6, 18, 10, 0.78)' : 'rgba(24, 6, 4, 0.78)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  if (won) {
    ctx.fillStyle = '#a8ffd0';
    ctx.shadowColor = '#1d5c34';
    ctx.shadowBlur = 24;
    ctx.font = 'bold 44px Georgia';
    ctx.fillText('¡El portal se abre!', CANVAS_W / 2, 240);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.text;
    ctx.font = '17px Georgia';
    ctx.fillText('Escapaste del bosque antes del amanecer.', CANVAS_W / 2, 282);
  } else {
    ctx.fillStyle = '#ffb0a1';
    ctx.shadowColor = '#5c1d12';
    ctx.shadowBlur = 24;
    ctx.font = 'bold 44px Georgia';
    ctx.fillText('El Guardián te atrapó', CANVAS_W / 2, 240);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.text;
    ctx.font = '17px Georgia';
    ctx.fillText('El bosque reclama a otro espíritu.', CANVAS_W / 2, 282);
  }

  ctx.fillStyle = COLORS.textDim;
  ctx.font = '15px Georgia';
  ctx.fillText(`Altares activados: ${stats.altarsLit}/${stats.totalAltars}   ·   Tiempo: ${fmtTime(stats.timeSeconds)}   ·   Semilla: ${stats.seed}`, CANVAS_W / 2, 330);

  // Botón reintentar.
  const bw = 320;
  const bh = 52;
  const bx = CANVAS_W / 2 - bw / 2;
  const by = 380;
  ctx.fillStyle = '#1d3b28';
  roundRect(ctx, bx, by, bw, bh, 10);
  ctx.fill();
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 10);
  ctx.stroke();
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 18px Georgia';
  ctx.fillText(won ? 'Jugar otra variante  (R)' : 'Intentar de nuevo  (R)', CANVAS_W / 2, by + 33);
  ctx.restore();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// (roundRect también se usa desde game.ts)
