import { AiResponse } from '../../types';
import { ResponseGenerator, registerGenerator } from '../index';

const notepadGenerator: ResponseGenerator = {
    name: 'notepad',
    description: 'Creates a simple notepad web application with formatting options',
    
    detect: (input: string): boolean => {
        // More comprehensive detection patterns
        const keywords = ['notepad', 'text editor', 'note taking', 'writing app'];
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
                    path: "notepad"
                },
                {
                    type: "createFile",
                    path: "notepad/index.html",
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Notepad</title>
    <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
    <div class="notepad-container">
        <div class="toolbar">
            <button id="new">New</button>
            <button id="save">Save</button>
            <button id="bold">Bold</button>
            <button id="italic">Italic</button>
            <button id="underline">Underline</button>
            <select id="fontSize">
                <option value="1">Small</option>
                <option value="2" selected>Medium</option>
                <option value="3">Large</option>
                <option value="4">X-Large</option>
            </select>
            <input type="color" id="textColor" value="#000000">
        </div>
        <div class="editor" id="editor" contenteditable="true"></div>
        <div class="status-bar">
            <span id="wordCount">0 words</span>
            <span id="charCount">0 characters</span>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>`
                },
                {
                    type: "createFile",
                    path: "notepad/style.css",
                    content: `body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
}

.notepad-container {
    width: 80%;
    max-width: 800px;
    height: 80vh;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.toolbar {
    padding: 10px;
    background-color: #f0f0f0;
    border-bottom: 1px solid #ddd;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.toolbar button, .toolbar select {
    padding: 5px 10px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
}

.toolbar button:hover {
    background-color: #e5e5e5;
}

.toolbar input[type="color"] {
    width: 30px;
    height: 30px;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
}

.editor {
    flex-grow: 1;
    padding: 20px;
    overflow-y: auto;
    background-color: #fff;
    border: none;
    outline: none;
    line-height: 1.5;
}

.status-bar {
    padding: 5px 10px;
    background-color: #f0f0f0;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    color: #666;
    font-size: 12px;
}

/* Make it more responsive */
@media (max-width: 600px) {
    .notepad-container {
        width: 95%;
        height: 95vh;
    }
    
    .toolbar {
        flex-wrap: wrap;
    }
}`
                },
                {
                    type: "createFile",
                    path: "notepad/script.js",
                    content: `// Get DOM elements
const editor = document.getElementById('editor');
const newBtn = document.getElementById('new');
const saveBtn = document.getElementById('save');
const boldBtn = document.getElementById('bold');
const italicBtn = document.getElementById('italic');
const underlineBtn = document.getElementById('underline');
const fontSizeSelect = document.getElementById('fontSize');
const textColorInput = document.getElementById('textColor');
const wordCountSpan = document.getElementById('wordCount');
const charCountSpan = document.getElementById('charCount');

// Initialize editor with placeholder text
editor.innerHTML = 'Start typing your notes here...';

// Clear initial content when editor is first clicked
editor.addEventListener('focus', function() {
    if (editor.innerHTML === 'Start typing your notes here...') {
        editor.innerHTML = '';
    }
}, { once: true });

// Format text functions
boldBtn.addEventListener('click', () => {
    document.execCommand('bold', false, null);
    editor.focus();
});

italicBtn.addEventListener('click', () => {
    document.execCommand('italic', false, null);
    editor.focus();
});

underlineBtn.addEventListener('click', () => {
    document.execCommand('underline', false, null);
    editor.focus();
});

fontSizeSelect.addEventListener('change', () => {
    document.execCommand('fontSize', false, fontSizeSelect.value);
    editor.focus();
});

textColorInput.addEventListener('input', () => {
    document.execCommand('foreColor', false, textColorInput.value);
    editor.focus();
});

// Word and character count
function updateCounts() {
    const text = editor.innerText || '';
    const words = text.trim() === '' ? 0 : text.trim().split(/\\s+/).length;
    const chars = text.length;
    
    wordCountSpan.textContent = \`\${words} words\`;
    charCountSpan.textContent = \`\${chars} characters\`;
}

editor.addEventListener('input', updateCounts);

// New document
newBtn.addEventListener('click', () => {
    if (confirm('Create a new document? Any unsaved changes will be lost.')) {
        editor.innerHTML = '';
        editor.focus();
        updateCounts();
    }
});

// Save document
saveBtn.addEventListener('click', () => {
    const content = editor.innerHTML;
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notepad-document.html';
    a.click();
    
    URL.revokeObjectURL(url);
});

// Initialize counts
updateCounts();`
                }
            ],
            message: "Created a simple notepad application in the 'notepad' folder. The notepad includes basic text formatting options like bold, italic, underline, font size and color. It also features a word and character counter, and allows saving documents as HTML files. Open the index.html file to start using the notepad."
        };
    }
};

// Register the generator
registerGenerator(notepadGenerator);

export default notepadGenerator;