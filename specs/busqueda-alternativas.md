# Búsqueda: A* vs BFS seleccionables

## Objetivo
Ofrecer al jugador dos algoritmos de búsqueda y poder alternarlos en vivo para observar sus diferencias.

## Comportamiento esperado
- Panel «Métodos» en el HUD con dos radios: «Búsqueda: A\* / BFS».
- El algoritmo seleccionado se usa para calcular el camino en Persecución y en Vuelta a Patrulla.
- **A\***: búsqueda informada, heurística Manhattan; garantiza el camino óptimo con costos uniformes y expande menos nodos.
- **BFS**: búsqueda sin información; garantiza el camino óptimo con costos uniformes; expande por capas (anillo por anillo).
- **Búsqueda (estado)** usa BFS por diseño: es un barrido sistemático por anillos alrededor del último punto conocido; alternar A\*/BFS no cambia ese barrido.
- Con **F2** se dibuja el camino activo y los nodos expandidos con colores distintos según el algoritmo.

## Fuera de alcance
Comparación formal con métricas; no se exige resultado distinto entre ambos (con costos uniformes ambos encuentran el camino óptimo; A\* llega expandiendo menos nodos).

## Cómo comprobarlo
- Elegir A\*: el guardián recalcula en línea recta hacia el jugador.
- Elegir BFS: el guardián llega al mismo camino pero la expansión de nodos visible (F2) difiere.
- Con F2 activo, el contador de nodos visitados indica la diferencia de expansión.
