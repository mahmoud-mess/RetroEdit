document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const fileInput = document.getElementById('fileInput');
    const loadButton = document.getElementById('loadButton');
    const saveButton = document.getElementById('saveButton');
    const newButton = document.getElementById('newButton');
    const findButton = document.getElementById('findButton');
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    const copyButton = document.getElementById('copyButton');
    const pasteButton = document.getElementById('pasteButton');
    const editorContent = document.getElementById('editorContent');
    const vizCanvas = document.getElementById('vizCanvas');
    const vizMode = document.getElementById('vizMode');
    const vizWidthSelect = document.getElementById('vizWidth');

    // Text-to-Bitmap elements
    const textInput = document.getElementById('textInput');
    const imageWidthInput = document.getElementById('imageWidth');
    const imageHeightInput = document.getElementById('imageHeight');
    const fontSizeSelect = document.getElementById('fontSize');
    const generateButton = document.getElementById('generateButton');
    const generateStatus = document.getElementById('generate-status');

    // Find dialog elements
    const findDialog = document.getElementById('findDialog');
    const findInput = document.getElementById('findInput');
    const findNextButton = document.getElementById('findNextButton');
    const findPrevButton = document.getElementById('findPrevButton');
    const findAllButton = document.getElementById('findAllButton');
    const findCloseButton = document.getElementById('findCloseButton');

    // Status bar elements
    const statusFilename = document.getElementById('status-filename');
    const statusSize = document.getElementById('status-size');
    const statusCursor = document.getElementById('status-cursor');
    const statusValue = document.getElementById('status-value');
    const statusSelection = document.getElementById('status-selection');
    const editIndicator = document.getElementById('editIndicator');

    // Data inspector elements
    const inspByte = document.getElementById('inspByte');
    const inspInt16 = document.getElementById('inspInt16');
    const inspInt32 = document.getElementById('inspInt32');
    const inspFloat = document.getElementById('inspFloat');

    // --- State Variables ---
    let state = {
        buffer: null,
        fileName: 'untitled.txt',
        bytesPerRow: 16,
        byteInputs: [],
        asciiChars: [],
        totalBytes: 0,
        activeOffset: -1,
        selectionStart: -1,
        selectionEnd: -1,
        clipboard: null,
        undoStack: [],
        redoStack: [],
        maxUndoSteps: 100,
        isModified: false
    };

    // --- Event Listeners ---
    generateButton.addEventListener('click', handleGenerateBitmap);
    loadButton.addEventListener('click', () => fileInput.click());
    newButton.addEventListener('click', createNewFile);
    findButton.addEventListener('click', showFindDialog);
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    copyButton.addEventListener('click', copy);
    pasteButton.addEventListener('click', paste);

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) loadFromFile(file);
    });

    saveButton.addEventListener('click', () => {
        if (!state.buffer) return;
        const blob = new Blob([state.buffer], { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = state.fileName;
        a.click();
        URL.revokeObjectURL(a.href);
        state.isModified = false;
        updateUI();
    });

    vizMode.addEventListener('change', renderVisualization);
    vizWidthSelect.addEventListener('change', renderVisualization);

    // Find dialog events
    findCloseButton.addEventListener('click', () => findDialog.classList.remove('show'));
    findNextButton.addEventListener('click', findNext);
    findPrevButton.addEventListener('click', findPrev);
    findAllButton.addEventListener('click', findAll);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeydown);

    // --- Core Functions ---

    function createNewFile() {
        if (state.isModified && !confirm('Discard changes to current file?')) return;
        
        state.buffer = new ArrayBuffer(0);
        state.fileName = 'untitled.bin';
        state.totalBytes = 0;
        state.isModified = false;
        state.undoStack = [];
        state.redoStack = [];
        clearSelection();
        
        renderHexEditor();
        renderVisualization();
        updateUI();
    }

    function handleGenerateBitmap() {
        const text = textInput.value;
        const width = parseInt(imageWidthInput.value, 10);
        const height = parseInt(imageHeightInput.value, 10);
        const fontSize = parseInt(fontSizeSelect.value, 10);

        if (!text) {
            generateStatus.textContent = "Error: Please enter some text to generate an image.";
            return;
        }
        if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
            generateStatus.textContent = "Error: Please enter a valid positive number for width and height.";
            return;
        }

        try {
            const rawBitmapData = createRawBitmapData(text, width, height, fontSize);
            state.buffer = rawBitmapData;
            state.fileName = 'text_bitmap.bin';
            state.totalBytes = rawBitmapData.byteLength;
            state.isModified = false;
            state.undoStack = [];
            state.redoStack = [];
            clearSelection();
            
            // Set visualization to match generated image dimensions
            vizMode.value = 'bitmap';
            vizWidthSelect.value = width;

            renderHexEditor();
            renderVisualization();
            updateUI();
            generateStatus.textContent = `Generated ${width}x${height} raw bitmap (${state.totalBytes} bytes).`;

        } catch (error) {
            console.error("Bitmap Generation Error:", error);
            generateStatus.textContent = `Error: ${error.message}`;
        }
    }

    function createRawBitmapData(text, width, height, fontSize) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Disable anti-aliasing for crisp, pixelated rendering
        ctx.imageSmoothingEnabled = false;

        // Black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        
        // White text
        ctx.fillStyle = 'white';
        ctx.font = `${fontSize}px monospace`;
        ctx.textBaseline = 'top';
        
        // Process and draw text line by line, two words at a time
        const lines = text.split('\n');
        let y = 2;
        const lineHeight = fontSize + 2;

        for (const line of lines) {
            const words = line.split(' ').filter(w => w.length > 0);
            for (let i = 0; i < words.length; i += 2) {
                const twoWords = words.slice(i, i + 2).join(' ');
                ctx.fillText(twoWords, 2, y);
                y += lineHeight;
                if (y > height - lineHeight) break;
            }
             if (y > height - lineHeight) break;
        }

        // Get the pixel data from the canvas
        const imageData = ctx.getImageData(0, 0, width, height).data;
        
        // Convert RGBA canvas data to monochrome bytes (0x00 or 0xFF)
        const outputBytes = new Uint8Array(width * height);
        for (let i = 0; i < imageData.length; i += 4) {
            const red = imageData[i];
            const pixelIndex = i / 4;
            outputBytes[pixelIndex] = (red > 128) ? 0xFF : 0x00;
        }

        return outputBytes.buffer;
    }

    function loadFromFile(file) {
        if (state.isModified && !confirm('Discard changes to current file?')) return;
        
        state.fileName = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            state.buffer = e.target.result;
            state.totalBytes = state.buffer.byteLength;
            state.isModified = false;
            state.undoStack = [];
            state.redoStack = [];
            clearSelection();
            
            renderHexEditor();
            renderVisualization();
            updateUI();
        };
        reader.readAsArrayBuffer(file);
    }

    function renderHexEditor() {
        editorContent.innerHTML = '';
        state.byteInputs = [];
        state.asciiChars = [];

        if (state.totalBytes === 0) {
            editorContent.innerHTML = '<p style="text-align: center; margin: 50px 0;">File is empty. Use "New File" to create a new file.</p>';
            return;
        }

        const view = new DataView(state.buffer);
        const fragment = document.createDocumentFragment();
        
        for (let offset = 0; offset < state.totalBytes; offset += state.bytesPerRow) {
            fragment.appendChild(createRowElement(offset, view));
        }
        
        editorContent.appendChild(fragment);
    }

    function createRowElement(offset, view) {
        const row = document.createElement('div');
        row.className = 'hex-editor-grid';

        const address = document.createElement('div');
        address.className = 'address';
        address.textContent = offset.toString(16).padStart(8, '0').toUpperCase();
        row.appendChild(address);
        
        // Create hex inputs
        for (let i = 0; i < state.bytesPerRow; i++) {
            const byteOffset = offset + i;
            if (byteOffset < state.totalBytes) {
                const byte = view.getUint8(byteOffset);
                const hexInput = createHexInput(byteOffset, byte);
                row.appendChild(hexInput);
                state.byteInputs[byteOffset] = hexInput;
            } else {
                row.appendChild(document.createElement('div'));
            }
        }

        const separator = document.createElement('div');
        separator.className = 'separator';
        row.appendChild(separator);
        
        // Create ASCII row
        const asciiRow = document.createElement('div');
        asciiRow.className = 'ascii-row';
        
        for (let i = 0; i < state.bytesPerRow; i++) {
            const byteOffset = offset + i;
            if (byteOffset < state.totalBytes) {
                const byte = view.getUint8(byteOffset);
                const asciiChar = createAsciiChar(byteOffset, byte);
                asciiRow.appendChild(asciiChar);
                state.asciiChars[byteOffset] = asciiChar;
            } else {
                const emptyChar = document.createElement('div');
                emptyChar.className = 'ascii-char';
                emptyChar.style.visibility = 'hidden';
                asciiRow.appendChild(emptyChar);
            }
        }
        
        row.appendChild(asciiRow);
        return row;
    }

    function createHexInput(byteOffset, byte) {
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'hex-input';
        hexInput.value = byte.toString(16).padStart(2, '0').toUpperCase();
        hexInput.maxLength = 2;
        hexInput.dataset.offset = byteOffset;
        
        hexInput.addEventListener('input', (e) => handleHexInput(e, byteOffset));
        hexInput.addEventListener('focus', (e) => handleCellFocus(byteOffset, 'hex'));
        hexInput.addEventListener('keydown', (e) => handleCellKeydown(e, byteOffset, 'hex'));
        hexInput.addEventListener('mousedown', handleMouseDown);
        
        return hexInput;
    }

    function createAsciiChar(byteOffset, byte) {
        const asciiChar = document.createElement('div');
        asciiChar.className = 'ascii-char';
        asciiChar.textContent = getAsciiChar(byte);
        asciiChar.tabIndex = 0;
        asciiChar.dataset.offset = byteOffset;
        
        asciiChar.addEventListener('keydown', (e) => handleAsciiKeydown(e, byteOffset));
        asciiChar.addEventListener('focus', (e) => handleCellFocus(byteOffset, 'ascii'));
        asciiChar.addEventListener('mousedown', handleMouseDown);
        
        return asciiChar;
    }

    function handleHexInput(e, byteOffset) {
        const value = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
        e.target.value = value;
        
        if (value.length === 2) {
            const byteValue = parseInt(value, 16);
            if (!isNaN(byteValue)) {
                pushUndo();
                new DataView(state.buffer).setUint8(byteOffset, byteValue);
                state.isModified = true;
                
                // Update ASCII representation
                if (state.asciiChars[byteOffset]) {
                    state.asciiChars[byteOffset].textContent = getAsciiChar(byteValue);
                }
                
                renderVisualization();
                updateDataInspector(byteOffset);
                updateUI();
            }
        }
    }

    function handleAsciiKeydown(e, byteOffset) {
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            const charCode = e.key.charCodeAt(0);
            
            pushUndo();
            new DataView(state.buffer).setUint8(byteOffset, charCode);
            state.isModified = true;
            
            // Update hex representation
            if (state.byteInputs[byteOffset]) {
                state.byteInputs[byteOffset].value = charCode.toString(16).padStart(2, '0').toUpperCase();
            }
            
            e.target.textContent = e.key;
            renderVisualization();
            updateDataInspector(byteOffset);
            updateUI();
            
            // Move to next cell
            moveCursor(1, 'ascii');
        } else {
            handleCellKeydown(e, byteOffset, 'ascii');
        }
    }

    function handleCellKeydown(e, byteOffset, type) {
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                moveCursor(-1, type);
                break;
            case 'ArrowRight':
                e.preventDefault();
                moveCursor(1, type);
                break;
            case 'ArrowUp':
                e.preventDefault();
                moveCursor(-state.bytesPerRow, type);
                break;
            case 'ArrowDown':
                e.preventDefault();
                moveCursor(state.bytesPerRow, type);
                break;
            case 'Tab':
                e.preventDefault();
                const newType = type === 'hex' ? 'ascii' : 'hex';
                focusCell(byteOffset, newType);
                break;
            case 'Home':
                e.preventDefault();
                const rowStart = Math.floor(byteOffset / state.bytesPerRow) * state.bytesPerRow;
                focusCell(rowStart, type);
                break;
            case 'End':
                e.preventDefault();
                const rowEnd = Math.min(
                    Math.floor(byteOffset / state.bytesPerRow) * state.bytesPerRow + state.bytesPerRow - 1,
                    state.totalBytes - 1
                );
                focusCell(rowEnd, type);
                break;
        }
        
        // Update selection if shift is held
        if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
            updateSelection(byteOffset);
        }
    }

    function handleCellFocus(offset, type) {
        state.activeOffset = offset;
        updateDataInspector(offset);
        updateStatusBar();
        
        // Clear selection if not shift-clicking
        if (!event.shiftKey) {
            clearSelection();
        }
    }

    function handleMouseDown(e) {
        if (e.shiftKey && state.selectionStart !== -1) {
            // Extend selection
            const offset = parseInt(e.target.dataset.offset);
            updateSelection(offset);
        } else {
            // Start new selection
            clearSelection();
        }
    }

    function moveCursor(delta, type) {
        const newOffset = state.activeOffset + delta;
        if (newOffset >= 0 && newOffset < state.totalBytes) {
            focusCell(newOffset, type);
        }
    }

    function focusCell(offset, type) {
        const element = type === 'hex' ? state.byteInputs[offset] : state.asciiChars[offset];
        if (element) {
            element.focus();
            if (type === 'hex') {
                element.select();
            }
        }
    }

    function updateSelection(endOffset) {
        if (state.selectionStart === -1) {
            state.selectionStart = state.activeOffset;
        }
        state.selectionEnd = endOffset;
        
        // Visual selection update
        const start = Math.min(state.selectionStart, state.selectionEnd);
        const end = Math.max(state.selectionStart, state.selectionEnd);
        
        // Clear previous selection
        document.querySelectorAll('.selection-highlight').forEach(el => {
            el.classList.remove('selection-highlight');
        });
        
        // Apply new selection
        for (let i = start; i <= end; i++) {
            if (state.byteInputs[i]) state.byteInputs[i].classList.add('selection-highlight');
            if (state.asciiChars[i]) state.asciiChars[i].classList.add('selection-highlight');
        }
        
        updateUI();
    }

    function clearSelection() {
        state.selectionStart = -1;
        state.selectionEnd = -1;
        document.querySelectorAll('.selection-highlight').forEach(el => {
            el.classList.remove('selection-highlight');
        });
        updateUI();
    }

    function getSelectedRange() {
        if (state.selectionStart === -1) return null;
        const start = Math.min(state.selectionStart, state.selectionEnd);
        const end = Math.max(state.selectionStart, state.selectionEnd);
        return { start, end, length: end - start + 1 };
    }

    function copy() {
        const selection = getSelectedRange();
        if (!selection) {
            // Copy current byte if no selection
            if (state.activeOffset !== -1) {
                const byte = new DataView(state.buffer).getUint8(state.activeOffset);
                state.clipboard = new Uint8Array([byte]);
            }
            return;
        }
        
        const view = new DataView(state.buffer);
        state.clipboard = new Uint8Array(selection.length);
        for (let i = 0; i < selection.length; i++) {
            state.clipboard[i] = view.getUint8(selection.start + i);
        }
        updateUI();
    }

    function paste() {
        if (!state.clipboard || state.activeOffset === -1) return;
        
        pushUndo();
        const view = new DataView(state.buffer);
        
        for (let i = 0; i < state.clipboard.length && state.activeOffset + i < state.totalBytes; i++) {
            view.setUint8(state.activeOffset + i, state.clipboard[i]);
            
            // Update UI elements
            const offset = state.activeOffset + i;
            if (state.byteInputs[offset]) {
                state.byteInputs[offset].value = state.clipboard[i].toString(16).padStart(2, '0').toUpperCase();
            }
            if (state.asciiChars[offset]) {
                state.asciiChars[offset].textContent = getAsciiChar(state.clipboard[i]);
            }
        }
        
        state.isModified = true;
        renderVisualization();
        updateUI();
    }

    function pushUndo() {
        if (state.undoStack.length >= state.maxUndoSteps) {
            state.undoStack.shift();
        }
        state.undoStack.push(state.buffer.slice());
        state.redoStack = []; // Clear redo stack on new action
        updateUI();
    }

    function undo() {
        if (state.undoStack.length === 0) return;
        
        state.redoStack.push(state.buffer.slice());
        state.buffer = state.undoStack.pop();
        
        state.isModified = state.undoStack.length > 0;
        renderHexEditor();
        renderVisualization();
        updateUI();
    }

    function redo() {
        if (state.redoStack.length === 0) return;
        
        state.undoStack.push(state.buffer.slice());
        state.buffer = state.redoStack.pop();
        
        state.isModified = true;
        renderHexEditor();
        renderVisualization();
        updateUI();
    }

    function handleKeydown(e) {
        if (e.ctrlKey) {
            switch(e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) redo();
                    else undo();
                    break;
                case 'y':
                    e.preventDefault();
                    redo();
                    break;
                case 'c':
                    e.preventDefault();
                    copy();
                    break;
                case 'v':
                    e.preventDefault();
                    paste();
                    break;
                case 'f':
                    e.preventDefault();
                    showFindDialog();
                    break;
                case 'a':
                    e.preventDefault();
                    selectAll();
                    break;
            }
        } else if (e.key === 'Escape') {
            findDialog.classList.remove('show');
            clearSelection();
        }
    }

    function selectAll() {
        if (state.totalBytes === 0) return;
        state.selectionStart = 0;
        state.selectionEnd = state.totalBytes - 1;
        updateSelection(state.selectionEnd);
    }

    // Find functionality
    function showFindDialog() {
        if (state.totalBytes === 0) return;
        findDialog.classList.add('show');
        findInput.focus();
    }

    function findNext() {
        performFind(true);
    }

    function findPrev() {
        performFind(false);
    }

    function findAll() {
        const pattern = getFindPattern();
        if (!pattern) return;
        
        const results = [];
        const view = new DataView(state.buffer);
        
        for (let i = 0; i <= state.totalBytes - pattern.length; i++) {
            let match = true;
            for (let j = 0; j < pattern.length; j++) {
                if (view.getUint8(i + j) !== pattern[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                results.push(i);
            }
        }
        
        alert(`Found ${results.length} occurrences`);
        if (results.length > 0) {
            focusCell(results[0], 'hex');
        }
    }

    function performFind(forward) {
        const pattern = getFindPattern();
        if (!pattern) return;
        
        const view = new DataView(state.buffer);
        const start = state.activeOffset !== -1 ? state.activeOffset : 0;
        const searchStart = forward ? start + 1 : start - 1;
        
        let found = -1;
        
        if (forward) {
            for (let i = searchStart; i <= state.totalBytes - pattern.length; i++) {
                if (matchesPattern(view, i, pattern)) {
                    found = i;
                    break;
                }
            }
        } else {
            for (let i = Math.min(searchStart, state.totalBytes - pattern.length); i >= 0; i--) {
                if (matchesPattern(view, i, pattern)) {
                    found = i;
                    break;
                }
            }
        }
        
        if (found !== -1) {
            focusCell(found, 'hex');
            // Highlight the found pattern
            state.selectionStart = found;
            state.selectionEnd = found + pattern.length - 1;
            updateSelection(state.selectionEnd);
        } else {
            alert('Pattern not found');
        }
    }

    function getFindPattern() {
        const input = findInput.value.trim();
        if (!input) return null;
        
        const isHex = document.getElementById('findHex').checked;
        const pattern = [];
        
        if (isHex) {
            const hexStr = input.replace(/\s+/g, '').replace(/[^0-9A-Fa-f]/g, '');
            if (hexStr.length % 2 !== 0) {
                alert('Invalid hex pattern');
                return null;
            }
            for (let i = 0; i < hexStr.length; i += 2) {
                pattern.push(parseInt(hexStr.substr(i, 2), 16));
            }
        } else {
            const text = document.getElementById('caseSensitive').checked ? input : input.toLowerCase();
            for (let i = 0; i < text.length; i++) {
                pattern.push(text.charCodeAt(i));
            }
        }
        
        return pattern;
    }

    function matchesPattern(view, offset, pattern) {
        for (let i = 0; i < pattern.length; i++) {
            let byte = view.getUint8(offset + i);
            let patternByte = pattern[i];
            
            // Handle case insensitive ASCII search
            if (!document.getElementById('findHex').checked && !document.getElementById('caseSensitive').checked) {
                if (byte >= 65 && byte <= 90) byte += 32; // Convert to lowercase
                if (patternByte >= 65 && patternByte <= 90) patternByte += 32;
            }
            
            if (byte !== patternByte) return false;
        }
        return true;
    }

    // Visualization functions
    function renderVisualization() {
        vizCanvas.innerHTML = '';
        if (!state.buffer) {
            vizCanvas.innerHTML = '<p style="text-align: center; color: #808080; margin-top: 50px;">Load or generate a file</p>';
            return;
        }

        const mode = vizMode.value;
        const width = parseInt(vizWidthSelect.value);
        const view = new DataView(state.buffer);
        
        vizCanvas.style.gridTemplateColumns = `repeat(${width}, 1fr)`;

        const fragment = document.createDocumentFragment();
        const renderFn = {
            'bitmap': renderBitmapVisualization,
            'density': renderDensityVisualization,
            'entropy': renderEntropyVisualization,
            'ascii': renderAsciiVisualization,
        }[mode];

        if(renderFn) renderFn(fragment, view);
        vizCanvas.appendChild(fragment);
    }

    function renderBitmapVisualization(fragment, view) {
        for (let i = 0; i < state.totalBytes; i++) {
            const byte = view.getUint8(i);
            const pixel = document.createElement('div');
            pixel.className = 'viz-pixel';
            pixel.style.backgroundColor = `rgb(${byte}, ${byte}, ${byte})`;
            pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, Value: ${byte} (0x${byte.toString(16).padStart(2, '0').toUpperCase()})`;
            pixel.addEventListener('click', () => focusCell(i, 'hex'));
            fragment.appendChild(pixel);
        }
    }

    function renderDensityVisualization(fragment, view) {
        const frequencies = new Array(256).fill(0);
        for (let i = 0; i < state.totalBytes; i++) frequencies[view.getUint8(i)]++;
        const maxFreq = Math.max(...frequencies.slice(1));
        
        for (let i = 0; i < state.totalBytes; i++) {
            const byte = view.getUint8(i);
            const density = byte === 0 ? 0 : frequencies[byte] / maxFreq;
            const pixel = document.createElement('div');
            pixel.className = 'viz-pixel';
            const intensity = Math.floor(density * 255);
            pixel.style.backgroundColor = `rgb(${255-intensity}, ${intensity}, 0)`;
            pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, Frequency: ${frequencies[byte]}`;
            pixel.addEventListener('click', () => focusCell(i, 'hex'));
            fragment.appendChild(pixel);
        }
    }
    
    function renderEntropyVisualization(fragment, view) {
        const blockSize = 256;
        for (let i = 0; i < state.totalBytes; i++) {
            const blockStart = Math.floor(i / blockSize) * blockSize;
            const entropy = calculateEntropy(view, blockStart, Math.min(blockStart + blockSize, state.totalBytes));
            const pixel = document.createElement('div');
            pixel.className = 'viz-pixel';
            const color = Math.floor(entropy * 255);
            pixel.style.backgroundColor = `rgb(${color}, 0, ${255-color})`;
            pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, Entropy: ${entropy.toFixed(3)}`;
            pixel.addEventListener('click', () => focusCell(i, 'hex'));
            fragment.appendChild(pixel);
        }
    }

    function renderAsciiVisualization(fragment, view) {
        for (let i = 0; i < state.totalBytes; i++) {
            const byte = view.getUint8(i);
            const pixel = document.createElement('div');
            pixel.className = 'viz-pixel';
            if (byte >= 32 && byte <= 126) pixel.style.backgroundColor = '#4caf50'; // Printable
            else if (byte === 0) pixel.style.backgroundColor = '#000000'; // Null
            else if (byte < 32) pixel.style.backgroundColor = '#2196f3'; // Control chars
            else pixel.style.backgroundColor = '#f44336'; // Extended ASCII
            pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, ASCII: ${getAsciiChar(byte)}`;
            pixel.addEventListener('click', () => focusCell(i, 'hex'));
            fragment.appendChild(pixel);
        }
    }

    function calculateEntropy(view, start, end) {
        if (start >= end) return 0;
        const frequencies = new Array(256).fill(0);
        const total = end - start;
        for (let i = start; i < end; i++) frequencies[view.getUint8(i)]++;
        let entropy = 0;
        for (const freq of frequencies) {
            if (freq > 0) entropy -= (freq / total) * Math.log2(freq / total);
        }
        return entropy / 8; // Normalize
    }

    function getAsciiChar(byteValue) {
        return (byteValue >= 32 && byteValue <= 126) ? String.fromCharCode(byteValue) : '.';
    }

    function updateDataInspector(offset) {
        if (offset === -1 || offset >= state.totalBytes) {
            inspByte.textContent = '-';
            inspInt16.textContent = '-';
            inspInt32.textContent = '-';
            inspFloat.textContent = '-';
            return;
        }
        
        const view = new DataView(state.buffer);
        const byte = view.getUint8(offset);
        
        inspByte.textContent = `${byte} (0x${byte.toString(16).padStart(2, '0').toUpperCase()})`;
        
        if (offset + 1 < state.totalBytes) {
            const int16 = view.getInt16(offset, true); // Little endian
            inspInt16.textContent = `${int16} (0x${int16.toString(16).padStart(4, '0').toUpperCase()})`;
        } else {
            inspInt16.textContent = '-';
        }
        
        if (offset + 3 < state.totalBytes) {
            const int32 = view.getInt32(offset, true); // Little endian
            const float32 = view.getFloat32(offset, true);
            inspInt32.textContent = `${int32} (0x${int32.toString(16).padStart(8, '0').toUpperCase()})`;
            inspFloat.textContent = isFinite(float32) ? float32.toPrecision(6) : 'Invalid';
        } else {
            inspInt32.textContent = '-';
            inspFloat.textContent = '-';
        }
    }

    function updateStatusBar() {
        statusFilename.textContent = `File: ${state.fileName}`;
        statusSize.textContent = `Size: ${state.totalBytes} bytes`;
        
        if (state.activeOffset !== -1 && state.activeOffset < state.totalBytes) {
            const byte = new DataView(state.buffer).getUint8(state.activeOffset);
            statusCursor.textContent = `Offset: 0x${state.activeOffset.toString(16).padStart(8, '0').toUpperCase()}`;
            statusValue.textContent = `Value: 0x${byte.toString(16).padStart(2, '0').toUpperCase()} (${byte})`;
        } else {
            statusCursor.textContent = `Offset: -`;
            statusValue.textContent = `Value: -`;
        }
        
        const selection = getSelectedRange();
        if (selection) {
            statusSelection.textContent = `Selection: ${selection.length} bytes`;
        } else {
            statusSelection.textContent = `Selection: -`;
        }
    }

    function updateUI() {
        saveButton.disabled = !state.buffer;
        findButton.disabled = !state.buffer || state.totalBytes === 0;
        undoButton.disabled = state.undoStack.length === 0;
        redoButton.disabled = state.redoStack.length === 0;
        copyButton.disabled = !state.buffer || (state.activeOffset === -1 && !getSelectedRange());
        pasteButton.disabled = !state.clipboard || state.activeOffset === -1;
        
        editIndicator.textContent = state.isModified ? 
            `Modified (${state.undoStack.length} changes)` : 'No changes';
        editIndicator.style.color = state.isModified ? '#cc0000' : '#666666';
        
        updateStatusBar();
    }

    // Initialize
    updateUI();
});