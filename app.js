const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FLAT_TO_SHARP = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
};

// DOM Elements
const songListEl = document.getElementById('song-list');
const songTitleEl = document.getElementById('song-title');
const songControlsEl = document.getElementById('song-controls');
const audioContainer = document.getElementById('audio-container');
const cypherContentEl = document.getElementById('cypher-content');
const cypherAreaEl = document.getElementById('cypher-area');
const currentKeyEl = document.getElementById('current-key');
const btnTransposeUp = document.getElementById('btn-transpose-up');
const btnTransposeDown = document.getElementById('btn-transpose-down');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const sidebarToggleBtn = document.getElementById('toggle-sidebar-btn');
const sidebarEl = document.getElementById('sidebar');

// Drawing Elements
const drawingCanvas = document.getElementById('drawing-canvas');
const ctx = drawingCanvas.getContext('2d');
const btnDrawToggle = document.getElementById('btn-draw-toggle');
const btnDrawUndo = document.getElementById('btn-draw-undo');
const btnDrawClear = document.getElementById('btn-draw-clear');

// State
let songs = [];
let currentSong = null;
let currentTransposeOffset = 0;
let originalKey = '';

// Drawing State
let isDrawingMode = false;
let isDrawing = false;
let currentStrokes = [];
let currentPath = [];

// Initialization
async function init() {
    setupEventListeners();
    try {
        const response = await fetch('./src/cyphers.json');
        if (!response.ok) throw new Error('Failed to load JSON');
        songs = await response.json();
        renderSongList();
    } catch (error) {
        console.error('Error loading songs:', error);
        cypherContentEl.innerHTML = `
            <div class="placeholder-text">
                <ion-icon name="warning-outline"></ion-icon>
                <p>Erro ao carregar as músicas. Certifique-se de estar rodando em um servidor local.</p>
            </div>
        `;
    }
}

function setupEventListeners() {
    themeToggleBtn.addEventListener('click', toggleTheme);
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
    
    btnTransposeUp.addEventListener('click', () => transpose(+1));
    btnTransposeDown.addEventListener('click', () => transpose(-1));

    // Drawing Events
    btnDrawToggle.addEventListener('click', toggleDrawingMode);
    btnDrawUndo.addEventListener('click', undoDrawing);
    btnDrawClear.addEventListener('click', clearDrawing);

    drawingCanvas.addEventListener('pointerdown', startDrawing);
    drawingCanvas.addEventListener('pointermove', draw);
    drawingCanvas.addEventListener('pointerup', endDrawing);
    drawingCanvas.addEventListener('pointercancel', endDrawing);
    drawingCanvas.addEventListener('pointerout', endDrawing);

    window.addEventListener('resize', () => {
        if (currentSong) resizeCanvasAndRedraw();
    });

    // Fechar barra lateral ao clicar fora dela no mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !sidebarEl.classList.contains('collapsed')) {
            const isClickInsideSidebar = sidebarEl.contains(e.target);
            const isClickOnToggle = sidebarToggleBtn.contains(e.target);
            if (!isClickInsideSidebar && !isClickOnToggle) {
                sidebarEl.classList.add('collapsed');
            }
        }
    });
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}

function toggleSidebar() {
    sidebarEl.classList.toggle('collapsed');
}

