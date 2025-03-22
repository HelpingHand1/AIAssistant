import { AiResponse } from '../../types';
import { ResponseGenerator, registerGenerator } from '../index';

const todoAppGenerator: ResponseGenerator = {
    name: 'todoApp',
    patterns: [/todo app/i, /create.*todo/i, /make.*todo/i],
    generate: async (_message: string): Promise<AiResponse> => {
        return {
            actions: [
                {
                    type: "createFolder",
                    path: "todo_app"
                },
                {
                    type: "createFile",
                    path: "todo_app/index.html",
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo App</title>
    <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
    <div class="app-container">
        <h1>Todo App</h1>
        <div class="input-container">
            <input type="text" id="todoInput" placeholder="Add a new task...">
            <button id="addButton">Add</button>
        </div>
        <ul id="todoList"></ul>
    </div>
    <script src="app.js"></script>
</body>
</html>`
                },
                {
                    type: "createFile",
                    path: "todo_app/style.css",
                    content: `body {
    background-color: #f4f4f4;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    font-family: Arial, sans-serif;
}
.app-container {
    background-color: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    width: 400px;
}
h1 {
    text-align: center;
    color: #333;
}
.input-container {
    display: flex;
    margin-bottom: 20px;
}
#todoInput {
    flex: 1;
    padding: 8px;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-right: 10px;
}
#addButton {
    padding: 8px 16px;
    background-color: #28a745;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
#addButton:hover {
    background-color: #218838;
}
#todoList {
    list-style: none;
    padding: 0;
}
#todoList li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: #f9f9f9;
    border-bottom: 1px solid #ddd;
}
#todoList li button {
    background-color: #dc3545;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
}
#todoList li button:hover {
    background-color: #c82333;
}`
                },
                {
                    type: "createFile",
                    path: "todo_app/app.js",
                    content: `const todoInput = document.getElementById('todoInput');
const addButton = document.getElementById('addButton');
const todoList = document.getElementById('todoList');

function addTodo() {
    const taskText = todoInput.value.trim();
    if (taskText === '') return;

    const li = document.createElement('li');
    li.textContent = taskText;

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.onclick = () => li.remove();

    li.appendChild(deleteButton);
    todoList.appendChild(li);

    todoInput.value = '';
}

addButton.addEventListener('click', addTodo);
todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
});`
                }
            ],
            message: "Created a simple Todo App in the 'todo_app' folder. The app includes an HTML file for structure, a CSS file for styling, and a JavaScript file with the logic to add and delete tasks. Enter a task and click 'Add' or press Enter to add it to the list."
        };
    }
};

// Register the generator
registerGenerator(todoAppGenerator);

export default todoAppGenerator;