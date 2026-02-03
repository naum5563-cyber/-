const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const levelEl = document.getElementById("level");
const speedLabel = document.getElementById("speedLabel");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayDesc = document.getElementById("overlayDesc");
const bestScoreEl = document.getElementById("bestScore");
const bestModeEl = document.getElementById("bestMode");

const modeSelect = document.getElementById("mode");
const gridSelect = document.getElementById("grid");
const speedSelect = document.getElementById("speed");
const themeSelect = document.getElementById("theme");
const soundToggle = document.getElementById("sound");
const particlesToggle = document.getElementById("particles");

const controlButtons = document.querySelectorAll(".controls button");

const STATE = {
  grid: 22,
  speed: 1,
  mode: "classic",
  theme: "neo",
  running: false,
  paused: false,
  score: 0,
  combo: 1,
  level: 1,
  tickInterval: 120,
  boost: false,
  ghost: 0,
  slow: 0,
};

const COLORS = {
  neo: {
    board: "#0d1020",
    grid: "#1a2040",
    snake: "#7df9ff",
    head: "#ffbe0b",
    food: "#ff5470",
    golden: "#ffd166",
    slow: "#4cc9f0",
    shrink: "#b5179e",
    ghost: "#80ffdb",
    obstacle: "#ff5e5b",
    text: "#eef1ff",
  },
  classic: {
    board: "#0b0e1a",
    grid: "#283036",
    snake: "#9fe870",
    head: "#ffd166",
    food: "#ff8fab",
    golden: "#ffd166",
    slow: "#90e0ef",
    shrink: "#f72585",
    ghost: "#80ffdb",
    obstacle: "#f07167",
    text: "#f8f9fa",
  },
  forest: {
    board: "#0c1f17",
    grid: "#1d3a2b",
    snake: "#74c69d",
    head: "#ffb703",
    food: "#ef476f",
    golden: "#ffd166",
    slow: "#4cc9f0",
    shrink: "#7209b7",
    ghost: "#80ffdb",
    obstacle: "#f77f00",
    text: "#e9f5e9",
  },
};

const EFFECTS = {
  particles: [],
};

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = null;
let special = null;
let obstacles = [];
let lastFrame = 0;
let animationId = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const bonusTypes = ["golden", "slow", "shrink", "ghost"];

function playTone(frequency, duration = 0.08, type = "sine") {
  if (!soundToggle.checked || audioCtx.state === "suspended") {
    return;
  }
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.value = 0.08;
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  oscillator.stop(audioCtx.currentTime + duration);
}

