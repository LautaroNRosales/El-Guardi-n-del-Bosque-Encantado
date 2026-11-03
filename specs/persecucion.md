# Persecución del Guardián

## Objetivo
El Guardián debe perseguir al jugador cuando lo detecta, y debe poder elegirse el algoritmo de búsqueda con el que lo hace.

## Comportamiento esperado
- Mientras no detecta al jugador, recorre puntos de patrulla.
- Los puntos de patrulla son transitables en el mapa generado; las rutas entre ellos se calculan según el escenario generado.
- Si el jugador entra en su cono de visión (90°, hasta 8 celdas según obstáculos) o dentro de su radio de audición (correr: 6 celdas, caminar: 1), y no hay un obstáculo bloqueando la vista, pasa a Alerta. Si confirma visualmente, pasa a Persecución.
- Calcula el camino con el algoritmo seleccionado en el HUD: **A\*** (informado, heurística Manhattan) o **BFS** (sin información, costos uniformes).
- El mapa de esta funcionalidad tiene costos de paso uniformes.
- Si pierde de vista u oído al jugador, se dirige a su última posición conocida.
- Si no lo encuentra allí (tras 3 s sin confirmación), pasa a Búsqueda (barrido BFS) y luego retoma la patrulla.

## Fuera de alcance
Combate, coordinación entre varios guardias, animaciones complejas.

## Cómo comprobarlo
- Sin jugador visible, el guardián patrulla.
- Con jugador visible, comienza la persecución.
- No detecta al jugador a través de paredes (LOS bloqueada por árboles, rocas y altares).
- Mientras está escondido en un arbusto, el guardián no lo ve, no lo oye y **no puede capturarlo** (ni tocandolo); el jugador vuelve a ser vulnerable al salir del arbusto.
- Si no existe un camino, no atraviesa obstáculos ni se bloquea: permanece en una celda válida y retoma la patrulla.
- Se puede seleccionar **BFS o A\*** en el panel «Métodos» y observar cómo cambia el recorrido (con F2 activo se ve la ruta y los nodos expandidos).
- Al generar otra variante (R), la patrulla adapta sus rutas a los obstáculos.
