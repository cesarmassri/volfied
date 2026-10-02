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

Mientras el trazo está abierto, **cualquier contacto con la traza hace perder una vida**:

- si el **boss** toca la traza, se pierde una vida;
- si un **enemigo menor** toca la traza, se pierde una vida;
- si el **jugador** vuelve a tocar una parte ya dibujada de su propia traza, también se pierde una vida.

Al perder una vida, el trazo incompleto desaparece y el jugador vuelve a una posición segura. La colisión de los enemigos se comprueba a lo largo de todo su desplazamiento entre ticks para que un enemigo rápido no pueda atravesar la traza sin ser detectado.

## Objetivo

Hay que conquistar al menos **75%** del área interior para superar el nivel.

Cada nivel es más difícil que el anterior:

- el **boss aumenta su velocidad** en `0.04` celdas por tick en cada nivel;
- los **enemigos menores aumentan su velocidad** en `0.045` celdas por tick en cada nivel;
- aparece **un enemigo menor adicional por nivel** hasta un máximo de 12;
- después de alcanzar ese máximo, la dificultad sigue creciendo mediante la velocidad;
- los enemigos menores parten con una velocidad suficientemente alta para que los cortes largos sean arriesgados;
- al terminar un nivel, la pantalla indica cuántos enemigos habrá en el siguiente.


El `TRAIL` y las celdas `CLAIMED` funcionan como paredes durante el flood fill.
