// --- script.js (Firefox Compatible) ---

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileInput = document.getElementById('fileInput');
    const loadButton = document.getElementById('loadButton');
    const saveButton = document.getElementById('saveButton');
    const editorContent = document.getElementById('editorContent');
    const controlsContainer = document.getElementById('controls-container');
    const vizCanvas = document.getElementById('vizCanvas');
    const vizMode = document.getElementById('vizMode');
    const vizWidth = document.getElementById('vizWidth');

    // Status Bar Elements
    const statusFilename = document.getElementById('status-filename');
    const statusSize = document.getElementById('status-size');
    const statusCursor = document.getElementById('status-cursor');
    const statusValue = document.getElementById('status-value');

    // State Variables
    let state = {
        buffer: null,
        fileName: '',
        bytesPerRow: 16,
        byteInputs: [],
        asciiInputs: [],
        totalBytes: 0,
        activeOffset: -1,
        activeInputType: ''
    };

    // Center the controls container
    controlsContainer.style.textAlign = 'center';

    // Event Listeners
    loadButton.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) {
            updateStatus('No file selected!', 'warning');
            return;
        }

        state.fileName = file.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            state.buffer = e.target.result;
            state.totalBytes = state.buffer.byteLength;
            renderHexEditor();
            renderVisualization();
            saveButton.disabled = false;
            updateStatus(`File '${state.fileName}' loaded successfully.`);
            updateStatusBar();
        };
        reader.readAsArrayBuffer(file);
    });

    saveButton.addEventListener('click', () => {
        if (!state.buffer) {
            updateStatus('No file to save!', 'warning');
            return;
        }

        const blob = new Blob([state.buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `edited_${state.fileName}`;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        updateStatus(`File saved as 'edited_${state.fileName}'.`);
    });

    // Visualization event listeners
    vizMode.addEventListener('change', renderVisualization);
    vizWidth.addEventListener('change', renderVisualization);

    // Hex Editor Rendering and Logic
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
            const row = createRowElement(offset, view);
            editorContent.appendChild(row);
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
        const asciiInput = document.createElement('input');
        asciiInput.type = 'text';
        asciiInput.className = 'ascii-input';
        asciiInput.maxLength = state.bytesPerRow;
        asciiInput.setAttribute('data-offset', offset);
        
        for (let i = 0; i < state.bytesPerRow; i++) {
            const byteOffset = offset + i;
            if (byteOffset < state.totalBytes) {
                const byte = view.getUint8(byteOffset);
                const hexInput = createHexInput(byteOffset, byte);
                row.appendChild(hexInput);
                state.byteInputs[byteOffset] = hexInput;
                asciiRowText += getAsciiChar(byte);
            } else {
                const emptyHex = document.createElement('div');
                emptyHex.className = 'hex-input';
                row.appendChild(emptyHex);
            }
        }

        const separator = document.createElement('div');
        separator.className = 'separator';
        row.appendChild(separator);
        
        asciiInput.value = asciiRowText;
        asciiInput.addEventListener('input', e => handleAsciiInput(e, offset));
        asciiInput.addEventListener('keydown', e => handleNavigation(e));
        asciiInput.addEventListener('focus', () => setActiveCell(offset, 'ascii'));
        asciiInput.addEventListener('blur', () => state.activeOffset = -1);

        state.asciiInputs[offset / state.bytesPerRow] = asciiInput;
        row.appendChild(asciiInput);
        
        return row;
    }

    function createHexInput(byteOffset, byte) {
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'hex-input';
        hexInput.value = byte.toString(16).padStart(2, '0').toUpperCase();
        hexInput.maxLength = 2;
        hexInput.setAttribute('data-offset', byteOffset);
        
        hexInput.addEventListener('input', e => handleHexInput(e, byteOffset));
        hexInput.addEventListener('keydown', e => handleNavigation(e));
        hexInput.addEventListener('focus', () => setActiveCell(byteOffset, 'hex'));
        hexInput.addEventListener('blur', () => state.activeOffset = -1);

        return hexInput;
    }

    // Visualization Functions (Firefox Compatible)
    function renderVisualization() {
        console.log('renderVisualization called, buffer exists:', !!state.buffer);
        
        // Clear canvas
        vizCanvas.innerHTML = '';

        if (!state.buffer) {
            vizCanvas.innerHTML = '<p style="text-align: center; color: #808080; margin-top: 50px;">Load a file to see visualization</p>';
            return;
        }

        const mode = vizMode.value;
        const width = parseInt(vizWidth.value);
        const view = new DataView(state.buffer);
        
        
        // Firefox-compatible grid setup
        vizCanvas.className = `viz-canvas viz-mode-${mode}`;
        vizCanvas.style.display = 'grid';
        vizCanvas.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
        vizCanvas.style.gridAutoRows = 'min-content';
        vizCanvas.style.gap = '0';
        vizCanvas.style.alignContent = 'start';

        // Use requestAnimationFrame for better Firefox compatibility
        requestAnimationFrame(() => {
            switch (mode) {
                case 'bitmap':
                    renderBitmapVisualization(view, width);
                    break;
                case 'density':
                    renderDensityVisualization(view, width);
                    break;
                case 'entropy':
                    renderEntropyVisualization(view, width);
                    break;
                case 'ascii':
                    renderAsciiVisualization(view, width);
                    break;
            }
        });
    }

    function renderBitmapVisualization(view, width) {
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < state.totalBytes; i++) {
            const byte = view.getUint8(i);
            const pixel = document.createElement('div');
            pixel.className = 'viz-pixel';
            pixel.style.backgroundColor = `rgb(${byte}, ${byte}, ${byte})`;
            pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, Value: 0x${byte.toString(16).toUpperCase().padStart(2, '0')}`;
            pixel.addEventListener('click', () => scrollToOffset(i));
            fragment.appendChild(pixel);
        }
        
        vizCanvas.appendChild(fragment);
    }

    function renderDensityVisualization(view, width) {
        const frequencies = new Array(256).fill(0);
        for (let i = 0; i < state.totalBytes; i++) {
            frequencies[view.getUint8(i)]++;
        }
        const maxFreq = Math.max(...frequencies);
        
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < state.totalBytes; i++) {
            const byte = view.getUint8(i);
            const density = frequencies[byte] / maxFreq;
            const pixel = document.createElement('div');
            pixel.className = 'viz-pixel';
            const intensity = Math.floor(density * 255);
            pixel.style.backgroundColor = `rgb(${255-intensity}, ${intensity}, 0)`;
            pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, Value: 0x${byte.toString(16).toUpperCase().padStart(2, '0')}, Density: ${(density*100).toFixed(1)}%`;
            pixel.addEventListener('click', () => scrollToOffset(i));
            fragment.appendChild(pixel);
        }
        
        vizCanvas.appendChild(fragment);
    }

    function renderEntropyVisualization(view, width) {
        const blockSize = 256;
        const blocks = Math.ceil(state.totalBytes / blockSize);
        const fragment = document.createDocumentFragment();
        
        for (let block = 0; block < blocks; block++) {
            const start = block * blockSize;
            const end = Math.min(start + blockSize, state.totalBytes);
            const entropy = calculateEntropy(view, start, end);
            
            for (let i = start; i < end; i++) {
                const pixel = document.createElement('div');
                pixel.className = 'viz-pixel';
                const entropyColor = Math.floor(entropy * 255);
                pixel.style.backgroundColor = `rgb(${entropyColor}, 0, ${255-entropyColor})`;
                pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, Block Entropy: ${entropy.toFixed(3)}`;
                pixel.addEventListener('click', () => scrollToOffset(i));
                fragment.appendChild(pixel);
            }
        }
        
        vizCanvas.appendChild(fragment);
    }

    function renderAsciiVisualization(view, width) {
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < state.totalBytes; i++) {
            const byte = view.getUint8(i);
            const pixel = document.createElement('div');
            pixel.className = 'viz-pixel';
            
            if (byte >= 32 && byte <= 126) {
                pixel.style.backgroundColor = '#00FF00'; // Green for printable ASCII
            } else if (byte === 0) {
                pixel.style.backgroundColor = '#000000'; // Black for null
            } else if (byte < 32) {
                pixel.style.backgroundColor = '#0000FF'; // Blue for control chars
            } else {
                pixel.style.backgroundColor = '#FF0000'; // Red for extended ASCII
            }
            
            pixel.title = `Offset: 0x${i.toString(16).toUpperCase()}, Value: 0x${byte.toString(16).toUpperCase().padStart(2, '0')}, Char: ${getAsciiChar(byte)}`;
            pixel.addEventListener('click', () => scrollToOffset(i));
            fragment.appendChild(pixel);
        }
        
        vizCanvas.appendChild(fragment);
    }

    function calculateEntropy(view, start, end) {
        const frequencies = new Array(256).fill(0);
        const total = end - start;
        
        for (let i = start; i < end; i++) {
            frequencies[view.getUint8(i)]++;
        }
        
        let entropy = 0;
        for (let freq of frequencies) {
            if (freq > 0) {
                const probability = freq / total;
                entropy -= probability * Math.log2(probability);
            }
        }
        
        return entropy / 8; // Normalize to 0-1 range
    }

    function scrollToOffset(offset) {
        const hexInput = state.byteInputs[offset];
        if (hexInput) {
            hexInput.focus();
            hexInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Handlers
    function handleHexInput(e, byteOffset) {
        let value = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
        e.target.value = value;
        if (value.length === 2) {
            const byteValue = parseInt(value, 16);
            if (!isNaN(byteValue)) {
                const view = new DataView(state.buffer);
                view.setUint8(byteOffset, byteValue);
                updateAsciiArea(byteOffset, byteValue);
                // Debounce visualization updates for better performance
                if (this.vizUpdateTimeout) clearTimeout(this.vizUpdateTimeout);
                this.vizUpdateTimeout = setTimeout(renderVisualization, 100);
            }
        }
        updateStatusBar(byteOffset);
    }

    function handleAsciiInput(e, rowOffset) {
        const textarea = e.target;
        const rawValue = textarea.value;
        const view = new DataView(state.buffer);
        let cleanedValue = '';
        
        for (let i = 0; i < state.bytesPerRow; i++) {
            const char = rawValue[i];
            const byteOffset = rowOffset + i;
            if (byteOffset < state.totalBytes) {
                const charCode = char ? char.charCodeAt(0) : 0x20; // Default to space
                view.setUint8(byteOffset, charCode);
                updateHexInput(byteOffset, charCode);
                cleanedValue += getAsciiChar(charCode);
            }
        }
        
        // This ensures the displayed value is always the "clean" representation
        textarea.value = cleanedValue;
        // Debounce visualization updates for better performance
        if (this.vizUpdateTimeout) clearTimeout(this.vizUpdateTimeout);
        this.vizUpdateTimeout = setTimeout(renderVisualization, 100);
        updateStatusBar(rowOffset + textarea.selectionStart);
    }

    function handleNavigation(e) {
        if (e.key.startsWith('Arrow')) {
            const isAsciiInput = e.target.classList.contains('ascii-input');
            let nextOffset = state.activeOffset;
            const bytesPerRow = state.bytesPerRow;

            if (e.key === 'ArrowRight') {
                if (isAsciiInput) {
                    // Do not navigate out of the ASCII input
                    return;
                }
                nextOffset++;
            } else if (e.key === 'ArrowLeft') {
                if (isAsciiInput) {
                    // Do not navigate out of the ASCII input
                    return;
                }
                nextOffset--;
            } else if (e.key === 'ArrowDown') {
                nextOffset += bytesPerRow;
            } else if (e.key === 'ArrowUp') {
                nextOffset -= bytesPerRow;
            } else {
                return;
            }

            if (nextOffset >= 0 && nextOffset < state.totalBytes) {
                e.preventDefault();
                const nextInput = isAsciiInput ? state.asciiInputs[Math.floor(nextOffset / bytesPerRow)] : state.byteInputs[nextOffset];
                if (nextInput) {
                    nextInput.focus();
                }
            }
        }
    }

    // UI and State Management
    function setActiveCell(offset, type) {
        // Remove 'active-cell' class from all inputs
        state.byteInputs.forEach(input => input.classList.remove('active-cell'));
        state.asciiInputs.forEach(input => input.classList.remove('active-cell'));

        // Add 'active-cell' to the focused element
        if (type === 'hex') {
            state.byteInputs[offset]?.classList.add('active-cell');
        } else if (type === 'ascii') {
            const asciiIndex = Math.floor(offset / state.bytesPerRow);
            state.asciiInputs[asciiIndex]?.classList.add('active-cell');
        }

        state.activeOffset = offset;
        state.activeInputType = type;
        updateStatusBar(offset);
    }

    function updateHexInput(byteOffset, byteValue) {
        if (state.byteInputs[byteOffset]) {
            state.byteInputs[byteOffset].value = byteValue.toString(16).padStart(2, '0').toUpperCase();
        }
    }

    function updateAsciiArea(byteOffset, byteValue) {
        const rowIndex = Math.floor(byteOffset / state.bytesPerRow);
        const colIndex = byteOffset % state.bytesPerRow;
        const input = state.asciiInputs[rowIndex];
        if (input) {
            const char = getAsciiChar(byteValue);
            input.value = input.value.substring(0, colIndex) + char + input.value.substring(colIndex + 1);
        }
    }

    function getAsciiChar(byteValue) {
        return (byteValue >= 32 && byteValue <= 126) ? String.fromCharCode(byteValue) : '.';
    }

    function updateStatusBar(offset = -1) {
        if (state.buffer) {
            statusFilename.textContent = `File: ${state.fileName}`;
            statusSize.textContent = `Size: ${state.totalBytes} bytes`;
        } else {
            statusFilename.textContent = 'No file loaded';
            statusSize.textContent = 'Size: 0 bytes';
        }
        
        if (offset !== -1 && offset < state.totalBytes) {
            const view = new DataView(state.buffer);
            const byte = view.getUint8(offset);
            statusCursor.textContent = `Offset: ${offset.toString(16).padStart(8, '0').toUpperCase()}`;
            statusValue.textContent = `Value: ${byte.toString(16).padStart(2, '0').toUpperCase()} (0x${byte.toString(16).padStart(2, '0').toUpperCase()})`;
        } else {
            statusCursor.textContent = `Offset: -`;
            statusValue.textContent = `Value: -`;
        }
    }

    function updateStatus(message, type = 'info') {
        const statusDiv = document.querySelector('.status-bar');
        console.log(message);
    }
});