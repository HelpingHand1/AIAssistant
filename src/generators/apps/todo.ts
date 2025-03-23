import { AiResponse } from '../../types';
import { ResponseGenerator } from '../../types';
import { registerGenerator } from '../index';

const todoAppGenerator: ResponseGenerator = {
    name: 'todoApp',
    description: 'Creates a feature-rich Todo application for task management',
    
    detect: (input: string): boolean => {
        // Detection patterns for todo app requests
        const keywords = ['todo app', 'todo list', 'task app', 'task list', 'todo application'];
        const actions = ['create', 'make', 'build', 'generate', 'develop'];
        
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
        <div class="filters">
            <button id="allFilter" class="filter-btn active">All</button>
            <button id="activeFilter" class="filter-btn">Active</button>
            <button id="completedFilter" class="filter-btn">Completed</button>
        </div>
        <ul id="todoList"></ul>
        <div class="todo-stats">
            <span id="itemsLeft">0 items left</span>
            <button id="clearCompleted">Clear completed</button>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>`
                },
                {
                    type: "createFile",
                    path: "todo_app/style.css",
                    content: `body {
    background-color: #f5f5f5;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    padding: 20px;
}

.app-container {
    background-color: #fff;
    padding: 25px;
    border-radius: 10px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 500px;
}

h1 {
    text-align: center;
    color: #2c3e50;
    margin-top: 0;
    margin-bottom: 20px;
    font-weight: 600;
}

.input-container {
    display: flex;
    margin-bottom: 20px;
}

#todoInput {
    flex: 1;
    padding: 12px;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 4px 0 0 4px;
    transition: border-color 0.3s;
}

#todoInput:focus {
    outline: none;
    border-color: #3498db;
}

#addButton {
    padding: 12px 20px;
    background-color: #3498db;
    color: #fff;
    border: none;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.3s;
}

#addButton:hover {
    background-color: #2980b9;
}

.filters {
    display: flex;
    justify-content: center;
    margin-bottom: 15px;
    gap: 10px;
}

.filter-btn {
    background-color: transparent;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.3s;
}

.filter-btn:hover {
    background-color: #f5f5f5;
}

.filter-btn.active {
    background-color: #3498db;
    color: white;
    border-color: #3498db;
}

#todoList {
    list-style: none;
    padding: 0;
    margin-bottom: 20px;
    max-height: 50vh;
    overflow-y: auto;
}

.todo-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    background-color: #f9f9f9;
    border-radius: 4px;
    margin-bottom: 8px;
    transition: all 0.3s;
    animation: fadeIn 0.3s;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.todo-item:hover {
    background-color: #f1f1f1;
}

.todo-content {
    display: flex;
    align-items: center;
    flex: 1;
}

.todo-checkbox {
    margin-right: 10px;
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.todo-text {
    flex: 1;
    word-break: break-word;
}

.completed .todo-text {
    text-decoration: line-through;
    color: #95a5a6;
}

.todo-actions {
    display: flex;
    gap: 5px;
}

.delete-btn {
    background-color: #e74c3c;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
    transition: background-color 0.3s;
}

.delete-btn:hover {
    background-color: #c0392b;
}

.todo-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #7f8c8d;
    font-size: 14px;
}

#clearCompleted {
    background: none;
    border: none;
    color: #3498db;
    cursor: pointer;
    font-size: 14px;
}

#clearCompleted:hover {
    text-decoration: underline;
}

.error-message {
    color: #e74c3c;
    font-size: 14px;
    margin-top: 5px;
    display: none;
}

@media (max-width: 600px) {
    .app-container {
        padding: 15px;
    }
    
    #todoInput, #addButton {
        padding: 10px;
    }
}`
                },
                {
                    type: "createFile",
                    path: "todo_app/app.js",
                    content: `// DOM Elements
const todoInput = document.getElementById('todoInput');
const addButton = document.getElementById('addButton');
const todoList = document.getElementById('todoList');
const itemsLeft = document.getElementById('itemsLeft');
const clearCompletedBtn = document.getElementById('clearCompleted');
const allFilterBtn = document.getElementById('allFilter');
const activeFilterBtn = document.getElementById('activeFilter');
const completedFilterBtn = document.getElementById('completedFilter');

// App State
let todos = [];
let currentFilter = 'all';

// Initialize the app
function init() {
    loadTodos();
    renderTodos();
    updateStats();
    
    // Event listeners
    addButton.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') addTodo();
    });
    clearCompletedBtn.addEventListener('click', clearCompleted);
    
    // Filter event listeners
    allFilterBtn.addEventListener('click', () => setFilter('all'));
    activeFilterBtn.addEventListener('click', () => setFilter('active'));
    completedFilterBtn.addEventListener('click', () => setFilter('completed'));
}

// Load todos from localStorage
function loadTodos() {
    const storedTodos = localStorage.getItem('todos');
    if (storedTodos) {
        todos = JSON.parse(storedTodos);
    }
}

