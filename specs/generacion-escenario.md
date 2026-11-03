# Generación de escenario y validez

## Objetivo
Cada partida genera un bosque distinto y siempre jugable; existe un control para generar otra variante.

## Comportamiento esperado
- Semilla mostrada en el HUD; tecla/botón **R** genera una variante nueva.
- Varían: arbustos, rocas, árboles no esenciales, posiciones de altares/portal, orden y conexiones de waypoints, ancho de senderos.
- Validación por búsqueda (BFS): desde el inicio deben alcanzar los 3 altares y el portal.
- Si no hay camino → **carve**: A\* con costo 1 (pasto) / 6 (árbol/roca) y se eliminan los obstáculos que atraviesa el camino. Resultado: siempre hay ≥ 1 camino continuo y válido.
- Inicio y objetivos nunca sobre paredes; inicio y portal nunca adyacentes.
- La patrulla y los waypoints se reconstruyen con la nueva distribución.
- Los casos sin camino posibles quedan cubiertos: el carve los corrige siempre; si igualmente no hubiera camino (p. ej., bloqueo total), el guardián permanece en celda válida y retoma patrulla.

## Fuera de alcance
Generador con garantías de dificultad estética avanzada; niveles múltiples.

## Cómo comprobarlo
- Pulsar R varias veces: ninguna variante deja un altar o el portal inaccesibles (test con 100 semillas en vitest).
- Iniciar y ver que el guardián puede llegar a cada zona de interés.
- Test `logic.test.ts`: `generateMap` válido en 100 semillas; `carve` repara un mapa bloqueado artificialmente.
