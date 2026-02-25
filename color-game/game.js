// 色違いゲーム - Game Logic

const GRID_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10]; // n×n grids (4,9,16,...,100 cells)
const TIME_LIMIT = 5; // seconds per round

let currentStage = 0;   // index into GRID_SIZES
let score = 0;
let bestScore = 0;
let history = [];
let timerInterval = null;
let timeLeft = TIME_LIMIT;
let correctCell = -1;   // index of the odd-colored cell
let gameActive = false;
let roundActive = false;

// ---- Audio (Web Audio API) ----
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playCorrect() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
}

function playWrong() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playTimeout() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(330, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(165, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

// ---- Color helpers ----
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hslToString(h, s, l) {
    return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Generates base color and odd color.
 * Difficulty scales with stage (larger grid → smaller difference).
 */
function generateColors(stage) {
    const h = randomInt(0, 359);
    const s = randomInt(40, 80);
    const l = randomInt(35, 65);

    // Difference decreases as stage increases (harder)
    // stage 0 (2×2): diff ~30,  stage 8 (10×10): diff ~10
    const maxDiff = Math.max(10, 30 - stage * 2);
    const minDiff = Math.max(6, 12 - stage);
    const diff = randomInt(minDiff, maxDiff);
    const sign = Math.random() < 0.5 ? 1 : -1;

    // Vary either lightness or saturation for the odd cell
    let baseColor, oddColor;
    if (Math.random() < 0.5) {
        // Lightness difference
        baseColor = hslToString(h, s, l);
        oddColor = hslToString(h, s, Math.min(95, Math.max(5, l + sign * diff)));
    } else {
        // Saturation difference
        baseColor = hslToString(h, s, l);
        oddColor = hslToString(h, Math.min(95, Math.max(5, s + sign * diff * 1.5)), l);
    }

    return { baseColor, oddColor };
}

// ---- UI helpers ----
function updateScoreUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('best-score').textContent = bestScore;
}

function updateTimerUI() {
    const el = document.getElementById('timer');
    el.textContent = timeLeft;
    el.className = 'timer-value' + (timeLeft <= 2 ? ' danger' : '');
}

function updateStageUI() {
    const n = GRID_SIZES[currentStage];
    document.getElementById('stage').textContent = `${n}×${n}`;
}

// ---- History ----
function loadHistory() {
    try {
        const data = JSON.parse(localStorage.getItem('colorGameHistory') || '[]');
        history = Array.isArray(data) ? data : [];
        bestScore = history.length > 0 ? Math.max(...history) : 0;
    } catch {
        history = [];
        bestScore = 0;
    }
}

function saveHistory() {
    try {
        localStorage.setItem('colorGameHistory', JSON.stringify(history.slice(-20)));
    } catch {}
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    const recent = history.slice(-10).reverse();
    recent.forEach((s, i) => {
        const li = document.createElement('li');
        li.textContent = `${i === 0 ? '🏆 ' : ''}${s} ステージ`;
        if (i === 0) li.classList.add('best');
        list.appendChild(li);
    });
}

// ---- Timer ----
function startTimer() {
    timeLeft = TIME_LIMIT;
    updateTimerUI();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            onTimeout();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// ---- Game flow ----
function startGame() {
    currentStage = 0;
    score = 0;
    gameActive = true;
    document.getElementById('result-screen').classList.add('hidden');
    updateScoreUI();
    startRound();
}

function startRound() {
    roundActive = true;
    updateStageUI();

    const n = GRID_SIZES[currentStage];
    const total = n * n;
    correctCell = randomInt(0, total - 1);

    const { baseColor, oddColor } = generateColors(currentStage);

    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

    for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.backgroundColor = i === correctCell ? oddColor : baseColor;
        cell.dataset.index = i;
        cell.addEventListener('click', onCellClick);
        cell.addEventListener('touchend', onCellTouch, { passive: false });
        grid.appendChild(cell);
    }

    startTimer();
}

function onCellClick(e) {
    if (!roundActive) return;
    const idx = parseInt(e.currentTarget.dataset.index);
    handleAnswer(idx);
}

function onCellTouch(e) {
    e.preventDefault();
    if (!roundActive) return;
    const idx = parseInt(e.currentTarget.dataset.index);
    handleAnswer(idx);
}

function handleAnswer(idx) {
    if (!roundActive) return;
    roundActive = false;
    stopTimer();

    if (idx === correctCell) {
        playCorrect();
        highlightCell(correctCell, true);
        score++; // count total cleared pages
        if (score > bestScore) bestScore = score;
        updateScoreUI();
        currentStage = Math.min(currentStage + 1, GRID_SIZES.length - 1);
        setTimeout(() => {
            startRound();
        }, 600);
    } else {
        playWrong();
        highlightCell(idx, false);
        highlightCell(correctCell, true);
        setTimeout(() => endGame(), 800);
    }
}

function onTimeout() {
    if (!roundActive) return;
    roundActive = false;
    playTimeout();
    highlightCell(correctCell, true);
    setTimeout(() => endGame(), 800);
}

function endGame() {
    gameActive = false;
    history.push(score);
    if (score > bestScore) bestScore = score;
    saveHistory();
    renderHistory();
    updateScoreUI();

    document.getElementById('result-score').textContent = score;
    document.getElementById('result-best').textContent = bestScore;
    document.getElementById('result-screen').classList.remove('hidden');
}

function highlightCell(idx, correct) {
    const cells = document.querySelectorAll('.cell');
    if (cells[idx]) {
        cells[idx].classList.add(correct ? 'correct' : 'wrong');
    }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    renderHistory();
    updateScoreUI();

    document.getElementById('start-btn').addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        startGame();
    });
    document.getElementById('retry-btn').addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        startGame();
    });
});