// Save todos to localStorage
function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// Set current filter
function setFilter(filter) {
    currentFilter = filter;
    
    // Update active filter button
    [allFilterBtn, activeFilterBtn, completedFilterBtn].forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (filter === 'all') allFilterBtn.classList.add('active');
    else if (filter === 'active') activeFilterBtn.classList.add('active');
    else if (filter === 'completed') completedFilterBtn.classList.add('active');
    
    renderTodos();
}

// Add a new todo
function addTodo() {
    const taskText = todoInput.value.trim();
    
    // Validate input
    if (taskText === '') {
        shake(todoInput);
        return;
    }

    // Create new todo object
    const newTodo = {
        id: Date.now(),
        text: taskText,
        completed: false,
        date: new Date().toISOString()
    };

    // Add to todos array
    todos.unshift(newTodo);
    
    // Save and render
    saveTodos();
    renderTodos();
    updateStats();
    
    // Clear input
    todoInput.value = '';
    todoInput.focus();
}

// Toggle todo completion status
function toggleTodo(id) {
    todos = todos.map(todo => {
        if (todo.id === id) {
            return { ...todo, completed: !todo.completed };
        }
        return todo;
    });
    
    saveTodos();
    renderTodos();
    updateStats();
}

// Delete a todo
function deleteTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    
    saveTodos();
    renderTodos();
    updateStats();
}

// Clear all completed todos
function clearCompleted() {
    todos = todos.filter(todo => !todo.completed);
    
    saveTodos();
    renderTodos();
    updateStats();
}

// Render the todo list based on current filter
function renderTodos() {
    // Clear the list
    todoList.innerHTML = '';
    
    // Filter todos based on current filter
    let filteredTodos = todos;
    
    if (currentFilter === 'active') {
        filteredTodos = todos.filter(todo => !todo.completed);
    } else if (currentFilter === 'completed') {
        filteredTodos = todos.filter(todo => todo.completed);
    }
    
    // Create and append todo elements
    filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        if (todo.completed) {
            li.classList.add('completed');
        }
        
        const todoContent = document.createElement('div');
        todoContent.className = 'todo-content';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-checkbox';
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', () => toggleTodo(todo.id));
        
        const todoText = document.createElement('span');
        todoText.className = 'todo-text';
        todoText.textContent = todo.text;
        
        const todoActions = document.createElement('div');
        todoActions.className = 'todo-actions';
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteTodo(todo.id));
        
        // Build the todo item
        todoContent.appendChild(checkbox);
        todoContent.appendChild(todoText);
        
        todoActions.appendChild(deleteButton);
        
        li.appendChild(todoContent);
        li.appendChild(todoActions);
        
        todoList.appendChild(li);
    });
    
    // Show empty state if no todos
    if (filteredTodos.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#95a5a6';
        
        if (todos.length === 0) {
            emptyMessage.textContent = 'Add your first todo!';
        } else {
            emptyMessage.textContent = 'No ' + currentFilter + ' todos found.';
        }
        
        todoList.appendChild(emptyMessage);
    }
}

// Update statistics
function updateStats() {
    const activeTodos = todos.filter(todo => !todo.completed);
    itemsLeft.textContent = \`\${activeTodos.length} item\${activeTodos.length !== 1 ? 's' : ''} left\`;
    
    // Show/hide clear completed button
    clearCompletedBtn.style.display = todos.some(todo => todo.completed) ? 'block' : 'none';
}

// Visual feedback for invalid input
function shake(element) {
    element.classList.add('shake');
    setTimeout(() => {
        element.classList.remove('shake');
    }, 500);
}

// Add shake animation
const style = document.createElement('style');
style.textContent = \`
.shake {
    animation: shake 0.5s;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
}
\`;
document.head.appendChild(style);

// Initialize the app
init();`
                },
                {
                    type: "createFile",
                    path: "todo_app/README.md",
                    content: `# Enhanced Todo App

A feature-rich todo application built with HTML, CSS, and JavaScript.

## Features

- Add, delete, and mark tasks as completed
- Filter tasks by status (All, Active, Completed)
- Clear all completed tasks at once
- Task counter showing remaining items
- Data persistence with localStorage
- Responsive design for all screen sizes
- Visual feedback and animations

## How to Use

1. Open the \`index.html\` file in any modern web browser
2. Enter a task in the input field and press Enter or click "Add"
3. Use the checkboxes to mark tasks as completed
4. Use the filter buttons to show specific tasks
5. Click "Clear completed" to remove all completed tasks

## Technical Details

The app uses:
- Vanilla JavaScript with no external dependencies
- localStorage API for data persistence
- CSS transitions and animations for smooth interactions
- Responsive design principles
`
                }
            ],
            message: "I've created a complete Todo App implementation with all the requested features."
        };
    }
};

// Register the generator
registerGenerator(todoAppGenerator);

export default todoAppGenerator;