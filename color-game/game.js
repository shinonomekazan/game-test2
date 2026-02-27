// 色違いゲーム - Game Logic

const GRID_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10]; // n×n grids (4,9,16,...,100 cells)
const TIME_LIMIT_INITIAL = 5; // starting seconds per round

let currentStage = 0;   // index into GRID_SIZES (used in standard course)
let currentCourse = 'standard'; // 'standard' or 'random'
let score = 0;
let bestScore = 0;
let timerInterval = null;
let timeLeft = TIME_LIMIT_INITIAL;
let timeLimit = TIME_LIMIT_INITIAL; // dynamic time limit, changes each round
let correctCell = -1;   // index of the odd-colored cell
let gameActive = false;
let roundActive = false;
let playerName = '';
let db = null;

// ---- Audio ----
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playCorrect() {
    const audio = new Audio('correct.mp3');
    audio.play();
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
    const n = currentCourse === 'random'
        ? GRID_SIZES[currentStage]
        : GRID_SIZES[currentStage];
    document.getElementById('stage').textContent = `${n}×${n}`;
    const courseEl = document.getElementById('course-label');
    if (courseEl) {
        courseEl.textContent = currentCourse === 'random' ? 'ランダム' : 'スタンダード';
    }
}

// ---- Player name ----
function loadPlayerName() {
    return localStorage.getItem('colorGamePlayerName') || '';
}

function savePlayerName(name) {
    localStorage.setItem('colorGamePlayerName', name);
}

// ---- Firebase Firestore ----
function initFirebase() {
    try {
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined'
            && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith('YOUR_')) {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
        }
    } catch (e) {
        console.warn('Firebase initialization failed:', e);
        db = null;
    }
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

async function addToRanking(name, s) {
    // Save to Firestore (shared ranking)
    if (db) {
        try {
            await db.collection('colorGameRanking').add({
                name: name || '名無し',
                score: s,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.warn('Firestore save failed:', e);
        }
    }
    // Also save to localStorage as offline fallback
    const ranking = loadRanking();
    ranking.push({ name: name || '名無し', score: s });
    ranking.sort((a, b) => b.score - a.score);
    const top10 = ranking.slice(0, 10);
    saveRanking(top10);
    return top10;
}

async function renderRanking() {
    let ranking = null;
    // Try loading shared ranking from Firestore
    if (db) {
        try {
            const snapshot = await db.collection('colorGameRanking')
                .orderBy('score', 'desc')
                .limit(10)
                .get();
            ranking = snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.warn('Firestore load failed:', e);
        }
    }
    // Fall back to localStorage if Firestore unavailable
    if (!ranking) {
        ranking = loadRanking();
    }
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
    timeLeft = timeLimit;
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
function startGame(course) {
    const input = document.getElementById('player-name-input');
    playerName = input ? input.value.trim() : '';
    if (playerName) savePlayerName(playerName);

    currentCourse = course || 'standard';
    currentStage = 0;
    score = 0;
    timeLimit = TIME_LIMIT_INITIAL;
    bestScore = loadBestScore();
    gameActive = true;
    showGameScreen();
    updateScoreUI();
    startRound();
}

function startRound() {
    roundActive = true;

    if (currentCourse === 'random') {
        currentStage = randomInt(0, GRID_SIZES.length - 1);
    }

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
            cells[correctCell].classList.add('correct');
        }
        score++;
        if (score > bestScore) bestScore = score;
        updateScoreUI();
        timeLimit = Math.min(10, timeLimit + 1);
        if (currentCourse === 'standard') {
            currentStage = Math.min(currentStage + 1, GRID_SIZES.length - 1);
        }
        setTimeout(() => startRound(), 0);
    } else {
        playWrong();
        vibrate([200, 100, 200]);
        highlightCell(idx, false);
        timeLimit = Math.max(1, timeLimit - 1);
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

async function endGame() {
    gameActive = false;
    await addToRanking(playerName || '名無し', score);
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
    initFirebase();
    showStartScreen();

    document.getElementById('start-standard-btn').addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        startGame('standard');
    });
    document.getElementById('start-random-btn').addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        startGame('random');
    });
    document.getElementById('retry-btn').addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        showStartScreen();
    });
});
