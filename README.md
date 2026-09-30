# Territory Splitter

Juego arcade web de conquista territorial, inspirado en la mecánica clásica de **Volfied / Qix**, pero implementado desde cero con gráficos y código propios.

Está preparado para ejecutarse directamente en **GitHub Pages**: no requiere Node.js, bundler, servidor ni dependencias externas.

## Jugar

- **Flechas** o **WASD**: mover.
- **P**: pausa.
- **R**: reiniciar partida.
- En teléfonos y tablets aparecen controles táctiles debajo del tablero.

El jugador comienza sobre una zona segura. Al entrar en el área libre empieza a dejar un trazo. Cuando el trazo vuelve a tocar territorio ya conquistado, el tablero se divide.

### Regla central de captura

El juego distingue entre:

- **Boss**: enemigo principal. La componente conexa de terreno libre que contiene al boss permanece activa.
- **Enemigos menores**: si quedan dentro de una región que pasa a ser conquistada, son eliminados y otorgan puntos.

Cuando se cierra un trazo:

1. El trazo se considera temporalmente una pared.
2. Se ejecuta un *flood fill* desde la posición del boss.
3. Todas las celdas libres alcanzables desde el boss continúan siendo libres.
4. Toda celda libre no alcanzable pasa a ser territorio conquistado.
5. El trazo también pasa a ser territorio conquistado.
6. Los enemigos menores que quedaron dentro de territorio conquistado son eliminados.

En términos de componentes conexas, si el corte produce regiones libres

`C1, C2, ..., Ck`,

se conserva únicamente la componente que contiene al boss. Las demás se capturan.

Esta regla reproduce la idea importante de que se puede **encerrar y matar enemigos menores**, mientras el enemigo principal determina qué región sigue siendo el campo activo.

## Riesgo

Mientras el trazo está abierto, cualquier enemigo que lo toque hace perder una vida. El trazo incompleto desaparece y el jugador vuelve a una posición segura.

## Objetivo

Hay que conquistar al menos **75%** del área interior para superar el nivel.

Cada nivel:

- aumenta de forma perceptible la velocidad de los enemigos;
- agrega enemigos menores, hasta un máximo;
- los enemigos menores parten con una velocidad bastante mayor que en la primera versión, para que los cortes largos sean arriesgados;
- conserva la misma mecánica de captura.

## Puntaje

La versión actual otorga:

- `2 puntos` por celda capturada;
- `500 puntos` por enemigo menor encerrado;
- bonificación de `2000 × nivel` al completar un nivel.

## Estructura

```text
territory-splitter/
├── index.html
├── style.css
├── game.js
└── README.md
```

### `index.html`

Contiene la interfaz, el `canvas`, HUD, instrucciones y controles táctiles.

### `style.css`

Diseño responsive. No usa frameworks ni fuentes remotas. El tablero se muestra con un ancho máximo de 860 px para que entre mejor en una ventana de navegador estándar sin alterar su resolución interna de 960 × 600.

### `game.js`

Contiene todo el motor:

- grilla del tablero;
- movimiento del jugador;
- construcción y cierre del trazo;
- flood fill desde el boss;
- captura de regiones;
- eliminación de enemigos menores;
- colisiones enemigo-trazo;
- porcentaje conquistado;
- niveles, vidas y puntuación;
- renderizado en Canvas 2D.

## Modelo del tablero

Cada celda tiene uno de tres estados:

```js
FREE    = 0 // región donde pueden moverse los enemigos
CLAIMED = 1 // territorio seguro conquistado
TRAIL   = 2 // trazo abierto del jugador
```

La representación discreta simplifica mucho el problema geométrico. No hace falta calcular intersecciones entre polígonos para determinar qué lado del corte debe rellenarse.

## Algoritmo de flood fill

Conceptualmente:

```text
reachable = flood_fill(boss.position)

para cada celda libre:
    si celda no está en reachable:
        celda = CLAIMED

para cada celda del trazo:
    celda = CLAIMED

para cada enemigo menor:
    si su posición quedó en CLAIMED:
        eliminar enemigo
```

El `TRAIL` y las celdas `CLAIMED` funcionan como paredes durante el flood fill.

## Ejecutar localmente

Como no hay módulos ni peticiones HTTP, normalmente alcanza con abrir `index.html` en el navegador.

También se puede usar cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
```

Y abrir:

```text
http://localhost:8000
```

## Publicar en GitHub Pages

1. Crear un repositorio nuevo en GitHub.
2. Copiar los archivos del proyecto a la raíz del repositorio.
3. Hacer commit y push a la rama principal.
4. En GitHub abrir **Settings → Pages**.
5. En **Build and deployment**, elegir **Deploy from a branch**.
6. Elegir la rama `main` y la carpeta `/ (root)`.
7. Guardar.

GitHub publicará el juego como un sitio estático.

## Ideas para ampliar

- dos modos de corte: lento/rápido con distinto puntaje;
- enemigos que circulen por la frontera conquistada;
- power-ups;
- patrones de movimiento diferentes para cada enemigo;
- sprites y animaciones originales;
- sonido y música;
- pantalla de título;
- récord local con `localStorage`;
- niveles diseñados manualmente;
- bosses con comportamientos distintos;
- soporte para gamepad;
- opción para cambiar el porcentaje objetivo.

## Nota sobre Volfied

Este proyecto no contiene ROMs, código, música, sprites, logos ni otros recursos del juego original. La implementación utiliza únicamente una mecánica de juego general de conquista territorial y recursos creados para este proyecto.

**Volfied** es una marca/título asociado a sus respectivos titulares. Este repositorio no pretende ser una distribución del juego original.

## Licencia sugerida

El código original de este proyecto puede publicarse bajo MIT. Si se agregan recursos externos (música, imágenes, tipografías, etc.), revisar por separado sus licencias antes de distribuirlos.
