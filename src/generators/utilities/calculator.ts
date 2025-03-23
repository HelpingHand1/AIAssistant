import { AiResponse } from '../../types';
import { ResponseGenerator } from '../../types';
import { registerGenerator } from '../index';

const calculatorGenerator: ResponseGenerator = {
    name: 'calculator',
    description: 'Creates a functional calculator web application with basic arithmetic operations',
    
    detect: (input: string): boolean => {
        // More comprehensive detection patterns
        const keywords = ['calculator', 'calc', 'calculation tool'];
        const actions = ['create', 'make', 'build', 'setup', 'generate'];
        
        // Check for direct mentions
        const directMatch = keywords.some(keyword => 
            input.toLowerCase().includes(keyword));
            
        // Check for action + keyword combinations
        const actionMatch = actions.some(action => 
            keywords.some(keyword => 
                input.toLowerCase().includes(`${action} ${keyword}`) || 
                input.toLowerCase().includes(`${action} a ${keyword}`)));
                
        return directMatch || actionMatch;
    },
    
    generate: async (_message: string): Promise<AiResponse> => {
        return {
            actions: [
                {
                    type: "createFolder",
                    path: "calculator"
                },
                {
                    type: "createFile",
                    path: "calculator/index.html",
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculator</title>
    <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
    <div class="calculator">
        <div class="display">
            <div id="previous"></div>
            <div id="current">0</div>
        </div>
        <button class="span-two" onclick="clearAll()">AC</button>
        <button onclick="deleteNumber()">DEL</button>
        <button onclick="appendOperator('/')">÷</button>
        <button onclick="appendNumber('7')">7</button>
        <button onclick="appendNumber('8')">8</button>
        <button onclick="appendNumber('9')">9</button>
        <button onclick="appendOperator('*')">×</button>
        <button onclick="appendNumber('4')">4</button>
        <button onclick="appendNumber('5')">5</button>
        <button onclick="appendNumber('6')">6</button>
        <button onclick="appendOperator('-')">-</button>
        <button onclick="appendNumber('1')">1</button>
        <button onclick="appendNumber('2')">2</button>
        <button onclick="appendNumber('3')">3</button>
        <button onclick="appendOperator('+')">+</button>
        <button onclick="appendNumber('0')">0</button>
        <button onclick="appendNumber('.')">.</button>
        <button class="span-two" onclick="calculate()">=</button>
    </div>
    <script src="script.js"></script>
</body>
</html>`
                },
                {
                    type: "createFile",
                    path: "calculator/style.css",
                    content: `*, *::before, *::after {
    box-sizing: border-box;
    font-family: 'Arial', sans-serif;
    font-weight: normal;
}

body {
    margin: 0;
    padding: 0;
    background: linear-gradient(to right, #00AAFF, #00FF6C);
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
}

.calculator {
    background-color: #222;
    border-radius: 10px;
    width: 350px;
    overflow: hidden;
    box-shadow: 0px 10px 25px rgba(0, 0, 0, 0.3);
}

.display {
    background-color: rgba(0, 0, 0, 0.75);
    color: white;
    text-align: right;
    padding: 20px 10px;
    font-size: 24px;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    word-wrap: break-word;
    word-break: break-all;
}

#previous {
    color: rgba(255, 255, 255, 0.75);
    font-size: 18px;
    min-height: 24px;
}

#current {
    font-size: 32px;
    min-height: 40px;
}

.calculator button {
    cursor: pointer;
    font-size: 20px;
    border: 1px solid #333;
    outline: none;
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    padding: 20px;
    transition: background-color 0.3s;
}

button:hover {
    background-color: rgba(255, 255, 255, 0.3);
}

.span-two {
    grid-column: span 2;
}

.calculator {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
}

.calculator .display {
    grid-column: 1 / -1;
}`
                },
                {
                    type: "createFile",
                    path: "calculator/script.js",
                    content: `const previousDisplay = document.getElementById('previous');
const currentDisplay = document.getElementById('current');

let currentValue = '0';
let previousValue = '';
let operation = null;
let shouldResetScreen = false;

function appendNumber(number) {
    if (currentValue === '0' || shouldResetScreen) {
        currentValue = '';
        shouldResetScreen = false;
    }
    
    // Prevent multiple decimal points
    if (number === '.' && currentValue.includes('.')) return;
    
    currentValue += number;
    updateDisplay();
}

function appendOperator(operator) {
    // If there's a pending operation, calculate first
    if (operation !== null) calculate();
    
    previousValue = currentValue;
    operation = operator;
    currentValue = '0';
    updateDisplay();
}

function calculate() {
    if (operation === null || shouldResetScreen) return;
    
    const prev = parseFloat(previousValue);
    const current = parseFloat(currentValue);
    
    if (isNaN(prev) || isNaN(current)) return;
    
    let result;
    switch (operation) {
        case '+':
            result = prev + current;
            break;
        case '-':
            result = prev - current;
            break;
        case '*':
            result = prev * current;
            break;
        case '/':
            if (current === 0) {
                result = 'Error';
            } else {
                result = prev / current;
            }
            break;
        default:
            return;
    }
    
    currentValue = result.toString();
    operation = null;
    previousValue = '';
    shouldResetScreen = true;
    updateDisplay();
}

function clearAll() {
    currentValue = '0';
    previousValue = '';
    operation = null;
    updateDisplay();
}

function deleteNumber() {
    currentValue = currentValue.toString().slice(0, -1);
    if (currentValue === '') currentValue = '0';
    updateDisplay();
}

function updateDisplay() {
    currentDisplay.textContent = currentValue;
    if (operation != null) {
        const opSymbol = operation === '*' ? '×' : 
                         operation === '/' ? '÷' : 
                         operation;
        previousDisplay.textContent = \`\${previousValue} \${opSymbol}\`;
    } else {
        previousDisplay.textContent = '';
    }
}`
                }
            ],
            message: "Created a functional calculator app in the 'calculator' folder. It includes a clean, modern UI with basic arithmetic operations (addition, subtraction, multiplication, division), and features like clear all, delete, and decimal input. Open the index.html file to use the calculator."
        };
    }
};

// Register the generator
registerGenerator(calculatorGenerator);

export default calculatorGenerator;