const PERFECT_MARGIN = 4;
const JUST_MISS_MARGIN = 14;

let placementToastTimer;
const canvasWrapper = document.querySelector(".canvas-wrapper");
const canvas = document.getElementById("game-canvas");
const context = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("best-score");

const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

const gameMessage = document.getElementById("game-message");
const finalScore = document.getElementById("final-score");

const COLORS = [
    "#1c332b",
    "#29483d",
    "#365c4e",
    "#476f60",
    "#c8a66b"
];

const FLOOR_HEIGHT = 32;
const INITIAL_WIDTH = 260;

let floors = [];
let movingFloor = null;

let score = 0;
let running = false;

let animationFrame;
let direction = 1;
let speed = 3;

let bestScore = Number(
    localStorage.getItem("majy-skyline-best") || 0
);

bestScoreElement.textContent = bestScore;

function resizeCanvas() {
    const bounds = canvas.parentElement.getBoundingClientRect();

    canvas.width = bounds.width;
    canvas.height = bounds.height;

    if (!running) {
        drawIdleState();
    }
}

function drawIdleState() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#1c332b";

    const width = Math.min(INITIAL_WIDTH, canvas.width * 0.6);

    context.fillRect(
        canvas.width / 2 - width / 2,
        canvas.height - FLOOR_HEIGHT,
        width,
        FLOOR_HEIGHT
    );
}

function startGame() {
    cancelAnimationFrame(animationFrame);

    score = 0;
    speed = 3;
    direction = 1;

    scoreElement.textContent = score;

    floors = [];

    gameMessage.classList.add("hidden");

    const width = Math.min(
        INITIAL_WIDTH,
        canvas.width * 0.6
    );

    floors.push({
        x: canvas.width / 2 - width / 2,
        y: canvas.height - FLOOR_HEIGHT,
        width,
        color: COLORS[0]
    });

    running = true;

    startButton.disabled = true;
    startButton.textContent = "Construction active";

    createMovingFloor();

    gameLoop();
    if (window.innerWidth <= 850) {
    setTimeout(() => {
        canvasWrapper.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }, 100);
}
}

function createMovingFloor() {
    const previous = floors[floors.length - 1];

    const startFromLeft = floors.length % 2 === 0;

    movingFloor = {
        x: startFromLeft
            ? -previous.width
            : canvas.width,

        y: previous.y - FLOOR_HEIGHT,

        width: previous.width,

        color: COLORS[floors.length % COLORS.length]
    };

    direction = startFromLeft ? 1 : -1;
}

function placeFloor() {
    if (!running || !movingFloor) {
        return;
    }

    const previous = floors[floors.length - 1];

    const alignmentDifference = Math.abs(
        movingFloor.x - previous.x
    );

    let overlapStart = Math.max(
        movingFloor.x,
        previous.x
    );

    let overlapEnd = Math.min(
        movingFloor.x + movingFloor.width,
        previous.x + previous.width
    );

    let overlap = overlapEnd - overlapStart;

    if (overlap <= 0) {
        endGame();
        return;
    }

    if (alignmentDifference <= PERFECT_MARGIN) {
        overlapStart = previous.x;
        overlap = previous.width;

        showPlacementToast("perfect");
    } else if (
        alignmentDifference <= JUST_MISS_MARGIN
    ) {
        showPlacementToast("just-missed");
    }

    floors.push({
        x: overlapStart,
        y: movingFloor.y,
        width: overlap,
        color: movingFloor.color
    });

    score++;

    scoreElement.textContent = score;

    speed = Math.min(
        8,
        3 + score * 0.12
    );

    moveTowerDownIfNeeded();

    createMovingFloor();
}

function moveTowerDownIfNeeded() {
    const topFloor = floors[floors.length - 1];

    const threshold = canvas.height * 0.3;

    if (topFloor.y < threshold) {
        const offset = threshold - topFloor.y;

        floors.forEach((floor) => {
            floor.y += offset;
        });
    }
}

function endGame() {
    running = false;

    cancelAnimationFrame(animationFrame);

    movingFloor = null;

    startButton.disabled = false;
    startButton.textContent = "Start construction";

    if (score > bestScore) {
        bestScore = score;

        localStorage.setItem(
            "majy-skyline-best",
            bestScore
        );

        bestScoreElement.textContent = bestScore;
    }

    finalScore.textContent =
        `${score} ${score === 1 ? "floor" : "floors"}`;

    gameMessage.classList.remove("hidden");
}

function update() {
    if (!movingFloor) {
        return;
    }

    movingFloor.x += speed * direction;

    if (
        movingFloor.x + movingFloor.width < 0 ||
        movingFloor.x > canvas.width
    ) {
        endGame();
    }
}

function drawFloor(floor) {
    context.fillStyle = floor.color;

    context.fillRect(
        floor.x,
        floor.y,
        floor.width,
        FLOOR_HEIGHT - 2
    );

    drawWindows(floor);
}

function drawWindows(floor) {
    if (floor.width < 45) {
        return;
    }

    context.fillStyle = "rgba(255, 255, 255, 0.18)";

    const windowWidth = 7;
    const gap = 16;

    for (
        let x = floor.x + 12;
        x < floor.x + floor.width - 12;
        x += gap
    ) {
        context.fillRect(
            x,
            floor.y + 9,
            windowWidth,
            12
        );
    }
}

function draw() {
    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawGrid();

    floors.forEach(drawFloor);

    if (movingFloor) {
        drawFloor(movingFloor);
    }
}

function drawGrid() {
    context.strokeStyle = "rgba(28, 51, 43, 0.05)";
    context.lineWidth = 1;

    const gridSize = 50;

    for (
        let x = 0;
        x < canvas.width;
        x += gridSize
    ) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
    }

    for (
        let y = 0;
        y < canvas.height;
        y += gridSize
    ) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
    }
}

function gameLoop() {
    if (!running) {
        return;
    }

    update();
    draw();

    animationFrame = requestAnimationFrame(gameLoop);
}

function showPlacementToast(type) {
    const toast = document.createElement("div");

    toast.className = `placement-toast ${type}`;

    if (type === "perfect") {
        toast.innerHTML = `
            <span class="toast-emotion">✦</span>
            <strong>PERFECT!</strong>
            <small>Precision engineering.</small>
        `;
    } else {
        toast.innerHTML = `
            <span class="toast-emotion">😮‍💨</span>
            <strong>JUST MISSED</strong>
            <small>That was close.</small>
        `;
    }

    canvas.parentElement.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("visible");
    });

    clearTimeout(placementToastTimer);

    placementToastTimer = setTimeout(() => {
        toast.classList.remove("visible");

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 900);
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

canvas.addEventListener("click", placeFloor);

document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        event.preventDefault();

        if (running) {
            placeFloor();
        }
    }
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
