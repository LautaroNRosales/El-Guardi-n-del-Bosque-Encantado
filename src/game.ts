// Mundo del juego: generación, actualización, render y HUD.

import {
  ALTAR_CHANNEL_SECONDS,
  ALTARS_REQUIRED,
  CANVAS_H,
  CANVAS_W,
  CELL,
  COLORS,
  GRID_H,
  GRID_PX,
  GRID_W,
  SIDEBAR_PX,
} from './config';
import { Grid } from './grid';
import { generateMap } from './mapgen';
import { buildWaypointGraph } from './waypoints';
import { Player, type PlayerInput } from './player';
import { drawEndOverlay, drawMenu, roundRect } from './screens';
import { randomSeed } from './rng';
import type {
  CellCoord,
  GameMap,
  NavigationMode,
  SearchAlgorithm,
  WaypointGraph,
} from './types';

export type ScreenState = 'menu' | 'playing' | 'won' | 'lost';

interface ClickZone {
  id: string;
  rect: [number, number, number, number];
}

const cellCenter = (c: CellCoord) => ({ x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL });

function hash2(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: ScreenState = 'menu';
  private map!: GameMap;
  private grid!: Grid;
  private graph!: WaypointGraph;
  private player!: Player;
  private seed = 0;

  readonly altarsLit = new Set<number>();
  searchAlgorithm: SearchAlgorithm = 'astar';
  navigationMode: NavigationMode = 'waypoints';

  private time = 0;
  private playTime = 0;
  private keys = new Set<string>();
  private clickZones: ClickZone[] = [];
  private mouse = { x: -1, y: -1 };

  // Debug (F1–F3)
  debugF1 = false;
  debugF2 = false;
  debugF3 = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    // ?play salta el menú y arranca la partida (QA y demo); ?seed=123 fija la semilla.
    const params = new URLSearchParams(window.location.search);
    const seedParam = Number(params.get('seed'));
    this.newGame(Number.isFinite(seedParam) && seedParam > 0 ? seedParam : randomSeed());
    this.state = params.has('play') ? 'playing' : 'menu';
    this.bindInput();
  }

  // ------------------------------------------------------------------ setup

  private newGame(seed: number): void {
    this.seed = seed;
    this.map = generateMap(seed);
    this.grid = new Grid(this.map.w, this.map.h, 'grass');
    this.grid.cells = this.map.cells; // compartir referencia: carve muta el mapa
    this.graph = buildWaypointGraph(this.map); // puede tallar el bosque y abrir paso
    this.player = new Player(this.map.start);
    this.altarsLit.clear();
    this.playTime = 0;
  }

  private regenerate(): void {
    this.newGame(randomSeed());
    this.state = 'playing';
  }

  private gridFromState(): ScreenState {
    return this.state;
  }

  getState(): ScreenState {
    return this.gridFromState();
  }

  // ------------------------------------------------------------------ input

  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      // Evitar scroll con flechas/espacio.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.keys.add(code);

      if (code === 'Enter' && this.state === 'menu') {
        this.state = 'playing';
        return;
      }
      if (code === 'KeyR') {
        this.regenerate();
        return;
      }
      if (code === 'KeyM') {
        // Silencio: el manejador de audio se conecta en hito 4.
        return;
      }
      if (code === 'F1') {
        e.preventDefault();
        this.debugF1 = !this.debugF1;
        return;
      }
      if (code === 'F2') {
        e.preventDefault();
        this.debugF2 = !this.debugF2;
        return;
      }
      if (code === 'F3') {
        e.preventDefault();
        this.debugF3 = !this.debugF3;
        return;
      }
      if (code === 'KeyE' && this.state === 'playing') {
        this.tryToggleHide();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width / rect.width;
      this.mouse.x = (e.clientX - rect.left) * sx;
      this.mouse.y = (e.clientY - rect.top) * sx;
    });
    this.canvas.addEventListener('mousedown', () => this.handleClick());
  }

  private readInput(): PlayerInput {
    const k = this.keys;
    return {
      left: k.has('KeyA') || k.has('ArrowLeft'),
      right: k.has('KeyD') || k.has('ArrowRight'),
      up: k.has('KeyW') || k.has('ArrowUp'),
      down: k.has('KeyS') || k.has('ArrowDown'),
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: k.has('Space'),
    };
  }

  private handleClick(): void {
    const { x, y } = this.mouse;
    for (const zone of this.clickZones) {
      const [zx, zy, zw, zh] = zone.rect;
      if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) {
        this.activateZone(zone.id);
        return;
      }
    }
  }

  private activateZone(id: string): void {
    switch (id) {
      case 'menu-play':
        this.state = 'playing';
        break;
      case 'end-retry':
        this.regenerate();
        break;
      case 'search-astar':
        this.searchAlgorithm = 'astar';
        break;
      case 'search-bfs':
        this.searchAlgorithm = 'bfs';
        break;
      case 'nav-grid':
        this.navigationMode = 'grid';
        break;
      case 'nav-waypoints':
        this.navigationMode = 'waypoints';
        break;
      case 'regen':
        this.regenerate();
        break;
    }
  }

  // ------------------------------------------------------------- helpers

  private tryToggleHide(): void {
    if (this.player.inBush(this.grid)) {
      this.player.hidden = !this.player.hidden;
      this.player.altarProgress = 0;
      return;
    }
    if (this.player.hidden) this.player.hidden = false;
  }

  private nearestAltarInRange(): { index: number; pos: CellCoord } | null {
    for (let i = 0; i < this.map.altars.length; i++) {
      if (this.altarsLit.has(i)) continue;
      const a = this.map.altars[i];
      const cx = a.x + 0.5;
      const cy = a.y + 0.5;
      if (Math.hypot(this.player.pos.x - cx, this.player.pos.y - cy) <= 1.35) {
        return { index: i, pos: a };
      }
    }
    return null;
  }

  private portalOpen(): boolean {
    return this.altarsLit.size >= ALTARS_REQUIRED;
  }

  private altarDisturbance: CellCoord | null = null;

  /** El guardián recoge esta perturbación cuando está implementado (hito 4). */
  takeDisturbance(): CellCoord | null {
    const d = this.altarDisturbance;
    this.altarDisturbance = null;
    return d;
  }

  // --------------------------------------------------------------- update

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;
    this.playTime += dt;

    const input = this.readInput();
    this.player.update(dt, input, this.grid);

    // Canal de activación de altar: mantener E, quieto y no corriendo.
    const altar = this.nearestAltarInRange();
    if (this.keys.has('KeyE') && altar && !this.player.running) {
      this.player.altarProgress += dt / ALTAR_CHANNEL_SECONDS;
      if (this.player.altarProgress >= 1) {
        this.player.altarProgress = 0;
        this.activateAltar(altar.index);
      }
    } else {
      this.player.altarProgress = Math.max(0, this.player.altarProgress - dt * 1.5);
    }

    // Portal: victoria.
    if (
      this.portalOpen() &&
      this.grid.at(this.player.cellX(), this.player.cellY()) === 'portal'
    ) {
      this.state = 'won';
    }
  }

  private activateAltar(index: number): void {
    this.altarsLit.add(index);
    this.altarDisturbance = { ...this.map.altars[index] };
  }

  // --------------------------------------------------------------- render

  render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    this.clickZones = [];

    if (this.state === 'menu') {
      drawMenu(ctx, this.time);
      // Zona clicable del botón Jugar (alineada con drawMenu).
      const bw = 260, bh = 52;
      this.clickZones.push({ id: 'menu-play', rect: [CANVAS_W / 2 - bw / 2, 448, bw, bh] });
      return;
    }

    this.drawWorld(ctx);
    this.drawSidebar(ctx);

    if (this.state === 'won' || this.state === 'lost') {
      drawEndOverlay(ctx, this.state === 'won', {
        altarsLit: this.altarsLit.size,
        totalAltars: ALTARS_REQUIRED,
        timeSeconds: this.playTime,
        seed: this.seed,
      });
      const bw = 320, bh = 52;
      this.clickZones.push({ id: 'end-retry', rect: [CANVAS_W / 2 - bw / 2, 380, bw, bh] });
    }
  }

  private drawWorld(ctx: CanvasRenderingContext2D): void {
    // Fondo de la grilla.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, GRID_PX, CANVAS_H);
    ctx.clip();

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        this.drawTile(ctx, x, y);
      }
    }

    if (this.debugF2) this.drawWaypointsDebug(ctx);
    if (this.debugF3) this.drawGridDebug(ctx);

    this.drawPlayer(ctx);

    // Prompt contextual e indicador de canal.
    this.drawPrompt(ctx);

    // Viñeta al bosque.
    const vg = ctx.createRadialGradient(
      GRID_PX / 2, GRID_PX / 2, GRID_PX * 0.35,
      GRID_PX / 2, GRID_PX / 2, GRID_PX * 0.78,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, GRID_PX, CANVAS_H);

    ctx.restore();

    // Separador del panel lateral.
    ctx.fillStyle = COLORS.sidebarBorder;
    ctx.fillRect(GRID_PX, 0, 2, CANVAS_H);
  }

  private drawTile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const t = this.grid.at(x, y);
    const px = x * CELL;
    const py = y * CELL;
    const r = hash2(x, y);

    // Pasto con variación y motas.
    ctx.fillStyle = r < 0.33 ? COLORS.grassA : r < 0.66 ? COLORS.grassB : COLORS.grassC;
    ctx.fillRect(px, py, CELL, CELL);
    ctx.fillStyle = 'rgba(210, 235, 205, 0.05)';
    const speckX = px + 6 + hash2(x * 3 + 1, y * 7 + 2) * (CELL - 12);
    const speckY = py + 6 + hash2(x * 5 + 3, y * 3 + 5) * (CELL - 12);
    ctx.fillRect(speckX, speckY, 3, 3);

    switch (t) {
      case 'tree':
        this.drawTree(ctx, px, py, x, y);
        break;
      case 'rock':
        this.drawRock(ctx, px, py, x, y);
        break;
      case 'bush':
        this.drawBush(ctx, px, py, x, y);
        break;
      case 'altar':
        this.drawAltar(ctx, px, py, this.map.altars.findIndex((a) => a.x === x && a.y === y));
        break;
      case 'portal':
        this.drawPortal(ctx, px, py);
        break;
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number): void {
    const r = hash2(x * 11 + 5, y * 13 + 7);
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    // Tronco
    ctx.fillStyle = '#3d2b1d';
    ctx.fillRect(cx - 3, cy + 6, 6, 8);
    // Copa: dos capas con salto determinista
    ctx.fillStyle = COLORS.treeDark;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, CELL * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(cx - 2 + r * 4, cy - 6, CELL * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 9, CELL * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRock(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number): void {
    const r = hash2(x * 17 + 1, y * 19 + 3);
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    ctx.fillStyle = COLORS.rockDark;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 9);
    ctx.lineTo(cx - 15, cy - 2 - r * 4);
    ctx.lineTo(cx - 6, cy - 12);
    ctx.lineTo(cx + 5, cy - 13 + r * 5);
    ctx.lineTo(cx + 14, cy - 3);
    ctx.lineTo(cx + 12, cy + 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.rock;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 6);
    ctx.lineTo(cx - 10, cy - 2);
    ctx.lineTo(cx - 3, cy - 8);
    ctx.lineTo(cx + 4, cy - 9);
    ctx.lineTo(cx + 9, cy - 1);
    ctx.lineTo(cx + 8, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(cx - 5, cy - 6, 5, 2);
  }

  private drawBush(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number): void {
    const r = hash2(x * 23 + 2, y * 29 + 4);
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    ctx.fillStyle = COLORS.bush;
    ctx.beginPath();
    ctx.arc(cx - 8 + r * 3, cy + 4, 9, 0, Math.PI * 2);
    ctx.arc(cx + 8 - r * 3, cy + 4, 9, 0, Math.PI * 2);
    ctx.arc(cx, cy - 6, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.bushLight;
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 8, 5.5, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawAltar(ctx: CanvasRenderingContext2D, px: number, py: number, altarIndex: number): void {
    const lit = altarIndex >= 0 && this.altarsLit.has(altarIndex);
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;

    // Base de piedra
    ctx.fillStyle = '#4a4436';
    roundRect(ctx, px + 6, py + CELL - 12, CELL - 12, 8, 3);
    ctx.fill();
    // Pilar
    ctx.fillStyle = '#5c5546';
    roundRect(ctx, cx - 7, cy - 12, 14, CELL - 20, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(cx - 4, cy - 9, 3, CELL - 26);

    // Orbe del altar
    if (lit) {
      ctx.save();
      ctx.shadowColor = COLORS.altarGlow;
      ctx.shadowBlur = 16;
      ctx.fillStyle = COLORS.altarGlow;
      ctx.beginPath();
      ctx.arc(cx, cy - 15, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Runa brillante
      ctx.strokeStyle = '#ffe9a3';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 4);
      ctx.lineTo(cx, cy - 1);
      ctx.lineTo(cx + 4, cy + 4);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#8d8674';
      ctx.beginPath();
      ctx.arc(cx, cy - 15, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPortal(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    const open = this.portalOpen();
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;

    if (open) {
      ctx.save();
      ctx.shadowColor = COLORS.portalActive;
      ctx.shadowBlur = 22;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, CELL * 0.44);
      grad.addColorStop(0, '#cbb8ff');
      grad.addColorStop(0.55, '#7b5cff');
      grad.addColorStop(1, 'rgba(60, 30, 140, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, CELL * 0.3, CELL * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Arcos giratorios
      ctx.strokeStyle = '#d9ccff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 1.8 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, CELL * 0.3, CELL * 0.42, 0, a, a + Math.PI / 2.4);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = '#4e4664';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, CELL * 0.26, CELL * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#171320';
      ctx.beginPath();
      ctx.ellipse(cx, cy, CELL * 0.2, CELL * 0.31, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const cx = p.pos.x * CELL;
    const bob = p.moving ? Math.sin(this.time * 9) * 2.5 : Math.sin(this.time * 2.4) * 1.6;
    const cy = p.pos.y * CELL + bob;

    ctx.save();
    if (p.hidden) ctx.globalAlpha = 0.45;

    // Halo del espíritu
    const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, 22);
    halo.addColorStop(0, 'rgba(126, 240, 224, 0.55)');
    halo.addColorStop(1, 'rgba(126, 240, 224, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo
    const body = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 9);
    body.addColorStop(0, '#eafffa');
    body.addColorStop(0.6, COLORS.player);
    body.addColorStop(1, '#3fbfb0');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();

    // Ojos según orientación
    const fx = Math.cos(p.facing);
    const fy = Math.sin(p.facing);
    ctx.fillStyle = '#0b3a35';
    const eyeOffset = 3.4;
    const perpX = -fy * eyeOffset;
    const perpY = fx * eyeOffset;
    const forward = 2.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        cx + fx * forward + perpX * side,
        cy + fy * forward + perpY * side,
        1.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPrompt(ctx: CanvasRenderingContext2D): void {
    const prompt = this.currentPrompt();
    const channel = this.player.altarProgress;
    if (!prompt && channel <= 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '13px Georgia';

    if (channel > 0) {
      // Anillo de progreso sobre el altar más cercano en rango.
      const altar = this.nearestAltarInRange();
      if (altar) {
        const c = cellCenter(altar.pos);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = COLORS.accent;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 20, -Math.PI / 2, -Math.PI / 2 + channel * Math.PI * 2);
        ctx.stroke();
      }
    }

    if (prompt) {
      const w = ctx.measureText(prompt).width + 36;
      const x = GRID_PX / 2 - w / 2;
      const y = CANVAS_H - 46;
      ctx.fillStyle = 'rgba(5, 13, 8, 0.78)';
      roundRect(ctx, x, y, w, 28, 14);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(prompt, GRID_PX / 2, y + 19);
    }
    ctx.restore();
  }

  private currentPrompt(): string | null {
    if (this.state !== 'playing') return null;
    if (this.player.hidden) return 'E — Salir del arbusto';
    if (this.player.inBush(this.grid)) return 'E — Esconderte en el arbusto';
    const altar = this.nearestAltarInRange();
    if (altar) return 'Mantené E — Activar altar';
    const portalCell = this.grid.at(this.player.cellX(), this.player.cellY()) === 'portal';
    if (portalCell && !this.portalOpen()) {
      const left = ALTARS_REQUIRED - this.altarsLit.size;
      return `El portal sigue sellado: falta${left === 1 ? '' : 'n'} ${left} altar${left === 1 ? '' : 'es'}`;
    }
    if (this.portalOpen()) {
      // Mostrar el objetivo si el portal está abierto y el jugador anda cerca.
      const p = this.map.portal;
      if (Math.hypot(this.player.pos.x - (p.x + 0.5), this.player.pos.y - (p.y + 0.5)) < 4) {
        return '¡El portal está abierto!';
      }
    }
    return null;
  }

  private drawWaypointsDebug(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Enlaces
    ctx.strokeStyle = 'rgba(255, 217, 102, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    for (const path of this.graph.edges.values()) {
      if (path.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const px = (path[i].x + 0.5) * CELL;
        const py = (path[i].y + 0.5) * CELL;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Nodos
    for (const n of this.graph.nodes) {
      const c = cellCenter(n);
      ctx.fillStyle = 'rgba(255, 217, 102, 0.9)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2c00';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGridDebug(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 220, 175, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(GRID_PX, y * CELL + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160, 220, 175, 0.5)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        ctx.fillText(`${x},${y}`, x * CELL + 2, y * CELL + 9);
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- HUD

  private drawSidebar(ctx: CanvasRenderingContext2D): void {
    const sx = GRID_PX + 2;
    const w = SIDEBAR_PX - 2;
    ctx.fillStyle = COLORS.sidebar;
    ctx.fillRect(sx, 0, w, CANVAS_H);

    let y = 22;
    const pad = 16;
    const textX = sx + pad;

    // Cabecera
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 17px Georgia';
    ctx.textAlign = 'left';
    ctx.fillText('El Guardián', textX, y);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = 'italic 11px Georgia';
    ctx.fillText('del Bosque Encantado', textX, y + 15);

    y += 34;
    this.divider(ctx, sx, y, w);
    y += 16;

    // Altares
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px Georgia';
    ctx.fillText('A L T A R E S', textX, y);
    y += 16;
    for (let i = 0; i < ALTARS_REQUIRED; i++) {
      const cx = textX + 14 + i * 44;
      const lit = this.altarsLit.has(i);
      ctx.beginPath();
      ctx.arc(cx, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#5c4d16' : '#131f16';
      ctx.fill();
      ctx.strokeStyle = lit ? COLORS.altarGlow : '#2a3d2f';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Runa rombo
      ctx.strokeStyle = lit ? COLORS.altarGlow : '#3a4f40';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, y - 6);
      ctx.lineTo(cx + 5, y);
      ctx.lineTo(cx, y + 6);
      ctx.lineTo(cx - 5, y);
      ctx.closePath();
      ctx.stroke();
    }
    y += 22;

    // Objetivo actual
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px Georgia';
    if (this.portalOpen()) {
      ctx.fillStyle = '#b9a5ff';
      ctx.fillText('El portal está abierto.', textX, y);
      ctx.fillText('Escápate por él.', textX, y + 16);
      y += 36;
    } else {
      const left = ALTARS_REQUIRED - this.altarsLit.size;
      ctx.fillText(`Activá los altares (${left} restante${left === 1 ? '' : 's'}).`, textX, y);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px Georgia';
      ctx.fillText('E junto al altar, sin correr,', textX, y + 16);
      ctx.fillText('y permanece unos segundos.', textX, y + 31);
      y += 47;
    }
    y += 4;

    // Semilla
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px Georgia';
    ctx.fillText(`Semilla: ${this.seed}`, textX, y);
    y += 18;
    this.divider(ctx, sx, y, w);
    y += 20;

    // Métodos
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px Georgia';
    ctx.fillText('M É T O D O S   D E L   G U A R D I Á N', textX, y);
    y += 16;

    y = this.radioRow(ctx, textX, y, 'search-astar', this.searchAlgorithm === 'astar', 'Búsqueda: A* (informado)');
    y = this.radioRow(ctx, textX, y, 'search-bfs', this.searchAlgorithm === 'bfs', 'Búsqueda: BFS (por capas)');
    y += 4;
    y = this.radioRow(ctx, textX, y, 'nav-waypoints', this.navigationMode === 'waypoints', 'Navegación: red de waypoints');
    y = this.radioRow(ctx, textX, y, 'nav-grid', this.navigationMode === 'grid', 'Navegación: grilla dinámica');
    y += 6;

    // Botón: generar otra variante
    const btnH = 34;
    const hover = this.isHover(textX, y, w - pad * 2, btnH);
    ctx.fillStyle = hover ? '#254a32' : '#1d3b28';
    roundRect(ctx, textX, y, w - pad * 2, btnH, 7);
    ctx.fill();
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1.2;
    roundRect(ctx, textX, y, w - pad * 2, btnH, 7);
    ctx.stroke();
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 12px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('Generar otra variante  (R)', textX + (w - pad * 2) / 2, y + 22);
    ctx.textAlign = 'left';
    this.clickZones.push({ id: 'regen', rect: [textX, y, w - pad * 2, btnH] });
    y += btnH + 18;
    this.divider(ctx, sx, y, w);
    y += 18;

    // Controles
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px Georgia';
    ctx.fillText('C O N T R O L E S', textX, y);
    y += 15;
    ctx.font = '11px Georgia';
    const lines = [
      'WASD / Flechas — moverse',
      'Shift — correr (ruidoso)',
      'Espacio — agacharse',
      'E — esconderse / activar altar',
      'R — nueva variante',
      'F1 cono · F2 rutas · F3 grilla',
      'M — silencio',
    ];
    for (const line of lines) {
      ctx.fillText(line, textX, y);
      y += 16;
    }
    y += 6;
    ctx.fillStyle = '#415c49';
    ctx.font = '9px Georgia';
    ctx.fillText('PIAPC · Lautaro Rosales · 2026', textX, CANVAS_H - 12);
  }

  private divider(ctx: CanvasRenderingContext2D, sx: number, y: number, w: number): void {
    ctx.strokeStyle = COLORS.sidebarBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + 16, y);
    ctx.lineTo(sx + w - 16, y);
    ctx.stroke();
  }

  private radioRow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    id: string,
    checked: boolean,
    label: string,
  ): number {
    const rowH = 22;
    const hover = this.isHover(x, y, SIDEBAR_PX - 32, rowH);
    if (hover) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      roundRect(ctx, x - 4, y - 2, SIDEBAR_PX - 24, rowH + 4, 5);
      ctx.fill();
    }
    const cy = y + rowH / 2;
    ctx.beginPath();
    ctx.arc(x + 8, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = checked ? COLORS.accent : '#101b13';
    ctx.fill();
    ctx.strokeStyle = checked ? COLORS.accent : '#3a4f40';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (checked) {
      ctx.fillStyle = '#241c05';
      ctx.beginPath();
      ctx.arc(x + 8, cy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = checked ? COLORS.text : COLORS.textDim;
    ctx.font = '11px Georgia';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 22, cy + 4);
    this.clickZones.push({ id, rect: [x - 4, y - 2, SIDEBAR_PX - 24, rowH + 4] });
    return y + rowH;
  }

  private isHover(x: number, y: number, w: number, h: number): boolean {
    return this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y && this.mouse.y <= y + h;
  }
}