function vibrate(pattern) {
  if (soundToggle.checked && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function resetGame() {
  const center = Math.floor(STATE.grid / 2);
  snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  STATE.score = 0;
  STATE.combo = 1;
  STATE.level = 1;
  STATE.tickInterval = 120 / STATE.speed;
  STATE.boost = false;
  STATE.ghost = 0;
  STATE.slow = 0;
  obstacles = [];
  EFFECTS.particles = [];
  spawnFood();
  spawnSpecial();
  spawnObstacles();
  updateUI();
  showOverlay("Готовы?", "Нажмите «Старт» или пробел.");
}

function showOverlay(title, desc) {
  overlayTitle.textContent = title;
  overlayDesc.textContent = desc;
  overlay.classList.add("active");
}

function hideOverlay() {
  overlay.classList.remove("active");
}

function updateUI() {
  scoreEl.textContent = STATE.score;
  comboEl.textContent = `x${STATE.combo}`;
  levelEl.textContent = STATE.level;
  speedLabel.textContent = `${(STATE.tickInterval / 120).toFixed(2)}x`;
}

function spawnFood() {
  food = randomEmptyCell();
}

function spawnSpecial() {
  if (Math.random() < 0.5) {
    special = null;
    return;
  }
  const type = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
  special = { ...randomEmptyCell(), type, ttl: 140 };
}

function spawnObstacles() {
  if (STATE.mode !== "obstacles") {
    obstacles = [];
    return;
  }
  const count = Math.floor(STATE.grid / 3);
  obstacles = [];
  for (let i = 0; i < count; i += 1) {
    obstacles.push(randomEmptyCell());
  }
}

function randomEmptyCell() {
  let cell;
  let safe = false;
  while (!safe) {
    cell = {
      x: Math.floor(Math.random() * STATE.grid),
      y: Math.floor(Math.random() * STATE.grid),
    };
    safe =
      !snake.some((seg) => seg.x === cell.x && seg.y === cell.y) &&
      !obstacles.some((obs) => obs.x === cell.x && obs.y === cell.y) &&
      (!food || food.x !== cell.x || food.y !== cell.y) &&
      (!special || special.x !== cell.x || special.y !== cell.y);
  }
  return cell;
}

function handleInput(dx, dy) {
  if (STATE.paused) {
    return;
  }
  if (direction.x === -dx && direction.y === -dy) {
    return;
  }
  nextDirection = { x: dx, y: dy };
}

function handleEat(type) {
  const effects = {
    food: { score: 1, combo: 1, speed: 0 },
    golden: { score: 3, combo: 2, speed: -12 },
    slow: { score: 1, combo: 1, speed: 20 },
    shrink: { score: 1, combo: 1, shrink: 2 },
    ghost: { score: 2, combo: 1, ghost: 80 },
  };
  const result = effects[type];
  if (!result) {
    return;
  }
  STATE.score += result.score * STATE.combo;
  STATE.combo = Math.min(8, STATE.combo + result.combo);
  if (result.speed) {
    STATE.tickInterval = Math.max(60, STATE.tickInterval + result.speed);
  }
  if (result.shrink) {
    snake.splice(-result.shrink);
  }
  if (result.ghost) {
    STATE.ghost = result.ghost;
  }
  if (type === "food") {
    spawnFood();
  } else {
    spawnSpecial();
  }
  if (type !== "slow") {
    playTone(520, 0.1, "triangle");
    vibrate([40, 20, 40]);
  } else {
    playTone(220, 0.12, "sine");
  }
  if (particlesToggle.checked) {
    spawnParticles(type);
  }
}

function spawnParticles(type) {
  const colorMap = {
    food: "#ff5470",
    golden: "#ffd166",
    slow: "#4cc9f0",
    shrink: "#b5179e",
    ghost: "#80ffdb",
  };
  const head = snake[0];
  for (let i = 0; i < 14; i += 1) {
    EFFECTS.particles.push({
      x: head.x + 0.5,
      y: head.y + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      life: 30,
      color: colorMap[type],
    });
  }
}

function levelUp() {
  const target = 5 + STATE.level * 3;
  if (STATE.score >= target) {
    STATE.level += 1;
    STATE.tickInterval = Math.max(50, STATE.tickInterval - 6);
    playTone(720, 0.15, "sawtooth");
    vibrate([80, 40, 80]);
  }
}

function checkCollision(head) {
  if (STATE.mode !== "wrap") {
    if (head.x < 0 || head.x >= STATE.grid || head.y < 0 || head.y >= STATE.grid) {
      return true;
    }
  }
  if (STATE.mode === "wrap") {
    head.x = (head.x + STATE.grid) % STATE.grid;
    head.y = (head.y + STATE.grid) % STATE.grid;
  }
  if (!STATE.ghost) {
    for (let i = 1; i < snake.length; i += 1) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        return true;
      }
    }
  }
  if (obstacles.some((obs) => obs.x === head.x && obs.y === head.y)) {
    return true;
  }
  return false;
}

function gameOver() {
  STATE.running = false;
  STATE.paused = false;
  overlay.classList.add("active");
  showOverlay("Игра окончена", "Нажмите «Старт», чтобы попробовать снова.");
  playTone(160, 0.2, "square");
  vibrate([120, 60, 120]);
  updateBestScore();
}

function updateBestScore() {
  const key = `snake-best-${STATE.mode}`;
  const best = Number(localStorage.getItem(key) || 0);
  if (STATE.score > best) {
    localStorage.setItem(key, String(STATE.score));
  }
  const overallBest = Object.keys(localStorage)
    .filter((item) => item.startsWith("snake-best"))
    .reduce((max, item) => Math.max(max, Number(localStorage.getItem(item))), 0);
  bestScoreEl.textContent = overallBest;
  bestModeEl.textContent = STATE.mode;
}