function renderSongList() {
    songListEl.innerHTML = '';
    songs.forEach(song => {
        const li = document.createElement('li');
        li.innerHTML = `
            <ion-icon name="musical-note"></ion-icon>
            ${song.titulo}
        `;
        li.addEventListener('click', () => {
            if (currentSong && currentSong.id === song.id) {
                if (window.innerWidth <= 768) {
                    sidebarEl.classList.add('collapsed');
                }
                return; // Evita recarregar a mesma música
            }

            document.querySelectorAll('.song-list li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            loadSong(song);
            if (window.innerWidth <= 768) {
                sidebarEl.classList.add('collapsed');
            }
        });
        songListEl.appendChild(li);
    });
}

function loadSong(song) {
    currentSong = song;
    songTitleEl.textContent = song.titulo;
    songControlsEl.style.display = 'flex';
    
    // Audio
    audioContainer.innerHTML = '';
    if (song.audio_urls && Array.isArray(song.audio_urls)) {
        song.audio_urls.forEach(track => {
            const trackDiv = document.createElement('div');
            trackDiv.className = 'audio-track';
            trackDiv.innerHTML = `
                <span class="audio-label">${track.title}:</span>
                <audio controls src="${track.url}"></audio>
            `;
            audioContainer.appendChild(trackDiv);
        });
    } else if (song.audio_url) {
        audioContainer.innerHTML = `<audio controls src="${song.audio_url}"></audio>`;
    }
    
    // Transposer State
    currentTransposeOffset = 0;
    originalKey = song.tom_original || 'C';
    updateKeyDisplay();
    
    // Scroll State
    cypherAreaEl.scrollTop = 0;
    
    // Render Cypher
    renderCypher(song.cifra_chordpro);

    // Desativar modo desenho ao carregar nova música
    isDrawingMode = false;
    cypherAreaEl.classList.remove('drawing-mode');
    btnDrawToggle.classList.remove('active');
    btnDrawUndo.style.display = 'none';
    btnDrawClear.style.display = 'none';

    // Esperar a renderização do DOM para pegar as dimensões corretas da cifra
    setTimeout(() => {
        loadStrokes();
        resizeCanvasAndRedraw();
    }, 50);
}

function renderCypher(chordproText) {
    // Salva o canvas antes de limpar a div para que ele não seja destruído
    const canvas = document.getElementById('drawing-canvas');
    cypherContentEl.innerHTML = '';
    if (canvas) cypherContentEl.appendChild(canvas);

    const lines = chordproText.split('\n');
    
    lines.forEach(line => {
        const lineEl = document.createElement('div');
        lineEl.className = 'cypher-line';
        
        // Handle Section Tags e.g., {Verso 1}
        if (line.startsWith('{') && line.endsWith('}')) {
            const sectionSpan = document.createElement('span');
            sectionSpan.className = 'section-tag';
            sectionSpan.textContent = line.slice(1, -1);
            lineEl.appendChild(sectionSpan);
            cypherContentEl.appendChild(lineEl);
            return;
        }
        
        // Handle Chords and Lyrics
        // Regex splits the string by [Chord], returning array: [lyric, chord, lyric, chord, ...]
        const parts = line.split(/\[(.*?)\]/g);
        
        // First part is always lyric (before first chord)
        if (parts[0]) {
            const group = createChordGroup('', parts[0]);
            lineEl.appendChild(group);
        }
        
        for (let i = 1; i < parts.length; i += 2) {
            const chord = parts[i];
            const lyric = parts[i + 1] || ''; // Handle if lyric is empty
            const group = createChordGroup(chord, lyric);
            lineEl.appendChild(group);
        }
        
        cypherContentEl.appendChild(lineEl);
    });
}

function createChordGroup(chordText, lyricText) {
    const group = document.createElement('span');
    group.className = 'chord-group';
    
    const chordSpan = document.createElement('span');
    chordSpan.className = 'chord';
    if (chordText) {
        chordSpan.textContent = chordText;
        chordSpan.setAttribute('data-original', chordText); // Store original for transposition
    } else {
        chordSpan.textContent = '\u200b'; // Zero-width space garante a mesma altura/baseline
    }
    
    const lyricSpan = document.createElement('span');
    lyricSpan.className = 'lyric';
    lyricSpan.textContent = lyricText;
    
    group.appendChild(chordSpan);
    group.appendChild(lyricSpan);
    
    return group;
}

// --- Transposer Logic ---

function normalizeNote(note) {
    return FLAT_TO_SHARP[note] || note;
}

function transposeNote(noteString, steps) {
    // Regex to extract Root Note (A-G with optional # or b) and the rest (m, 7, sus4, etc.)
    const match = noteString.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return noteString; // Cannot parse, return as is
    
    let root = normalizeNote(match[1]);
    let modifier = match[2];
    
    let index = NOTES.indexOf(root);
    if (index === -1) return noteString; // Not found in array
    
    // Calculate new index with positive modulo
    let newIndex = (index + steps) % 12;
    if (newIndex < 0) newIndex += 12;
    
    return NOTES[newIndex] + modifier;
}

function transposeSingleChord(chordString, steps) {
    // Split by '/' to handle bass notes (e.g., D/F#)
    const parts = chordString.split('/');
    const transposedParts = parts.map(part => transposeNote(part, steps));
    return transposedParts.join('/');
}

function transpose(steps) {
    currentTransposeOffset += steps;
    
    const chordElements = document.querySelectorAll('.chord[data-original]');
    chordElements.forEach(el => {
        const originalChord = el.getAttribute('data-original');
        el.textContent = transposeSingleChord(originalChord, currentTransposeOffset);
    });
    
    updateKeyDisplay();
}

function updateKeyDisplay() {
    if (currentTransposeOffset === 0) {
        currentKeyEl.textContent = originalKey;
    } else {
        const newKey = transposeNote(originalKey, currentTransposeOffset);
        const sign = currentTransposeOffset > 0 ? '+' : '';
        currentKeyEl.textContent = `${newKey} (${sign}${currentTransposeOffset})`;
    }
}

// --- Drawing Logic ---

function toggleDrawingMode() {
    if (!currentSong) return;
    isDrawingMode = !isDrawingMode;
    cypherAreaEl.classList.toggle('drawing-mode', isDrawingMode);
    btnDrawToggle.classList.toggle('active', isDrawingMode);
    
    if (isDrawingMode) {
        btnDrawUndo.style.display = 'flex';
        btnDrawClear.style.display = 'flex';
        resizeCanvasAndRedraw();
    } else {
        btnDrawUndo.style.display = 'none';
        btnDrawClear.style.display = 'none';
    }
}

function resizeCanvasAndRedraw() {
    if (!currentSong) return;
    const width = cypherContentEl.scrollWidth;
    const height = cypherContentEl.scrollHeight;
    
    if (drawingCanvas.width !== width || drawingCanvas.height !== height) {
        drawingCanvas.width = width;
        drawingCanvas.height = height;
    }
    redrawCanvas();
}

function getPos(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startDrawing(e) {
    if (!isDrawingMode) return;
    isDrawing = true;
    currentPath = [getPos(e)];
    drawPoint(currentPath[0]);
}

function draw(e) {
    if (!isDrawing || !isDrawingMode) return;
    const pos = getPos(e);
    currentPath.push(pos);
    
    const prevPos = currentPath[currentPath.length - 2];
    drawLine(prevPos, pos);
}

function endDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentPath.length > 0) {
        currentStrokes.push(currentPath);
        saveStrokes();
    }
    currentPath = [];
}

