// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

// Game constants
const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;
const NEXT_CANVAS_SIZE = 4;
const BASE_DROP_INTERVAL = 1000;
const MIN_DROP_INTERVAL = 100;
const COLORS = [
    null,
    '#FF6B6B', // I - Red
    '#4ECDC4', // O - Cyan
    '#45B7D1', // T - Blue
    '#FFA07A', // S - Orange
    '#98D8C8', // Z - Green
    '#F7DC6F', // J - Yellow
    '#BB8FCE'  // L - Purple
];

// Tetromino shapes
const SHAPES = [
    [], // Empty
    [[1, 1, 1, 1]], // I
    [[2, 2], [2, 2]], // O
    [[0, 3, 0], [3, 3, 3]], // T
    [[0, 4, 4], [4, 4, 0]], // S
    [[5, 5, 0], [0, 5, 5]], // Z
    [[6, 0, 0], [6, 6, 6]], // J
    [[0, 0, 7], [7, 7, 7]]  // L
];

// Game state
let board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
let currentPiece = null;
let nextPiece = null;
let currentX = 0;
let currentY = 0;
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// Particle effects for line clearing
let particles = [];

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5 - 2;
        this.life = 1;
        this.color = color;
        this.size = Math.random() * 5 + 3;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // Gravity
        this.life -= 0.02;
    }
    
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

// Create a new piece
function createPiece() {
    const type = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
    return {
        shape: SHAPES[type],
        color: type
    };
}

// Initialize game
function init() {
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    isPaused = false;
    dropInterval = BASE_DROP_INTERVAL;
    particles = [];
    
    currentPiece = createPiece();
    nextPiece = createPiece();
    resetPosition();
    
    updateScore();
    document.getElementById('gameOver').classList.remove('show');
}

// Reset piece position
function resetPosition() {
    currentX = Math.floor(COLS / 2) - Math.floor(currentPiece.shape[0].length / 2);
    currentY = 0;
}

// Draw a block with gradient effect
function drawBlock(x, y, color, context = ctx, blockSize = BLOCK_SIZE) {
    if (!color) return;
    
    const gradient = context.createLinearGradient(
        x * blockSize, y * blockSize,
        x * blockSize + blockSize, y * blockSize + blockSize
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, shadeColor(color, -20));
    
    context.fillStyle = gradient;
    context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
    
    // Border
    context.strokeStyle = shadeColor(color, -40);
    context.lineWidth = 2;
    context.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
    
    // Highlight
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fillRect(x * blockSize + 2, y * blockSize + 2, blockSize / 3, blockSize / 3);
}

// Clamp RGB value between 0 and 255
function clampRGB(value) {
    return Math.max(0, Math.min(255, value));
}

// Shade color helper
function shadeColor(color, percent) {
    // Validate hex color format
    if (!color || !color.startsWith('#')) {
        return color;
    }
    
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = clampRGB((num >> 16) + amt);
    const G = clampRGB((num >> 8 & 0x00FF) + amt);
    const B = clampRGB((num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B)
        .toString(16).slice(1);
}

// Draw the board
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            ctx.strokeRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }
    
    // Draw placed pieces
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) {
                drawBlock(col, row, COLORS[board[row][col]]);
            }
        }
    }
    
    // Draw current piece
    if (currentPiece) {
        for (let row = 0; row < currentPiece.shape.length; row++) {
            for (let col = 0; col < currentPiece.shape[row].length; col++) {
                if (currentPiece.shape[row][col]) {
                    drawBlock(currentX + col, currentY + row, COLORS[currentPiece.color]);
                }
            }
        }
    }
    
    // Draw particles
    particles.forEach(particle => particle.draw());
}

// Draw next piece
function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        const offsetX = (NEXT_CANVAS_SIZE - nextPiece.shape[0].length) / 2;
        const offsetY = (NEXT_CANVAS_SIZE - nextPiece.shape.length) / 2;
        
        for (let row = 0; row < nextPiece.shape.length; row++) {
            for (let col = 0; col < nextPiece.shape[row].length; col++) {
                if (nextPiece.shape[row][col]) {
                    drawBlock(offsetX + col, offsetY + row, COLORS[nextPiece.color], nextCtx, 30);
                }
            }
        }
    }
}

