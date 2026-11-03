# Game Design Document · TP Final Integrador

# El Guardián del Bosque Encantado

Juego de sigilo en 2D con vista superior. Atraviesa un bosque cambiante, activa los altares antiguos y escapa antes de que el Guardián te encuentre.

**Integrante:** Lautaro Rosales
**Cátedra:** PIAPC — Programación de Inteligencia Artificial para Videojuegos
**Documento:** Entrega del GDD · 2026

## Índice

1. Idea de juego, escenario y objetivo
2. Interacción y controles
3. NPC: percepción, objetivos y comportamientos
4. Algoritmos de búsqueda a implementar
5. Alternativas de navegación
6. Generación y variación del escenario
7. Alcance y límites del prototipo

---

## 1. Idea de juego, escenario y objetivo

### 1.1 Resumen

El Guardián del Bosque Encantado es un juego de sigilo en 2D con vista superior. El jugador encarna a un pequeño espíritu que debe atravesar un bosque cambiante para activar tres altares antiguos y abrir el portal de salida antes del amanecer. Un ser guardián patrulla la zona y persigue al jugador si lo detecta. No existe el combate: la única forma de avanzar es esconderse, planear rutas y evitar ser visto u oído.

### 1.2 Escenario

Bosque conformado por senderos transitables, árboles y rocas que bloquean la visión y el paso, arbustos donde el jugador puede ocultarse, y pasos estrechos que obligan a tomar decisiones de ruta. La disposición de los elementos varía en cada partida, manteniendo siempre la jugabilidad garantizada.

### 1.3 Objetivo del jugador

- Activar los 3 altares distribuidos por el mapa.
- Alcanzar el portal de salida una vez activados todos los altares.
- Evitar ser capturado por el Guardián en todo momento.

## 2. Interacción y controles

| Acción | Tecla | Detalle |
|---|---|---|
| Moverse | Flechas / WASD | Velocidad normal. Genera ruido leve. |
| Correr | Shift + movimiento | Duplica la velocidad. Genera ruido fuerte detectable desde más lejos. |
| Agacharse | Espacio (mantener) | Reduce visibilidad y ruido. No se puede mover rápido. |
| Esconderse / Salir | E | Entrar o salir de un arbusto. Mientras está escondido, el Guardián no ve al jugador. |
| Activar altar | E (junto al altar) | Solo es posible sin correr. Requiere permanecer unos segundos junto al altar. |

## 3. NPC: percepción, objetivos y comportamientos

### 3.1 Percepción

**Visión**

- Cono de visión de aproximadamente 90° de apertura orientado en la dirección de movimiento.
- Alcance lejano: 8 celdas — detección si no hay obstáculos de por medio.
- Alcance medio: 5 celdas — detección segura.
- Alcance cercano: 2 celdas — detecta incluso si el jugador está agachado.
- La visión queda bloqueada por árboles, rocas y altares.

**Oído**

- Correr: rango de detección de 6 celdas.
- Caminar: rango de detección de 1 celda.
- Quieto o escondido: no emite ruido detectable.

**Umbral de pérdida de rastro**

Si el jugador sale del campo de visión y deja de hacer ruido, el Guardián mantiene el rastro durante 3 segundos. Transcurrido ese tiempo sin confirmación visual, pasa al estado de Búsqueda.

### 3.2 Estados y comportamientos

- **Patrulla:** Recorre rutas definidas a velocidad moderada, cambiando de dirección en los puntos de control. Si escucha o ve algo, pasa inmediatamente a Alerta.
- **Alerta:** Se detiene y gira hacia la fuente del sonido. Si confirma la presencia visual del jugador, pasa a Persecución. Si no confirma en 4 segundos, vuelve a Patrulla.
- **Persecución:** Se dirige directamente hacia el jugador a velocidad máxima. Si llega a la última posición conocida y no lo encuentra, mantiene la búsqueda en la zona inmediata.
- **Búsqueda:** Recorre el área cercana al último punto conocido del jugador durante 10 segundos. Si no lo encuentra, retorna a su ruta de patrulla.
- **Vuelta a Patrulla:** Regresa al punto más cercano de su recorrido y continúa con la rutina normal.

### 3.3 Objetivos del NPC