function tick() {
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  if (checkCollision(head)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  let ate = false;
  if (food && head.x === food.x && head.y === food.y) {
    handleEat("food");
    ate = true;
  }
  if (special && head.x === special.x && head.y === special.y) {
    handleEat(special.type);
    ate = true;
  }

  if (!ate) {
    snake.pop();
    STATE.combo = Math.max(1, STATE.combo - 0.05);
  }

  if (special) {
    special.ttl -= 1;
    if (special.ttl <= 0) {
      spawnSpecial();
    }
  }

  if (STATE.ghost > 0) {
    STATE.ghost -= 1;
  }

  if (STATE.slow > 0) {
    STATE.slow -= 1;
  }

  levelUp();
  updateUI();
}

function update(delta) {
  if (!STATE.running || STATE.paused) {
    return;
  }
  const interval = STATE.tickInterval / (STATE.boost ? 1.7 : 1);
  if (delta - lastFrame >= interval) {
    tick();
    lastFrame = delta;
  }
}

function drawGrid() {
  const theme = COLORS[STATE.theme];
  ctx.fillStyle = theme.board;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  const cellSize = canvas.width / STATE.grid;
  for (let i = 0; i <= STATE.grid; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(canvas.width, i * cellSize);
    ctx.stroke();
  }
}

function drawCell(cell, color, glow = true, radius = 6) {
  const cellSize = canvas.width / STATE.grid;
  const pad = cellSize * 0.08;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow ? 16 : 0;
  const x = cell.x * cellSize + pad;
  const y = cell.y * cellSize + pad;
  const size = cellSize - pad * 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, size, size, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    ctx.lineTo(x + radius, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawSnake() {
  const theme = COLORS[STATE.theme];
  snake.forEach((segment, index) => {
    const isHead = index === 0;
    drawCell(segment, isHead ? theme.head : theme.snake, true, isHead ? 12 : 6);
  });
}

function drawFood() {
  const theme = COLORS[STATE.theme];
  if (food) {
    drawCell(food, theme.food, true, 10);
  }
  if (special) {
    drawCell(special, theme[special.type], true, 12);
  }
}

function drawObstacles() {
  const theme = COLORS[STATE.theme];
  obstacles.forEach((obs) => drawCell(obs, theme.obstacle, false, 4));
}

function drawParticles() {
  const cellSize = canvas.width / STATE.grid;
  EFFECTS.particles.forEach((particle) => {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life / 30);
    ctx.beginPath();
    ctx.arc(
      particle.x * cellSize,
      particle.y * cellSize,
      cellSize * 0.1,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  EFFECTS.particles = EFFECTS.particles.filter((particle) => particle.life > 0);
}

function updateParticles() {
  EFFECTS.particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 1;
  });
}

function render() {
  drawGrid();
  drawObstacles();
  drawFood();
  drawSnake();
  if (particlesToggle.checked) {
    drawParticles();
  }
}

function loop(timestamp) {
  update(timestamp);
  updateParticles();
  render();
  animationId = requestAnimationFrame(loop);
}

function startGame() {
  if (!STATE.running) {
    resetGame();
  }
  hideOverlay();
  STATE.running = true;
  STATE.paused = false;
  lastFrame = performance.now();
  playTone(440, 0.1, "triangle");
  if (!animationId) {
    animationId = requestAnimationFrame(loop);
  }
}

function togglePause() {
  if (!STATE.running) {
    return;
  }
  STATE.paused = !STATE.paused;
  if (STATE.paused) {
    showOverlay("Пауза", "Нажмите пробел, чтобы продолжить.");
  } else {
    hideOverlay();
    lastFrame = performance.now();
  }
}

function applySettings() {
  STATE.grid = Number(gridSelect.value);
  STATE.speed = Number(speedSelect.value);
  STATE.mode = modeSelect.value;
  STATE.theme = themeSelect.value;
  STATE.tickInterval = 120 / STATE.speed;
  document.documentElement.className = `theme-${STATE.theme}`;
  resetGame();
}

function handleKey(event) {
  switch (event.key) {
    case "ArrowUp":
    case "w":
    case "W":
      handleInput(0, -1);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      handleInput(0, 1);
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      handleInput(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      handleInput(1, 0);
      break;
    case " ":
      togglePause();
      break;
    case "Shift":
      STATE.boost = true;
      break;
    default:
      break;
  }
}

function handleKeyUp(event) {
  if (event.key === "Shift") {
    STATE.boost = false;
  }
}

function registerEvents() {
  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);
  resetBtn.addEventListener("click", resetGame);
  modeSelect.addEventListener("change", applySettings);
  gridSelect.addEventListener("change", applySettings);
  speedSelect.addEventListener("change", applySettings);
  themeSelect.addEventListener("change", applySettings);
  window.addEventListener("keydown", handleKey);
  window.addEventListener("keyup", handleKeyUp);
  controlButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const dir = button.dataset.dir;
      if (dir === "up") handleInput(0, -1);
      if (dir === "down") handleInput(0, 1);
      if (dir === "left") handleInput(-1, 0);
      if (dir === "right") handleInput(1, 0);
    });
  });
  overlay.addEventListener("click", startGame);
}

function init() {
  applySettings();
  updateBestScore();
  registerEvents();
  loop(0);
}

init();
