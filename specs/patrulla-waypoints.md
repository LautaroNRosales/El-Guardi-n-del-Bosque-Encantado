# Patrulla con red de waypoints

## Objetivo
El guardián patrulla una red de puntos de ruta construida a partir del escenario generado, y esa red se reconstruye en cada variante.

## Comportamiento esperado
- Los nodos son: los 3 altares, el portal, el centro y los 4 centros de cuadrante, ajustados a la celda transitable más cercana.
- Los enlaces se calculan por **A\*** sobre el mapa generado (no son trayectorias fijas).
- El grafo se une con union-find hasta ser conexo; el ciclo de patrulla se ordena por vecino más cercano desde un nodo inicial aleatorio.
- En modo «Navegación: Red de waypoints» el guardián se mueve por los enlaces; en modo «Grilla dinámica» recalcula la ruta en vivo hacia el siguiente punto de interés.
- Todos los nodos son transitables; ningún enlace atraviesa obstáculos.
- Al regenerar la variante (R), la red se reconstruye y la patrulla cambia visiblemente (comparar con F2).

## Fuera de alcance
Red de forma libre con cientos de nodos; entrada manual de waypoints.

## Cómo comprobarlo
- F2 muestra los nodos y enlaces de la red sobre el mapa.
- Alternar «Navegación» en Métodos cambia el comportamiento de patrulla visiblemente.
- Generar otra variante: los enlaces se adaptan a los nuevos obstáculos.
- Ningún nodo coincide con árbol, roca o altar activado.