- Detectar y capturar al jugador.
- Mantener la cobertura de las zonas clave del bosque.
- Investigar cualquier alteración en su entorno (ruidos, altares activados).

## 4. Algoritmos de búsqueda a implementar

### 4.1 A\* (A Estrella)

Uso: Se activa en estado de Persecución para calcular la ruta más corta y directa desde la posición actual del Guardián hasta la última ubicación conocida del jugador, evitando obstáculos en tiempo real. También se utiliza para volver a los puntos de la ruta cuando el Guardián se desvía de su patrulla.

### 4.2 Búsqueda en Anchura (BFS)

Uso: Se activa en estado de Búsqueda cuando el Guardián pierde el rastro del jugador. Explora sistemáticamente todas las celdas accesibles dentro de un radio determinado alrededor del último punto conocido, asegurándose de no dejar sectores sin revisar antes de decidir volver a patrullar.

## 5. Alternativas de navegación

### 5.1 Navegación por grilla con cálculo de ruta dinámico

Uso: En persecución e investigación. El mapa se divide en celdas transitables y obstaculizadas; el Guardián recalcula su camino en cada paso si el entorno cambia o si el jugador se mueve. Prioriza la velocidad de reacción sobre la suavidad del recorrido.

### 5.2 Navegación por red de puntos de ruta (Waypoints)

Uso: En patrullaje. El mapa cuenta con puntos de control conectados entre sí; el Guardián se desplaza de uno a otro siguiendo enlaces predefinidos. Es más eficiente computacionalmente, permite recorridos predecibles y se adapta fácilmente cuando el escenario cambia entre partidas.

> Nota: Se trata de dos estrategias distintas de planificación del desplazamiento, no únicamente del cambio de algoritmo de búsqueda, cumpliendo con el requisito de la consigna.

## 6. Generación y variación del escenario

### 6.1 Qué cambia entre partidas

- Posición exacta de arbustos, rocas y árboles no esenciales.
- Ubicación de los 3 altares y del portal de salida.
- Orden de los puntos de patrulla y conexiones entre zonas.
- Ancho y forma de algunos senderos.

### 6.2 Garantía de validez y jugabilidad

Antes de presentar el mapa al jugador, se ejecuta una comprobación automática: se verifica mediante recorrido que exista al menos un camino continuo y transitable desde el punto de inicio hasta cada altar, y desde cada altar hasta el portal. Si alguna zona queda inaccesible, se reacomodan los elementos hasta cumplir la condición. Además, se establecen anchos mínimos de paso para evitar callejones sin salida bloqueados.

### 6.3 Adaptación de las rutas de patrullaje

La red de puntos de ruta se reconstruye y reordena automáticamente según la disposición del escenario generada:

- Se identifican los puntos de paso obligado y las zonas de interés.
- Se conectan mediante rutas transitables verificadas.
- Se asigna al Guardián el nuevo recorrido antes de iniciar la partida.
- Si durante el juego el entorno cambia, los enlaces de la red de waypoints se recalculan en segundo plano.

## 7. Alcance y límites del prototipo

### 7.1 Incluye en esta entrega

- Mapa de tamaño reducido (aproximadamente 15 × 15 celdas) con representación visual simple.
- Un único NPC con los 5 estados de comportamiento descritos.
- Sistema de percepción combinando visión (cono) y oído (radio según acción).
- Implementación de los dos algoritmos de búsqueda: A\* y BFS.
- Dos modos de navegación: por grilla dinámica y por red de waypoints.
- Generación básica de variación en la ubicación de los elementos del escenario.
- Verificación automática de validez del escenario.
- Controles completos según la lista del punto 2.

### 7.2 Excluye — se deja para versiones futuras

- Múltiples niveles o progresión entre escenarios.
- Más de un Guardián o tipos de enemigos distintos.
- Animaciones complejas, sprites detallados o música.
- Sistema de puntuación, contador de tiempo o niveles de dificultad.
- Mecánicas adicionales: distraer al Guardián, uso de objetos, etc.

### 7.3 Tamaño estimado

- Mapa: 15 × 15 celdas, ampliable a 20 × 20 si el rendimiento lo permite.
- NPC: 1 unidad con comportamiento completo.
- Mecánicas centrales: Sigilo, detección, rutas adaptativas y activación de objetivos.
