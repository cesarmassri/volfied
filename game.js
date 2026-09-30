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
      0.15 + level * 0.008,
      true
    );

    minors = [];
    const minorCount = Math.min(2 + level, 8);
    for (let i = 0; i < minorCount; i++) {
      const angle = (i / minorCount) * Math.PI * 2 + 0.35;
      const x = COLS * (0.28 + (i % 4) * 0.14);
      const y = ROWS * (0.28 + (i % 3) * 0.14);
      const speed = 0.12 + level * 0.006 + (i % 2) * 0.015;
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
      }
      return;
    }

    player.x = nx;
    player.y = ny;

    if (destination === FREE) {
      player.drawing = true;
      setCell(nx, ny, TRAIL);
      player.trail.push({ x: nx, y: ny });
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

  function enemyTouchesTrail(enemy) {
    const radius = enemy.radius + 0.35;
    const minX = Math.floor(enemy.x - radius);
    const maxX = Math.ceil(enemy.x + radius);
    const minY = Math.floor(enemy.y - radius);
    const maxY = Math.ceil(enemy.y + radius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!inBounds(x, y) || getCell(x, y) !== TRAIL) continue;
        const cx = x + 0.5;
        const cy = y + 0.5;
        const dx = enemy.x - cx;
        const dy = enemy.y - cy;
        if (dx * dx + dy * dy <= radius * radius) return true;
      }
    }
    return false;
  }

  function positionIsFree(x, y, radius) {
    const samples = [
      [x - radius, y], [x + radius, y], [x, y - radius], [x, y + radius],
      [x - radius * .7, y - radius * .7], [x + radius * .7, y - radius * .7],
      [x - radius * .7, y + radius * .7], [x + radius * .7, y + radius * .7]
    ];

    return samples.every(([sx, sy]) => {
      const gx = Math.floor(sx);
      const gy = Math.floor(sy);
      return inBounds(gx, gy) && getCell(gx, gy) === FREE;
    });
  }

  function moveEnemy(enemy) {
    if (player.drawing && enemyTouchesTrail(enemy)) {
      loseLife();
      return;
    }

    const nx = enemy.x + enemy.vx;
    if (positionIsFree(nx, enemy.y, enemy.radius)) {
      enemy.x = nx;
    } else {
      enemy.vx *= -1;
    }

    const ny = enemy.y + enemy.vy;
    if (positionIsFree(enemy.x, ny, enemy.radius)) {
      enemy.y = ny;
    } else {
      enemy.vy *= -1;
    }

    if (player.drawing && enemyTouchesTrail(enemy)) loseLife();
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
      `Conquistaste ${claimedPercent().toFixed(1)}% del campo.`,
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
