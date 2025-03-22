import { AiResponse } from '../../types';
import { ResponseGenerator, registerGenerator } from '../index';
import { createCanvasGameBoilerplate, createKeyHandler } from '../../utils';

const snakeGameGenerator: ResponseGenerator = {
    name: 'snakeGame',
    patterns: [/snake game/i, /create.*snake/i, /make.*snake/i],
    generate: async (_message: string): Promise<AiResponse> => {
        return {
            actions: [
                {
                    type: "createFolder",
                    path: "snake_game"
                },
                {
                    type: "createFile",
                    path: "snake_game/index.html",
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Snake Game</title>
    <link rel="stylesheet" type="text/css" href="snake.css">
</head>
<body>
    <div class="game-container">
        <div class="score">Score: <span id="score">0</span></div>
        <canvas id="game" width="400" height="400"></canvas>
    </div>
    <script src="snake.js"></script>
</body>
</html>`
                },
                {
                    type: "createFile",
                    path: "snake_game/snake.css",
                    content: `body {
    background-color: #1a1a1a;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    font-family: Arial, sans-serif;
}
.game-container {
    text-align: center;
}
.score {
    color: #fff;
    font-size: 24px;
    margin-bottom: 10px;
}
#game {
    border: 2px solid #fff;
    background-color: #000;
}`
                },
                {
                    type: "createFile",
                    path: "snake_game/snake.js",
                    content: `${createCanvasGameBoilerplate('game')}

const scoreElement = document.getElementById('score');

// Snake initial position and velocity
let snake = [
    { x: 10, y: 10 },
];
let dx = 0;
let dy = 0;

// Food position
let foodX = Math.floor(Math.random() * tileCount);
let foodY = Math.floor(Math.random() * tileCount);

// Game state
let score = 0;
let gameSpeed = 100;

${createKeyHandler({ dx: 'dx', dy: 'dy' })}

// Main game loop
function game() {
    // Move snake
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head);

    // Check if snake ate the food
    if (head.x === foodX && head.y === foodY) {
        score += 10;
        scoreElement.textContent = score;
        foodX = Math.floor(Math.random() * tileCount);
        foodY = Math.floor(Math.random() * tileCount);
        gameSpeed = Math.max(50, gameSpeed - 2); // Increase speed
    } else {
        snake.pop();
    }

    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw food
    ctx.fillStyle = 'red';
    ctx.fillRect(foodX * gridSize, foodY * gridSize, gridSize - 2, gridSize - 2);

    // Draw snake
    ctx.fillStyle = 'green';
    snake.forEach(segment => {
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    });

    // Check for collisions
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        resetGame();
        return;
    }
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            resetGame();
            return;
        }
    }
}

// Reset game state
function resetGame() {
    snake = [{ x: 10, y: 10 }];
    dx = 0;
    dy = 0;
    score = 0;
    gameSpeed = 100;
    scoreElement.textContent = score;
    foodX = Math.floor(Math.random() * tileCount);
    foodY = Math.floor(Math.random() * tileCount);
    stopGame();
    startGame(game);
}

// Start the game
startGame(game);`
                }
            ],
            message: "Created a fully functional Snake game in the 'snake_game' folder. The game includes an HTML file for structure, a CSS file for styling, and a JavaScript file with the complete game logic. Use the arrow keys to control the snake, eat the red food to grow, and avoid hitting the walls or yourself!"
        };
    }
};

// Register the generator
registerGenerator(snakeGameGenerator);

export default snakeGameGenerator;