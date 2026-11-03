// Tipos compartidos del juego.

export type CellType =
  | 'grass'  // transitable
  | 'tree'   // bloquea paso y visión
  | 'rock'   // bloquea paso y visión
  | 'bush'   // transitable; esconde al jugador
  | 'altar'  // bloquea paso y visión; activa al canalizar E
  | 'portal';// transitable; dispara la victoria si están los 3 altares

export type GuardianState =
  | 'patrol'   // Patrulla
  | 'alert'    // Alerta
  | 'chase'    // Persecución
  | 'search'   // Búsqueda
  | 'return';  // Vuelta a Patrulla

export type SearchAlgorithm = 'astar' | 'bfs';
export type NavigationMode = 'grid' | 'waypoints';

export interface CellCoord {
  x: number;
  y: number;
}

/** Posición continua en unidades de celda. */
export interface Pos {
  x: number;
  y: number;
}

export interface GameMap {
  w: number;
  h: number;
  /** [y][x] */
  cells: CellType[][];
  start: CellCoord;
  portal: CellCoord;
  altars: CellCoord[];
  seed: number;
}

export interface Waypoint {
  x: number;
  y: number;
  /** Enlaces salientes consecutivos de la polilínea (índices de nodos). */
  next: number;
}

export interface WaypointGraph {
  /** Nodos ordenados por coordenada. */
  nodes: CellCoord[];
  /** Polilíneas de cada enlace: clave `${a}-${b}` con a<b → lista de celdas. */
  edges: Map<string, CellCoord[]>;
  /** Ciclo de patrulla: índices de nodos en orden. */
  patrol: number[];
}
