# GRAVITY LAB

**Laboratorio de física interactivo en 3D** construido con **Three.js**, **Ammo.js** y **Tween.js**, empaquetado con **Parcel**.

GRAVITY LAB no es una animación: es una pequeña instalación científica interactiva donde los objetos que ves caer, chocar y salir despedidos están gobernados por un **motor de cuerpos rígidos real** (Bullet Physics compilado a JavaScript mediante Ammo.js). La interfaz, de estética industrial/futurista, muestra en todo momento lo que está haciendo el solver: número de cuerpos, colisiones reales, velocidad media, gravedad efectiva y FPS.

---

## Índice

1. [Qué puedes hacer](#qué-puedes-hacer)
2. [Cómo funciona](#cómo-funciona)
3. [Tecnologías](#tecnologías)
4. [Instalación y ejecución](#instalación-y-ejecución)
5. [Controles](#controles)
6. [La física en detalle](#la-física-en-detalle)
7. [Estructura del proyecto](#estructura-del-proyecto)
8. [Configuración](#configuración)
9. [Rendimiento y límites](#rendimiento-y-límites)
10. [Solución de problemas](#solución-de-problemas)
11. [Validación realizada](#validación-realizada)
12. [Referencias](#referencias)
13. [Uso de IA / OpenCode](#uso-de-ia--opencode)

---

## Qué puedes hacer

- **Inyectar materia**: elige entre **esfera**, **cubo** o **cilindro** y lánzalos al laboratorio. Cada cuerpo tiene masa, fricción, restitución y velocidad inicial propios.
- **Cambiar la gravedad** con el deslizador (de `0` a `26 m/s²`), usar presets (**ZERO**, **MOON**, **EARTH**, **HEAVY**) o **invertirla** para que todo caiga hacia arriba contra el techo de contención.
- **Pausar, reanudar y reiniciar** la simulación sin recargar la página.
- **Seleccionar un cuerpo** haciendo clic sobre él y **aplicarle un impulso** con componente ascendente y giro.
- **Detonar una explosión radial** de intensidad ajustable. El epicentro es el cuerpo seleccionado o, si no hay ninguno, el centro de la plataforma. Los cuerpos ligeros salen despedidos más rápido que los pesados y la fuerza decae con la distancia.
- **Observar la telemetría real**: contactos detectados por el dispatcher de Ammo, velocidad media y máxima, gravedad efectiva, FPS y un histórico de energía cinética.
- **Mover la cámara** en órbita alrededor de la plataforma y **restablecer la vista** con una transición suave.
- **Reiniciar el laboratorio completo** (cuerpos, gravedad, cámara y contadores) con el botón *REBOOT*.

---

## Cómo funciona

La aplicación se organiza en capas independientes. Ninguna capa de interfaz habla directamente con Ammo, y el motor físico no conoce Three.js.

```
UI (DOM)  ──handlers──▶  Simulation  ──▶  PhysicsEngine (Ammo.js)
                            │                    │
                            ├──▶ BodyFactory ────┘  (malla + shape + rigid body)
                            ├──▶ LabScene          (escena, luces, cámara, estructuras)
                            ├──▶ Effects           (Tween.js: ondas, chispas, flashes)
                            └──▶ InteractionController (raycasting / selección)
```

### El bucle principal

En cada fotograma (`requestAnimationFrame`):

1. Se actualiza **Tween.js** (transiciones de UI, cámara, efectos y escalas de aparición).
2. `Simulation.update(delta)` acumula el tiempo y avanza la física con un **paso fijo de `1/60 s`**, hasta un máximo de 5 subpasos por fotograma. Ammo recibe siempre el mismo `dt`, de modo que el comportamiento no depende de los FPS.
3. Cada malla copia la transformación real de su cuerpo rígido (`motionState`).
4. Se renderiza la escena con Three.js.
5. La UI refresca la telemetría leyendo los valores reales de la simulación (~8 veces por segundo).

### Por qué el paso fijo

Un `delta` variable haría que la misma escena se comportara distinto en un portátil y en un monitor de 144 Hz. El acumulador garantiza reproducibilidad y evita que un pico de lag teletransporte objetos a través del suelo.

### Colisiones reales

El contador de colisiones **no** cuenta fotogramas ni intersecciones visuales. En cada tick se recorren los *manifolds* que genera el `btCollisionDispatcher`; solo se cuenta un contacto nuevo cuando un par de cuerpos (identificados por su `userIndex`) pasa de no tocarse a tocarse. Los pares estático–estático se ignoran.

### Tween.js sin romper la física

Tween.js se usa para:

- la aparición de los cuerpos (escala, nunca posición),
- la apertura de la compuerta de inyección,
- la cámara de introducción y el reinicio de vista,
- ondas de choque, flashes, chispas y pulsos de impulso,
- la entrada/salida de paneles, toasts y pantalla de arranque.

**Nunca** se interpola la posición de un cuerpo dinámico: esa posición pertenece al solver. Si Tween.js moviera un cuerpo, la malla y el collider se separarían y las colisiones dejarían de tener sentido.

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| [Three.js](https://threejs.org/) `0.152.1` | Render 3D, materiales PBR, luces, sombras, cámara y `OrbitControls`. |
| [Ammo.js](https://github.com/kripken/ammo.js/) (`ammojs-typed` `1.0.2`) | Motor de física Bullet compilado a JavaScript. Mundo, shapes, cuerpos rígidos, impulsos y contactos. |
| [Tween.js](https://github.com/tweenjs/tween.js/) `18.6.4` | Interpolaciones y efectos visuales. |
| [Parcel](https://parceljs.org/) `1.12.5` | Bundler y servidor de desarrollo del proyecto. |

No se han añadido dependencias nuevas: se utilizan las que ya incluía el proyecto.

---

## Instalación y ejecución

Requisitos: **Node.js** y **npm**.

```bash
npm install
npm start
```

`npm start` ejecuta `parcel ./src/index.html --open`: levanta el servidor de desarrollo y abre el navegador. Es el flujo habitual en NodeBox.

Para generar la versión de producción:

```bash
npm run build
```

El resultado queda en `dist/`.

> El proyecto mantiene el `package.json`, los scripts y la configuración de Parcel originales para no romper la compatibilidad con el entorno de la práctica.

---

## Controles

### Ratón / táctil

| Acción | Resultado |
|---|---|
| Arrastrar con el botón izquierdo | Orbitar la cámara. |
| Rueda / pinza | Zoom. |
| Arrastrar con el botón derecho | Desplazar (pan). |
| Clic sobre un cuerpo | Seleccionarlo y mostrar sus datos. |
| Clic en el vacío | Quitar la selección. |

El selector ignora el clic si has arrastrado más de 6 px, para que orbitar no cambie la selección.

### Teclado

| Tecla | Acción |
|---|---|
| `Espacio` | Pausar / reanudar. |
| `N` | Inyectar un cuerpo del tipo activo. |
| `1` / `2` / `3` | Esfera / cubo / cilindro. |
| `F` | Aplicar impulso al cuerpo seleccionado. |
| `E` | Detonar la explosión radial. |
| `G` | Invertir la gravedad. |
| `R` | Reiniciar el escenario. |
| `C` | Restablecer la cámara. |
| `Esc` | Cerrar el panel móvil o quitar la selección. |

### Interfaz

- **Barra superior**: estado de la simulación, estado del motor Ammo, pausa, vista y reinicio total.
- **Panel izquierdo — Matter Injector**: tipo de cuerpo, despliegue, gravedad (deslizador, presets, inversión), intensidad de detonación, reinicio.
- **Panel derecho — System Monitor**: cuerpos, colisiones, velocidad media, FPS, gravedad, histórico de velocidad y ficha del cuerpo seleccionado.
- En pantallas estrechas ambos paneles se convierten en cajones que se abren desde la barra inferior **LAB / DATA**.

---

## La física en detalle

- **Mundo**: `btDiscreteDynamicsWorld` con `btDbvtBroadphase`, solver `btSequentialImpulseConstraintSolver` y `btDefaultCollisionConfiguration`.
- **Paso**: `stepSimulation(1/60, 2, 1/60)` alimentado por un acumulador externo.
- **Cuerpos**: esferas (`btSphereShape`), cubos (`btBoxShape`) y cilindros (`btCylinderShape`) con masa, inercia calculada, fricción, restitución, *rolling friction* y amortiguación.
- **Suelo y estructuras**: la plataforma, el anillo perimetral, la base del laboratorio y un techo invisible son cuerpos estáticos con colliders coherentes con su geometría. El techo permite experimentar con gravedad invertida sin perder objetos.
- **Gravedad**: se modifica el vector del mundo (`setGravity`) y se despiertan todos los cuerpos. Valores negativos = hacia abajo; positivos = hacia arriba; `0` = entorno de ingravidez.
- **Impulso**: `applyCentralImpulse` + `applyTorqueImpulse`; la magnitud se escala con la masa para que el resultado sea visible en cuerpos pesados sin expulsar los ligeros de forma absurda.
- **Explosión**: impulso radial con caída lineal según la distancia (`radio = 10 m`) y un pequeño componente vertical. La intensidad se controla entre 5 y 60.
- **Límite**: máximo **32 cuerpos**. Al superarlo se retira el más antiguo con una animación de escala y se liberan sus recursos de Ammo.
- **Selección**: raycasting de Three.js contra las mallas; el cuerpo seleccionado se marca con un anillo emisivo que late.

---

## Estructura del proyecto

```
src/
├─ index.html                  Estructura del HUD, overlays y pantalla de arranque
├─ styles.css                  Sistema visual completo (oscuro, responsive)
└─ gravity-lab/
   ├─ main.js                  Arranque de Ammo, composición de sistemas y bucle principal
   ├─ config.js                Constantes: física, cámara, spawn, paletas, UI
   ├─ core/
   │  ├─ PhysicsEngine.js      Mundo Ammo, shapes, cuerpos, contactos, impulsos, limpieza
   │  ├─ LabScene.js           Renderer, escena, luces, plataforma, estructuras, cámara
   │  ├─ BodyFactory.js        Mallas + materiales + shapes de cada cuerpo
   │  ├─ Simulation.js         Orquestación: spawn, paso fijo, selección, explosión, reset
   │  ├─ Effects.js            Efectos con Tween.js (ondas, chispas, flashes, pulsos)
   │  └─ InteractionController.js  Picking por raycasting y cursor
   ├─ ui/
   │  └─ UIController.js       DOM, eventos, teclado, telemetría, paneles, toasts
   └─ utils/
      └─ textures.js           Texturas procedurales generadas con canvas
```

No hay imágenes ni modelos externos: la rejilla, la plataforma, los halos, el anillo de selección y las chispas se generan por código en tiempo de ejecución.

---

## Configuración

Casi todos los valores ajustables están en `src/gravity-lab/config.js`:

- `physics.gravity`, `maxGravity`, `fixedTimeStep`, `maxSubSteps`
- `physics.maxBodies`, `initialBodies`, `explosionRadius`, `explosionDefault`, `impulseStrength`
- `world.platformRadius`, `floorY`, `ceilingY`
- `camera.fov`, posiciones por defecto, distancias mínima/máxima
- `spawn.minY`, `maxY`, `radius`
- `BODY_PALETTES`: colores, emisivos, metalness y roughness de los materiales.

---

## Rendimiento y límites

- El render usa **sombras PCF suaves**, entorno `RoomEnvironment` con PMREM para reflejos metálicos y materiales PBR, pero **sin postprocesado** (nada de composer/bloom). El brillo se consigue con geometría emisiva y sprites aditivos, lo que mantiene el coste bajo y estable.
- Ammo.js es la build **asm.js** de `ammojs-typed` (no WASM), por eso el primer arranque tarda un poco más.
- La simulación está limitada a 32 cuerpos y 5 subpasos por fotograma para evitar espirales de muerte.
- En móvil los paneles se convierten en cajones para no tapar la escena.

---

## Solución de problemas

**La pantalla de arranque se queda parada o aparece “Physics core unavailable”.**
Ammo.js no ha podido inicializarse (navegador sin WebGL, bloqueo de scripts o timeout de 30 s). La pantalla de error muestra el detalle y permite reintentar la secuencia de arranque.

**No veo los paneles laterales.**
En ventanas de menos de 980 px de ancho están ocultos a propósito: ábrelos con los botones **LAB** y **DATA** de la barra inferior.

**Los objetos atraviesan el suelo.**
Comprueba que no has forzado la ventana a un tamaño extremo ni modificado `fixedTimeStep`/`maxSubSteps`. El suelo, el anillo y el techo son colliders estáticos reales.

**`npm start` no abre el navegador.**
Ejecuta `npx parcel src/index.html --open` o abre manualmente la URL que imprime Parcel (por defecto `http://localhost:1234`).

---

## Validación realizada

- `npm install` completado con las dependencias del proyecto.
- `npm run build` genera correctamente el bundle de producción con Parcel.
- Arranque en navegador con Chromium: Ammo.js pasa a **ONLINE**, se renderiza el canvas WebGL y se inyectan los 11 cuerpos iniciales.
- Telemetría comprobada en vivo: contador de cuerpos, **colisiones reales > 0** tras la caída inicial, velocidad media y ~60 FPS.
- Sin errores en consola tras el arranque.
- Controles, explosión, reinicio y comportamiento responsive probados manualmente en el navegador.

> Las cifras concretas dependen del equipo y del navegador; las anteriores son las observadas durante el desarrollo.

---

## Referencias

- Three.js — documentación oficial: <https://threejs.org/docs/>
- Three.js — ejemplos de `OrbitControls` y `RoomEnvironment`.
- Ammo.js — Bullet Physics en JavaScript: <https://github.com/kripken/ammo.js/>
- `ammojs-typed` — tipados y bootstrap: <https://www.npmjs.com/package/ammojs-typed>
- Tween.js — documentación y ejemplos: <https://github.com/tweenjs/tween.js/>
- Parcel — documentación: <https://parceljs.org/>
- Bullet Physics — manual del usuario: <https://github.com/bulletphysics/bullet3>
- Enunciado y material de la asignatura **Informática Gráfica** (ULPGC).

---

## Uso de IA / OpenCode

Este proyecto se ha desarrollado con la ayuda de **OpenCode** como asistente de programación. La IA se utilizó para:

- analizar la estructura existente del repositorio y conservar la compatibilidad con Parcel y los scripts originales;
- proponer y redactar la arquitectura modular (`PhysicsEngine`, `LabScene`, `BodyFactory`, `Simulation`, `Effects`, `UIController`);
- implementar la integración de Ammo.js (paso fijo, shapes, contactos, impulsos) y de Tween.js;
- diseñar la interfaz y el sistema visual;
- detectar y corregir errores de integración (por ejemplo, el shim de `Buffer` de Parcel 1 al cargar Ammo.js, o el ciclo de vida de objetos devueltos por Ammo);

Las decisiones de diseño, la verificación en navegador y la adaptación final al enunciado son responsabilidad del autor.
