import { AiResponse } from '../../types';
import { ResponseGenerator, registerGenerator } from '../index';

const ticTacToeGameGenerator: ResponseGenerator = {
    name: 'ticTacToeGame',
    patterns: [/tic[\s-]?tac[\s-]?toe/i, /create.*tic.*toe/i, /make.*tic.*toe/i],
    generate: async (_message: string): Promise<AiResponse> => {
        return {
            actions: [
                {
                    type: "createFolder",
                    path: "tic_tac_toe"
                },
                {
                    type: "createFile",
                    path: "tic_tac_toe/index.html",
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tic-Tac-Toe</title>
    <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
    <div class="game-container">
        <h1>Tic-Tac-Toe</h1>
        <div id="board">
            <div class="cell" data-index="0"></div>
            <div class="cell" data-index="1"></div>
            <div class="cell" data-index="2"></div>
            <div class="cell" data-index="3"></div>
            <div class="cell" data-index="4"></div>
            <div class="cell" data-index="5"></div>
            <div class="cell" data-index="6"></div>
            <div class="cell" data-index="7"></div>
            <div class="cell" data-index="8"></div>
        </div>
        <div id="status">Player X's turn</div>
        <button id="reset">Reset Game</button>
    </div>
    <script src="game.js"></script>
</body>
</html>`
                },
                {
                    type: "createFile",
                    path: "tic_tac_toe/style.css",
                    content: `body {
    background-color: #1a1a1a;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    font-family: Arial, sans-serif;
    color: #fff;
}
.game-container {
    text-align: center;
}
h1 {
    font-size: 36px;
    margin-bottom: 20px;
}
#board {
    display: grid;
    grid-template-columns: repeat(3, 100px);
    grid-gap: 5px;
    margin: 0 auto;
    width: 310px;
}
.cell {
    width: 100px;
    height: 100px;
    background-color: #333;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 40px;
    cursor: pointer;
    border: 2px solid #fff;
}
.cell:hover {
    background-color: #444;
}
#status {
    margin: 20px 0;
    font-size: 24px;
}
#reset {
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
    background-color: #555;
    color: #fff;
    border: none;
    border-radius: 5px;
}
#reset:hover {
    background-color: #666;
}`
                },
                {
                    type: "createFile",
                    path: "tic_tac_toe/game.js",
                    content: `const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const status = document.getElementById('status');
const resetButton = document.getElementById('reset');

let currentPlayer = 'X';
let gameState = Array(9).fill('');
let gameActive = true;

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
];

function handleCellClick(event) {
    const cell = event.target;
    const index = cell.getAttribute('data-index');

    if (gameState[index] !== '' || !gameActive) return;

    gameState[index] = currentPlayer;
    cell.textContent = currentPlayer;

    if (checkWin()) {
        status.textContent = \`Player \${currentPlayer} wins!\`;
        gameActive = false;
        return;
    }

    if (gameState.every(cell => cell !== '')) {
        status.textContent = "It's a draw!";
        gameActive = false;
        return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    status.textContent = \`Player \${currentPlayer}'s turn\`;
}

function checkWin() {
    return winningConditions.some(condition => {
        return condition.every(index => gameState[index] === currentPlayer);
    });
}

function resetGame() {
    currentPlayer = 'X';
    gameState = Array(9).fill('');
    gameActive = true;
    status.textContent = "Player X's turn";
    cells.forEach(cell => (cell.textContent = ''));
}

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
resetButton.addEventListener('click', resetGame);`
                }
            ],
            message: "Created a fully functional Tic-Tac-Toe game in the 'tic_tac_toe' folder. The game includes an HTML file for structure, a CSS file for styling, and a JavaScript file with the complete game logic. Click on the cells to play as X or O, and use the reset button to start a new game!"
        };
    }
};

// Register the generator
registerGenerator(ticTacToeGameGenerator);

export default ticTacToeGameGenerator;