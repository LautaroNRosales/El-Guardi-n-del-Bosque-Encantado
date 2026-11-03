// Todos los parámetros del juego en un único lugar (tunables).

// --- Grilla y lienzo ---
export const GRID_W = 15;
export const GRID_H = 15;
export const CELL = 44;                 // px por celda
export const GRID_PX = GRID_W * CELL;   // 660
export const SIDEBAR_PX = 280;
export const CANVAS_W = GRID_PX + SIDEBAR_PX; // 940
export const CANVAS_H = GRID_PX;        // 660

// --- Jugador (celdas/s) ---
export const WALK_SPEED = 2.8;
export const RUN_SPEED = 5.4;
export const CROUCH_SPEED = 1.5;

// --- Guardián (celdas/s) ---
export const GUARDIAN_PATROL_SPEED = 2.0;
export const GUARDIAN_RETURN_SPEED = 3.5;
export const GUARDIAN_SEARCH_SPEED = 3.2;
export const GUARDIAN_CHASE_SPEED = 5.0;

// --- Visión del Guardián (GDD 3.1) ---
export const VISION_HALF_ANGLE_DEG = 45;   // cono total de 90°
export const VISION_FAR = 8;               // lejos: solo de pie y sin obstáculos
export const VISION_MID = 5;               // detección segura
export const VISION_NEAR = 2;              // detecta incluso agachado

// --- Oído del Guardián (GDD 3.1) ---
export const HEAR_RUN = 6;
export const HEAR_WALK = 1;
export const HEAR_CROUCH = 0;

// --- Rastreo de la última posición conocida ---
export const TRAIL_LOST_SECONDS = 3;       // sin confirmación → Búsqueda
export const ALERT_CONFIRM_SECONDS = 4;    // Alerta sin confirmar → Patrulla
export const SEARCH_SECONDS = 10;          // duración del barrido
export const SEARCH_RADIUS = 5;            // radio del barrido BFS
export const SEARCH_STEP_SECONDS = 0.4;    // tiempo por celda del barrido
export const REPATH_SECONDS = 0.5;         // recálculo de ruta en persecución
export const PATH_NULL_WAIT_SECONDS = 2;   // sin camino disponible → Vuelta a Patrulla

// --- Captura ---
export const CAPTURE_DISTANCE = 0.6;

// --- Altares y portal ---
export const ALTAR_CHANNEL_SECONDS = 2.0;
export const ALTARS_REQUIRED = 3;

// --- Generación de escenario ---
export const OBSTACLE_CELLS_MIN = 20;
export const OBSTACLE_CELLS_MAX = 24;
export const BUSH_CELLS_MIN = 9;
export const BUSH_CELLS_MAX = 12;
export const ALTAR_MIN_SEPARATION = 5;     // celdas entre altares / inicio / portal
export const CARVE_OBSTACLE_COST = 6;      // costo de tallar un obstáculo
export const CARVE_GRASS_COST = 1;
export const MAX_GEN_ATTEMPTS = 200;

// --- Colores ---
export const COLORS = {
  grassA: '#16241a',
  grassB: '#1a2b1f',
  grassC: '#1e3324',
  tree: '#274d33',
  treeDark: '#19301f',
  rock: '#5a5f5e',
  rockDark: '#3c403f',
  bush: '#2f5c3d',
  bushLight: '#3f7a52',
  altar: '#8a7a4a',
  altarGlow: '#ffd966',
  portal: '#7b5cff',
  portalActive: '#a78bff',
  player: '#7ef0e0',
  guardian: '#2a2a33',
  guardianEyes: '#ffb347',
  sidebar: '#0d1b12',
  sidebarBorder: '#1d3b28',
  text: '#cfe8d4',
  textDim: '#7ea487',
  accent: '#ffd966',
  danger: '#ff6b57',
};