// Collision detection
function collide() {
    for (let row = 0; row < currentPiece.shape.length; row++) {
        for (let col = 0; col < currentPiece.shape[row].length; col++) {
            if (currentPiece.shape[row][col]) {
                const newX = currentX + col;
                const newY = currentY + row;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                if (newY >= 0 && board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Rotate piece
function rotate() {
    const rotated = currentPiece.shape[0].map((_, i) =>
        currentPiece.shape.map(row => row[i]).reverse()
    );
    
    const previousShape = currentPiece.shape;
    currentPiece.shape = rotated;
    
    if (collide()) {
        currentPiece.shape = previousShape;
        return false;
    }
    return true;
}

// Move piece
function move(dir) {
    currentX += dir;
    if (collide()) {
        currentX -= dir;
        return false;
    }
    return true;
}

// Drop piece
function drop() {
    currentY++;
    if (collide()) {
        currentY--;
        lockPiece();
        return false;
    }
    return true;
}

// Lock piece to board
function lockPiece() {
    for (let row = 0; row < currentPiece.shape.length; row++) {
        for (let col = 0; col < currentPiece.shape[row].length; col++) {
            if (currentPiece.shape[row][col]) {
                const boardY = currentY + row;
                const boardX = currentX + col;
                
                if (boardY < 0) {
                    gameOver = true;
                    document.getElementById('gameOver').classList.add('show');
                    document.getElementById('finalScore').textContent = score;
                    return;
                }
                
                board[boardY][boardX] = currentPiece.color;
            }
        }
    }
    
    clearLines();
    currentPiece = nextPiece;
    nextPiece = createPiece();
    resetPosition();
    drawNext();
    
    if (collide()) {
        gameOver = true;
        document.getElementById('gameOver').classList.add('show');
        document.getElementById('finalScore').textContent = score;
    }
}

// Clear completed lines
function clearLines() {
    let linesCleared = 0;
    
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row].every(cell => cell !== 0)) {
            // Create particles for cleared line
            for (let col = 0; col < COLS; col++) {
                const color = COLORS[board[row][col]];
                for (let i = 0; i < 5; i++) {
                    particles.push(new Particle(
                        col * BLOCK_SIZE + BLOCK_SIZE / 2,
                        row * BLOCK_SIZE + BLOCK_SIZE / 2,
                        color
                    ));
                }
            }
            
            board.splice(row, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            row++; // Check this row again
        }
    }
    
    if (linesCleared > 0) {
        lines += linesCleared;
        // Calculate score based on lines cleared (capped at 4 lines max)
        const scoreMultipliers = [0, 100, 300, 500, 800];
        const multiplier = scoreMultipliers[Math.min(linesCleared, 4)];
        score += multiplier * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * 100);
        updateScore();
    }
}

// Update score display
function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
}

// Game loop
function gameLoop(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    
    if (!gameOver && !isPaused) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            drop();
            dropCounter = 0;
        }
        
        // Update particles
        particles = particles.filter(p => {
            p.update();
            return p.life > 0;
        });
        
        drawBoard();
    }
    
    requestAnimationFrame(gameLoop);
}

// Keyboard controls
document.addEventListener('keydown', event => {
    if (gameOver) return;
    
    switch (event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            if (!isPaused) move(-1);
            break;
        case 'ArrowRight':
            event.preventDefault();
            if (!isPaused) move(1);
            break;
        case 'ArrowDown':
            event.preventDefault();
            if (!isPaused) drop();
            break;
        case 'ArrowUp':
            event.preventDefault();
            if (!isPaused) rotate();
            break;
        case ' ':
            event.preventDefault();
            isPaused = !isPaused;
            break;
    }
    
    if (!gameOver && !isPaused) {
        drawBoard();
    }
});

// Restart button
document.getElementById('restartButton').addEventListener('click', () => {
    init();
    drawBoard();
    drawNext();
});

// Initialize and start the game
init();
drawBoard();
drawNext();
gameLoop();