function drawPoint(pos) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 69, 58, 0.7)'; // Vermelho suave translúcido
    ctx.fill();
    ctx.closePath();
}

function drawLine(p1, p2) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = 'rgba(255, 69, 58, 0.7)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    currentStrokes.forEach(path => {
        if (path.length === 1) {
            drawPoint(path[0]);
        } else {
            for (let i = 1; i < path.length; i++) {
                drawLine(path[i-1], path[i]);
            }
        }
    });
}

function undoDrawing() {
    if (currentStrokes.length > 0) {
        currentStrokes.pop();
        saveStrokes();
        redrawCanvas();
    }
}

function clearDrawing() {
    if (confirm('Tem certeza que deseja apagar todos os desenhos desta cifra?')) {
        currentStrokes = [];
        saveStrokes();
        redrawCanvas();
    }
}

function saveStrokes() {
    if (!currentSong) return;
    localStorage.setItem('drawings_' + currentSong.id, JSON.stringify(currentStrokes));
}

function loadStrokes() {
    if (!currentSong) return;
    const saved = localStorage.getItem('drawings_' + currentSong.id);
    if (saved) {
        try {
            currentStrokes = JSON.parse(saved);
        } catch(e) {
            currentStrokes = [];
        }
    } else {
        currentStrokes = [];
    }
}



// Start
init();
