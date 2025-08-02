document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const fileInput = document.getElementById('fileInput');
    const loadButton = document.getElementById('loadButton');
    const saveButton = document.getElementById('saveButton');
    const editorContent = document.getElementById('editorContent');
    const vizCanvas = document.getElementById('vizCanvas');
    const vizMode = document.getElementById('vizMode');
    const vizWidthSelect = document.getElementById('vizWidth');

    // Text-to-Bitmap elements
    const textInput = document.getElementById('textInput');
    const imageWidthInput = document.getElementById('imageWidth');
    const imageHeightInput = document.getElementById('imageHeight');
    const generateButton = document.getElementById('generateButton');
    const generateStatus = document.getElementById('generate-status');

    // Status Bar Elements
    const statusFilename = document.getElementById('status-filename');
    const statusSize = document.getElementById('status-size');
    const statusCursor = document.getElementById('status-cursor');
    const statusValue = document.getElementById('status-value');

    // --- State Variables ---
    let state = {
        buffer: null,
        fileName: 'untitled.txt',
        bytesPerRow: 16,
        byteInputs: [],
        asciiInputs: [],
        totalBytes: 0,
        activeOffset: -1,
    };

    // --- Event Listeners ---
    generateButton.addEventListener('click', handleGenerateBitmap);
    loadButton.addEventListener('click', () => fileInput.click());
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
    });

    vizMode.addEventListener('change', renderVisualization);
    vizWidthSelect.addEventListener('change', renderVisualization);

    // --- Core Functions ---

    /**
     * Handles the "Generate & Load" button click.
     * Creates raw bitmap data from user text and loads it into the editor.
     */
    function handleGenerateBitmap() {
        const text = textInput.value;
        const width = parseInt(imageWidthInput.value, 10);
        const height = parseInt(imageHeightInput.value, 10);

        if (!text) {
            generateStatus.textContent = "Error: Please enter some text to generate an image.";
            return;
        }
        if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
            generateStatus.textContent = "Error: Please enter a valid positive number for width and height.";
            return;
        }

        try {
            const rawBitmapData = createRawBitmapData(text, width, height);
            state.buffer = rawBitmapData;
            state.fileName = 'text_bitmap.txt';
            state.totalBytes = rawBitmapData.byteLength;
            
            // Set visualization to match generated image dimensions
            vizMode.value = 'bitmap';
            vizWidthSelect.value = width;

            renderHexEditor();
            renderVisualization();
            saveButton.disabled = false;
            updateStatusBar();
            generateStatus.textContent = `Generated ${width}x${height} raw bitmap (${state.totalBytes} bytes).`;

        } catch (error) {
            console.error("Bitmap Generation Error:", error);
            generateStatus.textContent = `Error: ${error.message}`;
        }
    }

    /**
     * Creates raw, headerless, monochrome bitmap data from text.
     * @param {string} text - The text to draw.
     * @param {number} width - The width of the bitmap.
     * @param {number} height - The height of the bitmap.
     * @returns {ArrayBuffer} The raw byte data for the bitmap.
     */
    function createRawBitmapData(text, width, height) {
        // 1. Create an offscreen canvas to act as our image buffer
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // ** FIX: Disable anti-aliasing for crisp, pixelated rendering **
        ctx.imageSmoothingEnabled = false;

        // 2. Draw the text onto the canvas
        // Black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        
        // White text
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.textBaseline = 'top';
        
        // Process and draw text line by line, two words at a time
        const lines = text.split('\n');
        let y = 2; // Initial y position
        const lineHeight = 12; // Height of each line of text, including spacing

        for (const line of lines) {
            const words = line.split(' ').filter(w => w.length > 0); // Split by space and remove empty strings
            for (let i = 0; i < words.length; i += 2) {
                const twoWords = words.slice(i, i + 2).join(' ');
                ctx.fillText(twoWords, 2, y);
                y += lineHeight; // Move to the next line for the next pair of words
                if (y > height - lineHeight) break; // Stop if we run out of canvas height
            }
             if (y > height - lineHeight) break;
        }

        // 3. Get the pixel data from the canvas
        const imageData = ctx.getImageData(0, 0, width, height).data;
        
        // 4. Convert RGBA canvas data to monochrome bytes (0x00 or 0xFF)
        const outputBytes = new Uint8Array(width * height);
        for (let i = 0; i < imageData.length; i += 4) {
            // The canvas gives us RGBA. We only need one channel (e.g., Red) to check for color.
            const red = imageData[i];
            const pixelIndex = i / 4;
            
            // If the pixel is closer to white, set byte to 0xFF. Otherwise, 0x00.
            outputBytes[pixelIndex] = (red > 128) ? 0xFF : 0x00;
        }

        return outputBytes.buffer;
    }

    /**
     * Loads binary data from a user-selected file.
     */
    function loadFromFile(file) {
        state.fileName = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            state.buffer = e.target.result;
            state.totalBytes = state.buffer.byteLength;
            renderHexEditor();
            renderVisualization();
            saveButton.disabled = false;
            updateStatusBar();
        };
        reader.readAsArrayBuffer(file);
    }

    /**
     * Renders the grid of hex and ASCII inputs.
     */
    function renderHexEditor() {
        editorContent.innerHTML = '';
        state.byteInputs = [];
        state.asciiInputs = [];

        if (state.totalBytes === 0) {
            editorContent.innerHTML = '<p style="text-align: center;">File is empty.</p>';
            return;
        }

        const view = new DataView(state.buffer);
        for (let offset = 0; offset < state.totalBytes; offset += state.bytesPerRow) {
            editorContent.appendChild(createRowElement(offset, view));
        }
    }

    function createRowElement(offset, view) {
        const row = document.createElement('div');
        row.className = 'hex-editor-grid';

        const address = document.createElement('div');
        address.className = 'address';
        address.textContent = offset.toString(16).padStart(8, '0').toUpperCase();
        row.appendChild(address);
        
        let asciiRowText = '';
        
        for (let i = 0; i < state.bytesPerRow; i++) {
            const byteOffset = offset + i;
            if (byteOffset < state.totalBytes) {
                const byte = view.getUint8(byteOffset);
                const hexInput = createHexInput(byteOffset, byte);
                row.appendChild(hexInput);
                state.byteInputs[byteOffset] = hexInput;
                asciiRowText += getAsciiChar(byte);
            } else {
                row.appendChild(document.createElement('div')); // Placeholder for empty hex
            }
        }

        const separator = document.createElement('div');
        separator.className = 'separator';
        row.appendChild(separator);
        
        const asciiDiv = document.createElement('div');
        asciiDiv.className = 'ascii-input'; // Re-use styling
        asciiDiv.textContent = asciiRowText;
        row.appendChild(asciiDiv);
        
        return row;
    }

    function createHexInput(byteOffset, byte) {
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'hex-input';
        hexInput.value = byte.toString(16).padStart(2, '0').toUpperCase();
        hexInput.maxLength = 2;
        
        hexInput.addEventListener('input', (e) => handleHexInput(e, byteOffset));
        hexInput.addEventListener('focus', () => updateStatusBar(byteOffset));
        return hexInput;
    }

    // --- Visualization Functions ---
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
            pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, Value: ${byte}`;
            pixel.addEventListener('click', () => scrollToOffset(i));
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
            pixel.addEventListener('click', () => scrollToOffset(i));
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
            pixel.addEventListener('click', () => scrollToOffset(i));
            fragment.appendChild(pixel);
        }
    }

    function renderAsciiVisualization(fragment, view) {
        for (let i = 0; i < state.totalBytes; i++) {
            const byte = view.getUint8(i);
            const pixel = document.createElement('div');
            pixel.className = 'viz-pixel';
            if (byte >= 32 && byte <= 126) pixel.style.backgroundColor = '#4caf50';
            else if (byte === 0) pixel.style.backgroundColor = '#000000';
            else if (byte < 32) pixel.style.backgroundColor = '#2196f3';
            else pixel.style.backgroundColor = '#f44336';
            pixel.addEventListener('click', () => scrollToOffset(i));
            fragment.appendChild(pixel);
        }
    }

    // --- Handlers & Helpers ---
    function handleHexInput(e, byteOffset) {
        const value = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
        e.target.value = value;
        if (value.length === 2) {
            const byteValue = parseInt(value, 16);
            new DataView(state.buffer).setUint8(byteOffset, byteValue);
            renderVisualization(); // Re-render viz on change
            // Also update the ASCII view
            const rowElem = e.target.closest('.hex-editor-grid');
            const asciiElem = rowElem.querySelector('.ascii-input');
            const colIndex = byteOffset % state.bytesPerRow;
            asciiElem.textContent = asciiElem.textContent.substring(0, colIndex) + getAsciiChar(byteValue) + asciiElem.textContent.substring(colIndex + 1);
        }
        updateStatusBar(byteOffset);
    }
    
    function scrollToOffset(offset) {
        const hexInput = state.byteInputs[offset];
        if (hexInput) {
            hexInput.focus();
            hexInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    function updateStatusBar(offset = -1) {
        statusFilename.textContent = `File: ${state.fileName}`;
        statusSize.textContent = `Size: ${state.totalBytes} bytes`;
        if (offset !== -1 && offset < state.totalBytes) {
            const byte = new DataView(state.buffer).getUint8(offset);
            statusCursor.textContent = `Offset: ${offset.toString(16).padStart(8, '0').toUpperCase()}`;
            statusValue.textContent = `Value: ${byte.toString(16).padStart(2, '0').toUpperCase()}`;
        } else {
            statusCursor.textContent = `Offset: -`;
            statusValue.textContent = `Value: -`;
        }
    }
});


// TODO : fix text resolution, add obfuscation (random value in 06-FF for text pixels, other way if can find out)