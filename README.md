# El Guardián del Bosque Encantado

**TP Final Integrador · PIAPC — Programación de Inteligencia Artificial para Videojuegos · 2026**

Juego de sigilo en 2D (vista superior). Un pequeño espíritu debe atravesar un bosque que cambia en cada partida, activar los **3 altares antiguos** y escapar por el **portal de salida**… sin que el **Guardián** lo descubra. No hay combate: solo sigilo, percepción y planificación de rutas.

**Integrante:** Lautaro Rosales

Repositorio público: <https://github.com/LautaroNRosales/El-Guardi-n-del-Bosque-Encantado>

**Documentos:** [GDD](GDD.md) · [Presentación 4/11](presentacion.md) · [Specs](specs/)

---

## Cómo ejecutar

**Requisitos:** Node.js ≥ 18 (probado con v24) y npm. Sin assets externos, sin cuenta y sin API keys: todo se genera por código.

### Opción 1 — Ejecutar en desarrollo

```powershell
# 1) Cloná el repo y abrí PowerShell en la carpeta del proyecto
git clone https://github.com/LautaroNRosales/El-Guardi-n-del-Bosque-Encantado.git
cd "El-Guardi-n-del-Bosque-Encantado"

# 2) Instalá las dependencias (solo la primera vez)
npm.cmd install

# 3) Corré el juego
npm.cmd run dev
# → abrí en el navegador: http://localhost:5173
```

### Opción 2 — Build de producción

```powershell
npm.cmd install   # solo la primera vez
npm.cmd run build # type-check + genera dist/
npm.cmd run preview
# → abrí en el navegador: http://localhost:4173
```

> **¿Por qué `npm.cmd`?** En Windows, el PowerShell con la ejecución de scripts restringida rechaza `npm` (error de ExecutionPolicy por `npm.ps1`). La variante `npm.cmd` funciona siempre. En Linux/macOS o Git Bash, `npm` a secas está bien.


## Controles

| Acción | Tecla |
|---|---|
| Moverse | Flechas / WASD |
| Correr (duplica velocidad, ruido fuerte detectable a 6 celdas) | Shift + movimiento |
| Agacharse (lento, en silencio, detección solo a < 2 celdas) | Espacio (mantener) |
| Esconderse / salir del arbusto | E (solo en arbustos; escondido = **invisible e intocable**) |
| Activar altar (solo junto al altar, sin correr) | E (mantener ~2 s) |
| **Generar otra variante del bosque** | **R** (también botón en el HUD) |
| **Silencio on/off** | **M** |
| Debug: cono de visión real recortado por obstáculos | **F1** |
| Debug: waypoints, enlaces, ruta activa (color según algoritmo), última posición vista y nodos expandidos | **F2** |
| Debug: grilla + coordenadas | **F3** |
| Empezar desde el menú | Enter |

## Cómo cambiar los métodos del Guardián (panel «Métodos», en vivo)

El panel lateral del HUD permite **seleccionar en plena partida**:

- **Búsqueda: A\* / BFS** — algoritmo usado por el Guardián para calcular sus rutas (persecución y retorno). Con **F2** se ve el color de la ruta y el contador `expandidos` en vivo: A\* llega expandiendo menos nodos; BFS expande por capas. Ambos garantizan el camino óptimo porque los costos son uniformes.
- **Navegación: red de waypoints / grilla dinámica** — estrategia de planificación del desplazamiento (no es solo cambiar de algoritmo):
  - *Red de waypoints* (patrullaje clásico): sigue enlaces precalculados entre nodos de interés (altares, portal, centro, cuadrantes). Recorrido predecible y eficiente; se reconstruye en cada variante.
  - *Grilla dinámica*: recalcula la ruta en cada paso (reactivo; prioriza reaccionar antes que suavidad).

En la exposición se puede alternar ambos en vivo y generar otra variante (R) para mostrar cómo se adaptan las rutas.

## Objetivo y reglas

1. Activá los **3 altares** (marcá en el HUD «ALTARES»: 0/3 → 3/3).
2. El **portal** se abre; alcanzalo para ganar.
3. **Perdé** si el Guardián te toca.

Sigilo: el Guardián tiene **cono de visión de 90°** (8 celdas lejano — solo de pie; 5 seguro; 2 cercano — detecta incluso agachado) bloqueado por **árboles, rocas y altares**, y **oído** (correr: 6; caminar: 1; quieto/agachado/escondido: nada). **Mientras estás escondido en un arbusto, no puede verte, oírte ni capturarte**; al salir, volvés a ser vulnerable. Si deja de percibirte, mantiene tu **última posición conocida 3 s** y luego hace un **barrido BFS** de la zona.

