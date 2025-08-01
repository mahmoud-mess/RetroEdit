// --- script.js ---

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileInput = document.getElementById('fileInput');
    const loadButton = document.getElementById('loadButton');
    const saveButton = document.getElementById('saveButton');
    const editorContent = document.getElementById('editorContent');
    const controlsContainer = document.getElementById('controls-container');

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
        asciiInput.addEventListener('input', e => handleAsciiCharInput(e));
        asciiInput.addEventListener('keydown', e => handleAsciiNavigation(e));
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
        hexInput.addEventListener('keydown', e => handleHexNavigation(e));
        hexInput.addEventListener('focus', () => setActiveCell(byteOffset, 'hex'));
        hexInput.addEventListener('blur', () => state.activeOffset = -1);

        return hexInput;
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
            }
        }
        updateStatusBar(byteOffset);
    }

    function handleAsciiCharInput(e) {
        const input = e.target;
        const rowOffset = parseInt(input.dataset.offset, 10);
        const cursorPosition = input.selectionStart;
        const newValue = input.value;
        
        // Find the character that was changed
        let changedChar = null;
        let changedIndex = -1;
        for (let i = 0; i < newValue.length; i++) {
            if (i >= state.bytesPerRow || newValue[i] !== getAsciiChar(new DataView(state.buffer).getUint8(rowOffset + i))) {
                changedChar = newValue[i];
                changedIndex = i;
                break;
            }
        }

        // If a change was detected
        if (changedChar !== null && changedIndex !== -1 && rowOffset + changedIndex < state.totalBytes) {
            const byteOffset = rowOffset + changedIndex;
            const charCode = changedChar.charCodeAt(0);
            
            const view = new DataView(state.buffer);
            view.setUint8(byteOffset, charCode);
            
            // Update the hex input and ensure the ASCII display is "clean"
            updateHexInput(byteOffset, charCode);
        } else if (newValue.length < getCleanAsciiRow(rowOffset).length) {
            // Handle deletions
            const deletedIndex = newValue.length;
            const byteOffset = rowOffset + deletedIndex;
            if (byteOffset < state.totalBytes) {
                const view = new DataView(state.buffer);
                view.setUint8(byteOffset, 0x20); // Replace with space
                updateHexInput(byteOffset, 0x20);
            }
        }
        
        // After any change, re-render the clean row and restore cursor
        const cleanRow = getCleanAsciiRow(rowOffset);
        input.value = cleanRow;
        input.selectionStart = input.selectionEnd = cursorPosition;

        updateStatusBar(rowOffset + cursorPosition);
    }

    function getCleanAsciiRow(rowOffset) {
        const view = new DataView(state.buffer);
        let asciiRowText = '';
        for (let i = 0; i < state.bytesPerRow; i++) {
            const byteOffset = rowOffset + i;
            if (byteOffset < state.totalBytes) {
                const byte = view.getUint8(byteOffset);
                asciiRowText += getAsciiChar(byte);
            } else {
                asciiRowText += ' '; // Pad with spaces for incomplete rows
            }
        }
        return asciiRowText.trimEnd(); // Trim trailing spaces for a cleaner look
    }

    function handleHexNavigation(e) {
        if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            let nextOffset = state.activeOffset;
            const bytesPerRow = state.bytesPerRow;

            if (e.key === 'ArrowRight') nextOffset++;
            else if (e.key === 'ArrowLeft') nextOffset--;
            else if (e.key === 'ArrowDown') nextOffset += bytesPerRow;
            else if (e.key === 'ArrowUp') nextOffset -= bytesPerRow;

            if (nextOffset >= 0 && nextOffset < state.totalBytes) {
                state.byteInputs[nextOffset].focus();
            }
        }
    }

    function handleAsciiNavigation(e) {
        if (e.key.startsWith('Arrow')) {
            const input = e.target;
            const rowOffset = parseInt(input.dataset.offset, 10);
            let nextOffset = rowOffset + input.selectionStart;
            const bytesPerRow = state.bytesPerRow;

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const cursorPosition = input.selectionStart;
                if (cursorPosition < state.bytesPerRow && nextOffset < state.totalBytes - 1) {
                     input.selectionStart = input.selectionEnd = cursorPosition + 1;
                } else if (nextOffset < state.totalBytes - 1) {
                    const nextAsciiInput = state.asciiInputs[Math.floor((nextOffset + 1) / bytesPerRow)];
                    if(nextAsciiInput) nextAsciiInput.focus();
                }
            }
            else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const cursorPosition = input.selectionStart;
                if (cursorPosition > 0) {
                    input.selectionStart = input.selectionEnd = cursorPosition - 1;
                } else if (nextOffset > 0) {
                    const prevAsciiInput = state.asciiInputs[Math.floor((nextOffset - 1) / bytesPerRow)];
                    if(prevAsciiInput) {
                        prevAsciiInput.focus();
                        prevAsciiInput.selectionStart = prevAsciiInput.selectionEnd = prevAsciiInput.value.length;
                    }
                }
            }
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                nextOffset += bytesPerRow;
                if (nextOffset < state.totalBytes) {
                    const nextInput = state.asciiInputs[Math.floor(nextOffset / bytesPerRow)];
                    if(nextInput) nextInput.focus();
                }
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                nextOffset -= bytesPerRow;
                if (nextOffset >= 0) {
                    const nextInput = state.asciiInputs[Math.floor(nextOffset / bytesPerRow)];
                    if(nextInput) nextInput.focus();
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
        const input = state.asciiInputs[rowIndex];
        if (input) {
            input.value = getCleanAsciiRow(rowIndex * state.bytesPerRow);
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