document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const loadButton = document.getElementById('loadButton');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');
    const editorContent = document.getElementById('editorContent');

    let modifiedBuffer = null;
    let fileName = 'edited_file';
    const bytesPerRow = 16;
    const byteInputs = [];
    const charInputs = [];

    loadButton.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) {
            statusDiv.textContent = 'Please select a file first!';
            return;
        }

        fileName = `edited_${file.name}`;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            modifiedBuffer = e.target.result;
            renderHexEditor(modifiedBuffer);
            saveButton.style.display = 'inline-block';
            statusDiv.textContent = `File '${file.name}' loaded.`;
        };
        reader.readAsArrayBuffer(file);
    });

    saveButton.addEventListener('click', () => {
        if (!modifiedBuffer) {
            statusDiv.textContent = 'No file to save!';
            return;
        }

        const blob = new Blob([modifiedBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        statusDiv.textContent = `File saved as '${fileName}'.`;
    });

    function renderHexEditor(buffer) {
        editorContent.innerHTML = '';
        byteInputs.length = 0;
        charInputs.length = 0;
        const totalBytes = buffer.byteLength;
        const view = new DataView(buffer);

        for (let offset = 0; offset < totalBytes; offset += bytesPerRow) {
            const row = document.createElement('div');
            row.className = 'hex-editor-grid';

            const address = document.createElement('div');
            address.className = 'address';
            address.textContent = offset.toString(16).padStart(8, '0');
            row.appendChild(address);
            
            for (let i = 0; i < bytesPerRow; i++) {
                const byteOffset = offset + i;
                if (byteOffset < totalBytes) {
                    const byte = view.getUint8(byteOffset);
                    const hexInput = document.createElement('input');
                    hexInput.type = 'text';
                    hexInput.className = 'hex-input';
                    hexInput.value = byte.toString(16).padStart(2, '0');
                    hexInput.maxLength = 2;
                    hexInput.setAttribute('data-offset', byteOffset);
                    hexInput.addEventListener('input', e => handleHexInput(e, byteOffset));
                    hexInput.addEventListener('keydown', e => handleNavigation(e, byteOffset));
                    
                    byteInputs[byteOffset] = hexInput;
                    row.appendChild(hexInput);
                } else {
                    const emptyHex = document.createElement('div');
                    emptyHex.className = 'hex-input';
                    row.appendChild(emptyHex);
                }
            }

            const separator = document.createElement('div');
            separator.className = 'separator';
            row.appendChild(separator);

            for (let i = 0; i < bytesPerRow; i++) {
                const byteOffset = offset + i;
                if (byteOffset < totalBytes) {
                    const byte = view.getUint8(byteOffset);
                    const charInput = document.createElement('input');
                    charInput.type = 'text';
                    charInput.className = 'char-input';
                    charInput.value = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
                    charInput.maxLength = 1;
                    charInput.setAttribute('data-offset', byteOffset);
                    charInput.addEventListener('input', e => handleCharInput(e, byteOffset));
                    
                    charInputs[byteOffset] = charInput;
                    row.appendChild(charInput);
                } else {
                    const emptyChar = document.createElement('div');
                    emptyChar.className = 'char-input';
                    row.appendChild(emptyChar);
                }
            }

            editorContent.appendChild(row);
        }
    }

    // Handles changes in a hex input field
    function handleHexInput(e, byteOffset) {
        let value = e.target.value.toLowerCase().replace(/[^0-9a-f]/g, '');
        e.target.value = value;
        if (value.length === 2) {
            const byteValue = parseInt(value, 16);
            if (!isNaN(byteValue)) {
                const view = new DataView(modifiedBuffer);
                view.setUint8(byteOffset, byteValue);
                updateCharInput(byteOffset, byteValue);
            }
        }
    }

    // Handles changes in a character input field
    function handleCharInput(e, byteOffset) {
        let value = e.target.value.substring(0, 1);
        if (value.length === 0) {
            e.target.value = '.';
            value = '.';
        }
        const byteValue = value.charCodeAt(0);
        
        const view = new DataView(modifiedBuffer);
        view.setUint8(byteOffset, byteValue);
        updateHexInput(byteOffset, byteValue);
    }
    
    // Updates the hex input field for a given offset
    function updateHexInput(byteOffset, byteValue) {
        if (byteInputs[byteOffset]) {
            byteInputs[byteOffset].value = byteValue.toString(16).padStart(2, '0');
        }
    }

    // Updates the character input field for a given offset
    function updateCharInput(byteOffset, byteValue) {
        if (charInputs[byteOffset]) {
            charInputs[byteOffset].value = (byteValue >= 32 && byteValue <= 126) ? String.fromCharCode(byteValue) : '.';
        }
    }

    function handleNavigation(e, byteOffset) {
        let nextOffset = byteOffset;
        const key = e.key;

        if (key === 'ArrowRight') {
            nextOffset++;
        } else if (key === 'ArrowLeft') {
            nextOffset--;
        } else if (key === 'ArrowDown') {
            nextOffset += bytesPerRow;
        } else if (key === 'ArrowUp') {
            nextOffset -= bytesPerRow;
        } else {
            return;
        }
        
        const nextInput = byteInputs[nextOffset];
        if (nextInput) {
            e.preventDefault();
            nextInput.focus();
        }
    }
});