## Arquitectura

```
src/
├─ main.ts          # bootstrap + bucle rAF (dt acotado)
├─ config.ts        # TODAS las constantes de balance/GDD
├─ types.ts         # CellType, GuardianState, GameMap, WaypointGraph…
├─ rng.ts           # mulberry32(semilla) — variantes reproducibles
├─ grid.ts          # grilla: transitabilidad, línea de visión (muestreo de línea)
├─ pathfinding.ts   # A*, BFS, barrido BFS por radio, alcanzabilidad, «carve»
├─ mapgen.ts        # generación del bosque + validación BFS + carve (siempre jugable)
├─ waypoints.ts     # red de waypoints (A* + union-find) y ciclo de patrulla
├─ player.ts        # movimiento, correr, agacharse, esconderse, canal de altar
├─ guardian.ts      # FSM de 5 estados + navegación seleccionable + captura
├─ perception.ts    # cono 90°, LOS por obstáculos, oído por ruido
├─ game.ts          # mundo: render, HUD (panel Métodos, R), prompts, F1–F3, win/lose
├─ screens.ts       # menú y overlays de victoria/derrota
└─ audio.ts         # WebAudio procedural (sin assets)

test/               # vitest: 212 tests (mapgen×100 semillas, A*/BFS/carve/LOS,
                    # y simulación de la FSM: detectar→alerta→perseguir→capturar)
specs/              # especificaciones que guiaron el desarrollo
```

## Consigna ↔ implementación

| Requisito de la cátedra | Implementación |
|---|---|
| NPC percibe, recuerda y actúa | `perception.ts` (cono+oído) + `lastKnown` de 3 s en `guardian.ts` |
| ≥ 2 algoritmos de búsqueda **seleccionables y observables** | **Panel «Métodos»: A\*/BFS**; F2 muestra ruta y nodos expandidos en vivo |
| ≥ 2 alternativas de navegación **activables** | **Panel «Métodos»: Grilla dinámica / Red de waypoints** (Estrategias de planificación distintas, no solo el algoritmo) |
| Control para **generar otra variante** | Tecla/botón **R**; semilla visible; `?play&seed=` la fija |
| FSM | **5 estados** (Patrulla→Alerta→Persecución→Búsqueda→Vuelta a Patrulla), diagrama en `presentacion.md` |
| Specs antes de implementar | `specs/persecucion.md`, `busqueda-alternativas.md`, `patrulla-waypoints.md`, `generacion-escenario.md` |
| Variantes válidas (inicio/objetivos alcanzables; comprobar y corregir) | BFS de validación + **carve** (A\* con costo 1/6, abre árboles/rocas, **nunca altares**); test ×100 semillas |
| Patrullaje adaptable al escenario | Waypoints reconstruidos por variante; enlaces por A\*; sin trayectorias fijas |
| Caso sin camino mostrado/manejado | Sin camino: el Guardián espera 2 s en celda válida y vuelve a patrulla (`guard.ts`, `PATH_NULL_WAIT_SECONDS`); cubierto en spec y test |
| README completo, repo público | Este archivo; repo público en GitHub |
| GDD + presentación accesibles | [GDD.md](GDD.md), [presentacion.md](presentacion.md) |
| OpenCode + specs + comprensión | Sección 6 de `presentacion.md`; specs en `specs/` |
| Gráficos simples, IA observable | Canvas vectorial + F1 (cono recortado por obstáculos), F2, F3 |

## Algoritmos en una línea

- **A\* (A Estrella):** búsqueda informada con heurística Manhattan; con costos uniformes encuentra el camino óptimo expandiendo menos nodos que BFS. Uso: persecución, retorno e investigación.
- **BFS (Anchura):** búsqueda exhaustiva por capas; óptimo con costos uniformes; sin información (ignora la dirección al objetivo). Uso: barrido de la zona en la Búsqueda (por diseño) y alternativa seleccionable para rutas.
- **«Carve»:** A\* con costo 6 en obstáculos para **abrir paso** cuando el bosque quedó desconectado; garantiza la jugabilidad de toda variante.
- **LOS:** muestreo de la línea entre celdas; bloqueada por árboles, rocas y altares.

## Tests

```bash
npm run test
```

212 tests: validez del mapa en 100 semillas (camino inicio→altares→portal siempre existe), optimalidad de A\*, equivalencia A\*/BFS con costos uniformes, cobertura del barrido BFS, bloqueo de línea de visión, reparación «carve», y **simulación de la FSM** (detectar → alerta → persecución → captura; no-detección con muro; escondido = invisible; perturbación de altar → investiga).
