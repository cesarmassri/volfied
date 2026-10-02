(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ui = {
    level: document.getElementById('level'),
    lives: document.getElementById('lives'),
    claimed: document.getElementById('claimed'),
    target: document.getElementById('target'),
    score: document.getElementById('score'),
    restartBtn: document.getElementById('restartBtn'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'),
    overlayBtn: document.getElementById('overlayBtn')
  };

  const COLS = 96;
  const ROWS = 60;
  const CELL = canvas.width / COLS;
  const TARGET_PERCENT = 75;
  const TICK_MS = 28;

  // Velocidades en celdas por tick. Los enemigos menores son
  // deliberadamente más rápidos para que cortar áreas grandes tenga riesgo.
  const BOSS_BASE_SPEED = 0.19;
  const BOSS_LEVEL_SPEED = 0.04;
  const MINOR_BASE_SPEED = 0.275;
  const MINOR_LEVEL_SPEED = 0.045;
  const MINOR_SPEED_VARIATION = 0.04;
  const MAX_MINOR_ENEMIES = 12;

  const FREE = 0;
  const CLAIMED = 1;
  const TRAIL = 2;

  const COLORS = {
    background: '#06080d',
    free: '#0b1320',
    claimed: '#24555f',
    claimedGrid: '#2d6672',
    trail: '#f3d45b',
    player: '#ffffff',
    boss: '#ff5d73',
    minor: '#70d7ff',
    text: '#dce7f7'
  };

  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  let grid;
  let player;
  let boss;
  let minors;
  let level = 1;
  let lives = 3;
  let score = 0;
  let paused = false;
  let gameOver = false;
  let levelTransition = false;
  let inputDir = null;
  let lastTick = 0;

  function idx(x, y) {
    return y * COLS + x;
  }

  function inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  function getCell(x, y) {
    return inBounds(x, y) ? grid[idx(x, y)] : CLAIMED;
  }

  function setCell(x, y, value) {
    if (inBounds(x, y)) grid[idx(x, y)] = value;
  }

  function buildBoard() {
    grid = new Uint8Array(COLS * ROWS);

    for (let x = 0; x < COLS; x++) {
      setCell(x, 0, CLAIMED);
      setCell(x, ROWS - 1, CLAIMED);
    }
    for (let y = 0; y < ROWS; y++) {
      setCell(0, y, CLAIMED);
      setCell(COLS - 1, y, CLAIMED);
    }

    player = {
      x: Math.floor(COLS / 2),
      y: ROWS - 1,
      drawing: false,
      trail: []
    };

    boss = makeEnemy(
      COLS * 0.5,
      ROWS * 0.36,
      BOSS_BASE_SPEED + (level - 1) * BOSS_LEVEL_SPEED,
      true
    );

    minors = [];
    // Cada nivel agrega un enemigo menor hasta alcanzar el máximo.
    // Incluso después del máximo, la velocidad sigue aumentando.
    const minorCount = Math.min(2 + level, MAX_MINOR_ENEMIES);
    for (let i = 0; i < minorCount; i++) {
      const angle = (i / minorCount) * Math.PI * 2 + 0.35;
      const x = COLS * (0.28 + (i % 4) * 0.14);
      const y = ROWS * (0.28 + (i % 3) * 0.14);
      const speed =
        MINOR_BASE_SPEED +
        (level - 1) * MINOR_LEVEL_SPEED +
        (i % 3) * (MINOR_SPEED_VARIATION / 2);
      minors.push({
        ...makeEnemy(x, y, speed, false),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
      });
    }

    inputDir = null;
    levelTransition = false;
    updateHud();
  }

  function makeEnemy(x, y, speed, isBoss) {
    const angle = Math.random() * Math.PI * 2;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: isBoss ? 1.25 : 0.78,
      isBoss
    };
  }

  function resetGame() {
    level = 1;
    lives = 3;
    score = 0;
    paused = false;
    gameOver = false;
    hideOverlay();
    buildBoard();
  }

  function clearOpenTrail() {
    for (const p of player.trail) {
      if (getCell(p.x, p.y) === TRAIL) setCell(p.x, p.y, FREE);
    }
    player.trail = [];
    player.drawing = false;
  }

  function loseLife() {
    if (gameOver || levelTransition) return;

    lives -= 1;
    clearOpenTrail();
    player.x = Math.floor(COLS / 2);
    player.y = ROWS - 1;
    inputDir = null;

    if (lives <= 0) {
      lives = 0;
      gameOver = true;
      showOverlay('Fin de partida', `Puntaje final: ${score}.`, 'Jugar de nuevo');
    }
    updateHud();
  }

  function movePlayer() {
    if (!inputDir || gameOver || levelTransition) return;

    const d = directions[inputDir];
    const nx = player.x + d.x;
    const ny = player.y + d.y;
    if (!inBounds(nx, ny)) return;

    const destination = getCell(nx, ny);

    if (player.drawing) {
      // Tocar cualquier parte ya dibujada del trazo abierto cuesta una vida.
      // Esto incluye retroceder sobre la propia traza o cruzarla.
      if (destination === TRAIL) {
        loseLife();
        return;
      }

      player.x = nx;
      player.y = ny;

      if (destination === CLAIMED) {
        closeRegion();
      } else if (destination === FREE) {
        setCell(nx, ny, TRAIL);
        player.trail.push({ x: nx, y: ny });
        // La traza recién creada también puede aparecer debajo del boss o de
        // un enemigo menor. El contacto mata antes de esperar su próximo movimiento.
        if (anyEnemyTouchesTrail()) {
          loseLife();
          return;
        }
      }
      return;
    }

    player.x = nx;
    player.y = ny;

    if (destination === FREE) {
      player.drawing = true;
      setCell(nx, ny, TRAIL);
      player.trail.push({ x: nx, y: ny });
      // Si al crear esta primera celda la traza toca un enemigo, se pierde
      // inmediatamente la vida.
      if (anyEnemyTouchesTrail()) {
        loseLife();
        return;
      }
    }
  }

  function closeRegion() {
    if (!player.drawing || player.trail.length === 0) return;

    // El trazo es una pared temporal. Conservamos únicamente la componente
    // libre que contiene al boss. Las demás componentes pasan a CLAIMED.
    const reachable = floodFromBoss();
    let captured = 0;

    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const i = idx(x, y);
        if (grid[i] === FREE && !reachable[i]) {
          grid[i] = CLAIMED;
          captured += 1;
        }
      }
    }

    for (const p of player.trail) {
      if (getCell(p.x, p.y) === TRAIL) {
        setCell(p.x, p.y, CLAIMED);
        captured += 1;
      }
    }

    player.trail = [];
    player.drawing = false;

    let killed = 0;
    minors = minors.filter(enemy => {
      const ex = Math.max(0, Math.min(COLS - 1, Math.floor(enemy.x)));
      const ey = Math.max(0, Math.min(ROWS - 1, Math.floor(enemy.y)));
      const dead = getCell(ex, ey) === CLAIMED;
      if (dead) killed += 1;
      return !dead;
    });

    score += captured * 2 + killed * 500;
    updateHud();

    if (claimedPercent() >= TARGET_PERCENT) {
      completeLevel();
    }
  }

  function floodFromBoss() {
    const reachable = new Uint8Array(COLS * ROWS);
    const startX = Math.max(1, Math.min(COLS - 2, Math.floor(boss.x)));
    const startY = Math.max(1, Math.min(ROWS - 2, Math.floor(boss.y)));

    // Si el boss quedó exactamente sobre una frontera por redondeo, buscamos
    // la celda libre más próxima para iniciar la inundación.
    let sx = startX;
    let sy = startY;
    if (getCell(sx, sy) !== FREE) {
      outer:
      for (let r = 1; r <= 4; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const tx = startX + dx;
            const ty = startY + dy;
            if (inBounds(tx, ty) && getCell(tx, ty) === FREE) {
              sx = tx;
              sy = ty;
              break outer;
            }
          }
        }
      }
    }

    if (getCell(sx, sy) !== FREE) return reachable;

    const qx = new Int16Array(COLS * ROWS);
    const qy = new Int16Array(COLS * ROWS);
    let head = 0;
    let tail = 0;

    qx[tail] = sx;
    qy[tail] = sy;
    tail++;
    reachable[idx(sx, sy)] = 1;

    const steps = [[1,0],[-1,0],[0,1],[0,-1]];

    while (head < tail) {
      const x = qx[head];
      const y = qy[head];
      head++;

      for (const [dx, dy] of steps) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const i = idx(nx, ny);
        if (!reachable[i] && grid[i] === FREE) {
          reachable[i] = 1;
          qx[tail] = nx;
          qy[tail] = ny;
          tail++;
        }
      }
    }

    return reachable;
  }

  // Colisión exacta entre el círculo de un enemigo y una celda cuadrada.
  // Usar el cuadrado completo es importante: antes la detección de TRAIL
  // aproximaba cada celda por su centro, mientras el rebote usaba la celda
  // completa. Eso permitía que un enemigo rebotara en un borde/esquina del
  // trazo sin que se registrara la muerte del jugador.
  function circleIntersectsCell(x, y, radius, gx, gy) {
    const closestX = Math.max(gx, Math.min(x, gx + 1));
    const closestY = Math.max(gy, Math.min(y, gy + 1));
    const dx = x - closestX;
    const dy = y - closestY;
    return dx * dx + dy * dy <= radius * radius + 1e-9;
  }

  function circleTouchesTrail(x, y, radius) {
    const minX = Math.floor(x - radius) - 1;
    const maxX = Math.ceil(x + radius) + 1;
    const minY = Math.floor(y - radius) - 1;
    const maxY = Math.ceil(y + radius) + 1;

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        if (!inBounds(gx, gy) || getCell(gx, gy) !== TRAIL) continue;
        if (circleIntersectsCell(x, y, radius, gx, gy)) return true;
      }
    }
    return false;
  }

  function enemyTouchesTrail(enemy) {
    return circleTouchesTrail(enemy.x, enemy.y, enemy.radius);
  }

  function anyEnemyTouchesTrail() {
    if (!player.drawing) return false;
    if (enemyTouchesTrail(boss)) return true;
    return minors.some(enemyTouchesTrail);
  }

  // Comprueba todo el segmento recorrido entre dos posiciones. Así un enemigo
  // rápido no puede "saltar" una celda de TRAIL entre dos ticks.
  function sweptCircleTouchesTrail(x0, y0, x1, y1, radius) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / 0.08));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      if (circleTouchesTrail(x, y, radius)) return true;
    }
    return false;
  }

  // La misma geometría exacta se usa para las paredes CLAIMED. De este modo
  // "tocar TRAIL" y "chocar con pared" no pueden discrepar geométricamente.
  function positionIsFree(x, y, radius) {
    const minX = Math.floor(x - radius) - 1;
    const maxX = Math.ceil(x + radius) + 1;
    const minY = Math.floor(y - radius) - 1;
    const maxY = Math.ceil(y + radius) + 1;

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        if (!inBounds(gx, gy)) return false;
        if (getCell(gx, gy) !== FREE && circleIntersectsCell(x, y, radius, gx, gy)) {
          return false;
        }
      }
    }
    return true;
  }

  // Igual que la detección de TRAIL, comprobamos toda la trayectoria para que
  // las velocidades altas de niveles avanzados tampoco atraviesen paredes
  // CLAIMED por tunneling.
  function sweptPositionIsFree(x0, y0, x1, y1, radius) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / 0.12));

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!positionIsFree(x0 + dx * t, y0 + dy * t, radius)) return false;
    }
    return true;
  }

  function moveEnemy(enemy) {
    // El TRAIL nunca es una pared segura: cualquier contacto del boss o de
    // un enemigo menor con la traza abierta cuesta una vida. La comprobación
    // es continua a lo largo de cada desplazamiento para evitar tunneling.
    if (player.drawing && enemyTouchesTrail(enemy)) {
      loseLife();
      return;
    }

    const startX = enemy.x;
    const startY = enemy.y;
    const nx = startX + enemy.vx;

    if (player.drawing &&
        sweptCircleTouchesTrail(startX, startY, nx, startY, enemy.radius)) {
      loseLife();
      return;
    }

    if (sweptPositionIsFree(startX, startY, nx, startY, enemy.radius)) {
      enemy.x = nx;
    } else {
      enemy.vx *= -1;
    }

    const beforeY = enemy.y;
    const ny = beforeY + enemy.vy;
    if (player.drawing &&
        sweptCircleTouchesTrail(enemy.x, beforeY, enemy.x, ny, enemy.radius)) {
      loseLife();
      return;
    }

    if (sweptPositionIsFree(enemy.x, beforeY, enemy.x, ny, enemy.radius)) {
      enemy.y = ny;
    } else {
      enemy.vy *= -1;
    }

    if (player.drawing && enemyTouchesTrail(enemy)) {
      loseLife();
    }
  }

  function claimedPercent() {
    let claimed = 0;
    const interior = (COLS - 2) * (ROWS - 2);
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (getCell(x, y) === CLAIMED) claimed++;
      }
    }
    return (claimed / interior) * 100;
  }

  function completeLevel() {
    if (levelTransition) return;
    levelTransition = true;
    score += 2000 * level;
    updateHud();
    showOverlay(
      `Nivel ${level} completado`,
      `Conquistaste ${claimedPercent().toFixed(1)}% del campo. El nivel ${level + 1} tendrá un boss más rápido y ${Math.min(2 + level + 1, MAX_MINOR_ENEMIES)} enemigos menores.`,
      'Siguiente nivel'
    );
  }

  function nextLevel() {
    level += 1;
    hideOverlay();
    buildBoard();
  }

  function showOverlay(title, text, buttonText) {
    ui.overlayTitle.textContent = title;
    ui.overlayText.textContent = text;
    ui.overlayBtn.textContent = buttonText;
    ui.overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    ui.overlay.classList.add('hidden');
  }

  function togglePause() {
    if (gameOver || levelTransition) return;
    paused = !paused;
    if (paused) showOverlay('Pausa', 'El juego está pausado.', 'Continuar');
    else hideOverlay();
  }

  function updateHud() {
    ui.level.textContent = level;
    ui.lives.textContent = lives;
    ui.claimed.textContent = `${claimedPercent().toFixed(1)}%`;
    ui.target.textContent = `${TARGET_PERCENT}%`;
    ui.score.textContent = score.toLocaleString('es-AR');
  }

  function drawBoard() {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const state = getCell(x, y);
        if (state === FREE) continue;
        ctx.fillStyle = state === CLAIMED ? COLORS.claimed : COLORS.trail;
        ctx.fillRect(x * CELL, y * CELL, CELL + 0.25, CELL + 0.25);
      }
    }

    // Sutil textura sobre el territorio conquistado.
    ctx.strokeStyle = COLORS.claimedGrid;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, canvas.height);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawEnemy(enemy) {
    const px = enemy.x * CELL;
    const py = enemy.y * CELL;
    const r = enemy.radius * CELL;

    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = enemy.isBoss ? COLORS.boss : COLORS.minor;
    ctx.beginPath();
    if (enemy.isBoss) {
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const rr = i % 2 === 0 ? r : r * 0.52;
        const x = Math.cos(angle) * rr;
        const y = Math.sin(angle) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = '#10131a';
    ctx.beginPath();
    ctx.arc(-r * .25, -r * .12, Math.max(1.5, r * .12), 0, Math.PI * 2);
    ctx.arc(r * .25, -r * .12, Math.max(1.5, r * .12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    const px = (player.x + 0.5) * CELL;
    const py = (player.y + 0.5) * CELL;
    const r = CELL * .55;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(-r * .6, -r * .6, r * 1.2, r * 1.2);
    ctx.restore();
  }

  function draw() {
    drawBoard();
    drawEnemy(boss);
    for (const enemy of minors) drawEnemy(enemy);
    drawPlayer();

    if (player.drawing) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('TRAZO ABIERTO', 18, 30);
    }
  }

  function update() {
    movePlayer();
    if (gameOver || levelTransition) return;

    moveEnemy(boss);
    if (gameOver || levelTransition) return;

    for (const enemy of minors) {
      moveEnemy(enemy);
      if (gameOver || levelTransition) return;
    }
  }

  function frame(timestamp) {
    if (!lastTick) lastTick = timestamp;
    if (!paused && !gameOver && !levelTransition && timestamp - lastTick >= TICK_MS) {
      const steps = Math.min(3, Math.floor((timestamp - lastTick) / TICK_MS));
      for (let i = 0; i < steps; i++) update();
      lastTick = timestamp;
    }
    draw();
    requestAnimationFrame(frame);
  }

  function keyToDirection(key) {
    const k = key.toLowerCase();
    if (k === 'arrowup' || k === 'w') return 'up';
    if (k === 'arrowdown' || k === 's') return 'down';
    if (k === 'arrowleft' || k === 'a') return 'left';
    if (k === 'arrowright' || k === 'd') return 'right';
    return null;
  }

  window.addEventListener('keydown', event => {
    const dir = keyToDirection(event.key);
    if (dir) {
      event.preventDefault();
      inputDir = dir;
      return;
    }

    if (event.key.toLowerCase() === 'p') togglePause();
    if (event.key.toLowerCase() === 'r') resetGame();
  });

  window.addEventListener('keyup', event => {
    const dir = keyToDirection(event.key);
    if (dir === inputDir) inputDir = null;
  });

  document.querySelectorAll('[data-dir]').forEach(button => {
    const dir = button.dataset.dir;
    const start = event => {
      event.preventDefault();
      inputDir = dir;
    };
    const stop = event => {
      event.preventDefault();
      if (inputDir === dir) inputDir = null;
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('pointerleave', stop);
  });

  ui.restartBtn.addEventListener('click', resetGame);
  ui.overlayBtn.addEventListener('click', () => {
    if (gameOver) resetGame();
    else if (levelTransition) nextLevel();
    else if (paused) togglePause();
  });

  buildBoard();
  requestAnimationFrame(frame);
})();
