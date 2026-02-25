// 色違いゲーム - Game Logic

const GRID_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10]; // n×n grids (4,9,16,...,100 cells)
const TIME_LIMIT = 5; // seconds per round

let currentStage = 0;   // index into GRID_SIZES
let score = 0;
let bestScore = 0;
let timerInterval = null;
let timeLeft = TIME_LIMIT;
let correctCell = -1;   // index of the odd-colored cell
let gameActive = false;
let roundActive = false;
let mistakeUsed = false; // one-time mistake forgiveness per game
let playerName = '';

// ---- Audio (Web Audio API) ----
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playCorrect() {
    const t = audioCtx.currentTime;

    // Main fanfare: ascending chord notes
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.07);
        gain.gain.setValueAtTime(0.3, t + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.35);
        osc.start(t + i * 0.07);
        osc.stop(t + i * 0.07 + 0.35);
    });

    // Shimmer layer
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2094, t + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(4186, t + 0.45);
    gain2.gain.setValueAtTime(0.12, t + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc2.start(t + 0.15);
    osc2.stop(t + 0.45);
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

// ---- Vibration ----
function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

// ---- Burst animation ----
function showBurst(cellEl) {
    cellEl.classList.add('burst');
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'burst-particle';
        particle.style.setProperty('--angle', `${i * 45}deg`);
        particle.style.backgroundColor = cellEl.style.backgroundColor;
        cellEl.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
    }
    setTimeout(() => cellEl.classList.remove('burst'), 600);
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

// ---- Player name ----
function loadPlayerName() {
    return localStorage.getItem('colorGamePlayerName') || '';
}

function savePlayerName(name) {
    localStorage.setItem('colorGamePlayerName', name);
}

// ---- Ranking ----
function loadRanking() {
    try {
        const data = JSON.parse(localStorage.getItem('colorGameRanking') || '[]');
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveRanking(ranking) {
    try {
        localStorage.setItem('colorGameRanking', JSON.stringify(ranking));
    } catch {}
}

function addToRanking(name, s) {
    const ranking = loadRanking();
    ranking.push({ name: name || '名無し', score: s });
    ranking.sort((a, b) => b.score - a.score);
    const top10 = ranking.slice(0, 10);
    saveRanking(top10);
    return top10;
}

function renderRanking() {
    const ranking = loadRanking();
    const list = document.getElementById('ranking-list');
    if (!list) return;
    list.innerHTML = '';
    if (ranking.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'まだ記録がありません';
        li.className = 'rank-empty';
        list.appendChild(li);
        return;
    }
    ranking.forEach((entry, i) => {
        const li = document.createElement('li');
        const medals = ['🥇', '🥈', '🥉'];
        const prefix = medals[i] !== undefined ? medals[i] : `${i + 1}.`;
        li.textContent = `${prefix} ${entry.name}  ${entry.score} ステージ`;
        if (i === 0) li.classList.add('rank-first');
        list.appendChild(li);
    });
}

function loadBestScore() {
    const ranking = loadRanking();
    return ranking.length > 0 ? ranking[0].score : 0;
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

// ---- Screen management ----
function showStartScreen() {
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    renderRanking();
    const input = document.getElementById('player-name-input');
    if (input) input.value = loadPlayerName();
}

function showGameScreen() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('result-screen').classList.add('hidden');
}

// ---- Game flow ----
function startGame() {
    const input = document.getElementById('player-name-input');
    playerName = input ? input.value.trim() : '';
    if (playerName) savePlayerName(playerName);

    currentStage = 0;
    score = 0;
    mistakeUsed = false;
    bestScore = loadBestScore();
    gameActive = true;
    showGameScreen();
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

    if (idx === correctCell) {
        roundActive = false;
        stopTimer();
        playCorrect();
        vibrate([60, 30, 60]);
        const cells = document.querySelectorAll('.cell');
        if (cells[correctCell]) {
            showBurst(cells[correctCell]);
            cells[correctCell].classList.add('correct');
        }
        score++;
        if (score > bestScore) bestScore = score;
        updateScoreUI();
        currentStage = Math.min(currentStage + 1, GRID_SIZES.length - 1);
        setTimeout(() => startRound(), 200); // quickly advance to next stage
    } else {
        if (!mistakeUsed) {
            // First mistake – forgive and let player try again
            mistakeUsed = true;
            playWrong();
            vibrate(200);
            highlightCell(idx, false);
            const msg = document.getElementById('chance-message');
            if (msg) {
                msg.classList.remove('hidden');
                setTimeout(() => msg.classList.add('hidden'), 1000);
            }
            setTimeout(() => {
                const cells = document.querySelectorAll('.cell');
                if (cells[idx]) cells[idx].classList.remove('wrong');
                roundActive = true;
                startTimer(); // reset timer for another attempt
            }, 600);
        } else {
            // Second mistake – end game
            roundActive = false;
            stopTimer();
            playWrong();
            vibrate([200, 100, 200]);
            highlightCell(idx, false);
            highlightCell(correctCell, true);
            setTimeout(() => endGame(), 800);
        }
    }
}

function onTimeout() {
    if (!roundActive) return;
    roundActive = false;
    playTimeout();
    vibrate(500);
    highlightCell(correctCell, true);
    setTimeout(() => endGame(), 800);
}

function endGame() {
    gameActive = false;
    addToRanking(playerName || '名無し', score);
    bestScore = loadBestScore();
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
    showStartScreen();

    document.getElementById('start-btn').addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        startGame();
    });
    document.getElementById('retry-btn').addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        showStartScreen();
    });
});
