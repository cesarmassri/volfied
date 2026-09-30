# Territory Splitter

Juego arcade web de conquista territorial, inspirado en la mecánica clásica de **Volfied / Qix**, pero implementado desde cero con gráficos y código propios.

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

Esta regla reproduce la idea importante de que se puede **encerrar y matar enemigos menores**, mientras el enemigo principal determina qué región sigue siendo el campo activo.

## Riesgo

Mientras el trazo está abierto, cualquier enemigo que lo toque hace perder una vida. El trazo incompleto desaparece y el jugador vuelve a una posición segura. Para el jugador, en cambio, su propio trazo abierto funciona como una pared: no puede atravesarlo ni pisarlo, pero tocarlo no cuesta una vida.

## Objetivo

Hay que conquistar al menos **75%** del área interior para superar el nivel.

Cada nivel es más difícil que el anterior:

- el **boss aumenta su velocidad** en cada nivel;
- los **enemigos menores también aceleran** en cada nivel;
- aparece **un enemigo menor adicional por nivel** hasta un máximo de 12;
- después de alcanzar ese máximo, la dificultad sigue creciendo mediante la velocidad;
- los enemigos menores parten con una velocidad suficientemente alta para que los cortes largos sean arriesgados;
- al terminar un nivel, la pantalla indica cuántos enemigos habrá en el siguiente.

## Puntaje

La versión actual otorga:

- `2 puntos` por celda capturada;
- `500 puntos` por enemigo menor encerrado;
- bonificación de `2000 × nivel` al completar un nivel.

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
