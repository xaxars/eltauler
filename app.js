// El Tauler - Entrenador d'Escacs PWA
// app.js - Lògica principal de l'aplicació

const APP_VERSION = window.APP_VERSION || 'dev';
const STOCKFISH_URL = `stockfish.js?v=${APP_VERSION}`;
const DEBUG_ENRICHED_ANALYSIS = false;

let game = null;
let board = null;
let stockfish = null;
let stockfishReady = false;
let pendingEngineFirstMove = false;
let userELO = 50; 
let engineELO = 50;
let savedErrors = [];
let currentReview = [];
let reviewHistory = [];
let reviewChart = null;
let currentGameErrors = [];
let matchErrorQueue = [];
let currentMatchError = null;
let isMatchErrorReviewSession = false;
let reviewAutoCloseTimer = null;
let reviewOpenDelayTimer = null;
let openingBundleBoard = null;
let openingPracticeGame = null;
let openingPracticeMoveCount = 0;
const OPENING_PRACTICE_MAX_PLIES = 20;
let openingPracticeEngineThinking = false;
let openingMaximPending = false;
let lastOpeningMaxim = null;
let openingPracticeHintPending = false;
let openingPracticeBestMove = null;
// Variables per a la precisió del tauler d'obertures
let openingPracticeGoodMoves = 0;
let openingPracticeTotalMoves = 0;
let openingPracticeAnalysisPending = false;
let openingPracticeLastFen = null;
let openingPracticeLastMove = null;
let openingPracticePendingAnalysis = null; // Guardar anàlisi pendent mentre l'engine pensa
let openingPracticeHistory = []; // Historial de moviments per undo
// Variables per a l'anàlisi de precisió en dos passos (com partida lliure)
let openingAnalysisStep = 0; // 0 = no actiu, 1 = analitzant posició abans, 2 = analitzant posició després
let openingEvalBefore = null;
let openingEvalAfter = null;
let openingBestMove = null;
let openingTempScore = null;
let openingFenAfterMove = null; // FEN després del moviment per a la segona anàlisi
// Sistema de feedback instantani per obertures
let openingPreCalcBestMove = null; // Millor moviment pre-calculat per a la posició actual
let openingPreCalcPending = false; // Indica si estem calculant el millor moviment
let openingPreCalcFen = null; // FEN per al qual s'ha calculat el millor moviment
let openingLastMoveQuality = null; // Qualitat de l'últim moviment ('correct', 'good', 'incorrect')
// Sistema de callback per assegurar precisió abans del moviment de l'engine
let openingPendingUserMove = null; // {movePlayed, from, to} - Moviment de l'usuari pendent d'avaluar
let openingNeedsEngineMove = false; // Indica si cal demanar moviment de l'engine després de la precisió
// Sistema de tokens per evitar conflictes entre handlers de Stockfish
let stockfishRequestor = null; // Identificador de qui ha fet l'última petició

// Sistema d'obertures per calcular precisió
let openingTrie = null; // Estructura trie per cercar obertures
let openingCurrentSequence = []; // Seqüència actual de moviments (SAN)
let openingMatchedOpenings = []; // Obertures que coincideixen amb la seqüència actual
let openingSelectedOpening = null; // Obertura seleccionada (la més llarga que coincideix)
let openingNextMoveHint = null; // Següent moviment de l'obertura per a la pista

// Pràctica d'errors d'obertura
let openingErrorPracticeActive = false;
let openingErrorCurrentPositions = []; // Posicions d'error disponibles
let openingErrorCurrentFen = null; // FEN actual que s'està practicant
let openingErrorBestMove = null; // Millor moviment esperat
let openingErrorColorFilter = null; // 'w' o 'b'
let openingErrorMoveFilter = null; // Número de moviment
let openingErrorMovesRemaining = 2; // Jugades restants per completar
let openingErrorCurrentIndex = -1; // Índex de la posició actual

let gameHistory = [];
let historyBoard = null;
let historyReplay = null;
let lastBundleGeminiHint = null
let tvBoard = null;
let tvReplay = null;
let tvJeroglyphicsActive = false;
let tvJeroglyphicsAnalyzing = false;
let tvJeroglyphicsHinting = false;
let tvJeroglyphicsTopMoves = [];
let tvJeroglyphicsPvMoves = {};
let tvJeroglyphicsTargetIndex = null;
let tvJeroglyphicsActualMove = null;
let tvJeroglyphicsResumePlayback = false;
let tvJeroglyphicsSolved = false;
let tvJeroglyphicsIncorrect = false;

// Sistema d'IA Adaptativa
let recentGames = []; 
let aiDifficulty = 8; 
const ADAPTIVE_CONFIG = {
    MIN_LEVEL: 50,
    MAX_LEVEL: 3000,
    DEFAULT_LEVEL: 75,
    WIN_PRECISION_HIGH: 80,
    WIN_PRECISION_MID: 65,
    LOSS_PRECISION_HIGH: 60,
    LOSS_PRECISION_MID: 45,
    BOOST_HIGH: 50,
    BOOST_MID: 35,
    BOOST_LOW: 15,
    PENALTY_SOFT: -15,
    PENALTY_MID: -30,
    PENALTY_STRONG: -50,
    DRAW_BONUS: 10,
    STREAK_WIN_BONUS: 30,
    STREAK_LOSS_PENALTY: -25,
    FLOW_WINDOW_MIN: 5,
    FLOW_SAMPLE_SIZE: 10,
    FLOW_WINRATE_HIGH: 0.6,
    FLOW_WINRATE_LOW: 0.4,
    FLOW_DELTA: 30,
    MAX_DELTA: 60
};
const CONTINUOUS_ADJUST_CONFIG = {
    WINDOW_SIZE: 3,
    WIN_THRESHOLD: 2,
    LOSS_THRESHOLD: 2,
    WIN_ELO: 50,
    LOSS_ELO: -30,
    MAX_CYCLE_DELTA: 100,
    QUALITY_HIGH: 0.7,
    ERROR_PRECISION_MAX: 60,
    ERROR_CPLOSS_MIN: 140,
    ERROR_BLUNDERS_MIN: 2,
    LOSS_STREAK_TRIGGER: 5,
    LOSS_STREAK_DELTA: -50
};
const ELO_MILESTONES = [800, 1000, 1200, 1400, 1600, 1800, 2000];
const ERROR_WINDOW_N = 30;
const TH_ERR = 80;
const ELO_MIN = 200;
const ELO_MAX = 2000;
const CALIBRATION_ENGINE_PRECISION_RANGES = [
    { min: 45, max: 50 },
    { min: 52, max: 58 },
    { min: 58, max: 65 },
    { min: 65, max: 72 },
    { min: 72, max: 78 }
];
const CALIBRATION_GAME_COUNT = 5;
const CALIBRATION_ROCS = [300, 500, 600, 800, 900];
const CALIBRATION_DEPTHS = [5, 8, 10];
const CALIBRATION_ROC_MIN = 200;
const CALIBRATION_ROC_MAX = 2000;
const LEAGUE_UNLOCK_MIN_GAMES = CALIBRATION_GAME_COUNT + 1;
let recentErrors = [];
let currentElo = clampEngineElo(ADAPTIVE_CONFIG.DEFAULT_LEVEL);
aiDifficulty = levelToDifficulty(currentElo);
let consecutiveWins = 0;
let consecutiveLosses = 0;
let freeAdjustmentWindow = [];
let adjustmentLog = [];
let lastAdjustmentQualityAvg = null;
let freeLossStreak = 0;
let calibrationRocFloor = null;
let unlockedEloMilestones = [];
let isCalibrating = true;
let calibrationGames = [];
let calibrationProfile = null;
let calibratgeComplet = false;
let isCalibrationGame = false;
let currentCalibrationOpponentRoc = null;
let isEngineThinking = false;
let engineMoveCandidates = [];
let lastReviewSnapshot = null;
let calibrationResultsChart = null;
let currentGameStartTs = null;

let lastPosition = null; 
let blunderMode = false;
let currentBundleFen = null;
let currentBundleSeverity = null;
let currentBundleSource = null;
let playerColor = 'w';
let isRandomBundleSession = false;
let bundleSequenceStep = 1;
let bundleSequenceStartFen = null;
let bundleStepStartFen = null;
let bundleStrictPvLine = [];
let bundleStrictPvDepth = 0;
let bundleFixedSequence = null;
let bundleAutoReplyPending = false;
let bundleGeminiHintPending = false;
const LEAGUE_QUOTES = [
    "“El millor moment per jugar és ara.”",
    "“La sort somriu als valents.”",
    "“El tauler és teu, confia en el teu pla.”",
    "“Cada partida és una oportunitat de créixer.”",
    "“Aprofita la iniciativa!”",
    "“La preparació és mitja victòria.”",
    "“El rival també dubta; lidera tu.”",
    "“Juga amb calma, acaba amb força.”"
];

let totalPlayerMoves = 0;
let goodMoves = 0;
let pendingMoveEvaluation = false;
let totalEngineMoves = 0;
let goodEngineMoves = 0;

// Controls tàctils (tap-to-move)
let tapSelectedSquare = null;
let tapMoveEnabled = false;
let lastTapEventTs = 0;
let tvTapSelectedSquare = null;
let tvTapMoveEnabled = false;
let tvLastTapEventTs = 0;

// Controls tàctils per al tauler d'obertures
let openingTapSelectedSquare = null;
let openingTapMoveEnabled = false;
let openingLastTapEventTs = 0;

let deviceType = 'desktop';

function detectDeviceType() {
    const ua = (navigator && navigator.userAgent ? navigator.userAgent : '').toLowerCase();
    const minSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    const touch = isTouchDevice();

    const isTabletUA = /ipad|tablet|kindle|silk|playbook/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua));
    const isMobileUA = /mobi|iphone|ipod|android.*mobile|windows phone/.test(ua);

    if (isTabletUA || (touch && minSide >= 600 && minSide <= 1100)) return 'tablet';
    if (isMobileUA || (touch && minSide < 600)) return 'mobile';
    return 'desktop';
}

function applyDeviceType(type) {
    deviceType = type;
    document.body.dataset.device = type;
    document.body.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
    document.body.classList.add(`device-${type}`);
}

function updateDeviceType() {
    const detected = detectDeviceType();
    if (detected !== deviceType) {
        applyDeviceType(detected);
        resizeBoardToViewport();
        updateTvBoardInteractivity();        
    } else if (!document.body.classList.contains(`device-${detected}`)) {
        applyDeviceType(detected);
        updateTvBoardInteractivity();
    }
}

function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
}

// Control del tauler (Tocar / Arrossegar)
const CONTROL_MODE_KEY = 'eltauler_control_mode';
let controlMode = null;

// Revisió d'errors (Bundle): validar només la millor jugada o les 2 millors
const BUNDLE_ACCEPT_MODE_KEY = 'eltauler_bundle_accept_mode';
let bundleAcceptMode = 'top1'; // 'top1' o 'top2'
const bundleAnswerCache = new Map();

const GEMINI_API_KEY_STORAGE = 'chess_gemini_api_key';
const GEMINI_MODEL_ID = 'gemini-3-flash-preview';
let geminiApiKey = null;

const EPAPER_MODE_KEY = 'eltauler_epaper_mode';
let epaperEnabled = false;
const TV_JEROGLYPHICS_KEY = 'eltauler_tv_jeroglyphics';
const TV_JEROGLYPHICS_START = 15;
const TV_JEROGLYPHICS_INTERVAL = 20;
const TV_JEROGLYPHICS_END_BUFFER = 5;
let tvJeroglyphicsEnabled = false;
const BACKUP_DIR_DB = 'eltauler_backup_dir_db';
const BACKUP_DIR_STORE = 'handles';
const BACKUP_DIR_KEY = 'backupDir';
let backupDirHandle = null;

function loadBundleAcceptMode() {
    try {
        const v = localStorage.getItem(BUNDLE_ACCEPT_MODE_KEY);
        if (v === 'top1' || v === 'top2') return v;
        if (v === 'any') return 'top1';
    } catch (e) {}
    return 'top1';
}

function saveBundleAcceptMode(mode) {
    bundleAcceptMode = (mode === 'top2') ? 'top2' : 'top1';
    try { localStorage.setItem(BUNDLE_ACCEPT_MODE_KEY, bundleAcceptMode); } catch (e) {}
    const sel = document.getElementById('bundle-accept-select');
    if (sel) sel.value = bundleAcceptMode;
}

function loadEpaperPreference() {
    try { return localStorage.getItem(EPAPER_MODE_KEY) === 'on'; }
    catch (e) { return false; }
}

function saveEpaperPreference(enabled) {
    try { localStorage.setItem(EPAPER_MODE_KEY, enabled ? 'on' : 'off'); } catch (e) {}
}

function applyEpaperMode(enabled, options = {}) {
    epaperEnabled = !!enabled;
    document.body.classList.toggle('epaper-mode', epaperEnabled);
    const toggle = document.getElementById('epaper-toggle');
    if (toggle) toggle.checked = epaperEnabled;
    if (!options.skipSave) saveEpaperPreference(epaperEnabled);
    if (eloChart) updateEloChart();
    if (reviewChart) updateReviewChart();
}

function loadTvJeroglyphicsPreference() {
    try { return localStorage.getItem(TV_JEROGLYPHICS_KEY) === 'on'; }
    catch (e) { return false; }
}

function saveTvJeroglyphicsPreference(enabled) {
    try { localStorage.setItem(TV_JEROGLYPHICS_KEY, enabled ? 'on' : 'off'); } catch (e) {}
}

function openBackupDirDb() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('IndexedDB no disponible'));
            return;
        }
        const request = indexedDB.open(BACKUP_DIR_DB, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(BACKUP_DIR_STORE)) {
                db.createObjectStore(BACKUP_DIR_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadBackupDirHandle() {
    try {
        const db = await openBackupDirDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_DIR_STORE, 'readonly');
            const store = tx.objectStore(BACKUP_DIR_STORE);
            const req = store.get(BACKUP_DIR_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('No es pot carregar la carpeta de backups', e);
        return null;
    }
}

async function saveBackupDirHandle(handle) {
    try {
        const db = await openBackupDirDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_DIR_STORE, 'readwrite');
            const store = tx.objectStore(BACKUP_DIR_STORE);
            const req = store.put(handle, BACKUP_DIR_KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('No es pot guardar la carpeta de backups', e);
    }
}

function supportsDirectoryPicker() {
    return 'showDirectoryPicker' in window;
}

function supportsFilePicker() {
    return 'showOpenFilePicker' in window;
}

async function verifyHandlePermission(handle, mode = 'readwrite') {
    if (!handle || !handle.queryPermission) return 'granted';
    let status = await handle.queryPermission({ mode });
    if (status === 'prompt' && handle.requestPermission) {
        status = await handle.requestPermission({ mode });
    }
    return status;
}

async function selectBackupDirHandle(mode = 'readwrite') {
    if (!supportsDirectoryPicker()) return null;
    try {
        const handle = await window.showDirectoryPicker({ id: 'eltauler-backups', mode });
        backupDirHandle = handle;
        await saveBackupDirHandle(handle);
        if (navigator.storage && navigator.storage.persist) {
            await navigator.storage.persist();
        }
        return handle;
    } catch (e) {
        console.log('Selecció de carpeta cancel·lada');
        return null;
    }
}

async function ensureBackupDirHandle({ prompt = false, mode = 'readwrite', force = false } = {}) {
    if (!force && !backupDirHandle) {
        backupDirHandle = await loadBackupDirHandle();
    }
    if (!force && backupDirHandle) {
        const status = await verifyHandlePermission(backupDirHandle, mode);
        if (status === 'granted') return backupDirHandle;
    }
    if (!prompt || !supportsDirectoryPicker()) return null;
    return selectBackupDirHandle(mode);
}

async function writeBackupToDirectory(data, filename, { prompt = true, forceDirectorySelection = false } = {}) {
    const handle = await ensureBackupDirHandle({
        prompt,
        mode: 'readwrite',
        force: forceDirectorySelection
    });
    if (!handle) return null;
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return fileHandle;
}

async function importBackupFromPicker() {
    const handle = await ensureBackupDirHandle({ prompt: true, mode: 'read' });
    if (!handle || !supportsFilePicker()) return null;
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            startIn: handle,
            multiple: false,
            types: [{ description: 'Backup El Tauler', accept: { 'application/json': ['.json'] } }]
        });
        return await fileHandle.getFile();
    } catch (e) {
        console.log('Importació cancel·lada');
        return null;
    }
}

function buildBackupData({ includeGameHistory = false } = {}) {
    const base = {
        elo: userELO, bundles: savedErrors, streak: currentStreak, lastPracticeDate: lastPracticeDate,
        totalStars: totalStars, unlockedBadges: unlockedBadges, todayMissions: todayMissions, missionsDate: missionsDate,
        sessionStats: sessionStats, eloHistory: eloHistory, totalGamesPlayed: totalGamesPlayed,
        totalWins: totalWins, maxStreak: maxStreak,
        aiDifficulty: aiDifficulty, currentElo: currentElo, recentGames: recentGames, consecutiveWins: consecutiveWins,
        consecutiveLosses: consecutiveLosses, currentLeague: currentLeague, leagueActiveMatch: leagueActiveMatch,
        reviewHistory: reviewHistory, date: new Date().toLocaleDateString(),
        isCalibrating: isCalibrating,
        calibrationGames: calibrationGames,
        calibrationProfile: calibrationProfile,
        calibratgeComplet: calibratgeComplet,
        freeAdjustmentWindow: freeAdjustmentWindow,
        adjustmentLog: adjustmentLog,
        freeLossStreak: freeLossStreak,
        calibrationRocFloor: calibrationRocFloor,
        eloMilestones: unlockedEloMilestones,
        lastAdjustmentQualityAvg: lastAdjustmentQualityAvg
    };
    if (includeGameHistory) base.gameHistory = gameHistory;
    return base;
}

function importBackupData(data) {
    if (!data || typeof data !== 'object') return;
    userELO = data.elo || 50; savedErrors = data.bundles || [];
    currentStreak = data.streak || 0; lastPracticeDate = data.lastPracticeDate || null;
    totalStars = data.totalStars || 0; unlockedBadges = data.unlockedBadges || [];
    todayMissions = restoreMissions(data.todayMissions || []); missionsDate = data.missionsDate || null;
    sessionStats = data.sessionStats || { 
        gamesPlayed: 0, gamesWon: 0, bundlesSolved: 0, 
        bundlesSolvedLow: 0, bundlesSolvedMed: 0, bundlesSolvedHigh: 0,
        highPrecisionGames: 0, perfectGames: 0, blackWins: 0,
        leagueGamesPlayed: 0, freeGamesPlayed: 0
    };
    eloHistory = data.eloHistory || []; totalGamesPlayed = data.totalGamesPlayed || 0; totalWins = data.totalWins || 0; maxStreak = data.maxStreak || 0;
       const importedElo = (typeof data.currentElo === 'number') ? data.currentElo
        : (typeof data.adaptiveLevel === 'number') ? data.adaptiveLevel
            : (typeof data.aiDifficulty === 'number') ? difficultyToLevel(data.aiDifficulty)
                : userELO;
    currentElo = clampEngineElo(importedElo);
    aiDifficulty = levelToDifficulty(currentElo); recentGames = data.recentGames || []; consecutiveWins = data.consecutiveWins || 0; consecutiveLosses = data.consecutiveLosses || 0;
    currentLeague = data.currentLeague || null;
    leagueActiveMatch = data.leagueActiveMatch || null;
    reviewHistory = data.reviewHistory || [];
    gameHistory = data.gameHistory || [];
       isCalibrating = typeof data.isCalibrating === 'boolean' ? data.isCalibrating : isCalibrating;
    calibrationGames = Array.isArray(data.calibrationGames) ? data.calibrationGames : calibrationGames;
    calibrationProfile = data.calibrationProfile || calibrationProfile;
    calibratgeComplet = typeof data.calibratgeComplet === 'boolean' ? data.calibratgeComplet : calibratgeComplet;
    freeAdjustmentWindow = Array.isArray(data.freeAdjustmentWindow) ? data.freeAdjustmentWindow : freeAdjustmentWindow;
    adjustmentLog = Array.isArray(data.adjustmentLog) ? data.adjustmentLog : adjustmentLog;
    freeLossStreak = typeof data.freeLossStreak === 'number' ? data.freeLossStreak : freeLossStreak;
    calibrationRocFloor = typeof data.calibrationRocFloor === 'number' ? data.calibrationRocFloor : calibrationRocFloor;
    unlockedEloMilestones = Array.isArray(data.eloMilestones) ? data.eloMilestones : unlockedEloMilestones;
    lastAdjustmentQualityAvg = typeof data.lastAdjustmentQualityAvg === 'number' ? data.lastAdjustmentQualityAvg : lastAdjustmentQualityAvg;
    if (calibrationGames.length >= CALIBRATION_GAME_COUNT || calibratgeComplet || calibrationProfile) {
        isCalibrating = false;
        calibratgeComplet = true;
        if (calibrationRocFloor === null && calibrationProfile && typeof (calibrationProfile.roc ?? calibrationProfile.elo) === 'number') {
            calibrationRocFloor = calibrationProfile.roc ?? calibrationProfile.elo;
        }
    }
    currentCalibrationOpponentRoc = null;
    if (!isCalibrating) {
        userELO = Math.max(50, currentElo);
        syncEngineEloFromUser();
    }
    saveStorage(); updateDisplay(); alert('Dades importades!');
}

async function handleBackupImportFile(file) {
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (confirm(`Importar dades? ELO: ${data.elo || 50}, Estrelles: ${data.totalStars || 0}`)) {
            importBackupData(data);
        }
    } catch (err) {
        alert('Error llegint l\'arxiu');
    }
}

function applyTvJeroglyphicsMode(enabled, options = {}) {
    tvJeroglyphicsEnabled = !!enabled;
    const toggle = document.getElementById('tv-jeroglyphics-toggle');
    if (toggle) toggle.checked = tvJeroglyphicsEnabled;
    if (!options.skipSave) saveTvJeroglyphicsPreference(tvJeroglyphicsEnabled);
    if (!tvJeroglyphicsEnabled && tvJeroglyphicsActive) {
        cancelTvJeroglyphics('Jeroglífics desactivats.');
    }
    updateTvControls();
}

// Estat de validació estricta al Bundle
let isBundleStrictAnalysis = false;
let bundleBestMove = null;
let bundlePvMoves = {};
let bundlePvLines = {};
let lastHumanMoveUci = null;

let dragGuardBound = false;
let dragGuardHandler = null;

function getDefaultControlMode() {
    return isTouchDevice() ? 'tap' : 'drag';
}

function loadControlMode() {
    try {
        const v = localStorage.getItem(CONTROL_MODE_KEY);
        if (v === 'tap' || v === 'drag') return v;
    } catch (e) {}
    return getDefaultControlMode();
}

function setBodyControlClass(mode) {
    document.body.classList.toggle('control-tap', mode === 'tap');
    document.body.classList.toggle('control-drag', mode === 'drag');
}

function detachDragGuards() {
    const el = document.getElementById('myBoard');
    if (!el || !dragGuardBound || !dragGuardHandler) return;
    el.removeEventListener('touchmove', dragGuardHandler);
    el.removeEventListener('gesturestart', dragGuardHandler);
    dragGuardBound = false;
    dragGuardHandler = null;
}

function attachDragGuards() {
    if (!isTouchDevice()) return;
    const el = document.getElementById('myBoard');
    if (!el) return;

    detachDragGuards();
    dragGuardHandler = (e) => {
        if (controlMode === 'drag') e.preventDefault();
    };
    el.addEventListener('touchmove', dragGuardHandler, { passive: false });
    el.addEventListener('gesturestart', dragGuardHandler, { passive: false });
    dragGuardBound = true;
}

function disableTapToMove() {
    tapMoveEnabled = false;
    $('#myBoard').off('.tapmove');
    const boardEl = document.getElementById('myBoard');
    if (boardEl && controlMode !== 'drag') boardEl.style.touchAction = '';
    clearTapSelection();
}

function rebuildBoardForControlMode() {
    if (!game) return;
    const fen = game.fen();

    if (board) board.destroy();
    board = Chessboard('myBoard', {
        draggable: (controlMode === 'drag'),
        position: fen,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    setTimeout(() => { resizeBoardToViewport(); }, 0);

    if (controlMode === 'tap') {
        detachDragGuards();
        enableTapToMove();
    } else {
        disableTapToMove();
        attachDragGuards();
    }
}

function applyControlMode(mode, opts) {
    const o = opts || {};
    if (mode !== 'tap' && mode !== 'drag') mode = getDefaultControlMode();

    controlMode = mode;
    setBodyControlClass(mode);

    if (o.save !== false) {
        try { localStorage.setItem(CONTROL_MODE_KEY, mode); } catch (e) {}
    }

    const sel = document.getElementById('control-mode-select');
    if (sel) sel.value = mode;

    if (o.rebuild) rebuildBoardForControlMode();
    updateTvBoardInteractivity();
    updateOpeningBoardInteractivity();
}

// Resize del tauler perquè ocupi el màxim possible
let resizeTimer = null;

function resizeBoardToViewport() {
    const boardEl = document.getElementById('myBoard');
    const gameScreen = document.getElementById('game-screen');
    if (!boardEl || !gameScreen) return;

    const isVisible = (gameScreen.style.display !== 'none') && (gameScreen.offsetParent !== null);
    if (!isVisible) return;

    const headerEl = gameScreen.querySelector('.header');
    const precisionEl = gameScreen.querySelector('.precision-panel');
    const controlsEl = gameScreen.querySelector('.controls');

    const isDesktopLayout = deviceType === 'desktop';
    const used = isDesktopLayout ? 0 : (headerEl ? headerEl.getBoundingClientRect().height : 0)
        + (precisionEl ? precisionEl.getBoundingClientRect().height : 0)
        + (controlsEl ? controlsEl.getBoundingClientRect().height : 0);

    const availableW = window.innerWidth;
    const isSmall = availableW <= 520;
    const isPortrait = window.innerHeight >= availableW;

    let size = 0;

    if (isSmall && isPortrait) {
        size = Math.floor(Math.max(240, availableW));
        boardEl.style.marginLeft = '0';
        boardEl.style.marginRight = '0';
    } else {
        const verticalGaps = 24;
        const availableH = window.innerHeight - used - verticalGaps;
        size = Math.floor(Math.max(240, Math.min(availableW, availableH)));
        boardEl.style.marginLeft = 'auto';
        boardEl.style.marginRight = 'auto';
    }

    boardEl.style.width = size + 'px';
    boardEl.style.height = size + 'px';

    if (board && typeof board.resize === 'function') board.resize();
}

function resizeTvBoardToViewport() {
    const boardEl = document.getElementById('tv-board');
    const tvScreen = document.getElementById('tv-screen');
    if (!boardEl || !tvScreen) return;

    const isVisible = (tvScreen.style.display !== 'none') && (tvScreen.offsetParent !== null);
    if (!isVisible) return;

    const container = boardEl.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let size = Math.floor(rect.width);
    const availableHeight = window.innerHeight - rect.top - 24;

       if (availableHeight > 0) {
        size = Math.min(size, Math.floor(availableHeight));
    }

    size = Math.max(240, size);
    boardEl.style.width = `${size}px`;
    boardEl.style.height = `${size}px`;

    if (tvBoard && typeof tvBoard.resize === 'function') tvBoard.resize();
}

function scheduleBoardResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        resizeBoardToViewport();
        resizeTvBoardToViewport();
    }, 60);
}

window.addEventListener('resize', () => { updateDeviceType(); scheduleBoardResize(); }, { passive: true });
window.addEventListener('orientationchange', () => {
    updateDeviceType();
    setTimeout(() => resizeBoardToViewport(), 140);
}, { passive: true });

function clearTapSelection() {
    tapSelectedSquare = null;
    $('.square-55d63').removeClass('tap-selected tap-move');
}

function clearTvTapSelection() {
    tvTapSelectedSquare = null;
    applyEpaperMode(loadEpaperPreference(), { skipSave: true });
}

function clearEngineMoveHighlights() {
    $('#myBoard .square-55d63').removeClass('engine-move');
}

function highlightEngineMove(from, to) {
    clearEngineMoveHighlights();
    [from, to].forEach((sq) => {
        if (sq) {
            $(`#myBoard .square-55d63[data-square='${sq}']`).addClass('engine-move');
        }
    });
}

function highlightTapSelection(square) {
    $('.square-55d63').removeClass('tap-selected tap-move');
    const sel = $(`#myBoard .square-55d63[data-square='${square}']`);
    sel.addClass('tap-selected');

    const moves = game ? game.moves({ square: square, verbose: true }) : [];
    for (const mv of moves) {
        $(`#myBoard .square-55d63[data-square='${mv.to}']`).addClass('tap-move');
    }
}

function highlightTvTapSelection(square) {
    $('#tv-board .square-55d63').removeClass('tap-selected tap-move');
    if (!square) return;
    const sel = $(`#tv-board .square-55d63[data-square='${square}']`);
    sel.addClass('tap-selected');
}

function commitHumanMoveFromTap(from, to) {
    $('#blunder-alert').hide();
    if (engineMoveTimeout) clearTimeout(engineMoveTimeout);

    $('.square-55d63').removeClass('highlight-hint');
    const prevFen = game.fen();
    const move = game.move({ from: from, to: to, promotion: 'q' });
    if (move === null) return false;
    clearEngineMoveHighlights();
    lastHumanMoveUci = move.from + move.to + (move.promotion ? move.promotion : '');

    lastPosition = prevFen;
    totalPlayerMoves++;
    pendingMoveEvaluation = true;

    board.position(game.fen());
    updateStatus();
    
    if (game.game_over()) {
        handleGameOver();
        return true;
    }

    analyzeMove();
    return true;
}

function enableTapToMove() {
    if (tapMoveEnabled) return;
    tapMoveEnabled = true;
    const boardEl = document.getElementById('myBoard');
    if (boardEl) boardEl.style.touchAction = 'none';

    $('#myBoard').off('.tapmove')
        .on(`pointerdown.tapmove touchstart.tapmove`, '.square-55d63', function(e) {
        if (!game || game.game_over() || isEngineThinking) return;

        if (e && e.preventDefault) e.preventDefault();

        const nowTs = Date.now();
        if (nowTs - lastTapEventTs < 180) return;
        lastTapEventTs = nowTs;

        const square = $(this).attr('data-square');
        if (!square) return;

        if (!tapSelectedSquare) {
            const p = game.get(square);
            if (!p || p.color !== game.turn()) return;
            tapSelectedSquare = square;
            highlightTapSelection(square);
            return;
        }

        if (square === tapSelectedSquare) {
            clearTapSelection();
            return;
        }

        const moved = commitHumanMoveFromTap(tapSelectedSquare, square);
        if (moved) {
            clearTapSelection();
            return;
        }

        const p2 = game.get(square);
        if (p2 && p2.color === game.turn()) {
            tapSelectedSquare = square;
            highlightTapSelection(square);
        }
    });
}

function enableTvTapToMove() {
    if (tvTapMoveEnabled) return;
    tvTapMoveEnabled = true;
    const boardEl = document.getElementById('tv-board');
    if (boardEl) boardEl.style.touchAction = 'none';

    $('#tv-board').off('.tv-tapmove')
        .on(`pointerdown.tv-tapmove touchstart.tv-tapmove`, '.square-55d63', function(e) {
            if (!tvJeroglyphicsActive || tvJeroglyphicsAnalyzing || tvJeroglyphicsSolved || tvJeroglyphicsIncorrect) return;
            if (!tvReplay || !tvReplay.game) return;

            if (e && e.preventDefault) e.preventDefault();

            const nowTs = Date.now();
            if (nowTs - tvLastTapEventTs < 180) return;
            tvLastTapEventTs = nowTs;

            const square = $(this).attr('data-square');
            if (!square) return;

            if (!tvTapSelectedSquare) {
                const p = tvReplay.game.get(square);
                if (!p || p.color !== tvReplay.game.turn()) return;
                tvTapSelectedSquare = square;
                highlightTvTapSelection(square);
                return;
            }

            if (square === tvTapSelectedSquare) {
                clearTvTapSelection();
                return;
            }

            tvOnDrop(tvTapSelectedSquare, square);
            clearTvTapSelection();
        });
}

function disableTvTapToMove() {
    if (!tvTapMoveEnabled) return;
    tvTapMoveEnabled = false;
    $('#tv-board').off('.tv-tapmove');
    const boardEl = document.getElementById('tv-board');
    if (boardEl) boardEl.style.touchAction = '';
    clearTvTapSelection();
}

// =====================================================
// SISTEMA D'OBERTURES - Funcions per calcular precisió
// =====================================================

// Parseja un PGN d'obertura a un array de moviments SAN
function parsePgnToMoves(pgn) {
    if (!pgn) return [];
    // Eliminar números i punts (ex: "1. e4 e5 2. Nf3" -> ["e4", "e5", "Nf3"])
    return pgn.replace(/\d+\.\s*/g, '').trim().split(/\s+/).filter(m => m.length > 0);
}

// Construeix el trie d'obertures per cerca eficient
function buildOpeningTrie() {
    if (typeof OPENINGS_DATA === 'undefined') {
        console.warn('[Openings] OPENINGS_DATA no disponible');
        return null;
    }

    const trie = { children: {}, openings: [] };

    for (const opening of OPENINGS_DATA) {
        const moves = parsePgnToMoves(opening.pgn);
        let node = trie;

        for (const move of moves) {
            if (!node.children[move]) {
                node.children[move] = { children: {}, openings: [] };
            }
            node = node.children[move];
        }
        node.openings.push({ eco: opening.eco, name: opening.name, moves: moves });
    }

    console.log(`[Openings] Trie construït amb ${OPENINGS_DATA.length} obertures`);
    console.log(`[Openings] Primers moviments vàlids: [${Object.keys(trie.children).join(', ')}]`);
    return trie;
}

// Inicialitza el sistema d'obertures (només construeix el trie si no existeix)
function initOpeningSystem() {
    if (!openingTrie) {
        openingTrie = buildOpeningTrie();
        if (openingTrie) {
            console.log('[Openings] Sistema d\'obertures inicialitzat correctament');
        } else {
            console.error('[Openings] ERROR: No s\'ha pogut construir el trie d\'obertures');
        }
    }
    // NO resetejar openingCurrentSequence aquí - només es reseteja a resetOpeningPracticeBoard
}

// Obté els moviments vàlids d'obertura per a la posició actual
function getValidOpeningMoves(sequence) {
    if (!openingTrie) return [];

    let node = openingTrie;
    for (const move of sequence) {
        if (!node.children[move]) {
            return []; // No hi ha obertures que continuïn amb aquesta seqüència
        }
        node = node.children[move];
    }

    // Retorna tots els moviments possibles des d'aquest node
    return Object.keys(node.children);
}

// Comprova si un moviment és vàlid dins d'alguna obertura
function isValidOpeningMove(sequence, move) {
    const validMoves = getValidOpeningMoves(sequence);
    return validMoves.includes(move);
}

// Obté les obertures que coincideixen amb la seqüència actual
function getMatchingOpenings(sequence) {
    if (!openingTrie || sequence.length === 0) return [];

    let node = openingTrie;
    for (const move of sequence) {
        if (!node.children[move]) {
            return [];
        }
        node = node.children[move];
    }

    // Recollir totes les obertures des d'aquest node cap avall
    const openings = [];
    function collectOpenings(n) {
        openings.push(...n.openings);
        for (const child of Object.values(n.children)) {
            collectOpenings(child);
        }
    }
    collectOpenings(node);
    return openings;
}

// Selecciona la millor obertura quan hi ha múltiples opcions
// Basat en el moviment de l'engine
function selectBestOpeningByEngine(sequence, engineMove) {
    const validMoves = getValidOpeningMoves(sequence);

    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) return validMoves[0];

    // Si el moviment de l'engine coincideix amb una obertura, preferir-la
    if (validMoves.includes(engineMove)) {
        return engineMove;
    }

    // Sinó, retornar el primer moviment vàlid (ordre del fitxer d'obertures)
    return validMoves[0];
}

// Actualitza l'obertura seleccionada basant-se en la seqüència actual
// Selecciona l'obertura més llarga que coincideix exactament amb la seqüència
function updateSelectedOpening() {
    if (!openingTrie || openingCurrentSequence.length === 0) {
        openingSelectedOpening = null;
        openingNextMoveHint = null;
        return;
    }

    let node = openingTrie;
    let lastMatchingOpening = null;

    // Recórrer la seqüència i trobar l'obertura que coincideix
    for (let i = 0; i < openingCurrentSequence.length; i++) {
        const move = openingCurrentSequence[i];
        if (!node.children[move]) {
            break; // Hem sortit de les obertures conegudes
        }
        node = node.children[move];

        // Si aquest node té obertures, guardar la més llarga
        if (node.openings && node.openings.length > 0) {
            // Preferir l'obertura amb més moviments (més específica)
            lastMatchingOpening = node.openings.reduce((best, current) => {
                return (!best || current.moves.length > best.moves.length) ? current : best;
            }, null);
        }
    }

    openingSelectedOpening = lastMatchingOpening;

    // Calcular el següent moviment de l'obertura (pista)
    if (openingSelectedOpening && openingSelectedOpening.moves.length > openingCurrentSequence.length) {
        openingNextMoveHint = openingSelectedOpening.moves[openingCurrentSequence.length];
        console.log(`[Openings] Obertura seleccionada: ${openingSelectedOpening.name}`);
        console.log(`[Openings] Següent moviment (pista): ${openingNextMoveHint}`);
    } else {
        // Buscar qualsevol moviment vàlid d'obertura
        const validMoves = getValidOpeningMoves(openingCurrentSequence);
        openingNextMoveHint = validMoves.length > 0 ? validMoves[0] : null;
        if (openingNextMoveHint) {
            console.log(`[Openings] Fora d'obertura específica, pista genèrica: ${openingNextMoveHint}`);
        }
    }
}

// Obté el següent moviment de l'obertura per a la pista
// Retorna { move: 'Nf3', from: 'g1', to: 'f3', openingName: 'Italian Game' } o null
function getOpeningHint() {
    if (!openingNextMoveHint || !openingPracticeGame) return null;

    // Buscar el moviment en format verbose per obtenir from/to
    const moves = openingPracticeGame.moves({ verbose: true });
    const matchingMove = moves.find(m => m.san === openingNextMoveHint);

    if (matchingMove) {
        return {
            move: openingNextMoveHint,
            from: matchingMove.from,
            to: matchingMove.to,
            openingName: openingSelectedOpening ? openingSelectedOpening.name : null
        };
    }

    return null;
}

// Avalua la precisió d'un moviment basat en obertures
// Retorna: { quality: 'correct'|'good'|'incorrect', isOpeningMove: boolean, validMoves: [] }
function evaluateOpeningMovePrecision(sequence, movePlayed) {
    const validMoves = getValidOpeningMoves(sequence);

    console.log(`[OpeningEval] Seqüència: [${sequence.join(', ')}]`);
    console.log(`[OpeningEval] Moviment jugat: "${movePlayed}"`);
    console.log(`[OpeningEval] Moviments vàlids (${validMoves.length}): [${validMoves.slice(0, 10).join(', ')}${validMoves.length > 10 ? '...' : ''}]`);
    console.log(`[OpeningEval] Moviment "${movePlayed}" està a la llista: ${validMoves.includes(movePlayed)}`);

    // Si és el primer moviment i no hi ha cap obertura que comenci així
    if (sequence.length === 0 && validMoves.length > 0 && !validMoves.includes(movePlayed)) {
        // Primer moviment no estàndard: 50% (ni bo ni dolent)
        return { quality: 'unknown', isOpeningMove: false, validMoves: validMoves };
    }

    // Si el moviment és vàlid dins d'alguna obertura
    if (validMoves.includes(movePlayed)) {
        return { quality: 'correct', isOpeningMove: true, validMoves: validMoves };
    }

    // Si no hi ha moviments vàlids d'obertura (hem sortit de les obertures)
    if (validMoves.length === 0) {
        // Ja no estem dins d'obertures conegudes - usar engine
        return { quality: 'engine', isOpeningMove: false, validMoves: [] };
    }

    // Hi havia moviments d'obertura vàlids però l'usuari n'ha fet un altre
    return { quality: 'incorrect', isOpeningMove: false, validMoves: validMoves };
}

// =====================================================
// FI SISTEMA D'OBERTURES
// =====================================================

// Funcions per a la pista visual del tauler d'obertures
function clearOpeningHintHighlight() {
    $('#opening-board .square-55d63').removeClass('highlight-hint');
}

function highlightOpeningHint(from, to) {
    clearOpeningHintHighlight();
    if (from) {
        $(`#opening-board .square-55d63[data-square='${from}']`).addClass('highlight-hint');
    }
    if (to) {
        $(`#opening-board .square-55d63[data-square='${to}']`).addClass('highlight-hint');
    }
}

// Funcions de precisió per al tauler d'obertures
// Mostra el resultat del MOVIMENT ACTUAL (no la mitjana)
function updateOpeningPrecisionDisplay(animate = false) {
    const precisionEl = $('#opening-precision-value');
    const barEl = $('#opening-precision-bar');
    const panelEl = $('#opening-precision-panel');
    if (!precisionEl.length || !barEl.length) return;

    // Estat inicial - sense moviments o esperant dades de Stockfish
    if (openingPracticeTotalMoves === 0 || openingLastMoveQuality === null || openingLastMoveQuality === 'unknown') {
        precisionEl.text('—');
        barEl.css('width', '0%').removeClass('good warning danger move-correct move-incorrect move-good');
        // Actualitzar estadístiques de sessió (pot ser 0/0 o valors restaurats per undo)
        updateOpeningSessionStats();
        return;
    }

    // Mostrar resultat del MOVIMENT ACTUAL
    barEl.removeClass('good warning danger move-correct move-incorrect move-good');

    if (openingLastMoveQuality === 'correct') {
        // ═══════════════════════════════════════
        // MOVIMENT CORRECTE - Barra verda al 100%
        // ═══════════════════════════════════════
        precisionEl.text('✓');
        barEl.css('width', '100%').addClass('move-correct');
        if (animate) {
            barEl.addClass('precision-correct-anim');
            setTimeout(() => barEl.removeClass('precision-correct-anim'), 600);
        }
    } else if (openingLastMoveQuality === 'good') {
        // ═══════════════════════════════════════
        // MOVIMENT ACCEPTABLE - Barra taronja al 100%
        // ═══════════════════════════════════════
        precisionEl.text('~');
        barEl.css('width', '100%').addClass('move-good');
        if (animate) {
            barEl.addClass('precision-good-anim');
            setTimeout(() => barEl.removeClass('precision-good-anim'), 600);
        }
    } else {
        // ═══════════════════════════════════════
        // MOVIMENT INCORRECTE - Barra vermella al 100%
        // ═══════════════════════════════════════
        precisionEl.text('✗');
        barEl.css('width', '100%').addClass('move-incorrect');
        if (animate) {
            barEl.addClass('precision-error-anim');
            setTimeout(() => barEl.removeClass('precision-error-anim'), 600);
        }
    }

    // Actualitzar estadístiques de sessió
    updateOpeningSessionStats();
}

// Crea l'element d'estadístiques de sessió si no existeix
function createSessionStatsElement() {
    if (document.getElementById('opening-session-stats')) return;

    const panelEl = document.getElementById('opening-precision-panel');
    if (!panelEl) return;

    const statsEl = document.createElement('div');
    statsEl.id = 'opening-session-stats';
    statsEl.className = 'opening-session-stats';
    statsEl.innerHTML = `
        <span class="stats-label">Sessió:</span>
        <span class="stats-value" id="session-stats-value">0/0</span>
        <span class="stats-percent" id="session-stats-percent">(—%)</span>
    `;
    panelEl.appendChild(statsEl);
}

// Actualitza l'indicador d'estadístiques acumulades de la sessió
function updateOpeningSessionStats() {
    let statsEl = document.getElementById('opening-session-stats');

    // Crear si no existeix
    if (!statsEl) {
        createSessionStatsElement();
        statsEl = document.getElementById('opening-session-stats');
    }

    if (!statsEl) return;

    const valueEl = document.getElementById('session-stats-value');
    const percentEl = document.getElementById('session-stats-percent');

    // No mostrar estadístiques fins tenir dades vàlides de Stockfish
    // (openingLastMoveQuality ha de ser 'correct', 'good' o 'incorrect', no null ni 'unknown')
    const hasValidData = openingPracticeTotalMoves > 0 &&
                         openingLastMoveQuality !== null &&
                         openingLastMoveQuality !== 'unknown';

    if (!hasValidData) {
        if (valueEl) valueEl.textContent = '—/—';
        if (percentEl) percentEl.textContent = '(—%)';
        statsEl.className = 'opening-session-stats';
        return;
    }

    const avgPrecision = Math.round((openingPracticeGoodMoves / openingPracticeTotalMoves) * 100);

    if (valueEl) valueEl.textContent = `${openingPracticeGoodMoves}/${openingPracticeTotalMoves}`;
    if (percentEl) percentEl.textContent = `(${avgPrecision}%)`;

    // Color segons el percentatge
    statsEl.className = 'opening-session-stats';
    if (avgPrecision >= 80) {
        statsEl.classList.add('stats-good');
    } else if (avgPrecision >= 50) {
        statsEl.classList.add('stats-warning');
    } else {
        statsEl.classList.add('stats-danger');
    }
}

// ========== SISTEMA DE FEEDBACK INSTANTANI PER OBERTURES ==========

// Pre-calcula el millor moviment per a la posició actual (quan és el torn de l'usuari)
// DESACTIVAT: Interfereix amb l'anàlisi en dos passos (sobreescriu stockfishRequestor)
function preCalculateOpeningBestMove() {
    // La precisió ara es calcula amb el sistema d'anàlisi en dos passos (com partida lliure)
    return;
}

// Processa el resultat del pre-càlcul del millor moviment
// NOTA: Aquest sistema ja no s'utilitza per la precisió (ara usem anàlisi en dos passos)
// Només guardem el resultat per si es vol usar per pistes o feedback visual futur
function processOpeningPreCalcResult(bestMove) {
    if (!openingPreCalcPending) return;
    openingPreCalcPending = false;
    openingPreCalcBestMove = bestMove;
    console.log(`[OpeningInstant] Pre-calculat millor moviment: ${bestMove} (no afecta precisió)`);
    // No fem res més - la precisió es calcula amb l'anàlisi en dos passos
}

// Avalua instantàniament si el moviment de l'usuari és correcte
function evaluateOpeningMoveInstantly(movePlayed, moveFrom, moveTo) {
    // Inicialitzar sistema d'obertures si cal
    if (!openingTrie) {
        initOpeningSystem();
    }

    // Convertir moviment UCI a SAN per comparar amb obertures
    // El movePlayed ja és en format SAN (ex: "e4", "Nf3")
    const moveSAN = movePlayed;

    // Avaluar el moviment segons el sistema d'obertures
    const evaluation = evaluateOpeningMovePrecision(openingCurrentSequence, moveSAN);
    let quality = evaluation.quality;

    console.log(`[OpeningInstant] Seqüència actual: [${openingCurrentSequence.join(', ')}], Moviment: ${moveSAN}`);
    console.log(`[OpeningInstant] Moviments vàlids d'obertura: [${evaluation.validMoves.join(', ')}]`);
    console.log(`[OpeningInstant] Avaluació obertura: ${quality}, isOpeningMove: ${evaluation.isOpeningMove}`);

    // Si el moviment és d'obertura vàlid
    if (quality === 'correct') {
        openingLastMoveQuality = 'correct';
        showOpeningMoveVisualFeedback(moveFrom, moveTo, 'correct');
        openingPracticeTotalMoves++;
        openingPracticeGoodMoves++;
        updateOpeningPrecisionDisplay(true);
        // Afegir moviment a la seqüència actual
        openingCurrentSequence.push(moveSAN);
        console.log(`[OpeningInstant] Moviment d'obertura correcte: ${moveSAN}`);
        return 'correct';
    }

    // Si és el primer moviment i no coincideix amb cap obertura coneguda
    if (quality === 'unknown' && openingCurrentSequence.length === 0) {
        // Donar 50%: comptar com a mig punt
        openingLastMoveQuality = 'good';
        showOpeningMoveVisualFeedback(moveFrom, moveTo, 'good');
        openingPracticeTotalMoves += 2; // Comptem com 2 moviments
        openingPracticeGoodMoves += 1; // Però només 1 correcte = 50%
        updateOpeningPrecisionDisplay(true);
        // Afegir moviment a la seqüència (tot i no ser obertura estàndard)
        openingCurrentSequence.push(moveSAN);
        console.log(`[OpeningInstant] Primer moviment no estàndard: ${moveSAN} - 50%`);
        return 'good';
    }

    // Si hem sortit de les obertures conegudes, usar engine per avaluar
    if (quality === 'engine' || evaluation.validMoves.length === 0) {
        // Fallback: usar el pre-càlcul de l'engine si existeix
        const playedNorm = movePlayed.toLowerCase().substring(0, 4);
        const bestNorm = openingPreCalcBestMove ? openingPreCalcBestMove.toLowerCase().substring(0, 4) : null;

        if (bestNorm) {
            if (playedNorm === bestNorm) {
                quality = 'correct';
            } else if (playedNorm.substring(2, 4) === bestNorm.substring(2, 4)) {
                quality = 'good';
            } else {
                quality = 'incorrect';
            }
        } else {
            // Sense pre-càlcul i fora d'obertures, assumir acceptable
            quality = 'good';
        }

        openingLastMoveQuality = quality;
        showOpeningMoveVisualFeedback(moveFrom, moveTo, quality);
        openingPracticeTotalMoves++;
        if (quality === 'correct' || quality === 'good') {
            openingPracticeGoodMoves++;
        }
        updateOpeningPrecisionDisplay(true);
        openingCurrentSequence.push(moveSAN);
        console.log(`[OpeningInstant] Fora d'obertures, avaluació engine: ${quality}`);
        openingPreCalcBestMove = null;
        openingPreCalcFen = null;
        return quality;
    }

    // Hi havia moviments d'obertura vàlids però l'usuari n'ha fet un altre
    openingLastMoveQuality = 'incorrect';
    showOpeningMoveVisualFeedback(moveFrom, moveTo, 'incorrect');
    openingPracticeTotalMoves++;
    updateOpeningPrecisionDisplay(true);
    openingCurrentSequence.push(moveSAN);
    console.log(`[OpeningInstant] Moviment incorrecte: ${moveSAN}, esperats: [${evaluation.validMoves.join(', ')}]`);

    openingPreCalcBestMove = null;
    openingPreCalcFen = null;
    return 'incorrect';
}

// Gestiona el flux complet: primer precisió, després moviment de l'engine
// Utilitza el sistema d'anàlisi en dos passos (igual que partida lliure)
function handleOpeningUserMove(movePlayed, from, to, needsEngineMove) {
    console.log(`[OpeningAnalysis] handleOpeningUserMove cridat amb movePlayed="${movePlayed}"`);

    // Inicialitzar sistema d'obertures si cal
    if (!openingTrie) {
        console.log('[OpeningAnalysis] Inicialitzant sistema d\'obertures...');
        initOpeningSystem();
    }

    // Guardar si cal moure l'engine després de l'anàlisi
    openingNeedsEngineMove = needsEngineMove;

    // Usar el sistema d'obertures per avaluar el moviment
    const validMovesDebug = getValidOpeningMoves(openingCurrentSequence);
    console.log(`[OpeningAnalysis] DEBUG - Trie existeix: ${!!openingTrie}, Moviments vàlids des de seqüència [${openingCurrentSequence.join(', ')}]: [${validMovesDebug.join(', ')}]`);

    const evaluation = evaluateOpeningMovePrecision(openingCurrentSequence, movePlayed);
    let quality = evaluation.quality;

    console.log(`[OpeningAnalysis] Seqüència: [${openingCurrentSequence.join(', ')}], Moviment: ${movePlayed}`);
    console.log(`[OpeningAnalysis] Moviments vàlids: [${evaluation.validMoves.join(', ')}], Avaluació: ${quality}`);

    // Si el moviment és d'obertura vàlid
    if (quality === 'correct') {
        openingLastMoveQuality = 'correct';
        showOpeningMoveVisualFeedback(from, to, 'correct');
        openingPracticeTotalMoves++;
        openingPracticeGoodMoves++;
        updateOpeningPrecisionDisplay(true);
        openingCurrentSequence.push(movePlayed);
        updateSelectedOpening();
        console.log(`[OpeningAnalysis] Moviment d'obertura correcte: ${movePlayed}`);

        if (needsEngineMove) {
            setTimeout(() => requestOpeningPracticeEngineMove(), 700);
        }
        return;
    }

    // Si és el primer moviment i no coincideix amb cap obertura coneguda (50%)
    if (quality === 'unknown' && openingCurrentSequence.length === 0) {
        openingLastMoveQuality = 'good';
        showOpeningMoveVisualFeedback(from, to, 'good');
        // 50%: comptem com 2 moviments però només 1 correcte
        openingPracticeTotalMoves += 2;
        openingPracticeGoodMoves += 1;
        updateOpeningPrecisionDisplay(true);
        openingCurrentSequence.push(movePlayed);
        updateSelectedOpening();
        console.log(`[OpeningAnalysis] Primer moviment no estàndard: ${movePlayed} - 50%`);

        if (needsEngineMove) {
            setTimeout(() => requestOpeningPracticeEngineMove(), 700);
        }
        return;
    }

    // Si hem sortit de les obertures conegudes, usar engine per avaluar
    if (quality === 'engine' || evaluation.validMoves.length === 0) {
        // Fallback a l'anàlisi de l'engine
        const fenAfter = openingPracticeGame.fen();
        let fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        if (openingPracticeHistory.length > 0) {
            fenBefore = openingPracticeHistory[openingPracticeHistory.length - 1].fen;
        }
        openingCurrentSequence.push(movePlayed);
        updateSelectedOpening();
        console.log(`[OpeningAnalysis] Fora d'obertures, usant engine per: ${movePlayed}`);
        analyzeOpeningMoveQuality(fenBefore, movePlayed, fenAfter);
        return;
    }

    // Hi havia moviments d'obertura vàlids però l'usuari n'ha fet un altre
    openingLastMoveQuality = 'incorrect';
    showOpeningMoveVisualFeedback(from, to, 'incorrect');
    openingPracticeTotalMoves++;
    updateOpeningPrecisionDisplay(true);
    openingCurrentSequence.push(movePlayed);
    updateSelectedOpening();
    console.log(`[OpeningAnalysis] Moviment incorrecte: ${movePlayed}, esperats: [${evaluation.validMoves.join(', ')}]`);

    if (needsEngineMove) {
        setTimeout(() => requestOpeningPracticeEngineMove(), 700);
    }
}

// Mostra feedback visual sobre el tauler
function showOpeningMoveVisualFeedback(from, to, quality) {
    // Netejar feedback anterior
    clearOpeningMoveVisualFeedback();

    const toSquare = $(`#opening-board .square-55d63[data-square='${to}']`);
    if (!toSquare.length) return;

    // Afegir classe segons qualitat
    if (quality === 'correct') {
        toSquare.addClass('move-correct');
        showOpeningMoveIcon(to, '✓', 'correct');
    } else if (quality === 'good') {
        toSquare.addClass('move-good');
        showOpeningMoveIcon(to, '~', 'good');
    } else if (quality === 'incorrect') {
        toSquare.addClass('move-incorrect');
        showOpeningMoveIcon(to, '✗', 'incorrect');
    }

    // Eliminar feedback després d'un temps
    setTimeout(() => {
        toSquare.removeClass('move-correct move-good move-incorrect');
    }, 2000);
}

// Mostra una icona sobre la casella
function showOpeningMoveIcon(square, icon, type) {
    // Eliminar icones anteriors
    $('.opening-move-icon').remove();

    const squareEl = $(`#opening-board .square-55d63[data-square='${square}']`);
    if (!squareEl.length) return;

    const iconEl = $(`<div class="opening-move-icon opening-move-icon-${type}">${icon}</div>`);
    squareEl.append(iconEl);

    // Animació d'entrada
    setTimeout(() => iconEl.addClass('show'), 10);

    // Eliminar després d'un temps
    setTimeout(() => {
        iconEl.removeClass('show');
        setTimeout(() => iconEl.remove(), 300);
    }, 1500);
}

// Neteja el feedback visual
function clearOpeningMoveVisualFeedback() {
    $('#opening-board .square-55d63').removeClass('move-correct move-good move-incorrect');
    $('.opening-move-icon').remove();
}

function showMainMoveVisualFeedback(to, quality) {
    clearMainMoveVisualFeedback();
    const toSquare = $(`#myBoard .square-55d63[data-square='${to}']`);
    if (!toSquare.length) return;
    if (quality === 'correct') {
        toSquare.addClass('move-correct');
    } else if (quality === 'incorrect') {
        toSquare.addClass('move-incorrect');
    }
    setTimeout(() => {
        toSquare.removeClass('move-correct move-incorrect');
    }, 1200);
}

function clearMainMoveVisualFeedback() {
    $('#myBoard .square-55d63').removeClass('move-correct move-incorrect');
}

function analyzeOpeningMoveQuality(fenBefore, movePlayed, fenAfter) {
    if (!fenBefore || !movePlayed || !fenAfter) return;

    // Si l'engine està pensant, guardem l'anàlisi per després
    if (openingPracticeEngineThinking) {
        openingPracticePendingAnalysis = { fen: fenBefore, move: movePlayed, fenAfter: fenAfter };
        return;
    }

    // Si ja hi ha una anàlisi en curs, la substituïm
    if (openingPracticeAnalysisPending) {
        openingPracticePendingAnalysis = { fen: fenBefore, move: movePlayed, fenAfter: fenAfter };
        return;
    }

    executeOpeningMoveAnalysis(fenBefore, movePlayed, fenAfter);
}

function executeOpeningMoveAnalysis(fenBefore, movePlayed, fenAfter) {
    if (!stockfish) {
        if (!ensureStockfish()) return;
    }

    openingPracticeAnalysisPending = true;
    openingPracticeLastFen = fenBefore;
    openingPracticeLastMove = movePlayed;
    openingFenAfterMove = fenAfter;
    openingAnalysisStep = 1; // Pas 1: analitzar posició ABANS del moviment
    openingTempScore = null;
    openingEvalBefore = null;
    openingEvalAfter = null;
    openingBestMove = null;

    // Timeout de seguretat: si no rebem resposta en 8 segons, processar igualment
    setTimeout(() => {
        if (openingPracticeAnalysisPending && openingPracticeLastMove === movePlayed) {
            console.warn('[OpeningPrecision] Timeout esperant resposta Stockfish');
            finalizeOpeningMoveAnalysis(); // Processar amb el que tenim
        }
    }, 8000);

    stockfishRequestor = 'opening-analysis';
    try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
    stockfish.postMessage(`position fen ${fenBefore}`);
    stockfish.postMessage('go depth 10');
}

// Processa el resultat del pas 1 (posició abans del moviment)
function processOpeningAnalysisStep1(bestMove) {
    if (openingAnalysisStep !== 1) return;

    openingBestMove = bestMove;
    openingEvalBefore = openingTempScore;
    openingTempScore = null;

    // Pas 2: analitzar posició DESPRÉS del moviment
    openingAnalysisStep = 2;

    if (!openingFenAfterMove) {
        // Si no tenim FEN després, finalitzem amb el que tenim
        finalizeOpeningMoveAnalysis();
        return;
    }

    stockfishRequestor = 'opening-analysis';
    try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
    stockfish.postMessage(`position fen ${openingFenAfterMove}`);
    stockfish.postMessage('go depth 10');
}

// Processa el resultat del pas 2 (posició després del moviment)
function processOpeningAnalysisStep2() {
    if (openingAnalysisStep !== 2) return;

    openingEvalAfter = openingTempScore;
    finalizeOpeningMoveAnalysis();
}

// Finalitza l'anàlisi i calcula la qualitat del moviment
function finalizeOpeningMoveAnalysis() {
    if (!openingPracticeAnalysisPending) return;
    openingPracticeAnalysisPending = false;
    openingAnalysisStep = 0;

    let moveQuality = 'good'; // Default a acceptable

    try {
        // Calcular swing igual que a la partida lliure
        // swing = evalAfter + evalBefore (el signe és oposat perquè canvia de perspectiva)
        let swing = null;
        if (openingEvalBefore !== null && openingEvalAfter !== null) {
            swing = openingEvalAfter + openingEvalBefore;
        }

        // Classificar la qualitat del moviment usant la mateixa funció que partida lliure
        moveQuality = classifyMoveQuality(
            swing !== null ? Math.abs(swing) : null,
            openingPracticeLastMove,
            openingBestMove
        );

        // Guardar per feedback visual
        openingLastMoveQuality = moveQuality;

        // Comptar com a bon moviment si és 'excel' o 'good'
        if (moveQuality === 'excel' || moveQuality === 'good') {
            openingPracticeGoodMoves++;
        }
        openingPracticeTotalMoves++;
        updateOpeningPrecisionDisplay();

        console.log(`[OpeningPrecision] Move: ${openingPracticeLastMove}, Best: ${openingBestMove}, ` +
                   `EvalBefore: ${openingEvalBefore}, EvalAfter: ${openingEvalAfter}, ` +
                   `Swing: ${swing}, Quality: ${moveQuality}`);
    } catch (e) {
        // En cas d'error, almenys comptem el moviment com acceptable
        openingPracticeTotalMoves++;
        openingPracticeGoodMoves++;
        updateOpeningPrecisionDisplay();
        console.error('[OpeningPrecision] Error processant anàlisi:', e);
    } finally {
        // Netejar variables d'anàlisi
        openingPracticeLastFen = null;
        openingPracticeLastMove = null;
        openingFenAfterMove = null;
        openingTempScore = null;
        openingEvalBefore = null;
        openingEvalAfter = null;
        openingBestMove = null;
    }

    // Executar anàlisi pendent si n'hi ha (i l'engine no està pensant)
    if (openingPracticePendingAnalysis && !openingPracticeEngineThinking) {
        const pending = openingPracticePendingAnalysis;
        openingPracticePendingAnalysis = null;
        setTimeout(() => {
            executeOpeningMoveAnalysis(pending.fen, pending.move, pending.fenAfter);
        }, 50);
        return; // No moure l'engine encara, esperar la següent anàlisi
    }

    // Després de l'anàlisi, fer moure l'engine si cal
    if (openingNeedsEngineMove) {
        openingNeedsEngineMove = false;
        setTimeout(() => requestOpeningPracticeEngineMove(), 500);
    }
}

// Funcions tap-to-move per al tauler d'obertures
function clearOpeningTapSelection() {
    openingTapSelectedSquare = null;
    $('#opening-board .square-55d63').removeClass('tap-selected tap-move');
}

function highlightOpeningTapSelection(square) {
    $('#opening-board .square-55d63').removeClass('tap-selected tap-move');
    if (!square) return;
    const sel = $(`#opening-board .square-55d63[data-square='${square}']`);
    sel.addClass('tap-selected');

    const moves = openingPracticeGame ? openingPracticeGame.moves({ square: square, verbose: true }) : [];
    for (const mv of moves) {
        $(`#opening-board .square-55d63[data-square='${mv.to}']`).addClass('tap-move');
    }
}

function commitOpeningMoveFromTap(from, to) {
    if (!openingPracticeGame) return false;
    if (openingPracticeGame.game_over()) return false;

    // Mode pràctica d'errors d'obertura
    if (openingErrorPracticeActive) {
        const move = openingPracticeGame.move({ from: from, to: to, promotion: 'q' });
        if (!move) return false;

        const moveUci = from + to;
        openingBundleBoard.position(openingPracticeGame.fen());

        if (openingErrorBestMove && moveUci === openingErrorBestMove.substring(0, 4)) {
            // Moviment correcte
            showOpeningMoveVisualFeedback(from, to, 'correct');
            setTimeout(() => handleOpeningErrorSuccess(), 800);
        } else {
            // Moviment incorrecte
            showOpeningMoveVisualFeedback(from, to, 'incorrect');
            setTimeout(() => {
                openingPracticeGame.undo();
                openingBundleBoard.position(openingPracticeGame.fen());
            }, 600);
        }
        return true;
    }

    if (openingPracticeMoveCount >= OPENING_PRACTICE_MAX_PLIES) return false;

    // Guardar estat per poder desfer
    saveOpeningPracticeState();

    const wasWhiteTurn = openingPracticeGame.turn() === 'w';

    const move = openingPracticeGame.move({ from: from, to: to, promotion: 'q' });
    if (!move) {
        // Moviment invàlid, treure l'estat guardat
        openingPracticeHistory.pop();
        return false;
    }

    // Obtenir moviment en format SAN per al sistema d'obertures
    const movePlayed = move.san;

    // Netejar pista visual i estat
    clearOpeningHintHighlight();
    openingPracticeBestMove = null;
    openingPracticeMoveCount += 1;
    openingBundleBoard.position(openingPracticeGame.fen());
    updateOpeningPracticeStatus();

    // Determinar si cal moviment de l'engine
    const needsEngineMove = openingPracticeMoveCount < OPENING_PRACTICE_MAX_PLIES &&
                           !openingPracticeGame.game_over() &&
                           openingPracticeGame.turn() === 'b';

    // FLUX: Primer precisió, després moviment de l'engine
    if (wasWhiteTurn) {
        handleOpeningUserMove(movePlayed, from, to, needsEngineMove);
    } else if (needsEngineMove) {
        // Si no era torn de l'usuari però cal engine, demanar-lo directament
        setTimeout(() => requestOpeningPracticeEngineMove(), 300);
    }

    return true;
}

function enableOpeningTapToMove() {
    if (openingTapMoveEnabled) return;
    openingTapMoveEnabled = true;
    const boardEl = document.getElementById('opening-board');
    if (boardEl) boardEl.style.touchAction = 'none';

    $('#opening-board').off('.opening-tapmove')
        .on(`pointerdown.opening-tapmove touchstart.opening-tapmove`, '.square-55d63', function(e) {
            if (!openingPracticeGame || openingPracticeGame.game_over()) return;
            if (openingPracticeMoveCount >= OPENING_PRACTICE_MAX_PLIES) return;
            if (openingPracticeEngineThinking) return;

            if (e && e.preventDefault) e.preventDefault();

            const nowTs = Date.now();
            if (nowTs - openingLastTapEventTs < 180) return;
            openingLastTapEventTs = nowTs;

            const square = $(this).attr('data-square');
            if (!square) return;

            if (!openingTapSelectedSquare) {
                const p = openingPracticeGame.get(square);
                if (!p || p.color !== openingPracticeGame.turn()) return;
                openingTapSelectedSquare = square;
                highlightOpeningTapSelection(square);
                return;
            }

            if (square === openingTapSelectedSquare) {
                clearOpeningTapSelection();
                return;
            }

            const moved = commitOpeningMoveFromTap(openingTapSelectedSquare, square);
            if (moved) {
                clearOpeningTapSelection();
                return;
            }

            const p2 = openingPracticeGame.get(square);
            if (p2 && p2.color === openingPracticeGame.turn()) {
                openingTapSelectedSquare = square;
                highlightOpeningTapSelection(square);
            }
        });
}

function disableOpeningTapToMove() {
    if (!openingTapMoveEnabled) return;
    openingTapMoveEnabled = false;
    $('#opening-board').off('.opening-tapmove');
    const boardEl = document.getElementById('opening-board');
    if (boardEl) boardEl.style.touchAction = '';
    clearOpeningTapSelection();
}

function updateOpeningBoardInteractivity() {
    if (!openingBundleBoard) return;
    const shouldUseTap = controlMode === 'tap';
    openingBundleBoard.draggable = !shouldUseTap;
    if (shouldUseTap) {
        enableOpeningTapToMove();
    } else {
        disableOpeningTapToMove();
    }
}

let currentStreak = 0;
let lastPracticeDate = null;
let todayCompleted = false;
let missionsCompletionTime = null; // Guardarà l'hora de finalització

let totalStars = 0;
let todayMissions = [];
let missionsDate = null;
let unlockedBadges = [];

let sessionStats = { 
    gamesPlayed: 0, 
    gamesWon: 0, 
    bundlesSolved: 0,
    bundlesSolvedLow: 0,
    bundlesSolvedMed: 0,
    bundlesSolvedHigh: 0,
    highPrecisionGames: 0, 
    perfectGames: 0, 
    blackWins: 0,
    leagueGamesPlayed: 0,
    freeGamesPlayed: 0
};

let isAnalyzingHint = false;
let waitingForBlunderAnalysis = false;
let analysisStep = 0;
let tempAnalysisScore = 0;
let pendingBestMove = null;
let pendingEvalBefore = null;
let pendingEvalAfter = null;
let pendingAnalysisFen = null;
// Variables per captura enriquida de Stockfish
let pendingAnalysisDepth = null;
let pendingBestMovePv = [];
let pendingAlternatives = [];
let enrichedAnalysisBuffer = {};

let eloHistory = [];
let totalGamesPlayed = 0;
let totalWins = 0;
let maxStreak = 0;

// Lliga (mode escacs)
let currentLeague = null; 
let leagueActiveMatch = null; 

let currentGameMode = 'free';
let currentOpponent = null;
let eloChart = null;
let engineMoveTimeout = null;

const MISSION_TEMPLATES = [
    { id: 'play1', text: 'Juga 1 Partida', stars: 1, check: () => sessionStats.gamesPlayed >= 1 },
    { id: 'playLeague', text: 'Juga 1 Lliga', stars: 1, check: () => sessionStats.leagueGamesPlayed >= 1 },
    { id: 'playFree', text: 'Juga 1 Lliure', stars: 1, check: () => sessionStats.freeGamesPlayed >= 1 },
    { id: 'bundle1', text: 'Resol 1 Error', stars: 1, check: () => sessionStats.bundlesSolved >= 1 },
    { id: 'bundleLow', text: 'Resol 1 Lleu', stars: 1, check: () => sessionStats.bundlesSolvedLow >= 1 },
    { id: 'precision70', text: 'Precisió +70%', stars: 1, check: () => sessionStats.highPrecisionGames >= 1 },
    
    { id: 'play3', text: 'Juga 3 Partides', stars: 2, check: () => sessionStats.gamesPlayed >= 3 },
    { id: 'win2', text: 'Guanya 2 partides', stars: 2, check: () => sessionStats.gamesWon >= 2 },
    { id: 'bundle3', text: 'Resol 3 Errors', stars: 2, check: () => sessionStats.bundlesSolved >= 3 },
    { id: 'bundleMed', text: 'Resol 1 Mitjà', stars: 2, check: () => sessionStats.bundlesSolvedMed >= 1 },
    { id: 'precision85', text: 'Precisió +85%', stars: 2, check: () => sessionStats.perfectGames >= 1 },
    
    { id: 'play5', text: 'Juga 5 Partides', stars: 3, check: () => sessionStats.gamesPlayed >= 5 },
    { id: 'win4', text: 'Guanya 4 partides', stars: 3, check: () => sessionStats.gamesWon >= 4 },
    { id: 'bundleHigh', text: 'Resol 1 Greu', stars: 3, check: () => sessionStats.bundlesSolvedHigh >= 1 },
    { id: 'blackwin', text: 'Guanya amb Negres', stars: 3, check: () => sessionStats.blackWins >= 1 }
];

const BADGES = [
    { id: 'rookie', name: 'Novell', stars: 5, icon: '🌱' },
    { id: 'apprentice', name: 'Aprenent', stars: 20, icon: '📚' },
    { id: 'skilled', name: 'Competent', stars: 50, icon: '⚔️' },
    { id: 'expert', name: 'Expert', stars: 100, icon: '🎖️' },
    { id: 'master', name: 'Mestre', stars: 200, icon: '👑' },
    { id: 'grandmaster', name: 'Gran Mestre', stars: 400, icon: '🏆' },
    { id: 'legend', name: 'Llegenda', stars: 750, icon: '⭐' },
    { id: 'immortal', name: 'Immortal', stars: 1500, icon: '🔥' }
];

function getToday() { return new Date().toISOString().split('T')[0]; }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
}

function generateLeagueName() {
    const a = ['Lliga', 'Copa', 'Circuit', 'Temporada', 'Torneig'];
    const b = ['del Tauler', 'dels Alfiles', 'de la Dama', 'del Cavall', 'dels Naips', 'del Rei', 'de l\'Escac'];
    const c = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
    const partA = a[randInt(0, a.length - 1)];
    const partB = b[randInt(0, b.length - 1)];
    const partC = c[randInt(0, c.length - 1)];
    return `${partA} ${partB} ${partC}`;
}

function buildRoundRobinSchedule(playerIds) {
    const ids = playerIds.slice();
    const fixed = ids[0];
    let rest = ids.slice(1);
    const rounds = [];
    const n = ids.length;

    for (let r = 0; r < n - 1; r++) {
        const roundArr = [fixed, ...rest];
        const pairings = [];
        for (let i = 0; i < n / 2; i++) {
            const aId = roundArr[i];
            const bId = roundArr[n - 1 - i];
            pairings.push([aId, bId]);
        }
        rounds.push(pairings);
        const last = rest.pop();
        rest = [last, ...rest];
    }
    return rounds;
}

function createNewLeague(force = false) {
    if (currentLeague && !force) return currentLeague;

    const baseNames = [
        'RocaNegra', 'AlfilFosc', 'CavallViu', 'DamaRàpida', 'ReiCalm', 'PeóFerm',
        'TorreVella', 'Gambit', 'Finalista', 'TrampaDolça', 'VellaGuàrdia', 'LíniaSòlida',
        'EscacIAnem', 'Fletxa', 'Diagonal', 'CasellaClara', 'CasellaFosca', 'XecMate'
    ];
    shuffleArray(baseNames);

    const bots = [];
    for (let i = 0; i < 9; i++) {
        const name = baseNames[i] || `Rival${i + 1}`;
        const elo = Math.max(50, userELO + randInt(-25, 25));
        bots.push({ id: `bot${i + 1}`, name: name, elo: elo, pj: 0, pg: 0, pp: 0, pe: 0, pts: 0 });
    }

    const me = { id: 'me', name: 'Tu', elo: userELO, pj: 0, pg: 0, pp: 0, pe: 0, pts: 0 };
    const players = [me, ...bots];

    const ids = ['me', ...shuffleArray(bots.map(b => b.id))];
    const schedule = buildRoundRobinSchedule(ids);

    currentLeague = {
        id: 'league_' + Date.now(),
        name: generateLeagueName(),
        createdAt: Date.now(),
        players: players,
        schedule: schedule,
        currentRound: 1,
        completed: false
    };
    leagueActiveMatch = null;
    saveStorage();
    return currentLeague;
}

function getLeaguePlayer(id) {
    if (!currentLeague) return null;
    return currentLeague.players.find(p => p.id === id) || null;
}

function getLeaguePlayerElo(id) {
    const player = getLeaguePlayer(id);
    return player && typeof player.elo === 'number' ? player.elo : userELO;
}

function formatPts(v) {
    const isInt = Math.abs(v - Math.round(v)) < 1e-9;
    if (isInt) return String(Math.round(v));
    return (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
}

function leagueSort(players) {
    return players.slice().sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.pg !== a.pg) return b.pg - a.pg;
        if (b.elo !== a.elo) return b.elo - a.elo;
        return a.name.localeCompare(b.name);
    });
}

function getMyOpponentForRound(roundIndex) {
    if (!currentLeague) return null;
    const pairings = currentLeague.schedule[roundIndex];
    for (const [aId, bId] of pairings) {
        if (aId === 'me') return bId;
        if (bId === 'me') return aId;
    }
    return null;
}

function cloneLeaguePlayers() {
    if (!currentLeague) return [];
    return currentLeague.players.map(p => ({ ...p }));
}

function findPlayerRank(players, id) {
    const sorted = leagueSort(players);
    const idx = sorted.findIndex(p => p.id === id);
    return idx >= 0 ? idx + 1 : null;
}

function simulateRankAfterWin(opponentId) {
    if (!currentLeague) return null;
    const playersCopy = cloneLeaguePlayers();
    const me = playersCopy.find(p => p.id === 'me');
    const opp = playersCopy.find(p => p.id === opponentId);
    if (!me || !opp) return null;

    me.pj++; me.pg++; me.pts += 1;
    opp.pj++; opp.pp++;

    return findPlayerRank(playersCopy, 'me');
}

function isLeagueUnlocked() {
    return calibrationGames.length >= CALIBRATION_GAME_COUNT
        && totalGamesPlayed >= LEAGUE_UNLOCK_MIN_GAMES
        && !isCalibrationActive();
}

function updateLeagueAccessUI() {
    const leagueBtn = $('#btn-league');
    const unlocked = isLeagueUnlocked();
    if (leagueBtn.length) {
        leagueBtn.prop('disabled', !unlocked);
        leagueBtn.toggleClass('btn-disabled', !unlocked);
        if (unlocked) leagueBtn.removeAttr('title');
        else leagueBtn.attr('title', `Disponible després de ${LEAGUE_UNLOCK_MIN_GAMES} partides un cop calibrat.`);
    }
    if (!unlocked) $('#league-banner').hide();
    else updateLeagueBanner();
}

function updateLeagueBanner() {
    const banner = $('#league-banner');
    if (!banner.length) return;

     if (!isLeagueUnlocked()) {
        banner.hide();
        return;
    }

    createNewLeague(false);
    if (!currentLeague || currentLeague.completed) {
        banner.hide();
        return;
    }

    const roundIdx = currentLeague.currentRound - 1;
    const oppId = getMyOpponentForRound(roundIdx);
    const opp = oppId ? getLeaguePlayer(oppId) : null;
    if (!opp) { banner.hide(); return; }

    const myRank = findPlayerRank(currentLeague.players, 'me');
    const oppRank = findPlayerRank(currentLeague.players, opp.id);
    const projectedRank = simulateRankAfterWin(opp.id);

    $('#league-banner-opponent').text(opp.name);
    $('#league-banner-elo').text(opp.elo);
    $('#league-banner-opp-rank').text(oppRank ? `#${oppRank}` : '—');
    $('#league-banner-my-rank').text(myRank ? `#${myRank}` : '—');
    $('#league-banner-projected').text(projectedRank ? `#${projectedRank}` : '—');

    const quote = LEAGUE_QUOTES[Math.floor(Math.random() * LEAGUE_QUOTES.length)];
    $('#league-banner-quote').text(quote);

    banner.show();
}

function openLeague() {
    if (!isLeagueUnlocked()) {
        alert(`La lliga s'activa després de ${LEAGUE_UNLOCK_MIN_GAMES} partides un cop calibrat.`);
        return;
    }
    createNewLeague(false);
    $('#start-screen').hide(); $('#stats-screen').hide(); $('#game-screen').removeClass('active').hide();
    $('#league-screen').show();
    renderLeague();
}

function renderLeague() {
    if (!currentLeague) return;

    $('#league-name').text(currentLeague.name);

    if (currentLeague.completed) {
        $('#league-round').text('Lliga acabada');
        $('#league-next').text('Proper rival: —');
        $('#btn-league-play').hide();
        $('#btn-league-new').show();
    } else {
        $('#league-round').text(`Jornada ${currentLeague.currentRound}/9`);
        const oppId = getMyOpponentForRound(currentLeague.currentRound - 1);
        const opp = oppId ? getLeaguePlayer(oppId) : null;
        $('#league-next').text(`Proper rival: ${opp ? opp.name : '—'}`);
        $('#btn-league-play').show();
        $('#btn-league-new').hide();
    }

    const sorted = leagueSort(currentLeague.players);
    const tbody = $('#league-table-body');
    tbody.empty();

    sorted.forEach((p, idx) => {
        const tr = $('<tr></tr>');
        if (p.id === 'me') tr.addClass('league-row-me');

        if (currentLeague.completed) {
            if (idx === 0) tr.addClass('league-podium-1');
            else if (idx === 1) tr.addClass('league-podium-2');
            else if (idx === 2) tr.addClass('league-podium-3');
        }

        const displayElo = (isCalibrationActive() && p.id === 'me') ? '—' : p.elo;
        tr.append(`
            <td class="league-player-cell">
                <span class="league-player-name">${p.name}</span>
            </td>
        `);
        tr.append(`<td class="league-elo-cell num">${displayElo}</td>`);
        tr.append(`<td class="num">${p.pj}</td>`);
        tr.append(`<td class="num">${p.pg}</td>`);
        tr.append(`<td class="num">${p.pp}</td>`);
        tr.append(`<td class="num">${p.pe}</td>`);
        tr.append(`<td class="num">${formatPts(p.pts)}</td>`);
        tbody.append(tr);
    });
}

function simulateOutcomeByElo(eloA, eloB) {
    const ea = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
    const diff = Math.abs(eloA - eloB);
    const drawBase = 0.20;
    const drawExtra = 0.15 * (1 - Math.min(diff / 350, 1));
    const pDraw = Math.min(0.45, Math.max(0.10, drawBase + drawExtra));

    const r = Math.random();
    if (r < pDraw) return 'draw';

    const r2 = (r - pDraw) / (1 - pDraw);
    return r2 < ea ? 'A' : 'B';
}

function applyResult(aId, bId, outcome) {
    const a = getLeaguePlayer(aId);
    const b = getLeaguePlayer(bId);
    if (!a || !b) return;

    a.pj++; b.pj++;

    if (outcome === 'draw') {
        a.pe++; b.pe++;
        a.pts += 0.5; b.pts += 0.5;
        return;
    }

    if (outcome === 'winA') {
        a.pg++; b.pp++;
        a.pts += 1;
        return;
    }

    if (outcome === 'winB') {
        b.pg++; a.pp++;
        b.pts += 1;
        return;
    }
}

function startLeagueRound() {
    if (!isLeagueUnlocked()) {
        alert(`La lliga s'activa després de ${LEAGUE_UNLOCK_MIN_GAMES} partides un cop calibrat.`);
        return;
    }   
    if (!currentLeague) createNewLeague(false);
    if (currentLeague.completed) return;

    const roundIdx = currentLeague.currentRound - 1;
    const oppId = getMyOpponentForRound(roundIdx);
    if (!oppId) { alert('No s\'ha pogut trobar rival'); return; }

    leagueActiveMatch = { leagueId: currentLeague.id, round: currentLeague.currentRound, opponentId: oppId };
    currentGameMode = 'league';
    const opp = getLeaguePlayer(oppId);
    currentOpponent = opp ? { id: opp.id, name: opp.name, elo: opp.elo } : { id: oppId, name: 'Rival', elo: userELO };
    saveStorage();

    startGame(false);
}

function applyLeagueAfterGame(myOutcome) {
    if (!currentLeague || !leagueActiveMatch) return;
    if (leagueActiveMatch.leagueId !== currentLeague.id) { leagueActiveMatch = null; saveStorage(); return; }

    const roundNumber = leagueActiveMatch.round;
    const roundIdx = roundNumber - 1;
    const oppId = leagueActiveMatch.opponentId;

    if (myOutcome === 'win') applyResult('me', oppId, 'winA');
    else if (myOutcome === 'loss') applyResult('me', oppId, 'winB');
    else applyResult('me', oppId, 'draw');

    const pairings = currentLeague.schedule[roundIdx] || [];
    for (const [aId, bId] of pairings) {
        if ((aId === 'me' || bId === 'me')) continue;

        const a = getLeaguePlayer(aId);
        const b = getLeaguePlayer(bId);
        if (!a || !b) continue;

        const sim = simulateOutcomeByElo(a.elo, b.elo);
        if (sim === 'draw') applyResult(aId, bId, 'draw');
        else if (sim === 'A') applyResult(aId, bId, 'winA');
        else applyResult(aId, bId, 'winB');
    }

    currentLeague.currentRound++;
    if (currentLeague.currentRound > 9) {
        currentLeague.completed = true;
    }

    leagueActiveMatch = null;
    saveStorage();
}

function generateDailyMissions() {
    const today = getToday();
    const now = Date.now();
    const oneHour = 3600 * 1000; // 1 hora en mil·lisegons

    // Comprovem si ha passat 1 hora des que es van completar
    let timePassed = false;
    if (missionsCompletionTime && (now - missionsCompletionTime > oneHour)) {
        timePassed = true;
    }

    // Si estem al mateix dia, tenim missions, i NO ha passat l'hora, no fem res.
    if (missionsDate === today && todayMissions.length === 3 && !timePassed) {
        updateMissionsDisplay();
        return;
    }

    // Si ha passat l'hora, resetegem el temps per la pròxima tanda
    if (timePassed) {
        missionsCompletionTime = null;
    }

    missionsDate = today;
    
    // MODIFICACIÓ CLAU: La "seed" ara inclou l'hora per garantir que les noves missions siguin diferents
    // encara que sigui el mateix dia.
    const seedString = today.split('-').join('') + (timePassed ? 'v2' : ''); 
    // Nota: 'v2' és un exemple, cada cop que es completin canviarà l'atzar lleugerament
    
    // Per fer-ho senzill i que variï sempre si regenerem, fem servir un random pur si regenerem intra-dia
    const rng = timePassed ? Math.random : mulberry32(parseInt(today.split('-').join('')));

    const easy = MISSION_TEMPLATES.filter(m => m.stars === 1);
    const medium = MISSION_TEMPLATES.filter(m => m.stars === 2);
    const hard = MISSION_TEMPLATES.filter(m => m.stars === 3);
    
    // Funció auxiliar per triar random
    const pick = (arr) => arr[Math.floor((timePassed ? Math.random() : rng()) * arr.length)];

    todayMissions = [
        { ...pick(easy), completed: false },
        { ...pick(medium), completed: false },
        { ...pick(hard), completed: false }
    ];

    // Reiniciem estadístiques parcials de sessió per a les noves missions
    sessionStats = { 
        gamesPlayed: 0, gamesWon: 0, bundlesSolved: 0, 
        bundlesSolvedLow: 0, bundlesSolvedMed: 0, bundlesSolvedHigh: 0,
        highPrecisionGames: 0, perfectGames: 0, blackWins: 0,
        leagueGamesPlayed: 0, freeGamesPlayed: 0
    };
    
    saveStorage();
    updateMissionsDisplay();
}

function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function updateMissionsDisplay() {
    const container = $('#missions-list'); container.empty();
    const targets = { 
        play1: 1, play3: 3, play5: 5, win2: 2, win4: 4, 
        bundle1: 1, bundle3: 3, precision70: 1, precision85: 1, blackwin: 1,
        playLeague: 1, playFree: 1, bundleLow: 1, bundleMed: 1, bundleHigh: 1
    };
    const getValue = (id) => {
        if (id === 'playLeague') return sessionStats.leagueGamesPlayed;
        if (id === 'playFree') return sessionStats.freeGamesPlayed;
        if (id === 'bundleLow') return sessionStats.bundlesSolvedLow;
        if (id === 'bundleMed') return sessionStats.bundlesSolvedMed;
        if (id === 'bundleHigh') return sessionStats.bundlesSolvedHigh;
        
        if (id.startsWith('play')) return sessionStats.gamesPlayed;
        if (id.startsWith('win')) return sessionStats.gamesWon;
        if (id.startsWith('bundle')) return sessionStats.bundlesSolved;
        if (id === 'precision70') return sessionStats.highPrecisionGames;
        if (id === 'precision85') return sessionStats.perfectGames;
        if (id === 'blackwin') return sessionStats.blackWins;
        return 0;
    };
    todayMissions.forEach((mission) => {
        const stars = '★'.repeat(mission.stars);
        const completedClass = mission.completed ? 'completed' : '';
        const target = targets[mission.id] || 1;
        const val = getValue(mission.id);
        const stepsDone = Math.min(val, target);
        const trophies = '🏆'.repeat(stepsDone);
        const trophiesClass = stepsDone === 0 ? 'empty' : '';
        const progressText = mission.completed ? 'Fet' : `${stepsDone}/${target}`;
        container.append(
            `<div class="mission-item ${completedClass}">
                <div class="mission-stars">${stars}</div>
                <div class="mission-text">
                    <div class="mission-label">${mission.text}</div>
                    <div class="mission-progress">${progressText}</div>
                </div>
                <div class="mission-check">★</div>
                <div class="mission-trophies ${trophiesClass}">${trophies}</div>
            </div>`
        );
    });
}

function checkMissions() {
    let newStarsEarned = 0;
    let allCompletedBefore = todayMissions.every(m => m.completed); // Estat abans de comprovar

    todayMissions.forEach((mission, idx) => {
        if (!mission.completed && mission.check()) {
            mission.completed = true; newStarsEarned += mission.stars;
        }
    });

    // NOVA LÒGICA: Si totes estan completes i abans no ho estaven (o no tenim temps guardat)
    if (todayMissions.every(m => m.completed) && !missionsCompletionTime) {
        missionsCompletionTime = Date.now(); // Guardem el moment actual
        saveStorage();
    }

    if (newStarsEarned > 0) {
        const oldStars = totalStars; totalStars += newStarsEarned;
        saveStorage(); updateMissionsDisplay(); updateDisplay(); checkNewBadges(oldStars, totalStars);
    }
}

function checkNewBadges(oldStars, newStars) {
    BADGES.forEach(badge => {
        if (oldStars < badge.stars && newStars >= badge.stars) {
            if (!unlockedBadges.includes(badge.id)) {
                unlockedBadges.push(badge.id); showNewBadge(badge); saveStorage();
            }
        }
    });
}

function showNewBadge(badge) {
    $('#new-badge-icon').text(badge.icon); $('#new-badge-name').text(badge.name);
    $('#new-badge-stars').text('★'.repeat(Math.min(badge.stars / 10, 10)) + ` (${badge.stars}★)`);
    $('#new-badge-modal').css('display', 'flex');
}

function updateBadgesModal() {
    $('#modal-total-stars').text(totalStars); const grid = $('#badges-grid'); grid.empty();
    BADGES.forEach(badge => {
        const isUnlocked = totalStars >= badge.stars; const statusClass = isUnlocked ? 'unlocked' : 'locked';
        grid.append(`<div class="badge-item ${statusClass}"><div class="badge-icon">${badge.icon}</div><div class="badge-name">${badge.name}</div><div class="badge-req">${badge.stars}★</div></div>`);
    });
}

function getYesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; }

function checkStreak() {
    const today = getToday(); const yesterday = getYesterday();
    if (lastPracticeDate === today) todayCompleted = true;
    else if (lastPracticeDate === yesterday) todayCompleted = false;
    else if (lastPracticeDate && lastPracticeDate !== today) {
        currentStreak = 0; todayCompleted = false;
    }
    updateStreakDisplay();
}

function recordActivity() {
    const today = getToday();
    if (lastPracticeDate !== today) {
        if (lastPracticeDate === getYesterday()) currentStreak++;
        else if (!lastPracticeDate || lastPracticeDate !== today) currentStreak = 1;
        lastPracticeDate = today; todayCompleted = true;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
        saveStorage();
    }
    updateStreakDisplay();
}

function updateStreakDisplay() {
    $('#current-streak').text(currentStreak);
    const streakBox = $('#streak-box'); const statusEl = $('#streak-status');
    if (todayCompleted) { statusEl.removeClass('streak-pending').addClass('streak-done').text('✓ Fet'); streakBox.addClass('active'); } 
    else { statusEl.removeClass('streak-done').addClass('streak-pending').text('Pendent'); streakBox.removeClass('active'); }
}

function restoreMissions(savedList) {
    if (!Array.isArray(savedList)) return [];
    return savedList
        .map(saved => {
            const template = MISSION_TEMPLATES.find(t => t.id === saved.id);
            if (!template) return null;
            return { ...template, completed: !!saved.completed };
        })
        .filter(Boolean);
}

function clampEngineElo(elo) {
    if (isNaN(elo)) return Math.round(Math.max(ELO_MIN, Math.min(ELO_MAX, currentElo)));
    return Math.round(Math.max(ELO_MIN, Math.min(ELO_MAX, elo)));
}

function difficultyToLevel(legacyDifficulty) {
    // Converteix l'antic rang 5-15 a ELO adaptatiu 400-3000
    const normalized = Math.max(0, Math.min(1, ((legacyDifficulty || 8) - 5) / 10));
    return Math.round(ADAPTIVE_CONFIG.MIN_LEVEL + normalized * (ADAPTIVE_CONFIG.MAX_LEVEL - ADAPTIVE_CONFIG.MIN_LEVEL));
}

function levelToDifficulty(level) {
    // Manté la compatibilitat amb l'antic rang 5-15
    const normalized = Math.max(0, Math.min(1, (level - ADAPTIVE_CONFIG.MIN_LEVEL) / (ADAPTIVE_CONFIG.MAX_LEVEL - ADAPTIVE_CONFIG.MIN_LEVEL)));
    return Math.round(5 + normalized * 10);
}

function getEffectiveAIDifficulty() {
    if (isCalibrationGame) return levelToDifficulty(currentCalibrationOpponentRoc || CALIBRATION_ROCS[0]);
    return aiDifficulty;
}

function getAdaptiveNormalized() {
     return Math.max(0, Math.min(1, (currentElo - ADAPTIVE_CONFIG.MIN_LEVEL) / (ADAPTIVE_CONFIG.MAX_LEVEL - ADAPTIVE_CONFIG.MIN_LEVEL)));
}

function adjustAIDifficulty(playerWon, precision, resultScore = null) {
    const normalizedScore = (typeof resultScore === 'number') ? resultScore : (playerWon ? 1 : 0);
    const safePrecision = Math.max(0, Math.min(100, typeof precision === 'number' ? precision : 50));

    recentGames.push({ result: normalizedScore, precision: safePrecision });
    if (recentGames.length > 20) recentGames.shift();
    
    if (normalizedScore === 1) { consecutiveWins++; consecutiveLosses = 0; } 
    else if (normalizedScore === 0) { consecutiveLosses++; consecutiveWins = 0; }
    else { consecutiveWins = 0; consecutiveLosses = 0; }

    if (isCalibrating) {
        saveStorage();
        return;
    }

    let eloDelta = 0;

    if (normalizedScore === 1) {
        if (safePrecision > 80) eloDelta += 50;
        else if (safePrecision >= 65) eloDelta += 35;
        else eloDelta += 15;
    } else if (normalizedScore === 0) {
        if (safePrecision > 60) eloDelta -= 15;
        else if (safePrecision >= 45) eloDelta -= 30;
        else eloDelta -= 50;
    } else {
        eloDelta += 10;
    }

    if (consecutiveWins >= 3) eloDelta += 30;
    if (consecutiveLosses >= 3) eloDelta -= 25;

    if (recentGames.length >= 5) {
        const recentSlice = recentGames.slice(-10);
        const wins = recentSlice.filter(game => game.result === 1).length;
        const winRate = recentSlice.length > 0 ? wins / recentSlice.length : 0.5;
        if (winRate > 0.60) eloDelta += 30;
        else if (winRate < 0.40) eloDelta -= 30;
    }

    eloDelta = Math.max(-60, Math.min(60, eloDelta));
    currentElo = clampEngineElo(currentElo + eloDelta);
    aiDifficulty = levelToDifficulty(currentElo);
    applyEngineEloStrength(currentElo);
    saveStorage();
}

function getCalibrationRocFloor() {
    if (typeof calibrationRocFloor === 'number') return calibrationRocFloor;
    if (calibrationProfile && typeof (calibrationProfile.roc ?? calibrationProfile.elo) === 'number') return calibrationProfile.roc ?? calibrationProfile.elo;
    return userELO;
}

function clampUserElo(value) {
    const floor = getCalibrationRocFloor();
    const baseFloor = typeof floor === 'number' ? floor : ELO_MIN;
    const flexibleFloor = Math.max(ELO_MIN, baseFloor * 0.7);
    const minValue = Number.isFinite(flexibleFloor) ? flexibleFloor : ELO_MIN;
    return Math.round(Math.max(minValue, Math.min(ELO_MAX, value)));
}

function evaluateGameQuality(precision, avgCpLoss, blunders) {
    const safePrecision = Math.max(0, Math.min(100, typeof precision === 'number' ? precision : 0));
    const safeLoss = Math.max(0, typeof avgCpLoss === 'number' ? avgCpLoss : 180);
    const safeBlunders = Math.max(0, typeof blunders === 'number' ? blunders : 0);
    const precisionScore = safePrecision / 100;
    const lossScore = 1 - Math.min(safeLoss, 200) / 200;
    const blunderPenalty = Math.min(0.3, safeBlunders * 0.1);
    const qualityScore = Math.max(0, Math.min(1, (precisionScore * 0.6) + (lossScore * 0.4) - blunderPenalty));
    const isHighQuality = qualityScore >= CONTINUOUS_ADJUST_CONFIG.QUALITY_HIGH;
    const hasErrors = safePrecision <= CONTINUOUS_ADJUST_CONFIG.ERROR_PRECISION_MAX
        || safeLoss >= CONTINUOUS_ADJUST_CONFIG.ERROR_CPLOSS_MIN
        || safeBlunders >= CONTINUOUS_ADJUST_CONFIG.ERROR_BLUNDERS_MIN;
    return { qualityScore, isHighQuality, hasErrors };
}

function logEloAdjustment(entry) {
    adjustmentLog.push(entry);
    if (adjustmentLog.length > 120) adjustmentLog = adjustmentLog.slice(-120);
    saveStorage();
}

function checkEloMilestones(previousElo, newElo) {
    const unlocked = [];
    ELO_MILESTONES.forEach(milestone => {
        if (previousElo < milestone && newElo >= milestone && !unlockedEloMilestones.includes(milestone)) {
            unlockedEloMilestones.push(milestone);
            unlocked.push(milestone);
        }
    });
    return unlocked;
}

function applyContinuousEloAdjustment(delta, reason, meta = {}) {
    const previousElo = userELO;
    const cappedDelta = Math.max(-CONTINUOUS_ADJUST_CONFIG.MAX_CYCLE_DELTA, Math.min(CONTINUOUS_ADJUST_CONFIG.MAX_CYCLE_DELTA, delta));
    const nextElo = clampUserElo(previousElo + cappedDelta);
    const appliedDelta = nextElo - previousElo;
    if (appliedDelta === 0) return null;

    userELO = nextElo;
    updateEloHistory(userELO);
    syncEngineEloFromUser();

    const timestamp = new Date().toISOString();
    logEloAdjustment({
        timestamp: timestamp,
        previousElo: previousElo,
        newElo: userELO,
        delta: appliedDelta,
        reason: reason,
        trend: meta.trend || null,
        cycle: meta.cycle || null
    });

    let message = appliedDelta > 0
        ? `Has millorat! Nou nivell: ${userELO} ↗`
        : `Nivell ajustat: ${userELO} ↘`;
    const milestones = checkEloMilestones(previousElo, userELO);
    if (milestones.length) {
        message += ` · Assoliment ELO ${milestones[milestones.length - 1]} ✨`;
    }
    return { delta: appliedDelta, message: message };
}

function getBaselineAdjustmentDelta(resultLabel, qualityScore) {
    if (resultLabel === 'win') {
        return qualityScore >= 0.65 ? 10 : 6;
    }
    if (resultLabel === 'loss') {
        return qualityScore >= 0.6 ? -6 : -12;
    }
    return 0;
}

function registerFreeGameAdjustment(resultScore, precision, metrics = {}) {
    const quality = evaluateGameQuality(precision, metrics.avgCpLoss, metrics.blunders);
    const resultLabel = resultScore === 1 ? 'win' : resultScore === 0 ? 'loss' : 'draw';
    freeAdjustmentWindow.push({
        result: resultLabel,
        precision: precision,
        avgCpLoss: metrics.avgCpLoss || 0,
        blunders: metrics.blunders || 0,
        qualityScore: quality.qualityScore,
        isHighQuality: quality.isHighQuality,
        hasErrors: quality.hasErrors
    });
    if (freeAdjustmentWindow.length > CONTINUOUS_ADJUST_CONFIG.WINDOW_SIZE) {
        freeAdjustmentWindow = freeAdjustmentWindow.slice(-CONTINUOUS_ADJUST_CONFIG.WINDOW_SIZE);
    }

    if (resultLabel === 'loss') freeLossStreak++;
    else freeLossStreak = 0;

    let feedback = null;
    const baselineDelta = getBaselineAdjustmentDelta(resultLabel, quality.qualityScore);
    if (baselineDelta !== 0) {
        const baselineAdjustment = applyContinuousEloAdjustment(
            baselineDelta,
            'Ajust fi per resultat',
            { cycle: 'baseline' }
        );
        if (baselineAdjustment) {
            feedback = baselineAdjustment.message;
        }
    }
    if (freeLossStreak >= CONTINUOUS_ADJUST_CONFIG.LOSS_STREAK_TRIGGER) {
        const relief = applyContinuousEloAdjustment(
            CONTINUOUS_ADJUST_CONFIG.LOSS_STREAK_DELTA,
            'Protecció per ratxa de derrotes',
            { cycle: 'streak' }
        );
        if (relief) {
            feedback = relief.message + ' · Prova hints o mode entrenament';
        } else {
            feedback = 'Prova hints o mode entrenament';
        }
        freeLossStreak = 0;
    }

    if (freeAdjustmentWindow.length < CONTINUOUS_ADJUST_CONFIG.WINDOW_SIZE) {
        saveStorage();
        return { feedback: feedback };
    }

    const cycle = freeAdjustmentWindow.slice(0, CONTINUOUS_ADJUST_CONFIG.WINDOW_SIZE);
    freeAdjustmentWindow = [];

    const wins = cycle.filter(game => game.result === 'win').length;
    const losses = cycle.filter(game => game.result === 'loss').length;
    const highQuality = cycle.filter(game => game.isHighQuality).length;
    const errors = cycle.filter(game => game.hasErrors).length;
    const avgQuality = cycle.reduce((sum, game) => sum + game.qualityScore, 0) / (cycle.length || 1);
    let trend = null;
    if (typeof lastAdjustmentQualityAvg === 'number') {
        if (avgQuality - lastAdjustmentQualityAvg > 0.08) trend = 'millora';
        if (lastAdjustmentQualityAvg - avgQuality > 0.08) trend = 'empitjorament';
    }
    lastAdjustmentQualityAvg = avgQuality;

    let delta = 0;
    let reason = 'Nivell estable';
    if (wins >= CONTINUOUS_ADJUST_CONFIG.WIN_THRESHOLD && highQuality >= CONTINUOUS_ADJUST_CONFIG.WIN_THRESHOLD) {
        delta = CONTINUOUS_ADJUST_CONFIG.WIN_ELO;
        reason = 'Rendiment alt en 2/3 partides';
    } else if (losses >= CONTINUOUS_ADJUST_CONFIG.LOSS_THRESHOLD && errors >= CONTINUOUS_ADJUST_CONFIG.LOSS_THRESHOLD) {
        delta = CONTINUOUS_ADJUST_CONFIG.LOSS_ELO;
        reason = 'Errors repetits en 2/3 partides';
    }

    if (delta === 0) {
        saveStorage();
        return { feedback: feedback };
    }

    const adjustment = applyContinuousEloAdjustment(delta, reason, { trend: trend, cycle: cycle });
    saveStorage();
    if (adjustment && feedback) {
        return { feedback: `${adjustment.message} · ${feedback}` };
    }
    if (adjustment) return { feedback: adjustment.message };
    return { feedback: feedback };
}

 function isCalibrationActive() {
    return isCalibrating && calibrationGames.length < CALIBRATION_GAME_COUNT;
}

  function getCalibrationGameIndex() {
    return Math.min(calibrationGames.length, CALIBRATION_GAME_COUNT - 1);
}

function getCalibrationOpponentRoc() {
    const index = getCalibrationGameIndex();
    if (index < 3) return CALIBRATION_ROCS[index];
    const performance = getCalibrationPerformanceScore(calibrationGames);
    const base = CALIBRATION_ROCS[Math.min(index, CALIBRATION_ROCS.length - 1)];
    if (performance >= 0.7) return base + 150;
    if (performance <= 0.45) return Math.max(CALIBRATION_ROC_MIN, base - 150);
    return base;
}

function getCalibrationProgressCount() {
    const extra = isCalibrationGame ? 1 : 0;
    return Math.min(calibrationGames.length + extra, CALIBRATION_GAME_COUNT);
}

function getCalibrationGameDepth(gameIndex = null) {
    const index = typeof gameIndex === 'number' ? gameIndex : getCalibrationGameIndex();
    if (index < CALIBRATION_DEPTHS.length) return CALIBRATION_DEPTHS[index];
    const performance = getCalibrationPerformanceScore(calibrationGames);
    if (performance >= 0.7) return 12;
    if (performance >= 0.55) return 10;
    return 8;
}

function getCalibrationSkillLevel() {
    const depth = getCalibrationGameDepth(isCalibrationGame ? calibrationGames.length : getCalibrationGameIndex());
    const normalized = Math.max(0, Math.min(1, (depth - 5) / 10));
    const minSkill = 6;
    const maxSkill = 18;
    return Math.round(minSkill + (maxSkill - minSkill) * normalized);
}

function getCalibrationPrecisionRange(gameIndex = null) {
    const index = typeof gameIndex === 'number' ? gameIndex : getCalibrationGameIndex();
    return CALIBRATION_ENGINE_PRECISION_RANGES[index] || CALIBRATION_ENGINE_PRECISION_RANGES[CALIBRATION_ENGINE_PRECISION_RANGES.length - 1];
}

function getCalibrationPrecisionTargetText() {
    const range = getCalibrationPrecisionRange(isCalibrationGame ? calibrationGames.length : getCalibrationGameIndex());
    return `${range.min}-${range.max}%`;
}

function updateCalibrationProgressUI() {
    const container = $('#calibration-progress');
    if (!container.length) return;
    if (!isCalibrationActive()) {
        container.hide();
        return;
    }
    const progressCount = getCalibrationProgressCount();
    $('#calibration-progress-text').text(`Calibrant... Partida ${progressCount}/${CALIBRATION_GAME_COUNT}`);
    $('#calibration-progress-fill').css('width', `${Math.round((progressCount / CALIBRATION_GAME_COUNT) * 100)}%`);
    container.show();
}

function isCalibrationRequired() {
    return !calibratgeComplet;
}

function updateCalibrationAccessUI() {
    const lock = isCalibrationRequired();
    const lockableButtons = $('#btn-league, #btn-bundle-menu');
    lockableButtons.prop('disabled', lock).toggleClass('btn-disabled', lock);
    const leagueBanner = $('#league-banner');
    if (lock) leagueBanner.addClass('disabled'); else leagueBanner.removeClass('disabled');
}

function getCalibrationGameQuality(game) {
    const avgLoss = typeof game.avgCpLoss === 'number' ? game.avgCpLoss : 180;
    const precisionScore = typeof game.precision === 'number' ? game.precision / 100 : 0.4;
    const lossScore = 1 - Math.min(avgLoss, 300) / 300;
    const blunderPenalty = Math.min(0.3, (game.blunders || 0) * 0.05);
    return Math.max(0, Math.min(1, (lossScore * 0.6) + (precisionScore * 0.4) - blunderPenalty));
}

function getCalibrationPerformanceScore(games = calibrationGames) {
    if (!games.length) return 0.5;
    const total = games.reduce((sum, game) => {
        const resultScore = game.result === 'win' ? 1 : game.result === 'loss' ? 0 : 0.5;
        const quality = getCalibrationGameQuality(game);
        return sum + (quality * 0.4) + (resultScore * 0.6);
    }, 0);
    return total / games.length;
}

function estimateCalibrationRoc() {
    if (!calibrationGames.length) return clampEngineElo(ADAPTIVE_CONFIG.DEFAULT_LEVEL);
    const weighted = calibrationGames.map((game, idx) => {
        const resultScore = game.result === 'win' ? 1 : game.result === 'loss' ? 0 : 0.5;
        const quality = getCalibrationGameQuality(game);
        const performance = (quality * 0.4) + (resultScore * 0.6);
        const weight = 1 + (idx * 0.1);
        return { performance, weight, opponentElo: game.opponentElo || null };
    });
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    const weightedPerformance = weighted.reduce((sum, item) => sum + (item.performance * item.weight), 0) / (totalWeight || 1);
    const opponentEloValues = weighted
        .map(item => item.opponentElo)
        .filter(value => typeof value === 'number' && !isNaN(value));
    const avgOpponentElo = opponentEloValues.length
        ? opponentEloValues.reduce((sum, value) => sum + value, 0) / opponentEloValues.length
        : CALIBRATION_ROCS[Math.min(getCalibrationGameIndex(), CALIBRATION_ROCS.length - 1)];
    const performanceDelta = (weightedPerformance - 0.5) * 400;
    const confidence = Math.min(1, calibrationGames.length / CALIBRATION_GAME_COUNT);
    const eloEstimate = avgOpponentElo + (performanceDelta * confidence);
    return Math.max(CALIBRATION_ROC_MIN, Math.min(CALIBRATION_ROC_MAX, Math.round(eloEstimate)));
}

function showCalibrationReveal(rocValue) {
    const statusEl = $('#status');
    if (!statusEl.length) return;
    statusEl.text(`Calibratge completat! El teu nivell inicial és: ${rocValue} ROC ♟️`).addClass('elo-reveal');
    setTimeout(() => statusEl.removeClass('elo-reveal'), 2200);
}

function finalizeCalibrationFromGames() {
    const estimatedRoc = estimateCalibrationRoc();
    userELO = Math.max(50, estimatedRoc);
    calibrationRocFloor = userELO;
    updateEloHistory(userELO);
    syncEngineEloFromUser();
    isCalibrating = false;
    calibratgeComplet = true;
    currentCalibrationOpponentRoc = null;
    calibrationProfile = {
        roc: userELO,
        completedAt: new Date().toISOString(),
        games: calibrationGames.slice()
    };
    saveStorage();
    updateDisplay();
}

function recordCalibrationGame(resultScore, precision, metrics) {
    const safePrecision = Math.max(0, Math.min(100, typeof precision === 'number' ? precision : 0));
    const result = resultScore === 1 ? 'win' : resultScore === 0 ? 'loss' : 'draw';
    const opponentElo = typeof currentCalibrationOpponentRoc === 'number' ? currentCalibrationOpponentRoc : getCalibrationOpponentRoc();
    const gameMetrics = metrics || {};
    calibrationGames.push({
        opponentElo: opponentElo,
        result: result,
        precision: safePrecision,
        durationSeconds: gameMetrics.durationSeconds || 0,
        avgCpLoss: gameMetrics.avgCpLoss || 0,
        blunders: gameMetrics.blunders || 0,
        tacticalPatterns: gameMetrics.tacticalPatterns || []
    });
    if (calibrationGames.length >= CALIBRATION_GAME_COUNT) {
        finalizeCalibrationFromGames();
        return true;
    } else {
        saveStorage();
        updateCalibrationProgressUI();
        return false;
    }
}

function getOpponentElo() {
    if (isCalibrationGame && typeof currentCalibrationOpponentRoc === 'number') return currentCalibrationOpponentRoc;
    return (currentOpponent && typeof currentOpponent.elo === 'number') ? currentOpponent.elo : userELO;
}

function getAIDepth() {
    const randomness = Math.floor(Math.random() * 3) - 1;
    const effectiveDifficulty = getEffectiveAIDifficulty();
    
    if (isCalibrationGame) {
        return Math.max(1, Math.min(15, getCalibrationGameDepth(calibrationGames.length) + randomness));
    }

    if (currentGameMode !== 'league') {
        return Math.max(1, Math.min(15, effectiveDifficulty + randomness));
    }

    const oppElo = getOpponentElo();
    const myLeagueElo = getLeaguePlayerElo('me');
    const delta = (oppElo - myLeagueElo);
    const base = 8 + Math.round(delta / 250); 
    return Math.max(1, Math.min(15, base + randomness));
}

function getEngineSkillLevel() {
    const effectiveDifficulty = getEffectiveAIDifficulty();
    const normalized = Math.max(0, Math.min(1, (effectiveDifficulty - 5) / 10));
    const minSkill = 2;
    const maxSkill = 18;
    return Math.round(minSkill + (maxSkill - minSkill) * normalized);
}
function calculateEloDelta(resultScore) {
    const oppElo = getOpponentElo();
    const expected = 1 / (1 + Math.pow(10, (oppElo - userELO) / 400));
    const kFactor = 24;
    const raw = kFactor * (resultScore - expected);

    if (resultScore === 0) return Math.min(-8, Math.round(raw));
    if (resultScore === 1) return Math.max(8, Math.round(raw));
    return Math.round(raw);
}

function formatEloChange(delta) {
    return `${delta > 0 ? '+' : ''}${delta}`;
}

function resetEngineMoveCandidates() {
    engineMoveCandidates = [];
}

function trackEngineCandidate(msg) {
    if (!isEngineThinking || msg.indexOf('multipv') === -1 || msg.indexOf(' pv ') === -1) return;
    const pvMatch = msg.match(/multipv\s+(\d+).*?\spv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
    if (!pvMatch) return;

    let score = 0;
    const cpMatch = msg.match(/score cp (-?\d+)/);
    if (cpMatch) score = parseInt(cpMatch[1]);
    const mateMatch = msg.match(/score mate (-?\d+)/);
    if (mateMatch) {
        const mateVal = parseInt(mateMatch[1]);
        score = mateVal > 0 ? 10000 : -10000;
    }

    const multipv = parseInt(pvMatch[1]);
    const move = pvMatch[2];
    const existingIdx = engineMoveCandidates.findIndex(c => c.multipv === multipv);
    const candidate = { multipv, move, score };
    if (existingIdx >= 0) engineMoveCandidates[existingIdx] = candidate;
    else engineMoveCandidates.push(candidate);
}

function chooseHumanLikeMove(candidates) {
    if (!candidates || candidates.length === 0) return null;
    const sorted = candidates.slice().sort((a, b) => b.score - a.score);

    const effectiveDifficulty = getEffectiveAIDifficulty();
    const normalized = Math.max(0, Math.min(1, (effectiveDifficulty - 5) / 10));
    const bestScore = sorted[0].score;
    const maxDelta = 250 - (normalized * 170); // Més desviació a nivells baixos

    const plausible = sorted.filter(c => (bestScore - c.score) <= maxDelta);
    const pool = plausible.length ? plausible : [sorted[0]];
    const maxCandidates = normalized < 0.3 ? 4 : (normalized < 0.7 ? 3 : 2);
    const trimmed = pool.slice(0, maxCandidates);

    if (trimmed.length === 1) return trimmed[0];

    const offPathChance = Math.max(0.1, 0.35 - (normalized * 0.22));
    const explore = Math.random() < offPathChance;
    if (!explore) return trimmed[0];

    const temperature = 1.4 - (normalized * 0.8);
    const weights = trimmed.map((c, idx) => {
        const relativeScore = c.score - trimmed[0].score;
        const softness = Math.exp(relativeScore / (50 * temperature));
        return softness / (idx + 1);
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < trimmed.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return trimmed[i];
    }
    return trimmed[trimmed.length - 1];
}

function chooseCalibrationMove(candidates, fallbackMove) {
    if (!candidates || candidates.length === 0) return { move: fallbackMove };
    const sorted = candidates.slice().sort((a, b) => b.score - a.score);
    const bestScore = sorted[0].score;
    const goodCandidates = sorted.filter(c => (bestScore - c.score) <= 80);
    const badCandidates = sorted.filter(c => (bestScore - c.score) > 80);
    const range = getCalibrationPrecisionRange(isCalibrationGame ? calibrationGames.length : getCalibrationGameIndex());
    const minTarget = range.min / 100;
    const maxTarget = range.max / 100;
    const target = (minTarget + maxTarget) / 2;
    const currentPrecision = totalEngineMoves > 0 ? (goodEngineMoves / totalEngineMoves) : target;

    let pickGood = true;
    if (badCandidates.length === 0) pickGood = true;
    else if (goodCandidates.length === 0) pickGood = false;
    else if (currentPrecision < minTarget) pickGood = true;
    else if (currentPrecision > maxTarget) pickGood = false;
    else pickGood = Math.random() < target;

    const pool = pickGood ? goodCandidates : badCandidates;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    return choice || { move: fallbackMove };
}

// MODIFICAT: Ara carrega directament el fitxer local
function createStockfishWorker() {
    try {
        return new Worker(STOCKFISH_URL);
    } catch (e) {
        console.error("Error carregant Stockfish local:", e);
        return null;
    }
}

function ensureStockfish() {
    if (stockfish) return true;
    try {
        stockfish = createStockfishWorker();
        stockfish.onmessage = (e) => handleEngineMessage(e.data);
        stockfishReady = false;
        try { stockfish.postMessage('uci'); } catch (e) {}    
        return true;
    } catch (err) {
        console.error(err);
        stockfish = null;
        stockfishReady = false;
        return false;
    }
}

function loadStorage() {
    const elo = localStorage.getItem('chess_userELO'); if (elo) userELO = parseInt(elo);
    const errors = localStorage.getItem('chess_savedErrors'); if (errors) savedErrors = JSON.parse(errors);
    const streak = localStorage.getItem('chess_streak'); if (streak) currentStreak = parseInt(streak);
    const lastDate = localStorage.getItem('chess_lastPracticeDate'); if (lastDate) lastPracticeDate = lastDate;
    const stars = localStorage.getItem('chess_totalStars'); if (stars) totalStars = parseInt(stars);
    
    // Càrrega de Missions i Temps
    const missions = localStorage.getItem('chess_todayMissions'); const mDate = localStorage.getItem('chess_missionsDate');
    if (missions && mDate) { todayMissions = restoreMissions(JSON.parse(missions)); missionsDate = mDate; }
    
    // --- LÍNIA AFEGIDA PER AL CRONÒMETRE DE MISSIONS ---
    const mTime = localStorage.getItem('chess_missionsCompletionTime'); 
    if (mTime) missionsCompletionTime = parseInt(mTime);
    // ---------------------------------------------------

    const badges = localStorage.getItem('chess_unlockedBadges'); if (badges) unlockedBadges = JSON.parse(badges);
    const stats = localStorage.getItem('chess_sessionStats'); const statsDate = localStorage.getItem('chess_sessionStatsDate');
    if (stats && statsDate === getToday()) sessionStats = JSON.parse(stats);
    
    const history = localStorage.getItem('chess_eloHistory'); if (history) eloHistory = JSON.parse(history);
    const tGames = localStorage.getItem('chess_totalGamesPlayed'); if (tGames) totalGamesPlayed = parseInt(tGames);
    const tWins = localStorage.getItem('chess_totalWins'); if (tWins) totalWins = parseInt(tWins);
    const mStreak = localStorage.getItem('chess_maxStreak'); if (mStreak) maxStreak = parseInt(mStreak);
    
    const aiDiff = localStorage.getItem('chess_aiDifficulty'); if (aiDiff) aiDifficulty = parseInt(aiDiff);
    const rGames = localStorage.getItem('chess_recentGames'); if (rGames) recentGames = JSON.parse(rGames);
    const cWins = localStorage.getItem('chess_consecutiveWins'); if (cWins) consecutiveWins = parseInt(cWins);
    const cLosses = localStorage.getItem('chess_consecutiveLosses'); if (cLosses) consecutiveLosses = parseInt(cLosses);
       const calState = localStorage.getItem('chess_isCalibrating');
    const calGames = localStorage.getItem('chess_calibrationGames');
    const calProfile = localStorage.getItem('chess_calibrationProfile');
    const calComplete = localStorage.getItem('chess_calibratgeComplet');
    if (calState !== null) isCalibrating = (calState === 'true');
    if (calGames) {
        try {
            const parsedGames = JSON.parse(calGames);
            if (Array.isArray(parsedGames)) calibrationGames = parsedGames;
        } catch (e) {}
    }
    if (calProfile) {
        try {
            calibrationProfile = JSON.parse(calProfile);
        } catch (e) {}
    }
    if (calComplete !== null) calibratgeComplet = calComplete === 'true';
    if (calState === null && localStorage.getItem('chess_isCalibrationPhase') !== null) {
        isCalibrating = localStorage.getItem('chess_isCalibrationPhase') === 'true';
    }
    if ((calibrationProfile || calibratgeComplet || calibrationGames.length >= CALIBRATION_GAME_COUNT)) {
        isCalibrating = false;
        calibratgeComplet = true;
        if (calibrationRocFloor === null && calibrationProfile && typeof (calibrationProfile.roc ?? calibrationProfile.elo) === 'number') {
            calibrationRocFloor = calibrationProfile.roc ?? calibrationProfile.elo;
        }
        if (calibrationRocFloor === null && typeof userELO === 'number') {
            calibrationRocFloor = userELO;
        }
    } else if (calState === null && !calGames) {
        isCalibrating = true;
        calibratgeComplet = false;
    }
    const league = localStorage.getItem('chess_currentLeague'); if (league) currentLeague = JSON.parse(league);
    const lMatch = localStorage.getItem('chess_leagueActiveMatch'); if (lMatch) leagueActiveMatch = JSON.parse(lMatch);
    const reviews = localStorage.getItem('chess_reviewHistory'); if (reviews) reviewHistory = JSON.parse(reviews);
    const gameHistoryStored = localStorage.getItem('chess_gameHistory'); if (gameHistoryStored) gameHistory = JSON.parse(gameHistoryStored);
    const storedAdjustmentWindow = localStorage.getItem('chess_freeAdjustmentWindow');
    if (storedAdjustmentWindow) {
        try {
            const parsed = JSON.parse(storedAdjustmentWindow);
            if (Array.isArray(parsed)) freeAdjustmentWindow = parsed;
        } catch (e) {}
    }
    const storedAdjustmentLog = localStorage.getItem('chess_adjustmentLog');
    if (storedAdjustmentLog) {
        try {
            const parsed = JSON.parse(storedAdjustmentLog);
            if (Array.isArray(parsed)) adjustmentLog = parsed;
        } catch (e) {}
    }
    const storedFreeLossStreak = localStorage.getItem('chess_freeLossStreak');
    if (storedFreeLossStreak !== null) freeLossStreak = parseInt(storedFreeLossStreak);
    const storedEloFloor = localStorage.getItem('chess_calibrationRocFloor');
    if (storedEloFloor !== null) {
        const parsedFloor = parseInt(storedEloFloor);
        if (!isNaN(parsedFloor)) calibrationRocFloor = parsedFloor;
    }
    const storedEloMilestones = localStorage.getItem('chess_eloMilestones');
    if (storedEloMilestones) {
        try {
            const parsed = JSON.parse(storedEloMilestones);
            if (Array.isArray(parsed)) unlockedEloMilestones = parsed;
        } catch (e) {}
    }
    const storedQualityAvg = localStorage.getItem('chess_lastAdjustmentQualityAvg');
    if (storedQualityAvg !== null) {
        const parsedQuality = parseFloat(storedQualityAvg);
        if (!isNaN(parsedQuality)) lastAdjustmentQualityAvg = parsedQuality;
    }
    const storedElo = localStorage.getItem('chess_currentElo');
    currentElo = clampEngineElo(storedElo ? parseInt(storedElo) : userELO);
    aiDifficulty = levelToDifficulty(currentElo);
    const storedRecentErrors = localStorage.getItem('chess_recentErrors');
    if (storedRecentErrors) {
        try {
            const parsed = JSON.parse(storedRecentErrors);
            if (Array.isArray(parsed)) {
                recentErrors = parsed.map(Boolean).slice(-ERROR_WINDOW_N);
            }
        } catch (e) {}
    }
    const storedGeminiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
    if (storedGeminiKey) geminiApiKey = storedGeminiKey;
}

function saveStorage() {
    localStorage.setItem('chess_userELO', userELO);
    localStorage.setItem('chess_savedErrors', JSON.stringify(savedErrors));
    localStorage.setItem('chess_streak', currentStreak);
    localStorage.setItem('chess_lastPracticeDate', lastPracticeDate);
    localStorage.setItem('chess_totalStars', totalStars);
    localStorage.setItem('chess_todayMissions', JSON.stringify(todayMissions));
    localStorage.setItem('chess_missionsDate', missionsDate);
    localStorage.setItem('chess_unlockedBadges', JSON.stringify(unlockedBadges));
    localStorage.setItem('chess_sessionStats', JSON.stringify(sessionStats));
    localStorage.setItem('chess_sessionStatsDate', getToday());
    localStorage.setItem('chess_eloHistory', JSON.stringify(eloHistory));
    localStorage.setItem('chess_totalGamesPlayed', totalGamesPlayed);
    localStorage.setItem('chess_totalWins', totalWins);
    localStorage.setItem('chess_maxStreak', maxStreak);
    localStorage.setItem('chess_aiDifficulty', aiDifficulty);
    localStorage.setItem('chess_recentGames', JSON.stringify(recentGames));
    localStorage.setItem('chess_consecutiveWins', consecutiveWins);
    localStorage.setItem('chess_consecutiveLosses', consecutiveLosses);
    localStorage.setItem('chess_isCalibrating', String(isCalibrating));
    localStorage.setItem('chess_calibrationGames', JSON.stringify(calibrationGames));
    localStorage.setItem('chess_calibrationProfile', JSON.stringify(calibrationProfile));
    localStorage.setItem('chess_calibratgeComplet', String(calibratgeComplet));
    localStorage.setItem('chess_reviewHistory', JSON.stringify(reviewHistory));
    localStorage.setItem('chess_gameHistory', JSON.stringify(gameHistory));    
    localStorage.setItem('chess_currentElo', currentElo);
    localStorage.setItem('chess_recentErrors', JSON.stringify(recentErrors));
    localStorage.setItem('chess_freeAdjustmentWindow', JSON.stringify(freeAdjustmentWindow));
    localStorage.setItem('chess_adjustmentLog', JSON.stringify(adjustmentLog));
    localStorage.setItem('chess_freeLossStreak', freeLossStreak);
    if (calibrationRocFloor !== null && !isNaN(calibrationRocFloor)) {
        localStorage.setItem('chess_calibrationRocFloor', calibrationRocFloor);
    } else {
        localStorage.removeItem('chess_calibrationRocFloor');
    }
    localStorage.setItem('chess_eloMilestones', JSON.stringify(unlockedEloMilestones));
    if (lastAdjustmentQualityAvg !== null && !isNaN(lastAdjustmentQualityAvg)) {
        localStorage.setItem('chess_lastAdjustmentQualityAvg', lastAdjustmentQualityAvg);
    } else {
        localStorage.removeItem('chess_lastAdjustmentQualityAvg');
    }
    if (currentLeague) localStorage.setItem('chess_currentLeague', JSON.stringify(currentLeague)); else localStorage.removeItem('chess_currentLeague');
    if (leagueActiveMatch) localStorage.setItem('chess_leagueActiveMatch', JSON.stringify(leagueActiveMatch)); else localStorage.removeItem('chess_leagueActiveMatch');
    if (geminiApiKey) {
        localStorage.setItem(GEMINI_API_KEY_STORAGE, geminiApiKey);
    } else {
        localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    }
    localStorage.removeItem('chess_isCalibrationPhase');
    localStorage.removeItem('chess_calibrationMoves');
    localStorage.removeItem('chess_calibrationGoodMoves');
}

function updateGeminiSettingsUI() {
    const input = document.getElementById('gemini-key-input');
    const status = document.getElementById('gemini-key-status');
    if (!input || !status) return;
    if (geminiApiKey) {
        input.value = '';
        input.placeholder = 'Clau desada';
        status.textContent = '✅ OK';
    } else {
        input.placeholder = 'Enganxa la clau';
        status.textContent = 'No configurada';
    }
    updateBundleHintButtons();
}

function updateBundleHintButtons() {
    const brainBtn = document.getElementById('btn-brain-hint');
    const hintBtn = document.getElementById('btn-hint');
    if (!brainBtn || !hintBtn) return;
    
    const visible = blunderMode && bundleSequenceStep <= 2;
    brainBtn.style.display = visible ? 'inline-flex' : 'none';
    hintBtn.style.display = visible ? 'inline-flex' : 'none';
    
    brainBtn.disabled = !visible || !geminiApiKey || bundleGeminiHintPending;
    hintBtn.disabled = !visible || !stockfish || isAnalyzingHint;
}

function saveGeminiApiKey(rawKey) {
    const key = (rawKey || '').trim();
    if (!key) return false;
    geminiApiKey = key;
    saveStorage();
    updateGeminiSettingsUI();
    return true;
}

function updateEloHistory(newElo) {
    const today = getToday();
    const lastEntry = eloHistory[eloHistory.length - 1];
    if (lastEntry && lastEntry.date === today) { lastEntry.elo = newElo; } 
    else { eloHistory.push({ date: today, elo: newElo }); }
    if (eloHistory.length > 100) eloHistory = eloHistory.slice(-100);
    saveStorage();
}

function updateAdaptiveEngineEloLabel() {
     if (isCalibrationGame && typeof currentCalibrationOpponentRoc === 'number') {
        $('#engine-elo').text(`ROC ${currentCalibrationOpponentRoc}`);
        return;
    }
    if (isCalibrationActive()) {
        $('#engine-elo').text('Calibratge');
        return;
    }
    if (currentGameMode === 'free' && !blunderMode) {
        $('#engine-elo').text('Adaptativa');
        return;
    }
    $('#engine-elo').text(`Adaptativa · ELO ${Math.round(currentElo)}`);
}

function applyEngineEloStrength(eloValue) {
    if (!stockfish) return;
    const safeElo = clampEngineElo(eloValue);
    try {
        stockfish.postMessage('setoption name UCI_LimitStrength value true');
        stockfish.postMessage(`setoption name UCI_Elo value ${safeElo}`);
    } catch (e) {}
}

function syncEngineEloFromUser() {
    currentElo = clampEngineElo(userELO);
    aiDifficulty = levelToDifficulty(currentElo);
    applyEngineEloStrength(currentElo);
    updateAdaptiveEngineEloLabel();
}

function getDisplayedElo(value) {
    return isCalibrationActive() ? '—' : String(value);
}

function updateEloDisplay() {
    const displayValue = getDisplayedElo(userELO);
    $('#current-elo').text(displayValue);
    $('#game-elo').text(displayValue);
}

function updateDisplay() {
    engineELO = Math.round(currentElo);  
    updateEloDisplay();
    $('#current-stars').text(totalStars); $('#game-stars').text(totalStars);
    updateAdaptiveEngineEloLabel();
    updateCalibrationProgressUI();
    updateCalibrationAccessUI();
    
    let total = savedErrors.length;
    $('#bundle-info').text(total > 0 ? `${total} errors guardats` : 'Cap error desat');
    $('#game-bundles').text(total);
    updateStreakDisplay(); updateMissionsDisplay(); updateLeagueAccessUI();
}

function updateStatsDisplay() {
    $('#stats-total-games').text(totalGamesPlayed);
    $('#stats-total-wins').text(totalWins);
    $('#stats-bundles-count').text(savedErrors.length);
    $('#stats-max-streak').text(maxStreak);
    updateGeminiSettingsUI();
    updateEloChart();
    updateReviewChart();
}

function updateEloChart() {
    const ctx = document.getElementById('elo-chart').getContext('2d');
    if (isCalibrationActive()) {
        if (eloChart) eloChart.destroy();
        return;
    }  
    if (eloHistory.length === 0) { eloHistory.push({ date: getToday(), elo: userELO }); saveStorage(); }
    const labels = eloHistory.map(entry => { const parts = entry.date.split('-'); return `${parts[2]}/${parts[1]}`; });
    const data = eloHistory.map(entry => entry.elo);
    const strokeColor = epaperEnabled ? '#555' : '#c9a227';
    const fillColor = epaperEnabled ? 'rgba(90, 90, 90, 0.12)' : 'rgba(201, 162, 39, 0.1)';
    const pointBorder = epaperEnabled ? '#666' : '#f4e4bc';
    const gridColor = epaperEnabled ? '#d0d0d0' : 'rgba(201, 162, 39, 0.1)';
    const tickColor = epaperEnabled ? '#444' : '#a89a8a';
    
    if (eloChart) eloChart.destroy();
    eloChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ELO',
                data: data,
                borderColor: strokeColor,
                backgroundColor: fillColor,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: strokeColor,
                pointBorderColor: pointBorder,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, grid: { color: gridColor }, ticks: { color: tickColor } },
                x: { grid: { color: gridColor }, ticks: { color: tickColor, maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}

function classifyMoveQuality(swing, playerMove = null, bestMove = null) {
    if (playerMove && bestMove && playerMove === bestMove) return 'excel';
    if (swing === null || swing === undefined || Number.isNaN(swing)) return 'unknown';
    const absSwing = Math.abs(swing);
    const useEnrichedThresholds = Boolean(playerMove || bestMove);

    if (useEnrichedThresholds) {
        if (absSwing <= 25) return 'excel';
        if (absSwing <= 50) return 'good';
        if (absSwing <= 100) return 'inaccuracy';
        if (absSwing <= 300) return 'mistake';
        return 'blunder';
    }

    if (absSwing <= 30) return 'excel';
    if (absSwing <= 80) return 'good';
    if (absSwing <= 200) return 'inaccuracy';
    if (absSwing <= 600) return 'mistake';
    return 'blunder';
}

function initStockfishEnriched(stockfishInstance, multiPvCount = 3) {
    stockfishInstance.postMessage('uci');
    stockfishInstance.postMessage(`setoption name MultiPV value ${multiPvCount}`);
    stockfishInstance.postMessage('isready');
}

function parseUciInfo(line) {
    if (!line.startsWith('info') || !line.includes(' pv ')) return null;

    const info = {
        depth: null,
        seldepth: null,
        multipv: 1,
        score: null,
        scoreType: 'cp',
        nodes: null,
        nps: null,
        time: null,
        pv: []
    };

    const depthMatch = line.match(/\bdepth (\d+)/);
    if (depthMatch) info.depth = Number.parseInt(depthMatch[1], 10);

    const seldepthMatch = line.match(/\bseldepth (\d+)/);
    if (seldepthMatch) info.seldepth = Number.parseInt(seldepthMatch[1], 10);

    const multipvMatch = line.match(/\bmultipv (\d+)/);
    if (multipvMatch) info.multipv = Number.parseInt(multipvMatch[1], 10);

    const scoreCpMatch = line.match(/\bscore cp (-?\d+)/);
    if (scoreCpMatch) {
        info.score = Number.parseInt(scoreCpMatch[1], 10);
        info.scoreType = 'cp';
    }

    const scoreMateMatch = line.match(/\bscore mate (-?\d+)/);
    if (scoreMateMatch) {
        info.score = Number.parseInt(scoreMateMatch[1], 10);
        info.scoreType = 'mate';
    }

    const nodesMatch = line.match(/\bnodes (\d+)/);
    if (nodesMatch) info.nodes = Number.parseInt(nodesMatch[1], 10);

    const npsMatch = line.match(/\bnps (\d+)/);
    if (npsMatch) info.nps = Number.parseInt(npsMatch[1], 10);

    const timeMatch = line.match(/\btime (\d+)/);
    if (timeMatch) info.time = Number.parseInt(timeMatch[1], 10);

    const pvMatch = line.match(/ pv (.+)$/);
    if (pvMatch) {
        info.pv = pvMatch[1].trim().split(/\s+/);
    }

    return info;
}

class EnrichedAnalysis {
    constructor(fen, targetDepth = 20, multiPvCount = 3) {
        this.fen = fen;
        this.targetDepth = targetDepth;
        this.multiPvCount = multiPvCount;
        this.alternatives = new Map();
        this.maxDepthReached = 0;
        this.isComplete = false;
    }

    processLine(line) {
        const info = parseUciInfo(line);
        if (!info || info.depth === null) return;

        const existing = this.alternatives.get(info.multipv);
        if (!existing || info.depth >= existing.depth) {
            this.alternatives.set(info.multipv, info);
        }

        if (info.depth > this.maxDepthReached) {
            this.maxDepthReached = info.depth;
        }
    }

    complete() {
        this.isComplete = true;
    }

    getAlternatives() {
        return Array.from(this.alternatives.values())
            .sort((a, b) => a.multipv - b.multipv)
            .map((info) => ({
                move: info.pv[0] || null,
                eval: info.score,
                evalType: info.scoreType,
                depth: info.depth,
                pv: info.pv
            }));
    }

    getBestMove() {
        const best = this.alternatives.get(1);
        if (!best) return null;

        return {
            move: best.pv[0] || null,
            eval: best.score,
            evalType: best.scoreType,
            depth: best.depth,
            pv: best.pv
        };
    }
}

function analyzePositionEnriched(stockfishInstance, fen, depth = 20, multiPv = 3) {
    return new Promise((resolve) => {
        const analysis = new EnrichedAnalysis(fen, depth, multiPv);
        let timeoutId = null;

        const cleanup = () => {
            stockfishInstance.removeEventListener('message', messageHandler);
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        const messageHandler = (event) => {
            const line = event.data;
            if (typeof line !== 'string') return;

            if (line.startsWith('info')) {
                analysis.processLine(line);
            }

            if (line.startsWith('bestmove')) {
                cleanup();
                analysis.complete();
                resolve({
                    fen,
                    depth: analysis.maxDepthReached,
                    bestMove: analysis.getBestMove(),
                    alternatives: analysis.getAlternatives()
                });
            }
        };

        timeoutId = setTimeout(() => {
            cleanup();
            analysis.complete();
            resolve({
                fen,
                depth: analysis.maxDepthReached,
                bestMove: analysis.getBestMove(),
                alternatives: analysis.getAlternatives(),
                timedOut: true
            });
        }, 30000);

        stockfishInstance.addEventListener('message', messageHandler);
        try { stockfishInstance.postMessage(`setoption name MultiPV value ${multiPv}`); } catch (e) {}
        stockfishInstance.postMessage(`position fen ${fen}`);
        stockfishInstance.postMessage(`go depth ${depth}`);
    });
}

function uciToSan(fen, uciMove) {
    if (typeof Chess === 'undefined') return uciMove;
    const chess = new Chess(fen);
    const move = chess.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove.length > 4 ? uciMove[4] : undefined
    });
    return move ? move.san : uciMove;
}

function pvToSan(fen, pvArray) {
    if (typeof Chess === 'undefined') return pvArray;
    const chess = new Chess(fen);
    const sanMoves = [];
    for (const uciMove of pvArray) {
        const move = chess.move({
            from: uciMove.slice(0, 2),
            to: uciMove.slice(2, 4),
            promotion: uciMove.length > 4 ? uciMove[4] : undefined
        });
        sanMoves.push(move ? move.san : uciMove);
        if (!move) break;
    }
    return sanMoves;
}

function createEnrichedMoveReview(
    fen,
    playerMove,
    playerMoveSan,
    analysisBefore,
    analysisAfter,
    moveNumber
) {
    const bestMove = analysisBefore.bestMove;
    const evalBefore = bestMove ? bestMove.eval : null;
    const evalAfter = analysisAfter.bestMove ? analysisAfter.bestMove.eval : null;

    let swing = null;
    if (evalBefore !== null && evalAfter !== null) {
        swing = Math.abs(evalAfter - evalBefore);
    }

    const quality = classifyMoveQuality(swing, playerMove, bestMove?.move);

    return {
        fen,
        moveNumber,
        playerMove,
        playerMoveSan,
        bestMove: bestMove?.move || null,
        evalBefore,
        evalAfter,
        swing,
        quality,
        isCapture: playerMoveSan.includes('x'),
        isCheck: playerMoveSan.includes('+') || playerMoveSan.includes('#'),
        timestamp: Date.now(),
        depth: analysisBefore.depth,
        bestMoveSan: bestMove?.move ? uciToSan(fen, bestMove.move) : null,
        bestMovePv: bestMove?.pv || [],
        bestMovePvSan: bestMove?.pv ? pvToSan(fen, bestMove.pv) : [],
        alternatives: (analysisBefore.alternatives || []).map((alt) => ({
            move: alt.move,
            moveSan: alt.move ? uciToSan(fen, alt.move) : null,
            eval: alt.eval,
            evalType: alt.evalType,
            pv: alt.pv,
            pvSan: alt.pv ? pvToSan(fen, alt.pv) : []
        }))
    };
}

function parseFenPosition(fen) {
    const [board, turn, castling, enPassant] = fen.split(' ');
    const expandedBoard = expandBoard(board);
    const whiteKing = findPiece(expandedBoard, 'K');
    const blackKing = findPiece(expandedBoard, 'k');
    const material = countMaterial(expandedBoard);
    const passedPawns = findPassedPawns(expandedBoard);
    const kingSafety = evaluateKingSafety(expandedBoard, whiteKing, blackKing, castling);

    return {
        turn,
        castling,
        enPassant,
        whiteKing,
        blackKing,
        material,
        passedPawns,
        kingSafety,
        expandedBoard
    };
}

function expandBoard(boardFen) {
    const board = [];
    const rows = boardFen.split('/');

    for (const row of rows) {
        for (const char of row) {
            if (char >= '1' && char <= '8') {
                for (let i = 0; i < Number.parseInt(char, 10); i++) {
                    board.push(null);
                }
            } else {
                board.push(char);
            }
        }
    }

    return board;
}

function findPiece(board, piece) {
    const index = board.indexOf(piece);
    if (index === -1) return null;

    const file = String.fromCharCode(97 + (index % 8));
    const rank = 8 - Math.floor(index / 8);
    return `${file}${rank}`;
}

function findAllPieces(board, piece) {
    const positions = [];
    for (let i = 0; i < board.length; i++) {
        if (board[i] === piece) {
            const file = String.fromCharCode(97 + (i % 8));
            const rank = 8 - Math.floor(i / 8);
            positions.push(`${file}${rank}`);
        }
    }
    return positions;
}

function countMaterial(board) {
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let white = 0;
    let black = 0;

    const whitePieces = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
    const blackPieces = { p: 0, n: 0, b: 0, r: 0, q: 0 };

    for (const piece of board) {
        if (!piece) continue;

        if (piece === piece.toUpperCase()) {
            white += values[piece.toLowerCase()] || 0;
            if (whitePieces[piece] !== undefined) whitePieces[piece] += 1;
        } else {
            black += values[piece] || 0;
            if (blackPieces[piece] !== undefined) blackPieces[piece] += 1;
        }
    }

    return {
        white,
        black,
        balance: white - black,
        whitePieces,
        blackPieces
    };
}

function findPassedPawns(board) {
    const passed = { white: [], black: [] };

    for (let i = 0; i < 64; i++) {
        const piece = board[i];
        const file = i % 8;
        const rank = Math.floor(i / 8);

        if (piece === 'P') {
            let isPassed = true;
            for (let r = rank - 1; r >= 0 && isPassed; r--) {
                for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
                    if (board[r * 8 + f] === 'p') isPassed = false;
                }
            }
            if (isPassed && rank <= 5) {
                const square = `${String.fromCharCode(97 + file)}${8 - rank}`;
                passed.white.push(square);
            }
        }

        if (piece === 'p') {
            let isPassed = true;
            for (let r = rank + 1; r < 8 && isPassed; r++) {
                for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
                    if (board[r * 8 + f] === 'P') isPassed = false;
                }
            }
            if (isPassed && rank >= 2) {
                const square = `${String.fromCharCode(97 + file)}${8 - rank}`;
                passed.black.push(square);
            }
        }
    }

    return passed;
}

function evaluateKingSafety(board, whiteKing, blackKing, castling) {
    const safety = {
        white: { canCastle: false, hasCastled: false, exposed: false },
        black: { canCastle: false, hasCastled: false, exposed: false }
    };

    safety.white.canCastle = castling.includes('K') || castling.includes('Q');
    safety.black.canCastle = castling.includes('k') || castling.includes('q');

    if (whiteKing === 'g1' || whiteKing === 'c1') safety.white.hasCastled = true;
    if (blackKing === 'g8' || blackKing === 'c8') safety.black.hasCastled = true;

    const exposedFiles = ['d', 'e', 'f'];
    if (whiteKing && exposedFiles.includes(whiteKing[0]) && !safety.white.canCastle) {
        safety.white.exposed = true;
    }
    if (blackKing && exposedFiles.includes(blackKing[0]) && !safety.black.canCastle) {
        safety.black.exposed = true;
    }

    return safety;
}

async function prepareBundleSequence(fen) {
    // Validació inicial més robusta
    if (!stockfish) {
        console.error('[Bundle] Stockfish no existeix');
        ensureStockfish();
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (!stockfish) {
        console.error('[Bundle] No es pot inicialitzar Stockfish');
        return null;
    }
    
    // Esperar que Stockfish estigui llest
    let waitCount = 0;
    while (!stockfishReady && waitCount < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
    }
    
    if (!stockfishReady) {
        console.error('[Bundle] Stockfish no està llest després d\'esperar');
        return null;
    }
    
    try {
        // Neteja inicial més agressiva
        stockfish.postMessage('stop');
        stockfish.postMessage('setoption name MultiPV value 1');
        await new Promise(resolve => setTimeout(resolve, 300)); // Temps augmentat
        
        console.log('[Bundle] Iniciant preparació seqüència per FEN:', fen);
        
        // 1. Analitzar posició inicial (Pas 1)
        console.log('[Bundle] Pas 1: Analitzant posició inicial...');
        const step1Analysis = await analyzePositionEnriched(stockfish, fen, 15, 2);
        
        if (!step1Analysis || !step1Analysis.bestMove || !step1Analysis.bestMove.move) {
            console.error('[Bundle] Pas 1 fallit: no hi ha bestMove', step1Analysis);
            alert('Error: No es pot analitzar la posició inicial. Torna-ho a provar.');
            return null;
        }
        
        const playerMove1 = step1Analysis.bestMove.move;
        console.log('[Bundle] Pas 1 - Millor jugada:', playerMove1);
        
        const playerMove1San = uciToSan(fen, playerMove1);
        const playerMove1Pv = step1Analysis.bestMove.pv || [];
        const playerMove1Eval = step1Analysis.bestMove.eval || 0;
        
        // 2. Aplicar la millor jugada del jugador
        const tempGame1 = new Chess(fen);
        const move1 = tempGame1.move({
            from: playerMove1.slice(0, 2),
            to: playerMove1.slice(2, 4),
            promotion: playerMove1.length > 4 ? playerMove1[4] : undefined
        });
        
        if (!move1) {
            console.error('[Bundle] No es pot aplicar jugada 1:', playerMove1);
            alert('Error: Jugada no vàlida. Prova un altre error.');
            return null;
        }
        
        const afterPlayerFen = tempGame1.fen();
        console.log('[Bundle] Després jugada 1, FEN:', afterPlayerFen);
        
        // Pausa més llarga entre anàlisis
        await new Promise(resolve => setTimeout(resolve, 400)); // Augmentat
        
        // 3. Calcular millor resposta de l'oponent
        console.log('[Bundle] Pas 2: Analitzant resposta oponent...');
        const opponentAnalysis = await analyzePositionEnriched(stockfish, afterPlayerFen, 15, 1);
        
        if (!opponentAnalysis || !opponentAnalysis.bestMove || !opponentAnalysis.bestMove.move) {
            console.error('[Bundle] Pas 2 fallit: no hi ha bestMove oponent', opponentAnalysis);
            alert('Error: No es pot calcular la resposta. Prova un altre error.');
            return null;
        }
        
        const opponentMove = opponentAnalysis.bestMove.move;
        console.log('[Bundle] Pas 2 - Resposta oponent:', opponentMove);
        
        const opponentMoveSan = uciToSan(afterPlayerFen, opponentMove);
        const opponentMoveEval = opponentAnalysis.bestMove.eval || 0;
        
        // 4. Aplicar resposta de l'oponent
        const tempGame2 = new Chess(afterPlayerFen);
        const move2 = tempGame2.move({
            from: opponentMove.slice(0, 2),
            to: opponentMove.slice(2, 4),
            promotion: opponentMove.length > 4 ? opponentMove[4] : undefined
        });
        
        if (!move2) {
            console.error('[Bundle] No es pot aplicar jugada oponent:', opponentMove);
            alert('Error: Resposta no vàlida. Prova un altre error.');
            return null;
        }
        
        const afterOpponentFen = tempGame2.fen();
        console.log('[Bundle] Després resposta oponent, FEN:', afterOpponentFen);
        
        // Pausa abans de l'anàlisi final
        await new Promise(resolve => setTimeout(resolve, 400)); // Augmentat
        
        // 5. Calcular millor segona jugada del jugador (Pas 3)
        console.log('[Bundle] Pas 3: Analitzant segona jugada jugador...');
        const step2Analysis = await analyzePositionEnriched(stockfish, afterOpponentFen, 15, 2);
        
        if (!step2Analysis || !step2Analysis.bestMove || !step2Analysis.bestMove.move) {
            console.error('[Bundle] Pas 3 fallit: no hi ha bestMove pas 2', step2Analysis);
            alert('Error: No es pot calcular la segona jugada. Prova un altre error.');
            return null;
        }
        
        const playerMove2 = step2Analysis.bestMove.move;
        console.log('[Bundle] Pas 3 - Segona jugada:', playerMove2);
        
        const playerMove2San = uciToSan(afterOpponentFen, playerMove2);
        const playerMove2Pv = step2Analysis.bestMove.pv || [];
        const playerMove2Eval = step2Analysis.bestMove.eval || 0;
        
        // 6. Analitzar context posicional de cada pas
        const positionStep1 = parseFenPosition(fen);
        const positionStep2 = parseFenPosition(afterOpponentFen);
        const threatsStep1 = analyzePvThreats(fen, playerMove1Pv);
        const threatsStep2 = analyzePvThreats(afterOpponentFen, playerMove2Pv);
        
        console.log('[Bundle] Seqüència completa preparada:', 
            [playerMove1San, opponentMoveSan, playerMove2San]);
        
        // 7. Retornar seqüència completa i fixa
        return {
            initialFen: fen,
            
            step1: {
                fen: fen,
                playerMove: playerMove1,
                playerMoveSan: playerMove1San,
                playerMovePv: playerMove1Pv,
                evalBefore: playerMove1Eval,
                alternatives: step1Analysis.alternatives || [],
                position: positionStep1,
                threats: threatsStep1
            },
            
            opponentMove: {
                fen: afterPlayerFen,
                move: opponentMove,
                moveSan: opponentMoveSan,
                eval: opponentMoveEval
            },
            
            step2: {
                fen: afterOpponentFen,
                playerMove: playerMove2,
                playerMoveSan: playerMove2San,
                playerMovePv: playerMove2Pv,
                evalBefore: playerMove2Eval,
                alternatives: step2Analysis.alternatives || [],
                position: positionStep2,
                threats: threatsStep2
            },
            
            fullSequence: [playerMove1, opponentMove, playerMove2],
            fullSequenceSan: [playerMove1San, opponentMoveSan, playerMove2San]
        };
        
    } catch (error) {
        console.error('[Bundle] Error preparant seqüència:', error);
        alert('Error inesperat preparant l\'exercici. Torna-ho a provar.');
        return null;
    }
}

function analyzePvThreats(fen, pv) {
    if (!pv || pv.length === 0) {
        return { threats: [], themes: [], immediateThreats: [] };
    }

    const threats = [];
    const themes = new Set();
    const immediateThreats = [];

    for (let i = 0; i < Math.min(pv.length, 6); i++) {
        const move = pv[i];
        const moveInfo = parseUciMove(move);

        if (i === 0 && isLikelyCapture(fen, move)) {
            immediateThreats.push({
                type: 'capture',
                move,
                description: `Captura a ${moveInfo.to}`
            });
            themes.add('material');
        }

        if (moveInfo.promotion) {
            threats.push({
                type: 'promotion',
                move,
                piece: moveInfo.promotion,
                ply: i + 1
            });
            themes.add('promotion');
        }
    }

    const forkPattern = detectForkPattern(pv);
    if (forkPattern) {
        themes.add('fork');
        threats.push(forkPattern);
    }

    const checkCount = countChecksInPv(fen, pv);
    if (checkCount >= 2) {
        themes.add('king_attack');
        threats.push({
            type: 'king_attack',
            checks: checkCount,
            description: 'Atac persistent al rei'
        });
    }

    return {
        threats,
        themes: Array.from(themes),
        immediateThreats
    };
}

function parseUciMove(uciMove) {
    return {
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove.length > 4 ? uciMove[4] : null
    };
}

function isLikelyCapture(fen, uciMove) {
    const board = expandBoard(fen.split(' ')[0]);
    const to = parseUciMove(uciMove).to;
    const toIndex = squareToIndex(to);
    return board[toIndex] !== null;
}

function squareToIndex(square) {
    const file = square.charCodeAt(0) - 97;
    const rank = Number.parseInt(square[1], 10);
    return (8 - rank) * 8 + file;
}

function detectForkPattern(pv) {
    if (pv.length < 3) return null;

    const move1 = pv[0];
    const move3 = pv[2];

    if (move1 && move3 && move1.slice(2, 4) === move3.slice(0, 2)) {
        return {
            type: 'fork',
            knightMove: move1,
            capture: move3,
            description: `Possible forquilla: ${move1} seguida de ${move3}`
        };
    }

    return null;
}

function countChecksInPv(fen, pv) {
    if (typeof Chess === 'undefined') return 0;
    const chess = new Chess(fen);
    let checks = 0;

    for (const uciMove of pv) {
        const move = chess.move({
            from: uciMove.slice(0, 2),
            to: uciMove.slice(2, 4),
            promotion: uciMove.length > 4 ? uciMove[4] : undefined
        });
        if (!move) break;
        if (move.san && move.san.includes('+')) checks += 1;
    }

    return checks;
}

function generateHieroglyphics(moveReview, positionInfo, pvAnalysis) {
    const result = {
        moveSymbol: '',
        positionSymbol: '',
        themeSymbols: [],
        explanations: []
    };

    result.moveSymbol = getMoveQualitySymbol(moveReview);
    result.positionSymbol = getPositionEvalSymbol(moveReview.evalAfter);

    if (pvAnalysis.themes.includes('king_attack')) {
        result.themeSymbols.push('→');
        result.explanations.push('Atac directe al rei');
    }

    if (pvAnalysis.immediateThreats.length > 0) {
        result.themeSymbols.push('↑');
        result.explanations.push('Iniciativa amb amenaces');
    }

    if (pvAnalysis.threats.length > 0) {
        result.themeSymbols.push('Δ');
        const threat = pvAnalysis.threats[0];
        result.explanations.push(`Amenaça: ${threat.description || threat.type}`);
    }

    if (pvAnalysis.themes.includes('promotion')) {
        result.themeSymbols.push('⇑');
        result.explanations.push('Amenaça de promoció');
    }

    if (pvAnalysis.themes.includes('fork')) {
        result.themeSymbols.push('⑂');
        result.explanations.push('Tema de forquilla');
    }

    if (positionInfo.material.balance < -2 && moveReview.evalAfter > 0) {
        result.themeSymbols.push('⇆');
        result.explanations.push('Compensació per material');
    }

    if (Math.abs((moveReview.evalBefore || 0) - (moveReview.evalAfter || 0)) > 200 &&
        moveReview.quality === 'inaccuracy') {
        result.themeSymbols.push('⊕');
        result.explanations.push('Posició complicada');
    }

    const turn = positionInfo.turn;
    const enemySafety = turn === 'w' ? positionInfo.kingSafety.black : positionInfo.kingSafety.white;
    if (enemySafety.exposed) {
        result.themeSymbols.push('⊙');
        result.explanations.push('Rei enemic exposat');
    }

    return result;
}

function getMoveQualitySymbol(moveReview) {
    const { swing, quality, playerMove, bestMove } = moveReview;

    if (playerMove && bestMove && playerMove === bestMove) return '!!';
    if (swing === null || swing === undefined) return '';

    if (swing <= 10) return '!';
    if (swing <= 25) return '';
    if (swing <= 50) return '!?';
    if (swing <= 100) return '?!';
    if (swing <= 300) return '?';
    if (quality === 'blunder') return '??';
    return '';
}

function getPositionEvalSymbol(evalCp) {
    if (evalCp === null || evalCp === undefined) return '∞';

    const abs = Math.abs(evalCp);
    const sign = evalCp >= 0 ? 'w' : 'b';

    if (abs <= 25) return '=';
    if (abs <= 50) return sign === 'w' ? '⩲' : '⩱';
    if (abs <= 150) return sign === 'w' ? '±' : '∓';
    if (abs <= 500) return sign === 'w' ? '+-' : '-+';
    return sign === 'w' ? '+−' : '−+';
}

function generateCompleteAnalysis(moveReview) {
    const positionInfo = parseFenPosition(moveReview.fen);
    const pvAnalysis = analyzePvThreats(moveReview.fen, moveReview.bestMovePv || []);
    const hieroglyphics = generateHieroglyphics(moveReview, positionInfo, pvAnalysis);

    const llmContext = {
        position: moveReview.fen,
        played: moveReview.playerMoveSan,
        best: moveReview.bestMoveSan || moveReview.bestMove,
        bestLine: moveReview.bestMovePv,
        evalSwing: moveReview.swing,
        materialBalance: positionInfo.material.balance,
        whiteKingSafe: !positionInfo.kingSafety.white.exposed,
        blackKingSafe: !positionInfo.kingSafety.black.exposed,
        passedPawns: positionInfo.passedPawns,
        threats: pvAnalysis.threats,
        themes: pvAnalysis.themes,
        symbols: hieroglyphics
    };

    return {
        moveReview,
        positionInfo,
        pvAnalysis,
        hieroglyphics,
        llmContext
    };
}

function generateLlmPrompt(analysis) {
    const { moveReview, hieroglyphics, llmContext } = analysis;

    return `Analitza aquest error d'escacs i genera una màxima didàctica:

POSICIÓ (FEN): ${moveReview.fen}
JUGAT: ${moveReview.playerMoveSan} ${hieroglyphics.moveSymbol}
MILLOR: ${llmContext.best}
LÍNIA CORRECTA: ${llmContext.bestLine?.join(' ') || 'N/A'}
PÈRDUA: ${moveReview.swing} centipawns

CONTEXT POSICIONAL:
- Balanç material: ${llmContext.materialBalance > 0 ? '+' : ''}${llmContext.materialBalance}
- Rei blanc segur: ${llmContext.whiteKingSafe ? 'Sí' : 'No'}
- Rei negre segur: ${llmContext.blackKingSafe ? 'Sí' : 'No'}
- Peons passats blancs: ${llmContext.passedPawns.white.join(', ') || 'Cap'}
- Peons passats negres: ${llmContext.passedPawns.black.join(', ') || 'Cap'}

TEMES DETECTATS: ${llmContext.themes.join(', ') || 'Cap'}
AMENACES: ${llmContext.threats.map((t) => t.description || t.type).join('; ') || 'Cap'}

SÍMBOLS: ${hieroglyphics.moveSymbol} ${hieroglyphics.positionSymbol} ${hieroglyphics.themeSymbols.join(' ')}

Genera:
1. Una màxima d'escacs (1 frase memorable)
2. Explicació breu de per què la jugada és un error
3. Explicació de per què la línia correcta és millor`;
}

function registerMoveReview(swing, analysisData = {}) {
    if (blunderMode) return;
    const quality = classifyMoveQuality(Math.abs(swing));
    const history = game.history({ verbose: true });
    const lastMove = history[history.length - 1];
    
    // Intentar convertir bestMove UCI a SAN
    let bestMoveSan = null;
    if (analysisData.bestMove && analysisData.fen) {
        try {
            const tempGame = new Chess(analysisData.fen);
            const uci = analysisData.bestMove;
            const moveObj = tempGame.move({
                from: uci.slice(0, 2),
                to: uci.slice(2, 4),
                promotion: uci.length > 4 ? uci[4] : undefined
            });
            if (moveObj) bestMoveSan = moveObj.san;
        } catch (e) {}
    }
    
    currentReview.push({
        fen: analysisData.fen || lastPosition || null,
        moveNumber: Math.ceil(history.length / 2),
        playerMove: lastHumanMoveUci || '—',
        playerMoveSan: lastMove ? lastMove.san : '—',
        bestMove: analysisData.bestMove || null,
        color: lastMove ? lastMove.color : null,
        evalBefore: analysisData.evalBefore ?? null,
        evalAfter: analysisData.evalAfter ?? null,
        swing: Math.abs(swing),
        quality: quality,
        isCapture: lastMove ? !!lastMove.captured : false,
        isCheck: game.in_check(),
        timestamp: Date.now(),
        
        // NOUS CAMPS ENRIQUITS
        depth: analysisData.depth || null,
        bestMoveSan: bestMoveSan,
        bestMovePv: analysisData.bestMovePv || [],
        alternatives: analysisData.alternatives || []
    });
}

function summarizeReview(entries) {
    const base = { excel: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    (entries || []).forEach(item => {
        if (base[item.quality] !== undefined) base[item.quality]++;
    });
    return base;
}

function calculateAverageCpLoss(entries) {
    const list = entries || [];
    if (!list.length) return 0;
    const total = list.reduce((sum, entry) => sum + (entry.swing || 0), 0);
    return Math.round(total / list.length);
}

function countBlunders(entries, threshold = 200) {
    return (entries || []).filter(entry => (entry.swing || 0) > threshold).length;
}

function identifyTacticalPatterns(entries, avgCpLoss, blunderCount) {
    const counts = summarizeReview(entries);
    const patterns = [];

    if (blunderCount > 0) {
        patterns.push('Blunders tàctics (>200 CP)');
    }
    if ((counts.mistake || 0) >= 2 || (counts.blunder || 0) >= 1) {
        patterns.push('Pèrdua de material en combinacions');
    }
    if ((counts.inaccuracy || 0) >= 3) {
        patterns.push('Imprecisions en la coordinació de peces');
    }
    if (avgCpLoss <= 60 && (counts.good + counts.excel) >= (counts.inaccuracy + counts.mistake + counts.blunder)) {
        patterns.push('Bona execució tàctica');
    }
    if (patterns.length === 0) {
        patterns.push('Sense patrons crítics destacats');
    }
    return patterns;
}

function getCalibrationResultsSummary() {
    const results = calibrationGames.map(game => game.result || 'draw');
    const wins = results.filter(r => r === 'win').length;
    const losses = results.filter(r => r === 'loss').length;
    const draws = results.filter(r => r === 'draw').length;
    const avgCpLoss = calibrationGames.length
        ? Math.round(calibrationGames.reduce((sum, game) => sum + (game.avgCpLoss || 0), 0) / calibrationGames.length)
        : 0;
    const blunders = calibrationGames.reduce((sum, game) => sum + (game.blunders || 0), 0);
    const patterns = calibrationGames.flatMap(game => game.tacticalPatterns || []);
    const patternCounts = patterns.reduce((acc, pattern) => {
        acc[pattern] = (acc[pattern] || 0) + 1;
        return acc;
    }, {});

    const strengths = [];
    const weaknesses = [];

    if (avgCpLoss <= 70) strengths.push('Precisió consistent al llarg del calibratge');
    if (patternCounts['Bona execució tàctica']) strengths.push('Bona execució tàctica');
    if (wins >= 3) strengths.push('Bona capacitat de convertir avantatges');

    if (avgCpLoss > 90) weaknesses.push('Cal reduir pèrdues de centipawns');
    if (blunders > 0) weaknesses.push('Evita blunders crítics (>200 CP)');
    if (patternCounts['Pèrdua de material en combinacions']) weaknesses.push('Vigila les combinacions que perden material');
    if (patternCounts['Imprecisions en la coordinació de peces']) weaknesses.push('Millora la coordinació de peces');

    if (!strengths.length) strengths.push('Joc equilibrat sense punts forts clars');
    if (!weaknesses.length) weaknesses.push('Cap feblesa crítica detectada');

    return { wins, losses, draws, avgCpLoss, strengths, weaknesses };
}

function buildCalibrationChartData() {
    return calibrationGames.map(game => {
        const quality = getCalibrationGameQuality(game);
        return CALIBRATION_ROC_MIN + (quality * (CALIBRATION_ROC_MAX - CALIBRATION_ROC_MIN));
    });
}

function renderCalibrationResults() {
    const summary = getCalibrationResultsSummary();
    $('#calibration-elo-value').text(`${userELO} ROC`);
    $('#calibration-wld-summary').text(`W ${summary.wins} · L ${summary.losses} · D ${summary.draws}`);
    const resultRow = $('#calibration-wld-row');
    resultRow.empty();
    calibrationGames.forEach(game => {
        const cls = game.result === 'win' ? 'win' : game.result === 'loss' ? 'loss' : 'draw';
        const label = game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'D';
        resultRow.append(`<span class="calibration-result-badge ${cls}">${label}</span>`);
    });

    const strengthsList = $('#calibration-strengths');
    strengthsList.empty();
    summary.strengths.forEach(item => strengthsList.append(`<li>${item}</li>`));

    const weaknessesList = $('#calibration-weaknesses');
    weaknessesList.empty();
    summary.weaknesses.forEach(item => weaknessesList.append(`<li>${item}</li>`));

    const ctx = document.getElementById('calibration-chart');
    if (!ctx) return;
    const labels = calibrationGames.map((_, idx) => `Partida ${idx + 1}`);
    const data = buildCalibrationChartData();
    if (calibrationResultsChart) calibrationResultsChart.destroy();
    calibrationResultsChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Evolució del nivell',
                data,
                borderColor: '#c9a227',
                backgroundColor: 'rgba(201, 162, 39, 0.15)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#c9a227',
                pointBorderColor: '#f4e4bc',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, grid: { color: 'rgba(201, 162, 39, 0.1)' }, ticks: { color: '#a89a8a' } },
                x: { grid: { color: 'rgba(201, 162, 39, 0.1)' }, ticks: { color: '#a89a8a' } }
            }
        }
    });
}

function showCalibrationResultsScreen() {
    renderCalibrationResults();
    $('#game-screen').removeClass('active').hide();
    $('#league-screen').hide();
    $('#stats-screen').hide();
    $('#history-screen').hide();
    $('#start-screen').hide();
    $('#calibration-result-screen').show();
}

function persistReviewSummary(finalPrecision, resultLabel) {
    if (blunderMode) { currentReview = []; return; }
    const summary = summarizeReview(currentReview);
    const now = new Date();
    const label = now.toLocaleDateString('ca-ES', { day: '2-digit', month: 'short' }) + ' ' + now.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
    reviewHistory.push({
        label: label,
        precision: finalPrecision,
        result: resultLabel,
        ...summary
    });
    if (reviewHistory.length > 60) reviewHistory = reviewHistory.slice(-60);
    currentReview = [];
}

function updateReviewLegend(entry) {
    const lastEntry = entry || reviewHistory[reviewHistory.length - 1] || null;
    const counts = { excel: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    if (lastEntry) {
        counts.excel = lastEntry.excel || 0;
        counts.good = lastEntry.good || 0;
        counts.inaccuracy = lastEntry.inaccuracy || 0;
        counts.mistake = lastEntry.mistake || 0;
        counts.blunder = lastEntry.blunder || 0;
    }
    Object.keys(counts).forEach(key => {
        const el = document.getElementById(`legend-${key}`);
        if (el) el.textContent = counts[key];
    });
}

function updateReviewChart() {
    const canvas = document.getElementById('review-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const hasData = reviewHistory.length > 0;
    const labels = hasData ? reviewHistory.map(r => r.label) : ['—'];
    const graySteps = ['#444', '#555', '#666', '#777', '#888'];
    const tickColor = epaperEnabled ? '#444' : '#a89a8a';
    const gridColor = epaperEnabled ? '#d0d0d0' : 'rgba(201, 162, 39, 0.1)';
    const datasets = [
        { key: 'excel', label: 'Excel·lents', color: '#4a7c59' },
        { key: 'good', label: 'Bones', color: '#c9a227' },
        { key: 'inaccuracy', label: 'Imprecisions', color: '#ffb74d' },
        { key: 'mistake', label: 'Errors', color: '#ef5350' },
        { key: 'blunder', label: 'Blunders', color: '#b71c1c' }
        ].map((meta, idx) => {
        const gray = graySteps[idx % graySteps.length];
        return {
        label: meta.label,
        data: hasData ? reviewHistory.map(r => r[meta.key] || 0) : [0],
        borderColor: epaperEnabled ? gray : meta.color,
        backgroundColor: epaperEnabled ? `rgba(${80 + idx * 20}, ${80 + idx * 20}, ${80 + idx * 20}, 0.2)` : meta.color + '33',
        tension: 0.25,
        fill: false
        };
    });

    if (reviewChart) reviewChart.destroy();
    reviewChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: tickColor } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } },
                x: { ticks: { color: tickColor, maxRotation: 45, minRotation: 45 }, grid: { color: gridColor } }
            }
        }
    });
    updateReviewLegend();
}

function formatHistoryMode(mode) {
    if (mode === 'league') return 'Lliga';
    if (mode === 'free') return 'Amistosa';
    return 'Partida';
}

const TV_LICHESS_CHANNELS = [
    { id: 'featured', label: 'Destacada' },
    { id: 'classical', label: 'Clàssiques' },
    { id: 'rapid', label: 'Ràpides' },
    { id: 'blitz', label: 'Blitz' },
    { id: 'bullet', label: 'Bullet' },
    { id: 'ultraBullet', label: 'UltraBullet' },
    { id: 'chess960', label: 'Chess960' }
];

const TV_ELO_LEVELS = [2800, 2700, 2600, 2500, 2400];
const TV_LICHESS_RATINGS = [1600, 1800, 2000, 2200, 2500];
const TV_LICHESS_SPEEDS = ['blitz', 'rapid', 'classical'];
let tvSelectedElo = TV_ELO_LEVELS[0];

const TV_FALLBACK_POOL = [  
    {
        id: 'carlsen-caruana-wcc2018-g12',
        white: 'Magnus Carlsen',
        black: 'Fabiano Caruana',
        whiteElo: 2835,
        blackElo: 2832,
        event: 'World Championship 2018',
        date: '2018.11.26',
        result: '1/2-1/2',
        pgnText: `[Event "World Championship 2018"]
[Site "London"]
[Date "2018.11.26"]
[Round "12"]
[White "Carlsen, Magnus"]
[Black "Caruana, Fabiano"]
[Result "1/2-1/2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. h3 d6 9. c3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Bd7 14. Nf1 Rac8 15. Ne3 Nc6 16. d5 Nb4 17. Bb1 a5 18. a3 Na6 19. b4 g6 20. Bd2 Qb8 21. Bd3 Nc7 22. Rc1 Nxd5 23. Nxd5 Nxd5 24. exd5 Rxc1 25. Qxc1 Rc8 26. Qb1 axb4 27. axb4 Bf6 28. Rc1 Rxc1+ 29. Qxc1 Qa8 30. Bc3 Qa2 31. Bb1 Qa6 1/2-1/2`
    },
    {
        id: 'kasparov-topalov-1999',
        white: 'Garry Kasparov',
        black: 'Veselin Topalov',
        whiteElo: 2851,
        blackElo: 2700,
        event: 'Wijk aan Zee 1999',
        date: '1999.01.20',
        result: '1-0',
        pgnText: `[Event "Wijk aan Zee"]
[Site "Wijk aan Zee"]
[Date "1999.01.20"]
[White "Kasparov, Garry"]
[Black "Topalov, Veselin"]
[Result "1-0"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`
    },
    {
        id: 'morphy-duke-opera-1858',
        white: 'Paul Morphy',
        black: 'Duke of Brunswick',
        whiteElo: 2690,
        blackElo: 2000,
        event: 'Paris Opera',
        date: '1858.11.02',
        result: '1-0',
        pgnText: `[Event "Paris Opera"]
[Site "Paris"]
[Date "1858.11.02"]
[White "Morphy, Paul"]
[Black "Duke of Brunswick"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`
    },
    {
        id: 'fischer-spassky-1972-g6',
        white: 'Bobby Fischer',
        black: 'Boris Spassky',
        whiteElo: 2785,
        blackElo: 2660,
        event: 'World Championship 1972',
        date: '1972.07.23',
        result: '1-0',
        pgnText: `[Event "World Championship 1972"]
[Site "Reykjavik"]
[Date "1972.07.23"]
[Round "6"]
[White "Fischer, Robert James"]
[Black "Spassky, Boris"]
[Result "1-0"]

1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8 14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6 20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5 27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7 32. Qe5 Qe8 33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6 39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4 1-0`
    },
    {
        id: 'tal-miller-1965',
        white: 'Mikhail Tal',
        black: 'Miller',
        whiteElo: 2700,
        blackElo: 2400,
        event: 'Los Angeles 1965',
        date: '1965.01.01',
        result: '1-0',
         pgnText: `[Event "Los Angeles"]
[Site "Los Angeles"]
[Date "1965.01.01"]
[White "Tal, Mikhail"]
[Black "Miller"]
[Result "1-0"]

1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 e6 5. Nc3 d6 6. Be3 Nf6 7. f4 Be7 8. Qf3 O-O 9. O-O-O Qc7 10. Nb3 a6 11. g4 b5 12. g5 Nd7 13. Bd4 Nxd4 14. Nxd4 b4 15. Nce2 Bb7 16. h4 Nc5 17. Ng3 Rfc8 18. Bh3 Qb6 19. f5 e5 20. Nf3 Nxe4 21. Nxe4 Bxe4 22. Qxe4 Rxc2+ 23. Kb1 Rac8 24. f6 Bxf6 25. gxf6 R2c4 26. Qe3 Qxf6 27. Rhf1 Qe7 28. Rxd6 a5 29. Qg5 g6 30. Rd7 Qe6 31. Qf6 1-0`    }

];

const MASTERS_OPENINGS = [
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
    'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -',
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
    'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
    'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -',
    'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
    'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -'
];

const MIN_TV_MOVES = 21;
let lastTvDynamicId = null;

function mapEloToLichessRating(elo) {
    return TV_LICHESS_RATINGS.reduce((closest, rating) => {
        if (closest === null) return rating;
        const currentDiff = Math.abs(rating - elo);
        const bestDiff = Math.abs(closest - elo);
        return currentDiff < bestDiff ? rating : closest;
    }, null);
}

function updateTvEloUI() {
    const subtitle = document.getElementById('tv-subtitle');
    const title = document.getElementById('tv-title');
    if (subtitle) {
        subtitle.textContent = 'Lichess TV (si està disponible) o partida aleatòria de la base de dades oberta.';
    }
    if (title) {
       title.textContent = 'Reproducció TV';
    }
}

function randomizeTvElo() {
    if (!TV_ELO_LEVELS.length) return;
    tvSelectedElo = TV_ELO_LEVELS[randInt(0, TV_ELO_LEVELS.length - 1)];
}

function stopHistoryPlayback() {
    if (historyReplay && historyReplay.timer) {
        clearInterval(historyReplay.timer);
        historyReplay.timer = null;
    }
    if (historyReplay) historyReplay.isPlaying = false;
    updateHistoryControls();
}

function updateHistoryControls() {
    const playBtn = $('#history-play');
    const pauseBtn = $('#history-pause');
    const prevBtn = $('#history-prev');
    const nextBtn = $('#history-next');
    const hasEntry = historyReplay && historyReplay.entry;
    const movesCount = hasEntry ? historyReplay.moves.length : 0;
    const atStart = !hasEntry || historyReplay.moveIndex === 0;
    const atEnd = !hasEntry || historyReplay.moveIndex >= movesCount;

    playBtn.prop('disabled', !hasEntry || movesCount === 0 || historyReplay.isPlaying || atEnd);
    pauseBtn.prop('disabled', !hasEntry || !historyReplay.isPlaying);
    prevBtn.prop('disabled', !hasEntry || atStart || historyReplay.isPlaying);
    nextBtn.prop('disabled', !hasEntry || atEnd || historyReplay.isPlaying);
}

function updateHistoryProgress() {
    const progress = $('#history-progress');
    if (!historyReplay || !historyReplay.entry) {
        progress.text('0/0');
        return;
    }
    progress.text(`${historyReplay.moveIndex}/${historyReplay.moves.length}`);
}

function updateHistoryBoard() {
    if (!historyBoard || !historyReplay || !historyReplay.game) return;
    historyBoard.position(historyReplay.game.fen(), false);
    if (typeof historyBoard.resize === 'function') historyBoard.resize();
    updateHistoryProgress();
    updateHistoryControls();
}

// CERCA AQUESTA FUNCIÓ:
function initHistoryBoard() {
    if (historyBoard) return;
    const boardEl = document.getElementById('history-board');
    if (!boardEl) return;
    historyBoard = Chessboard('history-board', {
        draggable: false,
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
}

// CANVIA-LA PER AQUESTA:
function initHistoryBoard(entry) {
    const boardEl = document.getElementById('history-board');
    if (!boardEl) return;
    
    // Determinar orientació segons el color jugat
    let orientation = 'white';
    if (entry && entry.playerColor === 'b') {
        orientation = 'black';
    }
    
    // Si ja existeix el tauler, només canviar orientació si cal
    if (historyBoard) {
        historyBoard.orientation(orientation);
        return;
    }
    
    historyBoard = Chessboard('history-board', {
        draggable: false,
        position: 'start',
        orientation: orientation,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
}

function getHistoryMoves(entry) {
    if (!entry) return [];
    const baseMoves = Array.isArray(entry.moves) ? entry.moves : [];
    if ((!baseMoves.length || baseMoves.length === 1) && entry.pgn) {
        const pgnGame = new Chess();
        if (pgnGame.load_pgn(entry.pgn, { sloppy: true })) {
            const parsedMoves = pgnGame.history();
            if (parsedMoves.length) return parsedMoves;
        }
    }
    return baseMoves;
}

function loadHistoryEntry(entry) {
    if (!entry) return;
    stopHistoryPlayback();
    initHistoryBoard(entry);
    const moves = getHistoryMoves(entry);
    historyReplay = {
        entry: entry,
        game: new Chess(),
        moves: moves,
        moveIndex: 0,
        timer: null,
        isPlaying: false
    };
    updateHistoryDetails(entry);
    updateHistoryBoard();
}

function updateHistoryDetails(entry) {
    const resultEl = $('#history-result');
    const precisionEl = $('#history-precision');
    const metaEl = $('#history-meta');
    const breakdown = $('#history-breakdown');
    const reviewContent = $('#history-review-content');
    if (!entry) {
        resultEl.text('—');
        precisionEl.text('—');
        metaEl.text('Selecciona una partida per veure detalls.');
        breakdown.empty();
        if (reviewContent.length) reviewContent.text('—');
        updateHistoryProgress();
        updateHistoryControls();
        return;
    }

    resultEl.text(entry.result || '—');
    precisionEl.text(typeof entry.precision === 'number' ? `${entry.precision}%` : '—');
    const movesLabel = `${getHistoryMoves(entry).length} jugades`;
    const meta = `${entry.label || '—'} · ${formatHistoryMode(entry.mode)} · ${movesLabel}`;
    metaEl.text(meta);

    const counts = entry.counts || { excel: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    breakdown.html(`
        <div class="review-chip excel">Excel·lents <strong>${counts.excel || 0}</strong></div>
        <div class="review-chip good">Bones <strong>${counts.good || 0}</strong></div>
        <div class="review-chip inaccuracy">Imprecisions <strong>${counts.inaccuracy || 0}</strong></div>
        <div class="review-chip mistake">Errors <strong>${counts.mistake || 0}</strong></div>
        <div class="review-chip blunder">Blunders <strong>${counts.blunder || 0}</strong></div>
    `);
    updateHistoryReview(entry);
    updateHistoryProgress();
    updateHistoryControls();
}

function updateHistoryReview(entry) {
    const reviewContent = $('#history-review-content');
    const generateBtn = $('#history-generate-review');
    if (!reviewContent.length) return;
    if (!entry) {
        reviewContent.text('—');
        if (generateBtn.length) generateBtn.prop('disabled', true);
        return;
    }
    const review = entry.geminiReview || null;
    if (review && review.text) {
        reviewContent.html(formatGeminiReviewText(review.text));
        bindGeminiMoveLinks(reviewContent);
        if (generateBtn.length) generateBtn.prop('disabled', true);
        return;
    }
    if (review && review.status === 'pending') {
        reviewContent.text('Generant revisió amb Gemini...');
        if (generateBtn.length) generateBtn.prop('disabled', true);
        return;
    }
    if (review && review.status === 'error') {
        reviewContent.text(review.message || "No s'ha pogut generar la revisió.");
        if (generateBtn.length) generateBtn.prop('disabled', !geminiApiKey);
        return;
    }
    if (!geminiApiKey) {
        reviewContent.text('Configura la clau de Gemini per generar revisions.');
        if (generateBtn.length) generateBtn.prop('disabled', true);
        return;
    }
    reviewContent.text('Encara no hi ha revisió per aquesta partida.');
    if (generateBtn.length) generateBtn.prop('disabled', false);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatGeminiReviewText(text) {
    const safe = escapeHtml(text || '');
    
    // Primer, formatem les cometes per a màximes
    let formatted = safe
        .replace(/&quot;([\s\S]*?)&quot;/g, '<em>"$1"</em>')
        .replace(/\"([\s\S]*?)\"/g, '<em>"$1"</em>');
    
    // Patrons AMPLIATS per capturar més formats de referències a jugades
    const movePatterns = [
        // Formats amb paréntesis: "10. Nxe5", "10 (Nxe5)", etc.
        /(\d+)\.\s*([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?)/gi,
        /jugada\s+(\d+)\s*\(([^)]+)\)/gi,
        /a\s+la\s+jugada\s+(\d+)\s*\(([^)]+)\)/gi,
        /jugada\s+n[úu]mero\s+(\d+)\s*\(([^)]+)\)/gi,
        /moviment\s+(\d+)\s*\(([^)]+)\)/gi,
        /al\s+moviment\s+(\d+)\s*\(([^)]+)\)/gi,
        // Formats sense paréntesis
        /jugada\s+(\d+):\s*([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?)/gi,
        /move\s+(\d+)\s*\(([^)]+)\)/gi,
    ];
    
    // Apliquem cada patró
    movePatterns.forEach(pattern => {
        formatted = formatted.replace(pattern, (match, moveNumber, san) => {
            const cleanSan = san.trim()
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            
            return `<a href="#" class="gemini-move-link" data-move-number="${moveNumber}" data-san="${cleanSan}">${match}</a>`;
        });
    });
    
    return formatted;
}

function bindGeminiMoveLinks(container) {
    if (!container || !container.length) return;
    container.find('.gemini-move-link').off('click').on('click', function(event) {
        event.preventDefault();
        const moveNumber = Number($(this).data('move-number'));
        const san = String($(this).data('san') || '').trim();
        jumpToHistoryMove(moveNumber, san);
    });
}

function jumpToHistoryMove(moveNumber, san) {
    if (!historyReplay || !historyReplay.entry || !historyReplay.moves) return;
    stopHistoryPlayback();
    
    const targetIndex = findHistoryMoveIndex(moveNumber, san);
    if (targetIndex === null || targetIndex < 0) {
        console.warn(`No s'ha trobat la jugada ${moveNumber} (${san})`);
        return;
    }
    
    // Resetegem el joc i avancem fins a la posició ABANS de la jugada errònia
    historyReplay.game = new Chess();
    const stopAt = Math.max(0, targetIndex - 1); // Mostrem la posició just abans
    
    for (let i = 0; i < stopAt; i++) {
        const result = historyReplay.game.move(historyReplay.moves[i], { sloppy: true });
        if (!result) {
            console.warn(`Error aplicant jugada ${i}: ${historyReplay.moves[i]}`);
            break;
        }
    }
    
    historyReplay.moveIndex = stopAt;
    updateHistoryBoard();
    
    // Highlight visual de la casella destí de la jugada errònia
    if (targetIndex > 0 && historyReplay.moves[targetIndex - 1]) {
        const moveStr = historyReplay.moves[targetIndex - 1];
        highlightReviewedMove(moveStr);
    }
}

function highlightReviewedMove(san) {
    // Opcionalment, ressaltar la jugada al tauler
    $('#history-board .square-55d63').removeClass('reviewed-move');
    // Aquí podries afegir lògica per ressaltar caselles específiques
}

function findHistoryMoveIndex(moveNumber, san) {
    if (!historyReplay || !Array.isArray(historyReplay.moves)) return null;
    const moves = historyReplay.moves;
    const normalizedSan = (san || '').trim().replace(/[+#!?]/g, ''); // Eliminar anotacions
    
    // Primer intent: buscar per número de jugada exacte
    if (moveNumber) {
        // La jugada X correspon a l'índex (X-1)*2 per blanques o (X-1)*2+1 per negres
        // Però necessitem saber el color - intentem ambdós
        const whiteIndex = (moveNumber - 1) * 2;
        const blackIndex = whiteIndex + 1;
        
        // Comprovem si la SAN coincideix
        if (whiteIndex < moves.length) {
            const whiteSan = moves[whiteIndex].replace(/[+#!?]/g, '');
            if (!normalizedSan || whiteSan === normalizedSan) {
                return whiteIndex + 1; // +1 perquè volem mostrar DESPRÉS de jugar
            }
        }
        if (blackIndex < moves.length) {
            const blackSan = moves[blackIndex].replace(/[+#!?]/g, '');
            if (!normalizedSan || blackSan === normalizedSan) {
                return blackIndex + 1;
            }
        }
    }
    
    // Segon intent: buscar per SAN si no hem trobat per número
    if (normalizedSan) {
        for (let i = 0; i < moves.length; i++) {
            const moveSan = moves[i].replace(/[+#!?]/g, '');
            if (moveSan === normalizedSan) {
                // Si tenim moveNumber, comprovem que estigui a prop
                if (moveNumber) {
                    const fullMove = Math.ceil((i + 1) / 2);
                    if (Math.abs(fullMove - moveNumber) <= 1) {
                        return i + 1;
                    }
                } else {
                    return i + 1;
                }
            }
        }
    }
    
    // Tercer intent: només per número de jugada (blanques per defecte)
    if (moveNumber) {
        const defaultIndex = (moveNumber - 1) * 2;
        if (defaultIndex < moves.length) {
            return defaultIndex + 1;
        }
    }
    
    return null;
}

function getSevereErrors(entries) {
    return (entries || [])
        .filter(entry => entry.quality === 'blunder' || (entry.swing || 0) >= 200)
        .map(entry => ({
            fen: entry.fen || null,
            moveNumber: entry.moveNumber || null,
            playerMove: entry.playerMove || null,
            playerMoveSan: entry.playerMoveSan || null,
            bestMove: entry.bestMove || null,
            bestMoveSan: entry.bestMoveSan || null,
            bestMovePv: entry.bestMovePv || [],
            bestMovePvSan: entry.bestMovePvSan || [],
            evalBefore: entry.evalBefore ?? null,
            evalAfter: entry.evalAfter ?? null,
            swing: entry.swing || null,
            isCapture: !!entry.isCapture,
            isCheck: !!entry.isCheck,
            depth: entry.depth || null,
            alternatives: entry.alternatives || [],
            quality: entry.quality || 'blunder'
        }));
}

function getEntrySevereErrors(entry) {
    if (!entry) return [];
    if (Array.isArray(entry.severeErrors) && entry.severeErrors.length) {
        return entry.severeErrors;
    }
    if (Array.isArray(entry.review) && entry.review.length) {
        return getSevereErrors(entry.review);
    }
    return [];
}

function buildGeminiBundleHintPrompt(step, context = {}) {
    const stepNumber = step === 2 ? 2 : 1;
    const sentenceCount = stepNumber === 1 ? 2 : 1;
    const sentenceText = sentenceCount === 1 ? '1 frase' : '2 frases';
    const maxChars = 600;
    
    // Construir context posicional
    let contextText = '';
    if (context.fen) {
        contextText += `\nPOSICIÓ (FEN): ${context.fen}`;
    }
    if (context.playerMove) {
        contextText += `\nJugada feta: ${context.playerMove}`;
    }
    if (context.bestMove) {
        contextText += `\nMillor jugada: ${context.bestMove}`;
    }
    if (context.bestMovePv && context.bestMovePv.length) {
        contextText += `\nVariant principal: ${context.bestMovePv.slice(0, 4).join(' ')}`;
    }
    if (context.severity) {
        const severityLabels = { low: 'lleu', med: 'mitjà', high: 'greu' };
        contextText += `\nGravetat: Error ${severityLabels[context.severity] || 'desconegut'}`;
    }
    
    const extraStep1 = stepNumber === 1
        ? `\n\nPer al pas 1, genera dues frases màxima:\n- La primera frase ha d'apuntar a un concepte tàctic o estratègic general aplicable a aquesta posició.\n- La segona frase ha d'orientar subtilment cap a la peça o zona clau sense revelar directament la jugada.\n`
        : '';
    
    return `Ets un entrenador d'escacs expert. Analitza aquesta situació i genera ${sentenceText} en català amb màximes o principis d'escacs per ajudar a trobar la millor jugada del pas ${stepNumber}.
${contextText}

REGLES IMPERATIVES:
- Cada frase ha de tenir mínim 20 i 250 màxim caràcters 
- Les màximes han de ser específiques i accionables, no genèriques
- NO facis servir frases de menys de 5 paraules
- NO repeteixis conceptes entre frases
- NO facis servir cometes, emojis, ni enumeracions
- Centra't en conceptes tàctics concrets: forquilles, claus, atacs dobles, debilitats de peó, peces sobrecarregades, línies obertes, control del centre
- Les màximes han de guiar sense revelar directament la solució
${extraStep1}
BONS EXEMPLES de màximes per al pas 1:
Les peces actives sempre busquen caselles que controlin múltiples objectius simultàniament
Identifica les peces enemigues que defensen múltiples punts i sobrecarrega-les
Quan el rei està al centre les columnes obertes són autopistes d'atac

BONS EXEMPLES de màximes per al pas 2:
Després d'una tàctica guanyadora cal consolidar amb jugades naturals de desenvolupament
Mantén la pressió sobre els punts febles abans que l'adversari pugui reagrupar-se

Genera ara ${sentenceText} específica${sentenceCount === 1 ? '' : 's'} per aquesta posició:`;
}

function buildBundleGeminiPromptWithFixedSequence(step) {
    if (!bundleFixedSequence) return null;
    
    const stepData = step === 1 ? bundleFixedSequence.step1 : bundleFixedSequence.step2;
    
    if (step === 1) {
        return `Ets un mestre d'escacs que aplica els principis de l'Art de la Guerra de Sun Tzu als escacs.

SEQÜÈNCIA TÀCTICA COMPLETA (no revelar):
1. Jugador: ${bundleFixedSequence.fullSequenceSan[0]}
2. Oponent: ${bundleFixedSequence.fullSequenceSan[1]}
3. Jugador: ${bundleFixedSequence.fullSequenceSan[2]}

CONTEXT DEL PRIMER PAS:
Posició (FEN): ${stepData.fen}
Millor jugada: ${stepData.playerMoveSan}
Balanç material: ${stepData.position.material.balance}
Temes tàctics: ${stepData.threats.themes.join(', ') || 'Cap'}

INSTRUCCIONS:
Genera exactament 2 màximes o principis d'escacs inspirats en l'Art de la Guerra:

1. Primera màxima: Visió estratègica general que engloba els dos moviments de la seqüència sencera
2. Segona màxima: Principi tàctic específic pel primer moviment concret

REGLES IMPERATIVES:
- Només les màximes, res més
- Cada màxima entre 20-200 caràcters
- Inspirades en l'Art de la Guerra de Sun Tzu
- NO revelar directament la solució
- NO numerar les màximes
- NO afegir comentaris explicatius

FORMAT DE SORTIDA:
Màxima general
Màxima específica`;
    } else {
        return `Ets un mestre d'escacs que aplica els principis de l'Art de la Guerra de Sun Tzu als escacs.

CONTEXT DEL SEGON PAS:
Posició (FEN): ${stepData.fen}
Millor jugada: ${stepData.playerMoveSan}
Balanç material: ${stepData.position.material.balance}
Temes tàctics: ${stepData.threats.themes.join(', ') || 'Cap'}

INSTRUCCIONS:
Genera exactament 1 màxima o principi d'escacs inspirat en l'Art de la Guerra per al segon moviment de la seqüència.

REGLES IMPERATIVES:
- Només la màxima, res més
- Entre 20-200 caràcters
- Inspirada en l'Art de la Guerra de Sun Tzu
- NO revelar directament la solució
- NO numerar
- NO afegir comentaris explicatius

FORMAT DE SORTIDA:
Màxima específica`;
    }
}

// Obté les continuacions possibles agrupades per moviment
function getOpeningContinuations(sequence) {
    if (!openingTrie) return { continuations: {}, total: 0 };

    let node = openingTrie;

    // Si no hi ha seqüència, comencem des de l'arrel
    if (sequence.length > 0) {
        for (const move of sequence) {
            if (!node.children[move]) {
                return { continuations: {}, total: 0 };
            }
            node = node.children[move];
        }
    }

    // Agrupar obertures per següent moviment
    const continuations = {};
    let total = 0;

    for (const [nextMove, childNode] of Object.entries(node.children)) {
        // Recollir obertures d'aquest camí
        const openings = [];
        function collect(n) {
            openings.push(...n.openings);
            for (const child of Object.values(n.children)) {
                collect(child);
            }
        }
        collect(childNode);

        if (openings.length > 0) {
            // Ordenar per longitud de moviments (més curtes primer = més generals)
            openings.sort((a, b) => a.moves.length - b.moves.length);
            continuations[nextMove] = openings.slice(0, 3); // Màxim 3 per moviment
            total += openings.length;
        }
    }

    return { continuations, total };
}

function buildOpeningEncouragementPrompt() {
    return `Ets Sun Tzu, mestre estrateg, donant consell abans d'una partida d'escacs.

TASCA: Escriu un paràgraf d'encoratjament en català, estil "L'Art de la Guerra".

CONTINGUT:
- Parla de la importància de la preparació mental abans de la batalla
- Menciona els principis estratègics que s'apliquen a l'obertura d'escacs
- Pots incloure citacions o paràfrasis de "L'Art de la Guerra"
- Acaba amb un consell inspirador per començar la partida

REGLES:
- Entre 3 i 6 frases
- To filosòfic i inspirador
- Sense emojis
- Sense cometes al voltant de tot el text
- En català
- IMPORTANT: Acaba sempre amb un punt final

EXEMPLE D'ESTIL (NO COPIAR):
"L'estrateg savi prepara la victòria abans que comenci la batalla. Conèixer el terreny és conèixer les possibilitats. El centre del tauler és com la plana central on es decideixen els imperis. Qui el domina, controla els camins de la victòria."

Escriu ara:`
}

function buildOpeningAlternativesPrompt(sequence, continuations, selectedOpening) {
    const movesStr = sequence.join(' ');

    // Preparar llista d'alternatives
    let alternativesText = '';
    const moves = Object.keys(continuations);

    for (const move of moves.slice(0, 5)) { // Màxim 5 alternatives
        const openings = continuations[move];
        const names = openings.map(o => o.name).slice(0, 3).join(', ');
        alternativesText += `- ${move}: ${names}\n`;
    }

    const currentOpeningInfo = selectedOpening
        ? `OBERTURA ACTUAL: [${selectedOpening.eco || '??'}] ${selectedOpening.name}`
        : 'POSICIÓ: Sense obertura específica detectada';

    return `Ets Sun Tzu aplicant "L'Art de la Guerra" als escacs.

SEQÜÈNCIA JUGADA: ${movesStr || '(inici)'}
${currentOpeningInfo}

CONTINUACIONS POSSIBLES:
${alternativesText || 'Cap continuació teòrica'}

TASCA: Escriu un anàlisi complet en català (entre 5 i 10 frases):

1. OBERTURA ACTUAL: Explica què és aquesta obertura, el seu origen històric si el coneixes, i quin és el seu objectiu estratègic principal.

2. ALTERNATIVES: Per cada continuació possible, descriu-la amb metàfores militars de Sun Tzu:
   - NO diguis els moviments directament (${moves.slice(0, 3).join(', ')})
   - Usa al·lusions: "el camí del centre", "el flanc de rei", "la diagonal oculta", "l'avanç dels peons", "el salt del cavall"
   - Explica quina filosofia estratègica representa cada camí

3. CONSELL: Acaba amb un consell estratègic inspirat en Sun Tzu sobre com escollir entre les alternatives.

REGLES:
- Entre 5 i 10 frases
- Sense emojis ni numeració
- To estratègic militar profund
- En català
- IMPORTANT: Acaba sempre amb un punt final

Respon:`
}

async function requestOpeningMaximLlull() {
    if (!openingPracticeGame) return;
    if (!geminiApiKey) {
        const noteEl = document.getElementById('opening-practice-note');
        if (noteEl) {
            noteEl.innerHTML = '<div style="padding:10px; background:rgba(255,100,100,0.2); border-radius:8px; line-height:1.5;">Configura la clau de Gemini a Estadístiques per utilitzar aquesta funció.</div>';
        }
        return;
    }
    if (openingMaximPending) return;

    openingMaximPending = true;
    const noteEl = document.getElementById('opening-practice-note');

    // Determinar si és inici o continuació
    const isStart = openingCurrentSequence.length === 0;

    if (noteEl) {
        noteEl.innerHTML = isStart
            ? '<div style="padding:8px; background:rgba(100,100,255,0.15); border-radius:8px;">Consultant Sun Tzu...</div>'
            : '<div style="padding:8px; background:rgba(100,100,255,0.15); border-radius:8px;">Analitzant alternatives...</div>';
    }

    // Construir prompt segons l'estat
    let prompt;
    let continuationsData = null;

    if (isStart) {
        prompt = buildOpeningEncouragementPrompt();
    } else {
        continuationsData = getOpeningContinuations(openingCurrentSequence);
        prompt = buildOpeningAlternativesPrompt(
            openingCurrentSequence,
            continuationsData.continuations,
            openingSelectedOpening
        );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: isStart ? 0.9 : 0.7,
                    maxOutputTokens: isStart ? 1000 : 3000,
                    topP: 0.9,
                    topK: 30
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('[Gemini Opening] Error response:', response.status, errorBody);
            throw new Error(`Gemini error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();
        if (!text) throw new Error('Resposta buida de Gemini');

        // Netejar el text de possibles artefactes
        let cleanText = text
            .replace(/^\d+\.\s*/gm, '') // Treure numeracions
            .replace(/^[-•]\s*/gm, '') // Treure bullets
            .replace(/\*\*/g, '') // Treure bold markdown
            .replace(/^["«]|["»]$/g, '') // Treure cometes
            .trim();

        // Assegurar que acaba en punt final
        if (cleanText && !/[.!?]$/.test(cleanText)) {
            cleanText += '.';
        }

        // Verificar que no s'hagi cancel·lat (p.ex. per undo)
        if (!openingMaximPending) {
            console.log('[Gemini Opening] Petició cancel·lada (probablement per undo)');
            return;
        }

        // Construir HTML segons tipus
        let html = '<div style="padding:12px; background:rgba(139,0,0,0.10); border-left:3px solid #8b0000; border-radius:8px; line-height:1.6;">';

        if (isStart) {
            // Frase d'encoratjament simple
            html += `<div style="font-style:italic; color:var(--text-primary); font-size:1em;">"${cleanText}"</div>`;
            html += '<div style="text-align:right; margin-top:6px; font-size:0.8em; color:var(--text-secondary);">— Sun Tzu</div>';
        } else {
            // Mostrar obertura actual si existeix
            if (openingSelectedOpening) {
                html += `<div style="font-weight:600; color:#c9a227; margin-bottom:8px; font-size:0.9em;">[${openingSelectedOpening.eco || '??'}] ${openingSelectedOpening.name}</div>`;
            }

            // Mostrar alternatives disponibles
            if (continuationsData && Object.keys(continuationsData.continuations).length > 0) {
                const numAlternatives = Object.keys(continuationsData.continuations).length;
                html += `<div style="font-size:0.8em; color:var(--text-secondary); margin-bottom:6px;">${numAlternatives} continuacions possibles (${continuationsData.total} obertures)</div>`;
            }

            html += `<div style="color:var(--text-primary); font-size:0.95em;">${cleanText}</div>`;
        }

        html += '</div>';

        lastOpeningMaxim = html;
        if (noteEl) noteEl.innerHTML = html;

    } catch (err) {
        console.error('[Gemini Opening]', err);
        // Només mostrar error si no s'ha cancel·lat
        if (openingMaximPending && noteEl) {
            noteEl.innerHTML = '<div style="padding:10px; background:rgba(255,100,100,0.2); border-radius:8px;">No s\'ha pogut consultar. Torna-ho a provar.</div>';
        }
    } finally {
        openingMaximPending = false;
    }
}

async function requestGeminiBundleHint() {
    if (!blunderMode || !currentBundleFen) return;
    if (!geminiApiKey) {
        const statusEl = $('#status');
        statusEl.html('<div style="padding:10px; background:rgba(255,100,100,0.2); border-radius:8px; line-height:1.5;">⚠️ Configura la clau de Gemini a Estadístiques → Configuració per utilitzar aquesta pista.</div>');
        return;
    }
    if (bundleGeminiHintPending) return;
    
    bundleGeminiHintPending = true;
    updateBundleHintButtons();
    
    const statusEl = $('#status');
    statusEl.html('<div style="padding:8px; background:rgba(100,100,255,0.15); border-radius:8px;">🧠 Generant màxima d\'escacs...</div>');
    
    let prompt;
    if (bundleFixedSequence) {
        prompt = buildBundleGeminiPromptWithFixedSequence(bundleSequenceStep);
    } else {
        const errorContext = {};
        let currentError = savedErrors.find(e => e.fen === currentBundleFen);

        if (!currentError) {
            for (const entry of gameHistory) {
                if (entry.severeErrors && Array.isArray(entry.severeErrors)) {
                    currentError = entry.severeErrors.find(e => e.fen === currentBundleFen);
                    if (currentError) break;
                }
            }
        }

        if (currentError) {
            errorContext.fen = currentError.fen;
            errorContext.bestMove = currentError.bestMove;
            errorContext.playerMove = currentError.playerMove;
            errorContext.severity = currentError.severity;
            errorContext.bestMovePv = currentError.bestMovePv || [];
        } else {
            errorContext.fen = currentBundleFen;
        }

        const step = bundleSequenceStep === 2 ? 2 : 1;
        prompt = buildGeminiBundleHintPrompt(step, errorContext);
    }
    
    if (!prompt) {
        bundleGeminiHintPending = false;
        updateBundleHintButtons();
        return;
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.85,
                    maxOutputTokens: 2000,
                    topP: 0.95,
                    topK: 40
                }
            })
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('[Gemini] Error response:', response.status, errorBody);
            throw new Error(`Gemini error ${response.status}: ${errorBody}`);
        }
        
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();
        if (!text) throw new Error('Resposta buida de Gemini');
        
        const lines = text.split('\n').filter(l => l.trim());
        const validLines = lines.filter(line => {
            const words = line.trim().split(/\s+/).length;
            return words >= 5;
        });
        
        if (validLines.length === 0) {
            throw new Error('Respostes massa curtes');
        }
              
        const MAX_GEMINI_HINT_CHARS = 350;
        let remainingChars = MAX_GEMINI_HINT_CHARS;
        const trimmedLines = [];
        for (const line of validLines) {
            if (remainingChars <= 0) break;
            let trimmedLine = line.trim();
            if (trimmedLine.length > remainingChars) {
                const sliceLength = Math.max(remainingChars - 1, 0);
                trimmedLine = `${trimmedLine.slice(0, sliceLength).trim()}…`.trim();
            }
            trimmedLines.push(trimmedLine);
            remainingChars -= trimmedLine.length;
        }
        
        let html = '<div style="padding:12px; background:rgba(100,150,255,0.12); border-left:3px solid #6495ed; border-radius:8px; line-height:1.6;">';
        html += '<div style="font-weight:600; color:var(--accent-gold); margin-bottom:6px;">💡 Principis d\'escacs:</div>';
        trimmedLines.forEach(line => {
            html += `<div style="font-style:italic; margin:4px 0;">${line.trim()}</div>`;
        });
        html += '</div>';
        
        // CANVI: Guardar el missatge generat
        lastBundleGeminiHint = html;
        statusEl.html(html);
        
    } catch (err) {
        console.error(err);
        statusEl.html('<div style="padding:10px; background:rgba(255,100,100,0.2); border-radius:8px;">❌ No s\'ha pogut generar la màxima. Torna-ho a provar.</div>');
    } finally {
        bundleGeminiHintPending = false;
        updateBundleHintButtons();
    }
}

function buildGeminiReviewPrompt(entry, severeErrors) {
    const summary = entry.counts || {};
    const moves = getHistoryMoves(entry);
    
    const errorsDetail = severeErrors.map((err, idx) => {
        const moveNum = err.moveNumber || '?';
        const played = err.playerMoveSan || err.playerMove || '?';
        const best = err.bestMoveSan || err.bestMove || '?';
        const swing = err.swing || 0;
        const pvLine = (err.bestMovePvSan || err.bestMovePv || []).slice(0, 4).join(' ');
        
        return `Error ${idx + 1}:
  - Número de jugada: ${moveNum}
  - Jugada feta: ${played}
  - Millor jugada: ${best}
  - Pèrdua: ${swing} centipawns
  - Continuació correcta: ${pvLine || '—'}`;
    }).join('\n\n');

    const totalMoves = moves.length;
    
    return `Ets un mestre d'escacs amable que ensenya amb màximes memorables.

DADES DE LA PARTIDA
- Resultat: ${entry.result || '—'}
- Precisió: ${typeof entry.precision === 'number' ? `${entry.precision}%` : '—'}
- Total jugades: ${totalMoves}
- Jugades bones: ${(summary.excel || 0) + (summary.good || 0)}
- Imprecisions: ${summary.inaccuracy || 0}
- Errors greus: ${(summary.mistake || 0) + (summary.blunder || 0)}

ERRORS CONCRETS A ANALITZAR
${errorsDetail || 'Cap error greu detectat.'}

FORMAT OBLIGATORI PER REFERENCIAR JUGADES
Quan mensionis una jugada específica, SEMPRE utilitza exactament aquest format:
"jugada X (SAN)" - on X és el número i SAN la notació algebraica.
Exemples correctes:
- "A la jugada 12 (Nxe5), vas perdre material..."
- "L'error a la jugada 8 (Qd3) va ser decisiu..."
- "Calia jugar diferent a la jugada 15 (Bxf7+)..."

INSTRUCCIONS
1. Comença amb un TÍTOL: una màxima memorable entre cometes dobles
2. Paràgraf d'anàlisi general del rendiment (sense felicitacions excessives)
3. Per CADA error, explica:
   - Què va passar a la jugada X (SAN) - descriu l'acció mecànica
   - Per què era un error
   - Quina era la idea correcta
   - Una màxima universal entre cometes
4. Paràgraf de conclusió amb el principi clau per millorar

REGLES
- Màxim 400 paraules
- Prosa natural en paràgrafs (sense llistes ni numeracions)
- Descriu cada jugada identificant la peça i l'acció (ex: "en capturar el cavall amb l'alfil")
- Les màximes sempre entre cometes dobles
- To objectiu i professional

EXEMPLES DE MÀXIMES
"Desenvolupa les peces abans d'atacar"
"El rei al centre és un rei en perill"
"Abans de moure, mira què ataca el rival"
"Les peces han de treballar juntes"`;
}

async function requestGeminiReview(entry, severeErrors) {
    if (!entry || !geminiApiKey) return;
    if (entry.geminiReview && entry.geminiReview.status === 'pending') return;
    if (entry.geminiReview && entry.geminiReview.text) return;
    const resolvedErrors = Array.isArray(severeErrors) && severeErrors.length
        ? severeErrors
        : getEntrySevereErrors(entry);
    entry.geminiReview = { status: 'pending', text: '' };
    saveStorage();
    updateHistoryReview(historyReplay && historyReplay.entry && historyReplay.entry.id === entry.id ? historyReplay.entry : entry);
    const prompt = buildGeminiReviewPrompt(entry, resolvedErrors);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 4096,
                    topP: 0.95,
                    topK: 40
                }
            })
        });
        if (!response.ok) {
            throw new Error(`Gemini error ${response.status}`);
        }
        const data = await response.json();
        let text = data?.candidates?.[0]?.content?.parts?.map(part => part.text).join('')?.trim();
        if (!text) throw new Error('Resposta buida de Gemini');
        if (text.length > 4000) {
            text = text.slice(0, 4000).trim();
        }
        entry.geminiReview = { status: 'done', text };
    } catch (error) {
        entry.geminiReview = {
            status: 'error',
            message: 'No s’ha pogut generar la revisió amb Gemini.'
        };
    }
    saveStorage();
    if (historyReplay && historyReplay.entry && historyReplay.entry.id === entry.id) {
        updateHistoryReview(historyReplay.entry);
    }
}

function historyStepForward() {
    if (!historyReplay || !historyReplay.entry || historyReplay.moveIndex >= historyReplay.moves.length) return;
    const move = historyReplay.moves[historyReplay.moveIndex];
    historyReplay.game.move(move, { sloppy: true });
    historyReplay.moveIndex++;
    updateHistoryBoard();
}

function historyStepBack() {
    if (!historyReplay || !historyReplay.entry || historyReplay.moveIndex <= 0) return;
    historyReplay.game.undo();
    historyReplay.moveIndex--;
    updateHistoryBoard();
}

function startHistoryPlayback() {
    if (!historyReplay || !historyReplay.entry || historyReplay.moves.length === 0 || historyReplay.isPlaying) return;
    historyReplay.isPlaying = true;
    updateHistoryControls();
    historyReplay.timer = setInterval(() => {
        if (historyReplay.moveIndex >= historyReplay.moves.length) {
            stopHistoryPlayback();
            return;
        }
        historyStepForward();
    }, 900);
}

function stopTvPlayback() {
    if (tvReplay && tvReplay.timer) {
        clearInterval(tvReplay.timer);
        tvReplay.timer = null;
    }
    if (tvReplay) tvReplay.isPlaying = false;
    updateTvControls();
}

function updateTvControls() {
    const playBtn = $('#tv-play');
    const pauseBtn = $('#tv-pause');
    const prevBtn = $('#tv-prev');
    const nextBtn = $('#tv-next');
    const hintBtn = $('#tv-hint');
    const hasEntry = tvReplay && tvReplay.moves;
    const movesCount = hasEntry ? tvReplay.moves.length : 0;
    const atStart = !hasEntry || tvReplay.moveIndex === 0;
    const atEnd = !hasEntry || tvReplay.moveIndex >= movesCount;

    const lockedByPuzzle = tvJeroglyphicsActive || tvJeroglyphicsAnalyzing || tvJeroglyphicsIncorrect;

    playBtn.prop('disabled', !hasEntry || movesCount === 0 || tvReplay.isPlaying || atEnd || lockedByPuzzle);
    pauseBtn.prop('disabled', !hasEntry || !tvReplay.isPlaying || lockedByPuzzle);
    prevBtn.prop('disabled', !hasEntry || atStart || tvReplay.isPlaying || lockedByPuzzle);
    nextBtn.prop('disabled', !hasEntry || atEnd || tvReplay.isPlaying || lockedByPuzzle);
     hintBtn.prop('disabled', !tvJeroglyphicsActive || tvJeroglyphicsSolved);
    updateTvBoardInteractivity();  
    updateTvEndActions();
}

function updateTvProgress() {
    const progress = $('#tv-progress');
    if (!tvReplay || !tvReplay.moves) {
        progress.text('0/0');
        return;
    }
    progress.text(`${tvReplay.moveIndex}/${tvReplay.moves.length}`);
}

function updateTvEndActions() {
    const actions = $('#tv-end-actions');
    if (!tvReplay || !tvReplay.moves || tvReplay.moves.length === 0) {
        actions.hide();
        return;
    }
    const atEnd = tvReplay.moveIndex >= tvReplay.moves.length;
    if (atEnd && !tvReplay.isPlaying) actions.show();
    else actions.hide();
}

function updateTvBoard() {
    if (!tvBoard || !tvReplay || !tvReplay.game) return;
    tvBoard.position(tvReplay.game.fen(), false);
    resizeTvBoardToViewport();
    clearTvHintHighlight();   
    updateTvProgress();
    updateTvControls();
    updateTvJeroglyphicsUI();
}

function initTvBoard() {
    if (tvBoard) return;
    const boardEl = document.getElementById('tv-board');
    if (!boardEl) return;
    tvBoard = Chessboard('tv-board', {
        draggable: true,
        position: 'start',
        onDragStart: tvOnDragStart,
        onDrop: tvOnDrop,
        onSnapEnd: tvOnSnapEnd,      
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
    resizeTvBoardToViewport();
    updateTvBoardInteractivity();
}

function updateTvBoardInteractivity() {
    if (!tvBoard) return;
    const shouldUseTap = tvJeroglyphicsActive && deviceType === 'mobile' && controlMode === 'tap' && isTouchDevice();
    tvBoard.draggable = !shouldUseTap;
    if (shouldUseTap) {
        enableTvTapToMove();
    } else {
        disableTvTapToMove();
    }
}

function clearTvHintHighlight() {
    $('#tv-board .square-55d63').removeClass('highlight-hint');
}

function highlightTvHintSquare(square) {
    clearTvHintHighlight();
    if (!square) return;
    $(`#tv-board .square-55d63[data-square='${square}']`).addClass('highlight-hint');
}

function tvOnDragStart(source, piece) {
    if (!tvJeroglyphicsActive || tvJeroglyphicsAnalyzing || tvJeroglyphicsSolved || tvJeroglyphicsIncorrect) return false;
    if (!tvReplay || !tvReplay.game) return false;
    if ((tvReplay.game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (tvReplay.game.turn() === 'b' && piece.search(/^w/) !== -1)) return false;
}

function tvOnDrop(source, target) {
    if (!tvJeroglyphicsActive || tvJeroglyphicsSolved || !tvReplay || !tvReplay.game) return 'snapback';
    clearTvHintHighlight();
    const testGame = new Chess(tvReplay.game.fen());
    const move = testGame.move({ from: source, to: target, promotion: 'q' });
    if (!move) return 'snapback';
    const uciBase = move.from + move.to;
    const uci = uciBase + (move.promotion ? move.promotion : '');
    const accepted = tvJeroglyphicsTopMoves.filter(Boolean);
    const ok = accepted.length > 0 && accepted.some(candidate => (
        candidate === uci || candidate === uciBase || candidate.startsWith(uciBase)
    ));
    if (ok) {
        setTvStatus('Correcte! Pots continuar la partida.');
        tvJeroglyphicsSolved = true;
        tvJeroglyphicsIncorrect = false;
        tvJeroglyphicsAnalyzing = false;
        updateTvJeroglyphicsUI();
        updateTvControls()
    } else {
        setTvStatus('Incorrecte. Torna-ho a provar.');
        tvJeroglyphicsIncorrect = true;
        updateTvJeroglyphicsUI();
        updateTvControls();
    }
    return 'snapback';
}

function tvOnSnapEnd() {
    if (!tvBoard || !tvReplay || !tvReplay.game) return;
    tvBoard.position(tvReplay.game.fen(), false);
}

function setTvStatus(message, isError = false) {
    const status = $('#tv-status');
    status.text(message || '');
    status.css('color', isError ? 'var(--severity-high)' : 'var(--text-secondary)');
}

function getTvJeroglyphicsTurnLabel() {
    if (!tvReplay || !tvReplay.game) return '';
    return tvReplay.game.turn() === 'w' ? 'Juguen Blanques' : 'Juguen Negres';
}

function updateTvJeroglyphicsUI() {
    const turnEl = $('#tv-jeroglyphics-turn');
    const overlayEl = $('#tv-jeroglyphics-overlay');
    const correctEl = $('#tv-jeroglyphics-result-correct');
    const incorrectEl = $('#tv-jeroglyphics-result-incorrect');
    if (turnEl.length) {
        if (tvJeroglyphicsActive) {
            turnEl.text(getTvJeroglyphicsTurnLabel());
            turnEl.show();
        } else {
            turnEl.hide();
        }
    }
    if (overlayEl.length) {
        const showOverlay = tvJeroglyphicsActive && (tvJeroglyphicsSolved || tvJeroglyphicsIncorrect);
        overlayEl.toggle(showOverlay);
        correctEl.toggle(!!tvJeroglyphicsSolved);
        incorrectEl.toggle(!!tvJeroglyphicsIncorrect);
    }
}

function updateTvDetails(entry) {
    const resultEl = $('#tv-result');
    const metaEl = $('#tv-meta');
    const eloEl = $('#tv-elo');
    const whiteEl = $('#tv-white-player');
    const blackEl = $('#tv-black-player');
    if (!entry) {
        resultEl.text('—');
        metaEl.text('Sense dades.');
        eloEl.text('—');
        whiteEl.text('—');
        blackEl.text('—');
        return;
    }
    resultEl.text(`${entry.white} vs ${entry.black}`);
    metaEl.text(`${entry.event} · ${entry.date}`);
    eloEl.text(`${entry.whiteElo} vs ${entry.blackElo}`);
    whiteEl.text(entry.white || '—');
    blackEl.text(entry.black || '—');
}

function resetTvJeroglyphicsState() {
    tvJeroglyphicsActive = false;
    tvJeroglyphicsAnalyzing = false;
    tvJeroglyphicsHinting = false;
    tvJeroglyphicsTopMoves = [];
    tvJeroglyphicsPvMoves = {};
    tvJeroglyphicsTargetIndex = null;
    tvJeroglyphicsActualMove = null;
    tvJeroglyphicsResumePlayback = false;
    tvJeroglyphicsSolved = false;
    tvJeroglyphicsIncorrect = false;
    clearTvHintHighlight();
    updateTvJeroglyphicsUI();
}

async function fetchTvPgn(entry) {
    if (!entry) return '';
    if (entry.pgnUrl) {
        try {
            const response = await fetch(entry.pgnUrl, {
                headers: { 'Accept': 'application/x-chess-pgn' }
            });
            if (!response.ok) throw new Error('PGN fetch failed');
            const text = await response.text();
            const trimmed = text.trim();
            if (trimmed) return trimmed;
        } catch (err) {
            // Fall through to embedded PGN if available.
        }
    }
    return entry.pgnText ? entry.pgnText.trim() : '';
}

function shuffleArray(items) {
    const list = items.slice();
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function formatTvDate(date = new Date()) {
    return date.toISOString().slice(0, 10).replace(/-/g, '.');
}

function normalizeTvPlayerName(player, fallback) {
    if (!player) return fallback;
    if (player.user) return player.user.name || player.user.id || fallback;
    return player.name || player.id || player.username || fallback;
}

function normalizeTvElo(player) {
    if (!player) return '—';
    return player.rating || player.elo || '—';
}

function extractTvGameFromPayload(payload) {
    if (!payload) return null;
    if (payload.gameId || payload.id) return payload;
    if (payload.featured) return payload.featured;
    if (payload.current) return payload.current;
    if (payload.game) return payload.game;
    if (payload.channels && typeof payload.channels === 'object') {
        const candidates = Object.values(payload.channels);
        for (const candidate of candidates) {
            if (!candidate) continue;
            if (candidate.gameId || candidate.id) return candidate;
            if (candidate.game) return candidate.game;
        }
    }
    return null;
}

let cachedTopPlayers = null;
let topPlayersCacheTime = 0;
const TOP_PLAYERS_CACHE_MS = 3600000;

async function getTopPlayers() {
    const now = Date.now();
    if (cachedTopPlayers && (now - topPlayersCacheTime) < TOP_PLAYERS_CACHE_MS) {
        return cachedTopPlayers;
    }

    const categories = ['classical', 'rapid', 'blitz'];
    const allUsers = new Set();

    for (const cat of categories) {
        try {
            const response = await fetch(`https://lichess.org/api/player/top/30/${cat}`);
            if (!response.ok) continue;
            const data = await response.json();
            const users = data.users || [];
            users.forEach(u => allUsers.add(u.username));
        } catch (err) {}
    }

    if (allUsers.size > 0) {
        cachedTopPlayers = Array.from(allUsers);
        topPlayersCacheTime = now;
    }

    return cachedTopPlayers || ['DrNykterstein', 'penguingim1', 'Fins0', 'lance5500', 'opperwezen'];
}

async function fetchMastersGame() {
    const fen = MASTERS_OPENINGS[Math.floor(Math.random() * MASTERS_OPENINGS.length)];

    try {
        const response = await fetch(
            `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&topGames=15`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!response.ok) return null;

        const data = await response.json();
        const topGames = data.topGames || [];
        if (!topGames.length) return null;

        const game = topGames[Math.floor(Math.random() * topGames.length)];
        if (!game.id) return null;

        const pgnResponse = await fetch(
            `https://lichess.org/game/export/${game.id}`,
            { headers: { 'Accept': 'application/x-chess-pgn' } }
        );
        if (!pgnResponse.ok) return null;

        const pgnText = await pgnResponse.text();
        if (!pgnText || pgnText.trim().length < 50) return null;

        return {
            id: `masters-${game.id}`,
            white: game.white?.name || 'Blanques',
            black: game.black?.name || 'Negres',
            whiteElo: game.white?.rating || '—',
            blackElo: game.black?.rating || '—',
            event: 'Masters Database',
            date: game.year ? `${game.year}` : '—',
            result: game.winner === 'white' ? '1-0' : game.winner === 'black' ? '0-1' : '1/2-1/2',
            pgnText: pgnText.trim()
        };
    } catch (err) {
        console.warn('fetchMastersGame error:', err);
        return null;
    }
}

async function fetchTopPlayerGame() {
    const topPlayers = await getTopPlayers();
    const user = topPlayers[Math.floor(Math.random() * topPlayers.length)];
    
    try {
        const response = await fetch(
            `https://lichess.org/api/games/user/${user}?max=50&finished=true&perfType=blitz,rapid,classical&clocks=false&evals=false`,
            {
                headers: { 'Accept': 'application/x-chess-pgn' },
                cache: 'no-store'
            }
        );
        if (!response.ok) return null;
        
        const allPgn = await response.text();
        if (!allPgn || allPgn.trim().length < 50) return null;
        
        const games = allPgn.split(/\n(?=\[Event )/).filter(g => g.trim().length > 100);
        if (!games.length) return null;
        
        const validGames = games.filter(pgn => {
            const result = pgn.match(/\[Result\s+"([^"]+)"\]/);
            if (!result || result[1] === '*') return false;
            const moves = pgn.split(/\d+\.\s/).length - 1;
            return moves >= 20;
        });

        if (!validGames.length) return null;
        const pgnText = validGames[Math.floor(Math.random() * validGames.length)];
        
        const getHeader = (name) => {
            const match = pgnText.match(new RegExp(`\\[${name}\\s+"([^"]+)"\\]`));
            return match ? match[1] : null;
        };
        
        const gameId = getHeader('Site')?.split('/').pop() || `lichess-${Date.now()}`;
        const result = getHeader('Result');
        
        if (!result || result === '*') return null;
        
        return {
            id: `lichess-${gameId}`,
            white: getHeader('White') || 'Blanques',
            black: getHeader('Black') || 'Negres',
            whiteElo: getHeader('WhiteElo') || '—',
            blackElo: getHeader('BlackElo') || '—',
            event: getHeader('Event') || 'Lichess',
            date: getHeader('UTCDate') || getHeader('Date') || formatTvDate(),
            result: result,
            pgnText: pgnText.trim()
        };

    } catch (err) {
        console.warn('fetchTopPlayerGame error:', err);
        return null;
    }
}

async function fetchLichessDbGameByElo(targetElo) {
    const fen = MASTERS_OPENINGS[Math.floor(Math.random() * MASTERS_OPENINGS.length)];
    const rating = mapEloToLichessRating(targetElo);
    const speed = TV_LICHESS_SPEEDS[Math.floor(Math.random() * TV_LICHESS_SPEEDS.length)];

    try {
        const response = await fetch(
            `https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}&topGames=15&ratings=${rating}&speeds=${speed}`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!response.ok) return null;

        const data = await response.json();
        const topGames = data.topGames || [];
        if (!topGames.length) return null;

        const game = topGames[Math.floor(Math.random() * topGames.length)];
        if (!game.id) return null;

        const pgnResponse = await fetch(
            `https://lichess.org/game/export/${game.id}`,
            { headers: { 'Accept': 'application/x-chess-pgn' } }
        );
        if (!pgnResponse.ok) return null;

        const pgnText = await pgnResponse.text();
        if (!pgnText || pgnText.trim().length < 50) return null;

        const whiteName = game.white?.name || 'Blanques';
        const blackName = game.black?.name || 'Negres';

        return {
            id: `lichess-db-${game.id}`,
            white: whiteName,
            black: blackName,
            whiteElo: game.white?.rating || rating || '—',
            blackElo: game.black?.rating || rating || '—',
            event: `Lichess ${speed}`,
            date: game.year ? `${game.year}` : formatTvDate(),
            result: game.winner === 'white' ? '1-0' : game.winner === 'black' ? '0-1' : '1/2-1/2',
            pgnText: pgnText.trim()
        };
    } catch (err) {
        console.warn('fetchLichessDbGameByElo error:', err);
        return null;
    }
}

async function loadTvGame(entry) {
    if (!entry) return;
    stopTvPlayback();
    resetTvJeroglyphicsState();      
    initTvBoard();  
    setTvStatus('Carregant partida...');
    const rawPgnText = await fetchTvPgn(entry);
    let pgnText = selectTvPgn(rawPgnText);
    let pgnGame = new Chess();
    let loaded = pgnGame.load_pgn(pgnText, { sloppy: true });
    if (!loaded && entry.pgnText) {
        const fallbackText = selectTvPgn(entry.pgnText);
        pgnGame = new Chess();
        loaded = pgnGame.load_pgn(fallbackText, { sloppy: true });
        if (loaded) pgnText = fallbackText;
    }
    if (!loaded) {
        tvReplay = null;
        updateTvDetails(null);
        updateTvProgress();
        updateTvControls();
        setTvStatus('No s’ha pogut carregar la partida.', true);
       return false;
    }
      const header = pgnGame.header ? pgnGame.header() : {};
    const result = header && header.Result ? header.Result : '*';
    const termination = header && header.Termination ? String(header.Termination).toLowerCase() : '';
    const normalizedPgn = pgnText.trim();
    const endMatch = normalizedPgn.match(/(1-0|0-1|1\/2-1\/2|\*)\s*$/);
    const endToken = endMatch ? endMatch[1] : null;
    const isOngoing = result === '*'
        || termination.includes('unterminated')
        || termination.includes('abandoned')
        || !endToken
        || endToken !== result;
    if (isOngoing) {
        tvReplay = null;
        updateTvDetails(null);
        updateTvProgress();
        updateTvControls();
        setTvStatus('Partida inacabada. Buscant-ne una de completa...', true);
        return false;
    }
    const moves = pgnGame.history();
    if (moves.length < MIN_TV_MOVES) {
        tvReplay = null;
        updateTvDetails(null);
        updateTvProgress();
        updateTvControls();
        setTvStatus('Partida massa curta per TV.', true);
        return false;
    }
    tvReplay = {
        data: entry,
        game: new Chess(),
        moves: moves,
        moveIndex: 0,
        timer: null,
        isPlaying: false
    };
    updateTvDetails(entry);
    updateTvBoard();
    setTvStatus(`Partida carregada · ${moves.length} jugades.`);
    return true;
}

function splitTvPgnBlocks(pgnText) {
    if (!pgnText) return [];
    const normalized = pgnText.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];
    const blocks = normalized.split(/\n(?=\[Event\s)/g);
    return blocks.map(block => block.trim()).filter(Boolean);
}

function selectTvPgn(pgnText) {
    if (!pgnText) return '';
    const blocks = splitTvPgnBlocks(pgnText);
    if (!blocks.length) return pgnText.trim();
    if (blocks.length === 1) return blocks[0];
    let best = blocks[0];
    let bestMoves = -1;
    blocks.forEach(block => {
        const game = new Chess();
        if (!game.load_pgn(block, { sloppy: true })) return;
        const count = game.history().length;
        if (count > bestMoves) {
            bestMoves = count;
            best = block;
        }
    });
    return best;
}

function pickRandomTvGame() {
    if (!TV_FALLBACK_POOL.length) return null;
    if (!tvReplay || !tvReplay.data) return TV_FALLBACK_POOL[randInt(0, TV_FALLBACK_POOL.length - 1)];
    const currentId = tvReplay.data.id;
    const options = TV_FALLBACK_POOL.filter(entry => entry.id !== currentId);
    if (!options.length) return TV_FALLBACK_POOL[0];
    return options[randInt(0, options.length - 1)];
}

async function loadRandomTvGame() {
    randomizeTvElo();
    const dynamicEntry = await fetchLichessDbGameByElo(tvSelectedElo);
    if (dynamicEntry) {
        lastTvDynamicId = dynamicEntry.id;
        const ok = await loadTvGame(dynamicEntry);
        if (ok) return;
    }
    const attempts = TV_FALLBACK_POOL.length || 1;
    for (let i = 0; i < attempts; i++) {
        const next = pickRandomTvGame();
        const ok = await loadTvGame(next);
        if (ok) return;
    }
}

function shouldTriggerTvJeroglyphics() {
    if (!tvJeroglyphicsEnabled || tvJeroglyphicsActive || tvJeroglyphicsAnalyzing) return false;
    if (!tvReplay || !tvReplay.moves) return false;
    const moveIndex = tvReplay.moveIndex || 0;
    if (moveIndex < TV_JEROGLYPHICS_START) return false;
    if ((moveIndex - TV_JEROGLYPHICS_START) % TV_JEROGLYPHICS_INTERVAL !== 0) return false;
    const remaining = tvReplay.moves.length - moveIndex;
    return remaining > TV_JEROGLYPHICS_END_BUFFER;
}

function startTvJeroglyphics(resumePlayback) {
    if (!tvReplay || !tvReplay.game) return;
    if (!stockfish && !ensureStockfish()) {
        setTvStatus('Motor Stockfish no disponible.', true);
        return;
    }
    tvJeroglyphicsActive = true;
    tvJeroglyphicsAnalyzing = true;
    tvJeroglyphicsHinting = false;
    tvJeroglyphicsTopMoves = [];
    tvJeroglyphicsPvMoves = {};
    tvJeroglyphicsTargetIndex = tvReplay.moveIndex;
    tvJeroglyphicsActualMove = tvReplay.moves[tvReplay.moveIndex] || null;
    tvJeroglyphicsResumePlayback = !!resumePlayback;
    tvJeroglyphicsSolved = false;
    tvJeroglyphicsIncorrect = false;
    clearTvHintHighlight();
    stopTvPlayback();
    setTvStatus('Jeroglífic: buscant la millor jugada...');
    updateTvControls();
    updateTvJeroglyphicsUI();
    
    try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
    stockfish.postMessage(`position fen ${tvReplay.game.fen()}`);
    stockfish.postMessage('go depth 12');
}

function finishTvJeroglyphics(options = {}) {
    const { advanceMove = true, resumePlayback = tvJeroglyphicsResumePlayback } = options;
    tvJeroglyphicsActive = false;
    tvJeroglyphicsAnalyzing = false;
    tvJeroglyphicsHinting = false;
    tvJeroglyphicsSolved = false;
    tvJeroglyphicsIncorrect = false;
    tvJeroglyphicsResumePlayback = false;
    clearTvHintHighlight();
    try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}

    if (advanceMove && tvReplay && tvReplay.game) {
        const move = tvJeroglyphicsActualMove;
        tvJeroglyphicsActualMove = null;
        if (move) {
            try {
                tvReplay.game.move(move, { sloppy: true });
                tvReplay.moveIndex++;
                updateTvBoard();
            } catch (e) {}
        }
    } else {
        tvJeroglyphicsActualMove = null;
        updateTvControls();
        updateTvJeroglyphicsUI();
    }
    if (resumePlayback && tvReplay && !tvReplay.isPlaying) startTvPlayback();
}

function cancelTvJeroglyphics(message) {
    if (message) setTvStatus(message);
    tvJeroglyphicsResumePlayback = false;
    finishTvJeroglyphics();
}

function requestTvJeroglyphicsHint() {
    if (!tvJeroglyphicsActive || tvJeroglyphicsSolved || tvJeroglyphicsIncorrect || !tvReplay || !tvReplay.game) return;
    if (tvJeroglyphicsAnalyzing) {
        setTvStatus('Esperant la millor jugada...');
        return;
    }
    if (tvJeroglyphicsTopMoves.length > 0) {
        const toSquare = tvJeroglyphicsTopMoves[0].substring(2, 4);
        highlightTvHintSquare(toSquare);
        setTvStatus(`Pista: Alguna peça ha d'anar a ${toSquare}`);
        return;
    }
    if (!stockfish && !ensureStockfish()) {
        setTvStatus('Motor Stockfish no disponible.', true);
        return;
    }
    tvJeroglyphicsHinting = true;
    setTvStatus('Buscant pista...');
    stockfish.postMessage(`position fen ${tvReplay.game.fen()}`);
    stockfish.postMessage('go depth 15');
}

function tvStepForward() {
    if (!tvReplay || !tvReplay.moves || tvReplay.moveIndex >= tvReplay.moves.length) return;
    if (shouldTriggerTvJeroglyphics()) {
        startTvJeroglyphics(tvReplay.isPlaying);
        return;
    }   
    const move = tvReplay.moves[tvReplay.moveIndex];
    tvReplay.game.move(move, { sloppy: true });
    tvReplay.moveIndex++;
    updateTvBoard();
}

function tvStepBack() {
    if (!tvReplay || !tvReplay.moves || tvReplay.moveIndex <= 0) return;
    tvReplay.game.undo();
    tvReplay.moveIndex--;
    updateTvBoard();
}

function startTvPlayback() {
    if (!tvReplay || !tvReplay.moves || tvReplay.moves.length === 0 || tvReplay.isPlaying) return;
    tvReplay.isPlaying = true;
    updateTvControls();
    tvReplay.timer = setInterval(() => {
        if (tvReplay.moveIndex >= tvReplay.moves.length) {
            stopTvPlayback();
            return;
        }
        tvStepForward();
    }, 2000);
}

function resetTvReplay() {
    if (!tvReplay || !tvReplay.moves) return;
    stopTvPlayback();
    resetTvJeroglyphicsState();
    tvReplay.game = new Chess();
    tvReplay.moveIndex = 0;
    updateTvBoard();
}

function renderGameHistory() {
    const container = $('#history-list');
    if (!container.length) return;
    if (!gameHistory.length) {
        container.html('<div class="history-empty">Encara no hi ha partides guardades.</div>');
        historyReplay = null;
        updateHistoryDetails(null);
        return;
    }
    const items = gameHistory
        .slice()
        .reverse()
        .map(entry => {
            const movesCount = getHistoryMoves(entry).length;
            const meta = `${entry.label || '—'} · ${formatHistoryMode(entry.mode)} · ${movesCount} jugades`;
            return `
                <div class="history-item" data-history-id="${entry.id}">
                    <div class="history-item-main">
                        <div class="history-item-title">${entry.result || '—'}</div>
                        <div class="history-item-meta">${meta}</div>
                    </div>
                           <div class="history-item-actions">
                        <button class="btn btn-secondary history-select" data-history-id="${entry.id}">▶️ Veure</button>
                        <button class="btn btn-primary history-review" data-history-id="${entry.id}">📈 Revisió</button>
                    </div>
                </div>
            `;
        })
        .join('');
    container.html(items);
    $('.history-select').off('click').on('click', function() {
        const id = $(this).data('history-id');
        const entry = gameHistory.find(item => item.id === id);
        loadHistoryEntry(entry);
    });
        stopTvPlayback();
    $('.history-review').off('click').on('click', function() {
        const id = $(this).data('history-id');
        const entry = gameHistory.find(item => item.id === id);
        showHistoryReview(entry);
    });
    if (!historyReplay || !historyReplay.entry) {
        loadHistoryEntry(gameHistory[gameHistory.length - 1]);
    }
}

function showHistoryReview(entry) {
    if (!entry) return;
    currentGameErrors = Array.isArray(entry.errors)
        ? entry.errors.map(err => ({
            fen: err.fen,
            severity: err.severity,
            bestMove: err.bestMove || null,
            playerMove: err.playerMove || null,
            bestMovePv: err.bestMovePv || []  // ← AFEGIR AQUEST CAMP
        }))
        : [];
    const msg = entry.result || 'Partida';
    const precision = typeof entry.precision === 'number' ? entry.precision : 0;
    const counts = entry.counts || { excel: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    showPostGameReview(msg, precision, counts, null, { showCheckmate: false });
}

function recordGameHistory(resultLabel, finalPrecision, counts, options = {}) {
    if (blunderMode) return;
    const moves = game.history();
    const now = new Date();
    const entry = {
        id: `game_${now.getTime()}`,
        label: now.toLocaleDateString('ca-ES', { day: '2-digit', month: 'short' }) + ' ' + now.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString(),
        mode: currentGameMode,
        result: resultLabel,
        precision: finalPrecision,
        counts: counts,
        moves: moves,
        errors: currentGameErrors.map(err => ({
            fen: err.fen,
            severity: err.severity,
            bestMove: err.bestMove || null,
            playerMove: err.playerMove || null,
            bestMovePv: err.bestMovePv || []
        })),
        moveReviews: currentReview.map(review => ({
            moveNumber: review.moveNumber,
            quality: review.quality,
            color: review.color,
            swing: review.swing || 0,
            fen: review.fen || null,
            bestMove: review.bestMove || null
        })),
        review: [], // ← BUIDAT: ja no cal guardar review completa
        severeErrors: Array.isArray(options.severeErrors) ? options.severeErrors : [],
        geminiReview: options.geminiReview || null,
        playerColor: playerColor,
        opponent: currentOpponent || null,
        pgn: game.pgn()
    };
    gameHistory.push(entry);
    if (gameHistory.length > 10) gameHistory = gameHistory.slice(-10);
    // Bloc de neteja de reviews eliminat
}

function isOpeningMoveCorrect(quality) {
    return quality === 'excel' || quality === 'good';
}

// Converteix qualitat a precisió aproximada (0-100)
function qualityToPrecision(quality, swing) {
    // Si tenim swing, calcular precisió basada en centipawns perduts
    // Swing 0 = 100%, Swing 100 = ~50%, Swing 200+ = ~0%
    if (typeof swing === 'number' && swing > 0) {
        return Math.max(0, Math.round(100 - (swing / 2)));
    }
    // Fallback basat en qualitat
    switch (quality) {
        case 'excel': return 100;
        case 'good': return 85;
        case 'inaccuracy': return 60;
        case 'mistake': return 35;
        case 'blunder': return 10;
        default: return 50;
    }
}

function buildOpeningMoveStats() {
    const recentEntries = gameHistory
        .slice(-10)
        .filter(entry => Array.isArray(entry.moveReviews) && entry.moveReviews.length);
    const stats = [];
    const colors = [
        { key: 'w', label: 'Blanques' },
        { key: 'b', label: 'Negres' }
    ];

    colors.forEach(color => {
        for (let moveNumber = 1; moveNumber <= 10; moveNumber++) {
            let total = 0;
            let totalPrecision = 0;
            let countBelow75 = 0;
            const errorPositions = []; // Guardar posicions amb error

            recentEntries.forEach(entry => {
                const match = entry.moveReviews.find(review => (
                    review.moveNumber === moveNumber && review.color === color.key
                ));
                if (!match) return;

                total += 1;
                const precision = qualityToPrecision(match.quality, match.swing);
                totalPrecision += precision;

                // Si la precisió és inferior al 75%, guardar l'error
                if (precision < 75) {
                    countBelow75 += 1;
                    // Primer intentar obtenir del moveReview
                    if (match.fen && match.bestMove) {
                        errorPositions.push({
                            fen: match.fen,
                            bestMove: match.bestMove,
                            quality: match.quality
                        });
                    } else if (Array.isArray(entry.errors)) {
                        // Fallback: buscar en entry.errors pel número de moviment
                        for (const err of entry.errors) {
                            if (!err.fen || !err.bestMove) continue;
                            // Extreure moveNum i color del FEN
                            const fenParts = err.fen.split(' ');
                            if (fenParts.length < 6) continue;
                            const fenColor = fenParts[1]; // 'w' o 'b'
                            const fenMoveNum = parseInt(fenParts[5], 10);
                            // El FEN mostra qui ha de moure, que és qui va fer l'error
                            if (fenColor === color.key && fenMoveNum === moveNumber) {
                                errorPositions.push({
                                    fen: err.fen,
                                    bestMove: err.bestMove,
                                    quality: match.quality
                                });
                                break; // Només un error per partida/moviment
                            }
                        }
                    }
                }
            });

            const avgPrecision = total > 0 ? Math.round(totalPrecision / total) : null;

            stats.push({
                moveNumber,
                color: color.label,
                colorKey: color.key,
                total,
                avgPrecision,
                countBelow75,
                errorPositions
            });
        }
    });

    return { stats, totalEntries: recentEntries.length };
}

// Variable global per guardar estadístiques d'obertura
let openingStatsData = [];

function collectAllOpeningErrorPositions() {
    const positions = [];
    openingStatsData.forEach(stat => {
        if (!Array.isArray(stat.errorPositions)) return;
        stat.errorPositions.forEach(position => {
            positions.push({
                ...position,
                colorKey: stat.colorKey,
                moveNumber: stat.moveNumber
            });
        });
    });
    return positions;
}

function renderOpeningStatsScreen(useExistingData = false) {
    const listEl = $('#opening-stats-list');
    const noteEl = $('#opening-stats-note');
    if (!listEl.length) return;

    let stats, totalEntries;
    if (useExistingData && openingStatsData && openingStatsData.length > 0) {
        // Usar dades existents (actualitzades després de pràctica)
        stats = openingStatsData;
        totalEntries = stats.reduce((max, s) => Math.max(max, s.total), 0);
    } else {
        // Reconstruir des de gameHistory
        const result = buildOpeningMoveStats();
        stats = result.stats;
        totalEntries = result.totalEntries;
        openingStatsData = stats;
    }

    // Separar per color
    const whiteStats = stats.filter(s => s.colorKey === 'w');
    const blackStats = stats.filter(s => s.colorKey === 'b');

    let html = `
        <div class="opening-stats-header" style="font-weight:600; margin-bottom:8px;">
            <span>Mov.</span>
            <span>Precisió</span>
            <span>Errors</span>
        </div>
        <div style="font-weight:600; color:var(--text-secondary); margin:10px 0 5px; font-size:0.85em;">♔ Blanques</div>
    `;

    whiteStats.forEach((item, idx) => {
        const precisionClass = item.avgPrecision !== null && item.avgPrecision < 75 ? 'color:var(--severity-med)' : '';
        const hasErrors = item.countBelow75 > 0;
        const errorDisplay = hasErrors
            ? `<span class="move-link" data-color="w" data-move="${item.moveNumber}">${item.countBelow75}</span>`
            : item.total > 0 ? '<span class="move-link-disabled">0</span>' : '—';
        html += `
            <div class="opening-stats-row">
                <div class="move-cell">${item.moveNumber}</div>
                <div style="${precisionClass}">${item.avgPrecision === null ? '—' : `${item.avgPrecision}%`}</div>
                <div>${errorDisplay}</div>
            </div>
        `;
    });

    html += `<div style="font-weight:600; color:var(--text-secondary); margin:15px 0 5px; font-size:0.85em;">♚ Negres</div>`;

    blackStats.forEach((item, idx) => {
        const precisionClass = item.avgPrecision !== null && item.avgPrecision < 75 ? 'color:var(--severity-med)' : '';
        const hasErrors = item.countBelow75 > 0;
        const errorDisplay = hasErrors
            ? `<span class="move-link" data-color="b" data-move="${item.moveNumber}">${item.countBelow75}</span>`
            : item.total > 0 ? '<span class="move-link-disabled">0</span>' : '—';
        html += `
            <div class="opening-stats-row">
                <div class="move-cell">${item.moveNumber}</div>
                <div style="${precisionClass}">${item.avgPrecision === null ? '—' : `${item.avgPrecision}%`}</div>
                <div>${errorDisplay}</div>
            </div>
        `;
    });

    listEl.html(html);

    // Afegir handlers de clic amb event delegation
    listEl.off('click', '.move-link').on('click', '.move-link', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const color = $(this).attr('data-color');
        const moveNum = parseInt($(this).attr('data-move'), 10);
        startOpeningErrorPractice(color, moveNum);
    });

    if (noteEl.length) {
        noteEl.text(totalEntries > 0 ? `Basat en les últimes ${totalEntries} partides.` : '—');
    }
}

// Inicia la pràctica d'un error d'obertura
function startOpeningErrorPractice(color, moveNum) {
    // Buscar les posicions d'error per aquest color i moviment
    const stat = openingStatsData.find(s => s.colorKey === color && s.moveNumber === moveNum);

    if (!stat || !stat.errorPositions || stat.errorPositions.length === 0) {
        alert('No hi ha posicions disponibles per practicar.\n\nLes partides antigues no tenen aquesta informació. Juga noves partides per poder practicar els errors.');
        return;
    }

    openingErrorPracticeActive = true;
    openingErrorCurrentPositions = stat.errorPositions.map(position => ({
        ...position,
        colorKey: stat.colorKey,
        moveNumber: stat.moveNumber
    }));
    console.log('[StartPractice] Posicions inicials:', openingErrorCurrentPositions.length);
    openingErrorColorFilter = color;
    openingErrorMoveFilter = moveNum;
    openingErrorMovesRemaining = 2; // Dues jugades per resoldre

    // Seleccionar un error aleatori
    loadRandomOpeningError();
}

function loadRandomOpeningError() {
    if (openingErrorCurrentPositions.length === 0) {
        showOpeningErrorSuccessOverlay(true); // No en queden
        return;
    }

    // Seleccionar aleatori
    const idx = Math.floor(Math.random() * openingErrorCurrentPositions.length);
    const error = openingErrorCurrentPositions[idx];

    openingErrorCurrentIndex = idx; // Guardar índex per eliminar després
    openingErrorCurrentFen = error.fen;
    openingErrorBestMove = error.bestMove;
    openingPracticeBestMove = error.bestMove; // Per a la pista
    if (error.colorKey) {
        openingErrorColorFilter = error.colorKey;
    }
    if (error.moveNumber) {
        openingErrorMoveFilter = error.moveNumber;
    }
    openingErrorMovesRemaining = 2; // Reset a 2 jugades

    // Inicialitzar el tauler d'obertures amb la posició
    if (!openingBundleBoard) {
        initOpeningBundleBoard();
    }

    openingPracticeGame = new Chess(error.fen);
    openingPracticeMoveCount = 0;
    openingPracticeEngineThinking = false;
    openingPracticeGoodMoves = 0;
    openingPracticeTotalMoves = 0;

    // Determinar orientació segons el torn
    const turn = openingPracticeGame.turn();
    openingBundleBoard.orientation(turn === 'w' ? 'white' : 'black');
    openingBundleBoard.position(error.fen);

    // Amagar secció d'estadístiques, mostrar tauler
    $('.opening-section').first().hide();
    $('.opening-section').last().show();

    // Forçar redimensionament del tauler per assegurar visualització
    setTimeout(() => {
        if (openingBundleBoard && typeof openingBundleBoard.resize === 'function') {
            openingBundleBoard.resize();
        }
    }, 100);

    // Scroll al tauler
    const boardEl = document.getElementById('opening-board');
    if (boardEl) {
        boardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Actualitzar nota
    const noteEl = document.getElementById('opening-practice-note');
    if (noteEl) {
        noteEl.innerHTML = `<div style="padding:8px; background:rgba(201,162,39,0.15); border-radius:8px;">Practica l'error del moviment ${openingErrorMoveFilter} (${openingErrorColorFilter === 'w' ? 'blanques' : 'negres'}) - 2 jugades</div>`;
    }

    updateOpeningPrecisionDisplay();
    clearOpeningMoveVisualFeedback();
}

function handleOpeningErrorSuccess() {
    openingErrorMovesRemaining -= 1;

    // Si queden jugades, fer que l'oponent respongui
    if (openingErrorMovesRemaining > 0) {
        // Demanar moviment de Stockfish per l'oponent
        requestOpeningErrorOpponentMove();
        return;
    }

    // Treure la posició resolta de la llista per índex
    console.log('[ErrorSuccess] Abans splice:', openingErrorCurrentPositions.length, 'index:', openingErrorCurrentIndex);
    if (openingErrorCurrentIndex >= 0 && openingErrorCurrentIndex < openingErrorCurrentPositions.length) {
        openingErrorCurrentPositions.splice(openingErrorCurrentIndex, 1);
    }
    console.log('[ErrorSuccess] Després splice:', openingErrorCurrentPositions.length);

    // Actualitzar també openingStatsData per reflectir l'error resolt
    if (openingErrorColorFilter && openingErrorMoveFilter) {
        const stat = openingStatsData.find(s =>
            s.colorKey === openingErrorColorFilter && s.moveNumber === openingErrorMoveFilter
        );
        if (stat && stat.errorPositions && stat.errorPositions.length > 0) {
            // Eliminar la posició resolta dels stats
            if (openingErrorCurrentFen) {
                stat.errorPositions = stat.errorPositions.filter(p => p.fen !== openingErrorCurrentFen);
            } else if (stat.errorPositions.length > 0) {
                stat.errorPositions.shift(); // Eliminar el primer si no tenim FEN
            }
            stat.countBelow75 = stat.errorPositions.length;
        }
    }

    openingErrorCurrentFen = null;
    openingErrorBestMove = null;
    openingErrorCurrentIndex = -1;

    showOpeningErrorSuccessOverlay(false);
}

// Recull tots els errors d'obertura disponibles de tots els moviments/colors
function getAllOpeningErrors() {
    const allErrors = [];
    if (!openingStatsData) return allErrors;

    for (const stat of openingStatsData) {
        if (stat.errorPositions && stat.errorPositions.length > 0) {
            for (const pos of stat.errorPositions) {
                allErrors.push({
                    ...pos,
                    colorKey: stat.colorKey,
                    moveNumber: stat.moveNumber
                });
            }
        }
    }
    return allErrors;
}

function requestOpeningErrorOpponentMove() {
    if (!openingPracticeGame || openingPracticeGame.game_over()) {
        // Si la partida ha acabat, completar
        openingErrorMovesRemaining = 0;
        handleOpeningErrorSuccess();
        return;
    }

    // Utilitzar Stockfish per obtenir el millor moviment de l'oponent
    if (!stockfish && !ensureStockfish()) {
        // Si no hi ha Stockfish, fer moviment aleatori
        const moves = openingPracticeGame.moves();
        if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            openingPracticeGame.move(randomMove);
            openingBundleBoard.position(openingPracticeGame.fen());
            // Obtenir el nou millor moviment per l'usuari
            requestOpeningErrorBestMoveForUser();
        }
        return;
    }

    openingPracticeEngineThinking = true;
    stockfishRequestor = 'opening-error-opponent';
    try {
        stockfish.postMessage('stop');
        stockfish.postMessage('ucinewgame');
        stockfish.postMessage('position fen ' + openingPracticeGame.fen());
        stockfish.postMessage('go depth 10');
    } catch (e) {
        openingPracticeEngineThinking = false;
    }
}

function requestOpeningErrorBestMoveForUser() {
    if (!stockfish && !ensureStockfish()) {
        openingErrorBestMove = null;
        openingPracticeBestMove = null;
        return;
    }

    stockfishRequestor = 'opening-error-bestmove';
    try {
        stockfish.postMessage('stop');
        stockfish.postMessage('position fen ' + openingPracticeGame.fen());
        stockfish.postMessage('go depth 12');
    } catch (e) {}
}

function showOpeningErrorSuccessOverlay(noMore) {
    const overlay = $('#opening-error-success-overlay');
    if (!overlay.length) {
        exitOpeningErrorPractice();
        return;
    }

    const remaining = collectAllOpeningErrorPositions().length;
    const allErrors = getAllOpeningErrors();
    const globalRemaining = allErrors.length;
    const showAgainBtn = (remaining > 0 || globalRemaining > 0) && !noMore;
    console.log('[Overlay] remaining:', remaining, 'globalRemaining:', globalRemaining, 'noMore:', noMore, 'showBtn:', showAgainBtn);

    // Mostrar missatge adequat
    let message;
    if (noMore || globalRemaining === 0) {
        message = 'Has resolt tots els errors!';
    } else if (remaining > 0) {
        message = `${remaining} error${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`;
    } else {
        message = `${globalRemaining} error${globalRemaining > 1 ? 's' : ''} d'altres moviments`;
    }
    $('#opening-error-remaining').text(message);

    // Mostrar/amagar botó segons si queden errors
    const btnAgain = document.getElementById('btn-opening-error-again');
    console.log('[Overlay] btnAgain element:', btnAgain);
    if (btnAgain) {
        btnAgain.style.display = showAgainBtn ? 'inline-block' : 'none';
        console.log('[Overlay] btnAgain.style.display:', btnAgain.style.display);
    }

    overlay.css('display', 'flex');

    // Event handlers
    const btnHome = document.getElementById('btn-opening-error-home');
    if (btnHome) {
        btnHome.onclick = function() {
            overlay.hide();
            exitOpeningErrorPractice();
        };
    }

    if (btnAgain) {
        btnAgain.onclick = function() {
            overlay.hide();
            openingErrorCurrentPositions = collectAllOpeningErrorPositions();
            if (openingErrorCurrentPositions.length > 0) {
                // Encara queden del filtre actual
                $('.opening-section').first().hide();
                $('.opening-section').last().show();
                openingErrorMovesRemaining = 2;
                loadRandomOpeningError();
            } else {
                // Canviar a errors globals
                const allErrors = getAllOpeningErrors();
                if (allErrors.length > 0) {
                    // Seleccionar un aleatori de tots
                    const idx = Math.floor(Math.random() * allErrors.length);
                    const error = allErrors[idx];
                    // Actualitzar filtres al nou error
                    openingErrorColorFilter = error.colorKey;
                    openingErrorMoveFilter = error.moveNumber;
                    // Carregar totes les posicions d'aquest nou filtre
                    const stat = openingStatsData.find(s =>
                        s.colorKey === error.colorKey && s.moveNumber === error.moveNumber
                    );
                    if (stat && stat.errorPositions) {
                        openingErrorCurrentPositions = [...stat.errorPositions];
                    }
                    $('.opening-section').first().hide();
                    $('.opening-section').last().show();
                    openingErrorMovesRemaining = 2;
                    loadRandomOpeningError();
                } else {
                    exitOpeningErrorPractice();
                }
            }
        };
    }
}

function exitOpeningErrorPractice() {
    openingErrorPracticeActive = false;
    openingErrorCurrentPositions = [];
    openingErrorCurrentFen = null;
    openingErrorBestMove = null;

    // Mostrar secció d'estadístiques, amagar tauler
    $('.opening-section').first().show();
    $('.opening-section').last().hide();

    // Tornar a renderitzar estadístiques amb dades actualitzades
    renderOpeningStatsScreen(true);

    // Reset tauler
    resetOpeningPracticeBoard();
}

function initOpeningBundleBoard() {
    if (openingBundleBoard) return;
    const boardEl = document.getElementById('opening-board');
    if (!boardEl) return;
    openingPracticeGame = new Chess();
    openingPracticeMoveCount = 0;
    openingBundleBoard = Chessboard('opening-board', {
        draggable: (controlMode === 'drag'),
        position: 'start',
        onDragStart: (source, piece) => {
            if (!openingPracticeGame || openingPracticeGame.game_over()) return false;
            if (openingPracticeMoveCount >= OPENING_PRACTICE_MAX_PLIES) return false;
            if (openingPracticeEngineThinking) return false;
            if (openingPracticeGame.turn() === 'w' && piece.search(/^b/) !== -1) return false;
            if (openingPracticeGame.turn() === 'b' && piece.search(/^w/) !== -1) return false;
        },
        onDrop: (source, target) => {
            if (!openingPracticeGame) return 'snapback';

            // Mode pràctica d'errors
            if (openingErrorPracticeActive) {
                const move = openingPracticeGame.move({ from: source, to: target, promotion: 'q' });
                if (!move) return 'snapback';

                const moveUci = source + target;
                clearOpeningHintHighlight();

                // Comprovar si és el moviment correcte
                if (openingErrorBestMove && moveUci === openingErrorBestMove.substring(0, 4)) {
                    // Correcte!
                    showOpeningMoveVisualFeedback(source, target, 'correct');
                    openingPracticeGoodMoves++;
                    openingPracticeTotalMoves++;
                    updateOpeningPrecisionDisplay(true);
                    setTimeout(() => handleOpeningErrorSuccess(), 800);
                } else {
                    // Incorrecte
                    showOpeningMoveVisualFeedback(source, target, 'incorrect');
                    openingPracticeTotalMoves++;
                    updateOpeningPrecisionDisplay(true);
                    // Desfer el moviment
                    setTimeout(() => {
                        openingPracticeGame.undo();
                        openingBundleBoard.position(openingPracticeGame.fen());
                        clearOpeningMoveVisualFeedback();
                    }, 600);
                }
                return;
            }

            if (openingPracticeMoveCount >= OPENING_PRACTICE_MAX_PLIES) return 'snapback';

            // Guardar estat per poder desfer
            saveOpeningPracticeState();

            const wasWhiteTurn = openingPracticeGame.turn() === 'w';

            const move = openingPracticeGame.move({ from: source, to: target, promotion: 'q' });
            if (!move) {
                // Moviment invàlid, treure l'estat guardat
                openingPracticeHistory.pop();
                return 'snapback';
            }

            // Obtenir moviment en format SAN per al sistema d'obertures
            const movePlayed = move.san;

            // Netejar pista visual i estat
            clearOpeningHintHighlight();
            openingPracticeBestMove = null;
            openingPracticeMoveCount += 1;
            updateOpeningPracticeStatus();

            // Determinar si cal moviment de l'engine
            const needsEngineMove = openingPracticeMoveCount < OPENING_PRACTICE_MAX_PLIES &&
                                   !openingPracticeGame.game_over() &&
                                   openingPracticeGame.turn() === 'b';

            // FLUX: Primer precisió, després moviment de l'engine
            if (wasWhiteTurn) {
                handleOpeningUserMove(movePlayed, source, target, needsEngineMove);
            } else if (needsEngineMove) {
                // Si no era torn de l'usuari però cal engine, demanar-lo directament
                setTimeout(() => requestOpeningPracticeEngineMove(), 300);
            }
        },
        onSnapEnd: () => {
            if (!openingPracticeGame) return;
            openingBundleBoard.position(openingPracticeGame.fen());
        },
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
    updateOpeningPracticeStatus();
    updateOpeningPrecisionDisplay();
    updateOpeningUndoButton();
    if (typeof openingBundleBoard.resize === 'function') openingBundleBoard.resize();

    // Aplicar mode de control tàctil
    if (controlMode === 'tap') {
        enableOpeningTapToMove();
    }

    // Pre-calcular el millor moviment per al primer torn de l'usuari
    setTimeout(() => preCalculateOpeningBestMove(), 500);
}

function updateOpeningPracticeStatus() {
    const noteEl = document.getElementById('opening-practice-note');
    if (!noteEl) return;
    const remaining = Math.max(OPENING_PRACTICE_MAX_PLIES - openingPracticeMoveCount, 0);
    if (!openingPracticeGame) {
        noteEl.textContent = '—';
        return;
    }
    if (openingPracticeGame.game_over()) {
        noteEl.textContent = 'Partida finalitzada.';
        return;
    }
    if (remaining === 0) {
        noteEl.textContent = 'Límit de 10 moviments assolit.';
        return;
    }
    // No mostrar res per defecte - l'usuari pot prémer el botó Gemini per informació
    noteEl.textContent = '—';
}

// Guardar estat per undo (només un moviment)
function saveOpeningPracticeState() {
    if (!openingPracticeGame) return;
    // Només guardem l'últim estat (limitat a un sol undo)
    openingPracticeHistory = [{
        fen: openingPracticeGame.fen(),
        moveCount: openingPracticeMoveCount,
        goodMoves: openingPracticeGoodMoves,
        totalMoves: openingPracticeTotalMoves,
        openingSequence: [...openingCurrentSequence] // Guardar seqüència d'obertures
    }];
    updateOpeningUndoButton();
}

// Actualitzar estat del botó undo
function updateOpeningUndoButton() {
    const btn = document.getElementById('btn-opening-undo');
    if (!btn) return;
    // Deshabilitar si no hi ha historial o l'engine està pensant
    const canUndo = openingPracticeHistory.length > 0 && !openingPracticeEngineThinking;
    btn.disabled = !canUndo;
}

// Desfer el darrer moviment de l'usuari (limitat a un sol undo)
function undoOpeningPracticeMove() {
    if (!openingPracticeGame || openingPracticeHistory.length === 0) return;
    if (openingPracticeEngineThinking) return;

    // Recuperar i esborrar l'estat guardat (només permet un undo)
    const lastState = openingPracticeHistory.pop();

    // Restaurar l'estat del joc
    openingPracticeGame.load(lastState.fen);
    openingPracticeMoveCount = lastState.moveCount;
    openingPracticeGoodMoves = lastState.goodMoves;
    openingPracticeTotalMoves = lastState.totalMoves;
    // Restaurar seqüència d'obertures
    openingCurrentSequence = lastState.openingSequence ? [...lastState.openingSequence] : [];

    // Cancel·lar qualsevol anàlisi de precisió pendent
    openingPracticeAnalysisPending = false;
    openingPracticePendingAnalysis = null;
    openingPracticeLastFen = null;
    openingPracticeLastMove = null;
    // Cancel·lar també les noves variables d'anàlisi en dos passos
    openingAnalysisStep = 0;
    openingFenAfterMove = null;
    openingTempScore = null;
    openingEvalBefore = null;
    openingEvalAfter = null;
    openingBestMove = null;

    // Cancel·lar pista pendent
    openingPracticeHintPending = false;
    openingPracticeBestMove = null;

    // Cancel·lar màxima pendent (evitar que s'actualitzi després de l'undo)
    openingMaximPending = false;

    // Cancel·lar variables de feedback instantani
    openingPreCalcBestMove = null;
    openingPreCalcPending = false;
    openingPreCalcFen = null;
    openingLastMoveQuality = null;
    // Cancel·lar variables de callback precisió-engine
    openingPendingUserMove = null;
    openingNeedsEngineMove = false;
    // Cancel·lar token de Stockfish (evitar conflictes amb peticions anteriors)
    stockfishRequestor = null;

    // Netejar seleccions i pistes visuals
    clearOpeningTapSelection();
    clearOpeningHintHighlight();
    clearOpeningMoveVisualFeedback();

    // Actualitzar el tauler
    if (openingBundleBoard) {
        openingBundleBoard.position(openingPracticeGame.fen());
    }

    // Actualitzar UI
    updateOpeningPracticeStatus();
    updateOpeningPrecisionDisplay();
    updateOpeningUndoButton();

    // Missatge
    const noteEl = document.getElementById('opening-practice-note');
    if (noteEl) {
        noteEl.textContent = 'Moviment desfet. Torna a intentar-ho!';
    }

    // Pre-calcular el millor moviment per a la posició restaurada
    setTimeout(() => preCalculateOpeningBestMove(), 200);
}

function resetOpeningPracticeBoard() {
    openingPracticeGame = new Chess();
    openingPracticeMoveCount = 0;
    openingPracticeEngineThinking = false;
    openingMaximPending = false;
    lastOpeningMaxim = null;
    openingPracticeHintPending = false;
    openingPracticeBestMove = null;
    // Reset precisió
    openingPracticeGoodMoves = 0;
    openingPracticeTotalMoves = 0;
    openingPracticeAnalysisPending = false;
    openingPracticeLastFen = null;
    openingPracticeLastMove = null;
    openingPracticePendingAnalysis = null;
    // Reset variables d'anàlisi en dos passos
    openingAnalysisStep = 0;
    openingFenAfterMove = null;
    openingTempScore = null;
    openingEvalBefore = null;
    openingEvalAfter = null;
    openingBestMove = null;
    // Reset variables de feedback instantani
    openingPreCalcBestMove = null;
    openingPreCalcPending = false;
    openingPreCalcFen = null;
    openingLastMoveQuality = null;
    // Reset variables de callback precisió-engine
    openingPendingUserMove = null;
    openingNeedsEngineMove = false;
    // Reset token de Stockfish
    stockfishRequestor = null;
    openingPracticeHistory = []; // Reset historial per undo
    // Reset seqüència d'obertures
    openingCurrentSequence = [];
    openingMatchedOpenings = [];
    openingSelectedOpening = null;
    openingNextMoveHint = null;
    clearOpeningTapSelection();
    clearOpeningHintHighlight();
    clearOpeningMoveVisualFeedback();
    if (openingBundleBoard) {
        openingBundleBoard.position('start');
        if (typeof openingBundleBoard.resize === 'function') openingBundleBoard.resize();
    }
    updateOpeningPracticeStatus();
    updateOpeningPrecisionDisplay();
    updateOpeningUndoButton();
    // Pre-calcular el millor moviment per al primer torn de l'usuari
    setTimeout(() => preCalculateOpeningBestMove(), 300);
}

function requestOpeningPracticeEngineMove() {
    if (!openingPracticeGame || openingPracticeGame.game_over()) return;
    if (openingPracticeMoveCount >= OPENING_PRACTICE_MAX_PLIES) return;
    if (!stockfish && !ensureStockfish()) return;
    openingPracticeEngineThinking = true;
    updateOpeningUndoButton(); // Deshabilitar undo mentre l'engine pensa
    stockfishRequestor = 'opening-engine';
    try { stockfish.postMessage('setoption name UCI_LimitStrength value false'); } catch (e) {}
    try { stockfish.postMessage('setoption name Skill Level value 20'); } catch (e) {}
    try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
    stockfish.postMessage(`position fen ${openingPracticeGame.fen()}`);
    stockfish.postMessage('go depth 12');
}

function checkShareSupport() {
    if ((navigator.canShare && navigator.share) || supportsDirectoryPicker()) $('#btn-smart-share').show();
}

function guardCalibrationAccess() {
    if (!isCalibrationRequired()) return true;
    alert('Has de completar el calibratge inicial abans de jugar aquest mode.');
    return false;
}

function novaPartida() {
    currentGameMode = 'free';
    currentOpponent = null;
    if (leagueActiveMatch) { leagueActiveMatch = null; saveStorage(); }
    startGame(false);
}

function setupEvents() {
    checkShareSupport();
    $('#btn-new-game').click(() => {
        novaPartida();
    });

    $('#league-banner').on('click', () => { if (guardCalibrationAccess()) startLeagueRound(); });
    $('#btn-league-banner-play').on('click', (e) => { e.stopPropagation(); if (guardCalibrationAccess()) startLeagueRound(); });

    $('#btn-badges').click(() => { updateBadgesModal(); $('#badges-modal').css('display', 'flex'); });
    
    $('#btn-stats').click(() => { $('#start-screen').hide(); $('#stats-screen').show(); updateStatsDisplay(); });
    $('#btn-history').click(() => {
        $('#start-screen').hide();
        $('#history-screen').show();
        initHistoryBoard();
        renderGameHistory();
    });
    $('#btn-league').click(() => { if (guardCalibrationAccess()) openLeague(); });
    $('#btn-back-league').click(() => { $('#league-screen').hide(); $('#start-screen').show(); });
    $('#btn-league-new').click(() => { if (guardCalibrationAccess()) { createNewLeague(true); openLeague(); } });
    $('#btn-league-play').click(() => { if (guardCalibrationAccess()) startLeagueRound(); });
    $('#btn-opening').click(() => {
        renderOpeningStatsScreen();
        initOpeningBundleBoard();
        resetOpeningPracticeBoard();
        $('#start-screen').hide();
        $('#opening-screen').show();
        if (openingBundleBoard && typeof openingBundleBoard.resize === 'function') {
            setTimeout(() => openingBundleBoard.resize(), 50);
        }
    });
    $('#btn-back-opening').click(() => {
        $('#opening-screen').hide();
        $('#start-screen').show();
    });
    $('#btn-opening-bundle-menu').click(() => {
        $('#opening-screen').hide();
        $('#start-screen').show();
    });
    $('#btn-opening-bundle-hint').click(() => {
        if (!openingPracticeGame || openingPracticeGame.game_over()) return;
        if (openingPracticeEngineThinking || openingPracticeHintPending) {
            const noteEl = document.getElementById('opening-practice-note');
            if (noteEl) noteEl.innerHTML = '<div style="padding:8px; background:rgba(255,200,100,0.2); border-radius:8px;">⏳ Espera que l\'engine acabi...</div>';
            return;
        }

        // PRIMER: Intentar usar la pista de l'obertura seleccionada
        const openingHint = getOpeningHint();
        if (openingHint) {
            highlightOpeningHint(openingHint.from, openingHint.to);
            const noteEl = document.getElementById('opening-practice-note');
            if (noteEl) {
                const openingInfo = openingHint.openingName
                    ? `<br><small style="opacity:0.8">📖 ${openingHint.openingName}</small>`
                    : '';
                noteEl.innerHTML = `<div style="padding:12px; background:rgba(76,175,80,0.15); border-left:3px solid var(--accent-green); border-radius:8px;">
                    <strong>💡 Pista d'obertura:</strong> <strong>${openingHint.move}</strong> (${openingHint.from} → ${openingHint.to})${openingInfo}
                </div>`;
            }
            console.log(`[OpeningHint] Pista d'obertura: ${openingHint.move} (${openingHint.openingName || 'sense nom'})`);
            return;
        }

        // SEGON: Si ja tenim la millor jugada calculada per Stockfish, mostrar-la
        if (openingPracticeBestMove && openingPracticeBestMove.length >= 4) {
            const fromSquare = openingPracticeBestMove.substring(0, 2);
            const toSquare = openingPracticeBestMove.substring(2, 4);
            highlightOpeningHint(fromSquare, toSquare);
            const noteEl = document.getElementById('opening-practice-note');
            if (noteEl) {
                noteEl.innerHTML = `<div style="padding:12px; background:rgba(156,39,176,0.15); border-left:3px solid var(--accent-purple); border-radius:8px;">
                    <strong>💡 Pista (Stockfish):</strong> Mou de <strong>${fromSquare}</strong> a <strong>${toSquare}</strong>
                </div>`;
            }
            return;
        }

        // TERCER: Calcular amb Stockfish
        if (!stockfish && !ensureStockfish()) {
            const noteEl = document.getElementById('opening-practice-note');
            if (noteEl) noteEl.innerHTML = '<div style="padding:8px; background:rgba(255,100,100,0.2); border-radius:8px;">❌ Stockfish no disponible</div>';
            return;
        }

        openingPracticeHintPending = true;
        const noteEl = document.getElementById('opening-practice-note');
        if (noteEl) noteEl.innerHTML = '<div style="padding:8px; background:rgba(100,100,255,0.15); border-radius:8px;">🔍 Calculant millor jugada...</div>';

        stockfishRequestor = 'opening-hint';
        try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
        stockfish.postMessage(`position fen ${openingPracticeGame.fen()}`);
        stockfish.postMessage('go depth 12');
    });
    $('#btn-opening-bundle-maxim').click(() => {
        void requestOpeningMaximLlull();
    });
    $('#btn-opening-bundle-resign').click(() => {
        resetOpeningPracticeBoard();
    });
    $('#btn-opening-undo').click(() => {
        undoOpeningPracticeMove();
    });

    $('#btn-reset-league').click(() => {
        if (!guardCalibrationAccess()) return;
        if (!isLeagueUnlocked()) {
            alert(`La lliga s'activa després de ${LEAGUE_UNLOCK_MIN_GAMES} partides un cop calibrat.`);
            return;
        }
        const ok = confirm("Vols reiniciar la lliga actual? Se'n crearà una de nova segons el teu ELO actual.");
        if (!ok) return;
        createNewLeague(true);
        updateLeagueBanner();
        alert('Lliga reiniciada.');
    });

    $('#btn-back-stats').click(() => {
        stopHistoryPlayback();
        $('#stats-screen').hide();
        $('#start-screen').show();
    });
    $('#btn-back-history').click(() => {
        stopHistoryPlayback();
        $('#history-screen').hide();
        $('#start-screen').show();
    });
    $('#btn-calibration-continue').click(() => {
        $('#calibration-result-screen').hide();
        $('#start-screen').show();
        updateDisplay();
    });

    $('#btn-recalibrate').click(() => {
        if (!confirm("Això resetarà el teu perfil actual. Vols continuar?")) return;
        userELO = 50;
        currentElo = clampEngineElo(ADAPTIVE_CONFIG.DEFAULT_LEVEL);
        aiDifficulty = levelToDifficulty(currentElo);
        recentGames = [];
        consecutiveWins = 0;
        consecutiveLosses = 0;
        eloHistory = [];
        calibrationGames = [];
        calibrationProfile = null;
        freeAdjustmentWindow = [];
        adjustmentLog = [];
        freeLossStreak = 0;
        calibrationRocFloor = null;
        unlockedEloMilestones = [];
        lastAdjustmentQualityAvg = null;
        isCalibrating = true;
        calibratgeComplet = false;
        currentCalibrationOpponentRoc = null;
        saveStorage();
        updateDisplay();
        alert('Calibratge reiniciat. Comença la nova seqüència de 5 partides.');
    });
    
    $('#history-play').off('click').on('click', () => { startHistoryPlayback(); });
    $('#history-pause').off('click').on('click', () => { stopHistoryPlayback(); });
    $('#history-prev').off('click').on('click', () => { historyStepBack(); });
    $('#history-next').off('click').on('click', () => { historyStepForward(); });
    $('#history-generate-review').off('click').on('click', () => {
        if (!historyReplay || !historyReplay.entry) return;
        const severeErrors = getEntrySevereErrors(historyReplay.entry);
        void requestGeminiReview(historyReplay.entry, severeErrors);
    });
    $('#result-indicator').off('click').on('click', () => {
        if (!lastReviewSnapshot) return;
        showPostGameReview(
            lastReviewSnapshot.msg,
            lastReviewSnapshot.finalPrecision,
            lastReviewSnapshot.counts,
            null,
            { showCheckmate: lastReviewSnapshot.showCheckmate }
        );
    });

    $('#control-mode-select').off('change').on('change', function() {
        const mode = $(this).val();
        const shouldRebuild = $('#game-screen').is(':visible');
        applyControlMode(mode, { save: true, rebuild: shouldRebuild });
    });

    // Mode de validació del Bundle (Revisió d'errors)
    $('#bundle-accept-select').off('change').on('change', function() {
        saveBundleAcceptMode($(this).val());
    });

    $('#btn-save-gemini-key').off('click').on('click', () => {
        const input = document.getElementById('gemini-key-input');
        if (!input) return;
        const ok = saveGeminiApiKey(input.value);
        if (ok) {
            input.value = '';
            alert('Clau de Gemini guardada.');
        } else {
            alert('Introdueix una clau vàlida.');
        }
    });

    $('#epaper-toggle').off('change').on('change', function() {
        applyEpaperMode($(this).is(':checked'));
    });

    $('#btn-show-delete').click(() => { $('#confirm-delete-panel').slideDown(); });
    $('#btn-cancel-delete').click(() => { $('#confirm-delete-panel').slideUp(); });
    
    $('#btn-confirm-delete').click(() => {
        if (confirm('Estàs completament segur? Aquesta acció NO es pot desfer i perdràs TOTES les teves dades.')) {
            localStorage.clear();
            saveEpaperPreference(epaperEnabled);
            applyControlMode(getDefaultControlMode(), { save: true, rebuild: false });
            userELO = 50; savedErrors = []; currentStreak = 0; lastPracticeDate = null;
            todayCompleted = false; totalStars = 0; todayMissions = []; missionsDate = null; unlockedBadges = [];
            sessionStats = { 
                gamesPlayed: 0, gamesWon: 0, bundlesSolved: 0, 
                bundlesSolvedLow: 0, bundlesSolvedMed: 0, bundlesSolvedHigh: 0,
                highPrecisionGames: 0, perfectGames: 0, blackWins: 0,
                leagueGamesPlayed: 0, freeGamesPlayed: 0
            };
            eloHistory = []; totalGamesPlayed = 0; totalWins = 0; maxStreak = 0;
            currentElo = clampEngineElo(userELO);
            aiDifficulty = levelToDifficulty(currentElo); recentGames = []; consecutiveWins = 0; consecutiveLosses = 0;
            isCalibrating = true; calibrationGames = []; calibrationProfile = null; calibratgeComplet = false;
            currentLeague = null; leagueActiveMatch = null;
            reviewHistory = []; currentReview = []; gameHistory = [];
            geminiApiKey = null;
            saveStorage(); generateDailyMissions(); updateDisplay();
            $('#stats-screen').hide(); $('#start-screen').show(); $('#confirm-delete-panel').hide();
            alert('Totes les dades han estat esborrades. Comença de nou!');
        }
    });
    
    $('#btn-hint').click(() => {
    if (game.game_over()) return;
    
    // En mode bundle, usar la jugada pre-calculada
    if (blunderMode && bundleFixedSequence) {
        const step = bundleSequenceStep;
        const expectedMove = step === 1 
            ? bundleFixedSequence.step1.playerMove 
            : bundleFixedSequence.step2.playerMove;
        if (expectedMove && expectedMove.length >= 4) {
            const toSquare = expectedMove.substring(2, 4);
            $('.square-55d63').removeClass('highlight-hint');
            $(`#myBoard .square-55d63[data-square='${toSquare}']`).addClass('highlight-hint');
            $('#status').text(`Pista: Alguna peça ha d'anar a ${toSquare}`);
        }
        return;
    }
    
    // Comportament normal per partides
    if (!stockfish && !ensureStockfish()) { 
        $('#status').text("Motor Stockfish no disponible").css('color', '#c62828'); 
        return; 
    }
    isAnalyzingHint = true;
    $('#status').text("Buscant objectiu clau...");
    stockfish.postMessage(`position fen ${game.fen()}`);
    stockfish.postMessage('go depth 15');
});

    $('#btn-brain-hint').click(() => {
        void requestGeminiBundleHint();
    });

    $('#btn-smart-share').click(async () => {
   const data = buildBackupData();
        const filename = `eltauler_backup_${totalStars}stars.json`;
        if (supportsDirectoryPicker()) {
            const savedFile = await writeBackupToDirectory(data, filename, { forceDirectorySelection: true });
            if (savedFile) {
                alert('Backup guardat a la carpeta seleccionada.');
            }
        }
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'El Tauler - Progrés', text: `ELO: ${userELO} | ★${totalStars}` }); } 
            catch (e) { console.log('Cancel·lat'); }
        }
    });

    $('#btn-export').click(() => {
             const data = buildBackupData({ includeGameHistory: true });
        const filename = `eltauler_backup_${totalStars}stars.json`;
        if (supportsDirectoryPicker()) {
            writeBackupToDirectory(data, filename, { prompt: false })
                .then((savedFile) => {
                    if (savedFile) {
                        alert('Backup guardat a la carpeta seleccionada.');
                        return;
                    }
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
                    URL.revokeObjectURL(url);
                })
                .catch(() => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
                    URL.revokeObjectURL(url);
                });
            return;
        }        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    });

      $('#btn-import').click(async () => {
        const file = await importBackupFromPicker();
        if (file) {
            await handleBackupImportFile(file);
            return;
        }
        $('#file-input').click();
    });
    $('#file-input').change(async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await handleBackupImportFile(file);
    });

    // Click per desfer
    $('#blunder-alert').click(() => {
        if (engineMoveTimeout) clearTimeout(engineMoveTimeout);

        if (game && game.game_over()) {
            if (lastReviewSnapshot) {
                showPostGameReview(
                    lastReviewSnapshot.msg,
                    lastReviewSnapshot.finalPrecision,
                    lastReviewSnapshot.counts,
                    null,
                    { showCheckmate: lastReviewSnapshot.showCheckmate }
                );
            }
            $('#blunder-alert').hide();
            return;
        }
        
        const targetFen = lastPosition || null;
        if (targetFen) {
            game.load(targetFen);
        } else {
            game.undo();
        }

        board.position(game.fen());
        $('#blunder-alert').hide();

        $('.square-55d63').removeClass('highlight-hint tap-selected tap-move');
        clearEngineMoveHighlights();
        clearTapSelection();

        if (blunderMode && currentBundleFen) {
            $('#status').text("Prova una altra jugada");
        } else {
            $('#status').text("Rectifica... (+0)");
            waitingForBlunderAnalysis = false;
            pendingMoveEvaluation = false;
        }
    });

     const showMenuExitModal = () => {
        const message = leagueActiveMatch
            ? "Sortir de la partida de lliga? Comptarà com a derrota."
            : "Vols sortir de la partida?";
        $('#menu-exit-message').text(message);
        $('#menu-exit-modal').css('display', 'flex');
    };

    const hideMenuExitModal = () => {
        $('#menu-exit-modal').hide();
    };

    $('#btn-back').click(() => {
       showMenuExitModal();
    });

    const showResignModal = () => {
        // No permetre rendir-se si el joc ja ha acabat
        if (!game || game.game_over()) return;
        $('#resign-modal').css('display', 'flex');
    };

    const hideResignModal = () => {
        $('#resign-modal').hide();
    };

    $('#btn-resign').click(() => {
        showResignModal();
    });

    $('#btn-resign-confirm').click(() => {
        hideResignModal();
        handleGameOver(true);
    });

    $('#btn-resign-cancel').click(() => {
        hideResignModal();
    });

    $('#resign-modal').click((event) => {
        if (event.target.id === 'resign-modal') {
            hideResignModal();
        }
    });

    $('#btn-menu-exit-confirm').click(() => {
        hideMenuExitModal();
        if (leagueActiveMatch) {
            handleGameOver(true);
            return;
        }
        $('#game-screen').removeClass('active').hide();
        $('#start-screen').show();
        if (stockfish) stockfish.postMessage('stop');
    });

    $('#btn-menu-exit-cancel').click(() => {
        hideMenuExitModal();
    });

    $('#menu-exit-modal').click((event) => {
        if (event.target.id === 'menu-exit-modal') {
            hideMenuExitModal();
        }
    });

    $('#btn-bundle-menu').click(() => {
        if (!guardCalibrationAccess()) return;
        showBundleMenu();
    });
}

function showBundleMenu() {
    if (savedErrors.length === 0) { alert('No tens errors guardats'); return; }

    $('#bundle-modal').remove();

    const groups = { low: [], med: [], high: [] };
    savedErrors.forEach((err, idx) => {
        const sev = (err.severity === 'med' || err.severity === 'high' || err.severity === 'low') ? err.severity : 'low';
        groups[sev].push({ err, idx });
    });

    const sectionMeta = {
        low: { title: 'Groc · Lleus', sev: 'low' },
        med: { title: 'Taronja · Mitjans', sev: 'med' },
        high: { title: 'Vermell · Greus', sev: 'high' }
    };

    let html = '<div class="modal-overlay" id="bundle-modal" style="display:flex;"><div class="modal-content">';
    html += '<div class="modal-title">📚 Errors Guardats</div>';
    html += '<button class="btn btn-primary" id="btn-bundle-random" style="margin:0 0 12px 0;">🎲 Resoldre bundle aleatori</button>';
    html += '<div class="bundle-folder-list">';

    ['high', 'med', 'low'].forEach((sevKey) => {
        const meta = sectionMeta[sevKey];
        const count = groups[sevKey].length;

        html += `<div class="bundle-section ${meta.sev}">`;
        html += '<div class="bundle-section-header">';
        html += `<div class="bundle-section-title">${meta.title}</div>`;
        html += `<div class="bundle-section-count"><span>${count}</span><span class="bundle-section-caret">▾</span></div>`;
        html += '</div>';

        html += '<div class="bundle-section-content">';
        if (count === 0) {
            html += '<div class="bundle-empty">Cap bundle en aquesta carpeta</div>';
        } else {
            html += '<div class="bundle-list">';
            groups[sevKey].forEach(({ err, idx }) => {
                const severityClass = err.severity;
                const severityLabel = err.severity === 'low' ? 'Lleu' : err.severity === 'med' ? 'Mitjà' : 'Greu';
                html += `<div class="bundle-item ${severityClass}" data-idx="${idx}" data-severity="${severityClass}">`;
                html += `<div><strong>${severityLabel}</strong><div class="bundle-meta">${err.date} • ELO: <span class="bundle-elo">${err.elo || '?'}</span></div></div>`;
                html += `<div class="bundle-remove" onclick="event.stopPropagation(); removeBundle(${idx})">🗑️</div>`;
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>'; 
        html += '</div>'; 
    });

    html += '</div>'; 
    html += '<button class="close-modal" onclick="$(\'#bundle-modal\').remove()">Tancar</button></div></div>';
    $('body').append(html);

    $('#bundle-modal .bundle-section-header').off('click').on('click', function() {
        $(this).closest('.bundle-section').toggleClass('open');
    });

    $('#bundle-modal .bundle-item').off('click').on('click', function() {
        const idx = Number(this.dataset.idx);
        const entry = savedErrors[idx];
        if (!entry) return;
        startSelectedBundleGame(entry);
    });
 
    $('#btn-bundle-random').off('click').on('click', () => {
        startRandomBundleGame();
    });
}

function removeBundle(idx) {
    if (confirm('Esborrar aquest error?')) {
        savedErrors.splice(idx, 1); saveStorage(); updateDisplay();
        $('#bundle-modal').remove(); if (savedErrors.length > 0) showBundleMenu();
    }
}

window.startBundleGame = function(fen, severity = null) {
    isRandomBundleSession = false;
    isMatchErrorReviewSession = false;
    matchErrorQueue = [];
    currentMatchError = null;
    currentBundleSource = 'category';
    currentBundleSeverity = (severity === 'low' || severity === 'med' || severity === 'high') ? severity : null;
    $('#bundle-modal').remove(); currentGameMode = 'bundle';
    currentOpponent = null;
    startGame(true, fen);
};

function startRandomBundleGame() {
    if (savedErrors.length === 0) { alert('No tens errors guardats'); return false; }
    const choice = savedErrors[Math.floor(Math.random() * savedErrors.length)];
    isRandomBundleSession = true;
    isMatchErrorReviewSession = false;
    matchErrorQueue = [];
    currentMatchError = null;
    currentBundleSource = 'random';
    currentBundleSeverity = null;  
    $('#bundle-modal').remove();
    currentGameMode = 'bundle';
    currentOpponent = null;
    startGame(true, choice.fen);
    return true;
}

function startSelectedBundleGame(entry) {
    if (!entry || !entry.fen) return false;
    isRandomBundleSession = true;
    isMatchErrorReviewSession = false;
    matchErrorQueue = [];
    currentMatchError = null;
    currentBundleSource = 'manual';
    currentBundleSeverity = null;
    $('#bundle-modal').remove();
    currentGameMode = 'bundle';
    currentOpponent = null;
    startGame(true, entry.fen);
    return true;
}

function startMatchErrorReview() {
    if (currentGameErrors.length === 0) {
        alert('No hi ha errors per revisar en aquesta partida.');
        return;
    }
    isRandomBundleSession = false;
    matchErrorQueue = currentGameErrors.slice();
    isMatchErrorReviewSession = true;
    currentMatchError = null;
    currentBundleSource = 'match';
    currentBundleSeverity = null;   
    launchNextMatchError();
}

function scrollToMatchErrorReview() {
    const boardEl = document.getElementById('myBoard');
    const target = boardEl || document.getElementById('game-screen');
    if (!target || typeof target.scrollIntoView !== 'function') return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function launchNextMatchError() {
    if (matchErrorQueue.length === 0) {
        endMatchErrorReviewSession();
        return;
    }
    currentMatchError = matchErrorQueue.shift();
    startGame(true, currentMatchError.fen);
}

function endMatchErrorReviewSession() {
    isMatchErrorReviewSession = false;
    matchErrorQueue = [];
    currentMatchError = null;
    $('#match-error-success-overlay').hide();
    returnToMainMenuImmediate();
}

function showMatchErrorReviewOverlay(remaining, noMore) {
    const overlay = $('#match-error-success-overlay');
    if (!overlay.length) {
        if (remaining > 0) {
            const wantsMore = confirm(`Vols revisar un altre error? En queden ${remaining}.`);
            if (wantsMore) {
                launchNextMatchError();
            } else {
                endMatchErrorReviewSession();
            }
        } else {
            alert('Ja has revisat tots els errors de la partida.');
            endMatchErrorReviewSession();
        }
        return;
    }

    $('#match-error-remaining').text(
        noMore ? 'Has revisat tots els errors!' :
        remaining > 0 ? `${remaining} error${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}` :
        'No en queden més!'
    );

    const btnAgain = document.getElementById('btn-match-error-again');
    if (btnAgain) {
        btnAgain.style.display = remaining > 0 && !noMore ? 'inline-block' : 'none';
    }

    overlay.css('display', 'flex');

    const btnHome = document.getElementById('btn-match-error-home');
    if (btnHome) {
        btnHome.onclick = function() {
            overlay.hide();
            endMatchErrorReviewSession();
        };
    }

    if (btnAgain) {
        btnAgain.onclick = function() {
            overlay.hide();
            launchNextMatchError();
        };
    }
}

function promptMatchErrorNext() {
    const remaining = matchErrorQueue.length;
    showMatchErrorReviewOverlay(remaining, remaining === 0);
}

async function startGame(isBundle, fen = null) {  // ← AFEGIR async
    currentReview = [];
    lastReviewSnapshot = null;
    setResultIndicator(null);
    $('#btn-resign').prop('disabled', false);
    const checkmateImage = $('#checkmate-image');
    if (checkmateImage.length) checkmateImage.hide();
        if (!isBundle) {
        currentGameErrors = [];
        matchErrorQueue = [];
        currentMatchError = null;
        isMatchErrorReviewSession = false;
        currentBundleSource = null;
        currentBundleSeverity = null;
        }
    applyControlMode(loadControlMode(), { save: false, rebuild: false });
    $('#bundle-success-overlay').hide();
    $('#bundle-category-success-overlay').hide(); 
    $('#match-error-success-overlay').hide();
    if (!isBundle) isRandomBundleSession = false;
    
    $('#start-screen').hide();
    $('#stats-screen').hide();
    $('#league-screen').hide();
    $('#history-screen').hide();
    $('#calibration-result-screen').hide();
    $('#game-screen').addClass('active').show();
    
blunderMode = isBundle; 
    isCalibrationGame = isCalibrationActive() && !isBundle;
    currentBundleFen = fen;
    
    // ✅ CALCULAR SEQÜÈNCIA FIXA PER BUNDLES
    bundleFixedSequence = null;
    if (isBundle && fen) {
        $('#status').text("Preparant exercici...").css('color', 'var(--accent-cream)');
        bundleFixedSequence = await prepareBundleSequence(fen);
        
        if (!bundleFixedSequence) {
            alert("No s'ha pogut preparar l'exercici. Es retornarà al menú.");
            returnToMainMenuImmediate();
            return;
        }
        
        // Guardar seqüència per validació
        bundleStrictPvLine = bundleFixedSequence.fullSequence;
    }
    
    lastHumanMoveUci = null;
    isBundleStrictAnalysis = false;
    bundleBestMove = null;
    bundlePvMoves = {};
    bundlePvLines = {};
    bundleStrictPvLine = [];
    bundleStrictPvDepth = 0;
    bundleSequenceStep = 1;
    bundleSequenceStartFen = fen || null;
    bundleStepStartFen = fen || null;
    bundleAutoReplyPending = false;
    bundleGeminiHintPending = false;
    if (isBundle) { bundleAcceptMode = loadBundleAcceptMode(); }

    totalPlayerMoves = 0; 
    goodMoves = 0;
    totalEngineMoves = 0;
    goodEngineMoves = 0;
    isEngineThinking = false;
    pendingMoveEvaluation = false;
    currentGameStartTs = Date.now();
    
    updatePrecisionDisplay();
    updateAIPrecisionDisplay();
    updateAIPrecisionTarget();
    updateCalibrationProgressUI();
    updateEloDisplay();
    
    game = new Chess(fen || undefined); 
    
    let boardOrientation = 'white';
    
    // LÒGICA DE COLORS
    if (isBundle) {
        playerColor = game.turn();
        boardOrientation = (playerColor === 'w') ? 'white' : 'black';
    } else {
        const isWhite = Math.random() < 0.5;
        playerColor = isWhite ? 'w' : 'b';
        boardOrientation = isWhite ? 'white' : 'black';
    }
    
    if (board) board.destroy();
    board = Chessboard('myBoard', {
        orientation: boardOrientation,
        draggable: (controlMode === 'drag'), 
        position: game.fen(), 
        onDragStart: onDragStart, 
        onDrop: onDrop, 
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    setTimeout(() => { resizeBoardToViewport(); }, 0);
    if (isMatchErrorReviewSession) {
        setTimeout(() => { scrollToMatchErrorReview(); }, 0);
    }
    
    if (controlMode === 'tap') {
        detachDragGuards();
        disableTapToMove(); 
        enableTapToMove();
    } else {
        disableTapToMove();
        attachDragGuards();
        clearTapSelection();
    }

    const engineReady = ensureStockfish();
    if (!engineReady) { $('#status').text("Motor Stockfish no carregat.").css('color', '#c62828'); }
    
    $('#blunder-alert').hide();

    // Lògica de Modes
    if (isCalibrationGame) {
        currentCalibrationOpponentRoc = getCalibrationOpponentRoc();
        aiDifficulty = levelToDifficulty(currentCalibrationOpponentRoc);
        if (engineReady) applyEngineEloStrength(currentCalibrationOpponentRoc);
        $('#engine-elo').text(`ROC ${currentCalibrationOpponentRoc}`);
        $('#game-mode-title').text('🎯 Partida de calibratge');
    } else if (isBundle) {
        currentGameMode = 'bundle';
        currentOpponent = null;
        $('#engine-elo').text('Anàlisi');
        $('#game-mode-title').text(isMatchErrorReviewSession ? '🔍 Errors de la partida' : '📚 Bundle');
    } else if (leagueActiveMatch) {
        currentGameMode = 'league';
        const opp = getLeaguePlayer(leagueActiveMatch.opponentId);
        if (opp) currentOpponent = { id: opp.id, name: opp.name, elo: opp.elo };
        const label = opp ? `${opp.name} (${opp.elo})` : 'Rival de lliga';
        $('#engine-elo').text(label);
        $('#game-mode-title').text(`🏆 Lliga · Jornada ${leagueActiveMatch.round}/9`);
    } else {
        currentGameMode = 'free';
        currentOpponent = null;
        updateAdaptiveEngineEloLabel();
        $('#game-mode-title').text('♟ Nova partida');
        if (engineReady) applyEngineEloStrength(currentElo);
    }
        if (!isCalibrationGame) {
        currentCalibrationOpponentRoc = null;
    }   
    
    $('.square-55d63').removeClass('highlight-hint');
    clearEngineMoveHighlights();
    updateStatus();
    updateBundleHintButtons();
    
    // Forçar actualització visual després de 100ms
    setTimeout(() => {
        updateBundleHintButtons();
        if (blunderMode) {
            const statusEl = $('#status');
            const msg = bundleSequenceStep === 1 
                ? 'Pas 1 de 2: Troba la millor jugada'
                : 'Pas 2 de 2: Completa la seqüència';
            statusEl.text(msg);
        }
    }, 100);
    
    if (playerColor !== game.turn()) {
        pendingEngineFirstMove = true;
        if (stockfishReady) {
            pendingEngineFirstMove = false;
            setTimeout(makeEngineMove, 500);
        }
    } else {
        pendingEngineFirstMove = false;
    }
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over() || isEngineThinking) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) || 
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) return false;
    if (blunderMode && game.turn() !== playerColor) return false;
}

function onDrop(source, target) {
    $('#blunder-alert').hide();
    if (engineMoveTimeout) clearTimeout(engineMoveTimeout);

    $('.square-55d63').removeClass('highlight-hint');
    lastPosition = game.fen(); 
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    clearEngineMoveHighlights();
    lastHumanMoveUci = move.from + move.to + (move.promotion ? move.promotion : '');
    
    totalPlayerMoves++; 
    pendingMoveEvaluation = true; 
    updateStatus();
    
    if (game.game_over()) {
        handleGameOver();
        return;
    }
    
    analyzeMove(); 
}

function onSnapEnd() { board.position(game.fen()); }

function makeEngineMove() {
    if (!stockfish && !ensureStockfish()) return;

    isEngineThinking = true; 
    $('#status').text("L'adversari pensa...");

    const depth = getAIDepth(); 
    const skillLevel = isCalibrationGame ? getCalibrationSkillLevel() : getEngineSkillLevel();
    resetEngineMoveCandidates();

    try { stockfish.postMessage(`setoption name Skill Level value ${skillLevel}`); } catch (e) {}
    const multiPvValue = isCalibrationGame ? 7 : 5;
    try { stockfish.postMessage(`setoption name MultiPV value ${multiPvValue}`); } catch (e) {}
    stockfish.postMessage(`position fen ${game.fen()}`); 
    stockfish.postMessage(`go depth ${depth}`);
}

function chooseFallbackMove(fallbackMove) {
    const effectiveDifficulty = getEffectiveAIDifficulty();
    const normalized = Math.max(0, Math.min(1, (effectiveDifficulty - 5) / 10));
    const mistakeChance = Math.max(0.1, 0.35 - (normalized * 0.25));
    if (Math.random() > mistakeChance) return fallbackMove;
    const legalMoves = game ? game.moves({ verbose: true }) : [];
    if (!legalMoves || legalMoves.length === 0) return fallbackMove;
    const choice = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    return `${choice.from}${choice.to}${choice.promotion || ''}`;
}

function analyzeMove() {
    if (!stockfish && !ensureStockfish()) { setTimeout(makeEngineMove, 300); return; }

    if (blunderMode && (bundleAcceptMode === 'top1' || bundleAcceptMode === 'top2')) {
        const bundleKey = lastPosition || currentBundleFen;
        const cached = bundleKey ? bundleAnswerCache.get(bundleKey) : null;
        if (cached && cached.mode === bundleAcceptMode) {
            const hasTop1 = cached.mode === 'top1' && cached.bestMove;
            const hasTop2 = cached.mode === 'top2' && cached.pvMoves && (cached.pvMoves['1'] || cached.pvMoves['2']);
            if (hasTop1 || hasTop2) {
                evaluateBundleAttempt(cached);
                return;
            }
        }
        isBundleStrictAnalysis = true;
        bundlePvMoves = {};
        bundleBestMove = null;
        bundlePvLines = {};
        bundleStrictPvLine = [];
        bundleStrictPvDepth = 0;
        const multiPvValue = bundleAcceptMode === 'top2' ? 2 : 1;
        stockfish.postMessage(`setoption name MultiPV value ${multiPvValue}`);
        stockfish.postMessage(`position fen ${lastPosition}`);
        stockfish.postMessage('go depth 12');
        return;
    }

    // CANVI: Activar MultiPV i resetejar buffer
    resetEnrichedAnalysisBuffer();
    waitingForBlunderAnalysis = true;
    analysisStep = 1;
    tempAnalysisScore = 0;
    pendingBestMove = null;
    pendingEvalBefore = null;
    pendingEvalAfter = null;
    pendingAnalysisFen = lastPosition;

    // CANVI: Demanar 3 variants per capturar alternatives
    if (DEBUG_ENRICHED_ANALYSIS) {
        console.log('[EnrichedAnalysis] start', {
            waitingForBlunderAnalysis,
            analysisStep,
            fen: lastPosition
        });
        console.log('[EnrichedAnalysis] setoption MultiPV value 3');
    }
    try { stockfish.postMessage('setoption name MultiPV value 3'); } catch (e) {}
    stockfish.postMessage(`position fen ${lastPosition}`);
    stockfish.postMessage('go depth 12');
}

function resolvePendingMoveEvaluation(moveQuality) {
    if (!pendingMoveEvaluation) return;
    if (moveQuality === 'excel' || moveQuality === 'good') {
        goodMoves++;
    }
    pendingMoveEvaluation = false;
    updatePrecisionDisplay();
}

/**
 * Acumula informació UCI durant l'anàlisi.
 * @param {object} info - Resultat de parseUciInfo
 */
function accumulateAnalysisInfo(info) {
    if (!info || info.multipv === undefined) return;

    const key = String(info.multipv);
    
    // Només actualitzar si la profunditat és igual o major
    if (!enrichedAnalysisBuffer[key] || 
        (info.depth && info.depth >= (enrichedAnalysisBuffer[key].depth || 0))) {
        enrichedAnalysisBuffer[key] = {
            depth: info.depth,
            score: info.score,
            scoreType: info.scoreType,
            pv: info.pv,
            move: info.pv[0] || null
        };
    }
}

/**
 * Extreu el resultat final de l'anàlisi acumulada.
 * @returns {object} - { depth, bestMove, bestMovePv, alternatives }
 */
function extractEnrichedAnalysis() {
    const result = {
        depth: null,
        bestMove: null,
        bestMovePv: [],
        alternatives: []
    };

    const pv1 = enrichedAnalysisBuffer['1'];
    if (pv1) {
        result.depth = pv1.depth;
        result.bestMove = pv1.move;
        result.bestMovePv = pv1.pv || [];
    }

    // Afegir alternatives (multipv 2 i 3)
    ['2', '3'].forEach(key => {
        const alt = enrichedAnalysisBuffer[key];
        if (alt && alt.move) {
            let evalCp = alt.score;
            if (alt.scoreType === 'mate') {
                evalCp = alt.score > 0 ? 10000 : -10000;
            }
            result.alternatives.push({
                move: alt.move,
                eval: evalCp,
                pv: alt.pv || []
            });
        }
    });

    return result;
}

/**
 * Reseteja el buffer d'anàlisi enriquida.
 */
function resetEnrichedAnalysisBuffer() {
    enrichedAnalysisBuffer = {};
}

function handleEngineMessage(rawMsg) {
    if (typeof rawMsg !== 'string') return;
    const msg = rawMsg.trim();
    if (msg === 'uciok') {
        try { stockfish.postMessage('isready'); } catch (e) {}
        return;
    }
    if (msg === 'readyok') {
        stockfishReady = true;
        if (pendingEngineFirstMove && playerColor !== game.turn()) {
            pendingEngineFirstMove = false;
            setTimeout(makeEngineMove, 200);
        }
        return;
    }

    // Pre-càlcul del millor moviment per feedback instantani (obertures)
    if (openingPreCalcPending && stockfishRequestor === 'opening-precalc' && msg.indexOf('bestmove') !== -1) {
        stockfishRequestor = null;
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            const bestMove = match[1] + match[2] + (match[3] || '');
            processOpeningPreCalcResult(bestMove);
        } else {
            processOpeningPreCalcResult(null);
        }
        return;
    }

    // Anàlisi de precisió del tauler d'obertures (sistema de dos passos)
    if (openingPracticeAnalysisPending && openingAnalysisStep > 0 && stockfishRequestor === 'opening-analysis' && msg.indexOf('bestmove') !== -1) {
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (openingAnalysisStep === 1) {
            // Pas 1 completat: tenim la posició abans del moviment
            // No netejem stockfishRequestor perquè passem al pas 2
            const bestMove = match ? (match[1] + match[2] + (match[3] || '')) : null;
            processOpeningAnalysisStep1(bestMove);
        } else if (openingAnalysisStep === 2) {
            // Pas 2 completat: tenim la posició després del moviment
            stockfishRequestor = null;
            processOpeningAnalysisStep2();
        }
        return;
    }

    // Pista del tauler d'obertures
    if (openingPracticeHintPending && stockfishRequestor === 'opening-hint' && msg.indexOf('bestmove') !== -1) {
        stockfishRequestor = null;
        openingPracticeHintPending = false;
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            const fromSquare = match[1];
            const toSquare = match[2];
            openingPracticeBestMove = fromSquare + toSquare + (match[3] || '');
            // Marcar visualment les caselles
            highlightOpeningHint(fromSquare, toSquare);
            const noteEl = document.getElementById('opening-practice-note');
            if (noteEl) {
                noteEl.innerHTML = `<div style="padding:12px; background:rgba(156,39,176,0.15); border-left:3px solid var(--accent-purple); border-radius:8px;">
                    <strong>💡 Pista:</strong> Mou de <strong>${fromSquare}</strong> a <strong>${toSquare}</strong>
                </div>`;
            }
        }
        return;
    }

    if (openingPracticeEngineThinking && stockfishRequestor === 'opening-engine' && msg.indexOf('bestmove') !== -1) {
        stockfishRequestor = null;
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match && openingPracticeGame) {
            const from = match[1];
            const to = match[2];
            const promotion = match[3] || 'q';

            // Fer el moviment de l'engine immediatament en chess.js (per evitar que l'usuari mogui abans)
            const move = openingPracticeGame.move({
                from,
                to,
                promotion
            });
            if (move) {
                clearOpeningHintHighlight();
                openingPracticeBestMove = null;
                openingPracticeMoveCount += 1;
                updateOpeningPracticeStatus();
                // Afegir moviment de l'engine a la seqüència d'obertures
                if (move.san) {
                    openingCurrentSequence.push(move.san);
                    console.log(`[OpeningEngine] Moviment engine afegit: ${move.san}, seqüència: [${openingCurrentSequence.join(', ')}]`);
                    // Actualitzar l'obertura seleccionada i la pista
                    updateSelectedOpening();
                }
            }

            // Ara l'estat del joc és correcte, podem permetre que l'usuari mogui
            openingPracticeEngineThinking = false;
            updateOpeningUndoButton();

            // Actualitzar el tauler visualment amb un petit delay per a animació suau
            setTimeout(() => {
                if (openingBundleBoard && openingPracticeGame) {
                    openingBundleBoard.position(openingPracticeGame.fen());
                }
                // Pre-calcular el millor moviment per al proper torn de l'usuari
                preCalculateOpeningBestMove();
            }, 200);
        } else {
            openingPracticeEngineThinking = false;
            updateOpeningUndoButton(); // Rehabilitar undo
            // Pre-calcular el millor moviment per al proper torn de l'usuari
            preCalculateOpeningBestMove();
        }
        return;
    }

    // Handler per moviment de l'oponent en pràctica d'errors d'obertura
    if (openingErrorPracticeActive && stockfishRequestor === 'opening-error-opponent' && msg.indexOf('bestmove') !== -1) {
        stockfishRequestor = null;
        openingPracticeEngineThinking = false;
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match && openingPracticeGame) {
            const from = match[1];
            const to = match[2];
            const promotion = match[3] || 'q';
            const move = openingPracticeGame.move({ from, to, promotion });
            if (move) {
                setTimeout(() => {
                    openingBundleBoard.position(openingPracticeGame.fen());
                    // Obtenir el millor moviment per l'usuari
                    requestOpeningErrorBestMoveForUser();
                }, 300);
            }
        }
        return;
    }

    // Handler per obtenir millor moviment de l'usuari en pràctica d'errors
    if (openingErrorPracticeActive && stockfishRequestor === 'opening-error-bestmove' && msg.indexOf('bestmove') !== -1) {
        stockfishRequestor = null;
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            openingErrorBestMove = match[1] + match[2] + (match[3] || '');
            openingPracticeBestMove = openingErrorBestMove;
        }
        return;
    }

    if (bundleAutoReplyPending && msg.indexOf('bestmove') !== -1) {
        bundleAutoReplyPending = false;
        try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            const replyMove = match[1] + match[2] + (match[3] || '');
            applyBundleAutoReply(replyMove);
        }
        return;
    }

    if (tvJeroglyphicsAnalyzing) {
        if (msg.indexOf('bestmove') !== -1) {
            tvJeroglyphicsAnalyzing = false;
            try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
            const bestMatch = msg.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
            if (!tvJeroglyphicsTopMoves.length) {
                tvJeroglyphicsTopMoves = bestMatch ? [bestMatch[1]] : [];
            }
            setTvStatus('Jeroglífic: endevina la millor jugada.');
            updateTvControls();
            updateTvJeroglyphicsUI();        
        }
        return;
    }

    if (tvJeroglyphicsHinting && msg.indexOf('bestmove') !== -1) {
        tvJeroglyphicsHinting = false;
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])/);
        if (match) {
            const to = match[2];
            highlightTvHintSquare(to);
            setTvStatus(`Pista: Alguna peça ha d'anar a ${to}`);
        }
        return;
    }
    
    // NOU: Capturar línies "info" per anàlisi enriquida
    if (waitingForBlunderAnalysis && msg.startsWith('info') && msg.indexOf(' pv ') !== -1) {
        if (DEBUG_ENRICHED_ANALYSIS) console.log('[EnrichedAnalysis] info', msg);
        const parsedInfo = parseUciInfo(msg);
        if (parsedInfo) {
            accumulateAnalysisInfo(parsedInfo);
            // Actualitzar score temporal del multipv 1
            if (parsedInfo.multipv === 1 && parsedInfo.score !== null) {
                if (parsedInfo.scoreType === 'mate') {
                    tempAnalysisScore = parsedInfo.score > 0 ? 10000 : -10000;
                } else {
                    tempAnalysisScore = parsedInfo.score;
                }
            }
        }
    }

    if (msg.indexOf('score cp') !== -1) {
        let match = msg.match(/score cp (-?\d+)/);
        if (match) {
            tempAnalysisScore = parseInt(match[1]);
            // Capturar també per a l'anàlisi d'obertures
            if (openingPracticeAnalysisPending && openingAnalysisStep > 0) {
                openingTempScore = parseInt(match[1]);
            }
        }
    }
    if (msg.indexOf('score mate') !== -1) {
         let match = msg.match(/score mate (-?\d+)/);
         if (match) {
             let mates = parseInt(match[1]);
             tempAnalysisScore = mates > 0 ? 10000 : -10000;
             // Capturar també per a l'anàlisi d'obertures
             if (openingPracticeAnalysisPending && openingAnalysisStep > 0) {
                 openingTempScore = mates > 0 ? 10000 : -10000;
             }
         }
    }

    trackEngineCandidate(msg);
    
    // Validació estricta en mode Bundle
    if (isBundleStrictAnalysis) {
        if (msg.startsWith('info') && msg.indexOf(' pv ') !== -1) {
            const parsedInfo = parseUciInfo(msg);
            if (parsedInfo && (parsedInfo.multipv === 1 || parsedInfo.multipv === 2)) {
                const depth = parsedInfo.depth || 0;
                const existingDepth = bundlePvLines[parsedInfo.multipv]?.depth || 0;
                if (depth >= existingDepth) {
                    bundlePvLines[parsedInfo.multipv] = { depth, pv: parsedInfo.pv || [] };
                    if (parsedInfo.multipv === 1) {
                        bundleStrictPvLine = parsedInfo.pv || [];
                        bundleStrictPvDepth = depth;
                    }
                }
            }
        }
        if (bundleAcceptMode === 'top2') {
            const pvMatch = msg.match(/multipv\s+([12]).*?\spv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
            if (pvMatch) {
                bundlePvMoves[pvMatch[1]] = pvMatch[2];
            }
        }

        if (msg.indexOf('bestmove') !== -1) {
            isBundleStrictAnalysis = false;
            try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}

            if (bundleAcceptMode === 'top1') {
                const bestMatch = msg.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
                bundleBestMove = bestMatch ? bestMatch[1] : null;
                cacheBundleAnswer(lastPosition, bundleAcceptMode, bundleBestMove, {}, bundleStrictPvLine, null);
                evaluateBundleAttempt({ mode: bundleAcceptMode, bestMove: bundleBestMove, pvMoves: {}, pvLine: bundleStrictPvLine });
                return;
            }

            cacheBundleAnswer(lastPosition, bundleAcceptMode, null, { ...bundlePvMoves }, null, { ...bundlePvLines });
            evaluateBundleAttempt({ mode: bundleAcceptMode, bestMove: null, pvMoves: { ...bundlePvMoves }, pvLines: { ...bundlePvLines } });
        }
        return;
    }

    if (isAnalyzingHint && msg.indexOf('bestmove') !== -1) {
        isAnalyzingHint = false;
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])/);
        if (match) {
            const to = match[2];
            $('#myBoard').find('.square-' + to).addClass('highlight-hint');
            $('#status').text(`Pista: Alguna peça ha d'anar a ${to}`);
        }
        return;
    }

    if (msg.indexOf('bestmove') !== -1 && waitingForBlunderAnalysis) {
        if (analysisStep === 1) {
            // CANVI: Extreure anàlisi enriquida
            const enriched = extractEnrichedAnalysis();
            
            const bestMatch = msg.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
            pendingBestMove = enriched.bestMove || (bestMatch ? bestMatch[1] : null);
            pendingBestMovePv = enriched.bestMovePv || [];
            pendingAnalysisDepth = enriched.depth || null;
            pendingAlternatives = enriched.alternatives || [];
            pendingEvalBefore = tempAnalysisScore;
            
            // Resetejar buffer i MultiPV per la segona anàlisi
            resetEnrichedAnalysisBuffer();
            try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
            
            analysisStep = 2;
            stockfish.postMessage(`position fen ${game.fen()}`);
            stockfish.postMessage('go depth 10');
        }
        else if (analysisStep === 2) {
            pendingEvalAfter = tempAnalysisScore;
            let swing = pendingEvalAfter + (pendingEvalBefore || 0);
            if (!isCalibrationGame && !blunderMode && currentGameMode === 'free') {
                const delta = swing;
                const isError = delta > TH_ERR;
                recentErrors.push(isError);
                if (recentErrors.length > ERROR_WINDOW_N) recentErrors.shift();
                if (recentErrors.length === ERROR_WINDOW_N) {
                    recentErrors = recentErrors.slice(-ERROR_WINDOW_N);
                }
                saveStorage();
            }           
            waitingForBlunderAnalysis = false;
            const moveQuality = classifyMoveQuality(Math.abs(swing), lastHumanMoveUci, pendingBestMove);
            registerMoveReview(swing, {
                fen: pendingAnalysisFen,
                bestMove: pendingBestMove,
                bestMovePv: pendingBestMovePv,
                depth: pendingAnalysisDepth,
                alternatives: pendingAlternatives,
                evalBefore: pendingEvalBefore,
                evalAfter: pendingEvalAfter
            });
            resolvePendingMoveEvaluation(moveQuality);
            
            if (swing > 250 && !blunderMode) {
                let severity = 'low';
                if (swing > 800) severity = 'high';
                else if (swing > 500) severity = 'med';

                $('#blunder-alert').removeClass('alert-low alert-med alert-high')
                    .addClass('alert-' + severity).show();

                saveBlunderToBundle(
                    pendingAnalysisFen || lastPosition,
                    severity,
                    pendingBestMove,
                    lastHumanMoveUci,
                    pendingBestMovePv
                );

                engineMoveTimeout = setTimeout(() => {
                    if (!game.game_over()) makeEngineMove();
                }, 1500);

            } else {
                if (blunderMode) handleBundleSuccess();
                else if (!game.game_over()) makeEngineMove();
            }
            pendingBestMove = null;
            pendingBestMovePv = [];
            pendingAnalysisDepth = null;
            pendingAlternatives = [];
            pendingEvalBefore = null;
            pendingEvalAfter = null;
            pendingAnalysisFen = null;
        }
        return;
    }

    if (msg.indexOf('bestmove') !== -1 && isEngineThinking) {
        const match = msg.match(/bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            const fallbackMove = match[1] + match[2] + (match[3] || '');
            const chosen = isCalibrationGame
                ? chooseCalibrationMove(engineMoveCandidates, fallbackMove)
                : (chooseHumanLikeMove(engineMoveCandidates) || { move: null });
            const moveStr = (engineMoveCandidates.length > 0 && chosen.move)
                ? chosen.move
                : chooseFallbackMove(fallbackMove);
            const fromSq = moveStr.substring(0, 2);
            const toSq = moveStr.substring(2, 4);
            const promotion = moveStr.length > 4 ? moveStr[4] : (match[3] || 'q');
            registerEngineMovePrecision(moveStr, engineMoveCandidates);    
            resetEngineMoveCandidates();
            try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
            setTimeout(() => {
                isEngineThinking = false;
                game.move({ from: fromSq, to: toSq, promotion: promotion });
                board.position(game.fen());
                highlightEngineMove(fromSq, toSq);
                updateStatus();
                if (game.game_over()) handleGameOver();
            }, 900);
        }
    }
}

function selectBundlePvLineForMove(bundleData, playedMove) {
    if (!bundleData) return [];
    if (Array.isArray(bundleData.pvLine) && bundleData.pvLine.length) {
        return bundleData.pvLine;
    }
    const pvLines = bundleData.pvLines || {};
    const candidates = Object.values(pvLines)
        .map(entry => entry?.pv || entry)
        .filter(line => Array.isArray(line) && line.length);
    const match = candidates.find(line => line[0] === playedMove);
    return match || (candidates[0] || []);
}

function applyBundleAutoReply(moveUci) {
    if (!moveUci) return;
    const fromSq = moveUci.substring(0, 2);
    const toSq = moveUci.substring(2, 4);
    const promotion = moveUci.length > 4 ? moveUci[4] : 'q';
    game.move({ from: fromSq, to: toSq, promotion });
    board.position(game.fen());
    highlightEngineMove(fromSq, toSq);
    bundleStepStartFen = game.fen();
    lastHumanMoveUci = null;
    updateStatus();
}

function requestBundleAutoReply() {
    if (!stockfish && !ensureStockfish()) return;
    bundleAutoReplyPending = true;
    try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}
    stockfish.postMessage(`position fen ${game.fen()}`);
    stockfish.postMessage('go depth 10');
}

function resetBundleToStartPosition() {
    const fen = bundleStepStartFen || currentBundleFen || lastPosition || null;
    if (!fen) return;
    try { game.load(fen); } catch (e) { return; }
    board.position(game.fen());

    lastHumanMoveUci = null;
    waitingForBlunderAnalysis = false;
    isEngineThinking = false;
    $('.square-55d63').removeClass('highlight-hint tap-selected tap-move');
    clearEngineMoveHighlights();
    clearTapSelection();
    clearMainMoveVisualFeedback();
    $('#blunder-alert').hide();
    
    // CANVI: Restaurar el missatge de Gemini si existeix
    const statusEl = $('#status');
    if (lastBundleGeminiHint) {
        statusEl.html(lastBundleGeminiHint);
    } else {
        statusEl.text("Torna a intentar-ho");
    }
}

function cacheBundleAnswer(fen, mode, bestMove, pvMoves, pvLine = null, pvLines = null) {
    if (!fen || !mode) return;
    bundleAnswerCache.set(fen, { mode, bestMove, pvMoves, pvLine, pvLines });
}

function evaluateBundleAttempt(bundleData) {
    const played = lastHumanMoveUci || '';
    const playedTo = played.length >= 4 ? played.slice(2, 4) : null;
    
    // ✅ SI HI HA SEQÜÈNCIA FIXA, USAR-LA
    if (bundleFixedSequence) {
        const step = bundleSequenceStep;
        
        // Validar segons el pas actual
        const expectedMove = step === 1 
            ? bundleFixedSequence.step1.playerMove 
            : bundleFixedSequence.step2.playerMove;
        
        const alternatives = step === 1
            ? bundleFixedSequence.step1.alternatives
            : bundleFixedSequence.step2.alternatives;
        
        // Validar jugada
        let ok = played === expectedMove;
        
        // Si mode top2, acceptar també alternatives
        if (!ok && bundleAcceptMode === 'top2' && alternatives.length > 0) {
            ok = alternatives.some(alt => alt.move === played);
        }
        
        if (ok) {
            if (pendingMoveEvaluation) { 
                goodMoves++; 
                pendingMoveEvaluation = false; 
                updatePrecisionDisplay(); 
            }
            if (playedTo) showMainMoveVisualFeedback(playedTo, 'correct');
            
            if (bundleSequenceStep === 1) {
                // CANVI: Netejar el missatge de Gemini només quan s'avança al pas 2
                lastBundleGeminiHint = null;
                
                bundleSequenceStep = 2;
                const replyMove = bundleFixedSequence.opponentMove.move;
                applyBundleAutoReply(replyMove);
                bundleStepStartFen = game.fen();
                
                $('#status').text('Pas 2 de 2: Completa la seqüència');
                return;
            }
            
            // CANVI: Netejar el missatge quan s'acaba l'exercici
            lastBundleGeminiHint = null;
            handleBundleSuccess();
        } else {
            if (playedTo) showMainMoveVisualFeedback(playedTo, 'incorrect');
            // Error - resetar al pas actual
            if (pendingMoveEvaluation) {
                pendingMoveEvaluation = false;
                totalPlayerMoves = Math.max(0, totalPlayerMoves - 1);
                updatePrecisionDisplay();
            }
            
            if (bundleSequenceStep === 1) {
                bundleStepStartFen = bundleSequenceStartFen;
            }
            setTimeout(() => {
                resetBundleToStartPosition();
            }, 700);
        }
        return;
    }
    
    // ❌ FALLBACK: Mètode antic si no hi ha seqüència fixa
    const playedBase = played.slice(0, 4);
    let ok = false;
    if (bundleData.mode === 'top1') {
        const bestMove = bundleData.bestMove || '';
        const bestBase = bestMove.slice(0, 4);
        ok = bestMove ? (played === bestMove || playedBase === bestBase) : false;
    } else if (bundleData.mode === 'top2') {
        const accepted = [bundleData.pvMoves?.['1'], bundleData.pvMoves?.['2']].filter(Boolean);
        ok = accepted.length > 0 ? accepted.includes(played) : false;
    }
    
    if (ok) {
        if (pendingMoveEvaluation) { 
            goodMoves++; 
            pendingMoveEvaluation = false; 
            updatePrecisionDisplay(); 
        }
        if (playedTo) showMainMoveVisualFeedback(playedTo, 'correct');
        
        if (bundleSequenceStep === 1) {
            // CANVI: Netejar el missatge de Gemini només quan s'avança al pas 2
            lastBundleGeminiHint = null;
            
            const pvLine = selectBundlePvLineForMove(bundleData, played);
            const replyMove = pvLine.length > 1 ? pvLine[1] : null;
            bundleSequenceStep = 2;
            if (replyMove) {
                applyBundleAutoReply(replyMove);
            } else {
                requestBundleAutoReply();
            }
            bundleStepStartFen = game.fen();
            return;
        }
        
        // CANVI: Netejar el missatge quan s'acaba l'exercici
        lastBundleGeminiHint = null;
        handleBundleSuccess();
    } else {
        if (playedTo) showMainMoveVisualFeedback(playedTo, 'incorrect');
        if (pendingMoveEvaluation) {
            pendingMoveEvaluation = false;
            totalPlayerMoves = Math.max(0, totalPlayerMoves - 1);
            updatePrecisionDisplay();
        }
        if (bundleSequenceStep === 1) {
            bundleStepStartFen = bundleSequenceStartFen;
        }
        setTimeout(() => {
            resetBundleToStartPosition();
        }, 700);
    }
}

function showBundleTryAgainModal() {
    $('#bundle-retry-modal').remove();
    const stepLabel = bundleSequenceStep === 2 ? 'aquest segon pas' : 'aquest pas';
    const reasonText = bundleAcceptMode === 'top2'
        ? `Aquesta no és una de les dues millors opcions per ${stepLabel}. Prova una altra jugada.`
        : `Aquesta no és la millor opció per ${stepLabel}. Prova una altra jugada.`;
    let html = '<div class="modal-overlay" id="bundle-retry-modal" style="display:flex;">';
    html += '<div class="modal-content">';
    html += '<div class="modal-title">Tornar a intentar</div>';
    html += `<div style="margin:12px 0; color:var(--text-secondary); line-height:1.4;">${reasonText}</div>`;
    html += '<button class="btn btn-primary" id="btn-bundle-retry-ok">OK</button>';
    html += '</div></div>';
    $('body').append(html);

    $('#btn-bundle-retry-ok').off('click').on('click', () => {
        $('#bundle-retry-modal').remove();
        resetBundleToStartPosition();
    });
}

function renderReviewBreakdown(counts) {
    const container = $('#review-breakdown');
    if (!container.length) return;
    container.empty();
    const items = [
        { key: 'excel', label: 'Excel·lents', css: 'excel' },
        { key: 'good', label: 'Bones', css: 'good' },
        { key: 'inaccuracy', label: 'Imprecisions', css: 'inaccuracy' },
        { key: 'mistake', label: 'Errors', css: 'mistake' },
        { key: 'blunder', label: 'Blunders', css: 'blunder' }
    ];
    items.forEach(item => {
        const value = counts[item.key] || 0;
        const block = `<div class="review-chip ${item.css}"><span>${item.label}</span><strong>${value}</strong></div>`;
        container.append(block);
    });
}

function showPostGameReview(msg, finalPrecision, counts, onClose, options = {}) {
    const modal = $('#review-modal');
    if (!modal.length) {
        alert(msg + (finalPrecision ? `\nPrecisió: ${finalPrecision}%` : ''));
        if (typeof onClose === 'function') onClose();
        return;
    }
    
    const checkmateOverlay = $('#checkmate-overlay');
    const checkmateImage = $('#checkmate-image');
    const openReviewModal = () => {
        if (checkmateImage.length) {
            if (options.showCheckmate) {
                checkmateImage.show();
            } else {
                checkmateImage.hide();
            }
        }
    
        $('#review-result-text').text(msg);
        $('#review-precision-value').text(finalPrecision ? `${finalPrecision}%` : '—');
        renderReviewBreakdown(counts || summarizeReview(currentReview));
        modal.css('display', 'flex');
    };
    
    if (reviewAutoCloseTimer) {
        clearTimeout(reviewAutoCloseTimer);
        reviewAutoCloseTimer = null;
    }
    if (reviewOpenDelayTimer) {
        clearTimeout(reviewOpenDelayTimer);
        reviewOpenDelayTimer = null;
    }

     if (options.showCheckmate) {
        if (checkmateOverlay.length) {
            checkmateOverlay.hide();
        }
        reviewOpenDelayTimer = setTimeout(() => {            
            openReviewModal();
        }, 2000);
    } else {
        openReviewModal();
    }

    const hasMatchErrors = currentGameErrors.length > 0;
    const reviewErrorsBtn = $('#btn-review-errors');
    if (reviewErrorsBtn.length) {
        reviewErrorsBtn.toggle(hasMatchErrors);
        reviewErrorsBtn.off('click').on('click', () => {
            modal.hide();
            startMatchErrorReview();
        });
    }

    $('#btn-review-close').off('click').on('click', () => {
         if (reviewAutoCloseTimer) {
            clearTimeout(reviewAutoCloseTimer);
            reviewAutoCloseTimer = null;
        }
        if (reviewOpenDelayTimer) {
            clearTimeout(reviewOpenDelayTimer);
            reviewOpenDelayTimer = null;
        }
        checkmateOverlay.hide();        
        modal.hide();
        if (typeof onClose === 'function') onClose();
    });
    $('#btn-review-stats').off('click').on('click', () => {
        if (reviewAutoCloseTimer) {
            clearTimeout(reviewAutoCloseTimer);
            reviewAutoCloseTimer = null;
        }        
                if (reviewOpenDelayTimer) {
            clearTimeout(reviewOpenDelayTimer);
            reviewOpenDelayTimer = null;
        }
        checkmateOverlay.hide();
        modal.hide();
        $('#start-screen').hide(); $('#league-screen').hide(); $('#game-screen').removeClass('active').hide(); $('#stats-screen').show();
        updateStatsDisplay();
        if (typeof onClose === 'function') onClose();
    });

    $('#btn-review-menu').off('click').on('click', () => {
        if (reviewAutoCloseTimer) {
            clearTimeout(reviewAutoCloseTimer);
            reviewAutoCloseTimer = null;
        }
        if (reviewOpenDelayTimer) {
            clearTimeout(reviewOpenDelayTimer);
            reviewOpenDelayTimer = null;
        }
        checkmateOverlay.hide();
        modal.hide();
        returnToMainMenuImmediate();
    });
}

function returnToMainMenuImmediate() {
    $('#game-screen').removeClass('active').hide(); $('#league-screen').hide(); $('#stats-screen').hide(); $('#calibration-result-screen').hide(); $('#start-screen').show();
    if (stockfish) stockfish.postMessage('stop');
    clearTapSelection();
    isMatchErrorReviewSession = false;
    matchErrorQueue = [];
    currentMatchError = null;
    currentBundleSource = null;
    currentBundleSeverity = null;
    blunderMode = false;
    updateBundleHintButtons();
}

function handleBundleSuccess() {
    bundleSequenceStep = 1;
    bundleStepStartFen = null;
    $('#status').text("EXCEL·LENT! Problema resolt 🏆").css('color', '#4a7c59').css('font-weight', 'bold');
    sessionStats.bundlesSolved++;
    if (stockfish) stockfish.postMessage('stop');
    
    if (currentBundleFen) {
        const solvedErr = savedErrors.find(e => e.fen === currentBundleFen);
        if (solvedErr) {
            if (solvedErr.severity === 'high') sessionStats.bundlesSolvedHigh++;
            else if (solvedErr.severity === 'med') sessionStats.bundlesSolvedMed++;
            else sessionStats.bundlesSolvedLow++;
        }
        savedErrors = savedErrors.filter(e => e.fen !== currentBundleFen);
        currentBundleFen = null;
    }
    // Netejar l'error també de les partides guardades
    gameHistory.forEach(entry => {
    if (entry.severeErrors && Array.isArray(entry.severeErrors)) {
        entry.severeErrors = entry.severeErrors.filter(err => err.fen !== currentBundleFen);
    }
});
    
    saveStorage(); updateDisplay(); checkMissions();
    board.draggable = false;

    if (isMatchErrorReviewSession) {
        promptMatchErrorNext();
    } else if (isRandomBundleSession) {
        showRandomBundleSuccessOverlay();
    } else if (currentBundleSource === 'category') {
        showCategoryBundleSuccessOverlay();
    } else {
        alert("Molt bé! Has trobat la millor opció.");
        returnToMainMenuImmediate();
    }
}

function showRandomBundleSuccessOverlay() {
    const overlay = $('#bundle-success-overlay');
    if (!overlay.length) {
        alert("Molt bé! Has trobat la millor opció.");
        returnToMainMenuImmediate();
        return;
    }

    const remaining = savedErrors.length;
    overlay.find('.bundle-success-remaining').text(
        remaining > 0 ? `${remaining} bundles pendents` : 'No queda cap bundle pendent'
    );
    overlay.find('#btn-bundle-random-again').prop('disabled', remaining === 0);
    overlay.css('display', 'flex');

    $('#btn-bundle-random-home').off('click').on('click', () => {
        isRandomBundleSession = false;
        overlay.hide();
        returnToMainMenuImmediate();
    });

    $('#btn-bundle-random-again').off('click').on('click', () => {
        overlay.hide();
        if (!startRandomBundleGame()) {
            isRandomBundleSession = false;
            returnToMainMenuImmediate();
        }
    });
}

function showCategoryBundleSuccessOverlay() {
    const overlay = $('#bundle-category-success-overlay');
    if (!overlay.length) {
        alert("Molt bé! Has trobat la millor opció.");
        returnToBundleMenu();
        return;
    }

    const severity = currentBundleSeverity;
    const labels = { low: 'lleus', med: 'mitjans', high: 'greus' };
    const remaining = severity ? savedErrors.filter(err => err.severity === severity).length : 0;
    const remainingText = severity
        ? `Queden ${remaining} errors ${labels[severity] || ''}.`
        : 'Queden errors pendents.';
    overlay.find('.bundle-success-remaining').text(remainingText);
    const againBtn = overlay.find('#btn-bundle-category-again');
    againBtn.prop('disabled', remaining === 0 || !severity);
    overlay.css('display', 'flex');

    $('#btn-bundle-category-home').off('click').on('click', () => {
        overlay.hide();
        returnToBundleMenu();
    });

     $('#btn-bundle-category-menu').off('click').on('click', () => {
        overlay.hide();
        returnToMainMenuImmediate();
    });

    againBtn.off('click').on('click', () => {
        overlay.hide();
        if (!startCategoryBundleNext(severity)) {
            returnToBundleMenu();
        }
    });
}

function startCategoryBundleNext(severity) {
    if (!severity) return false;
    const pool = savedErrors.filter(err => err.severity === severity);
    if (pool.length === 0) return false;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    startBundleGame(choice.fen, severity);
    return true;
}

function returnToBundleMenu() {
    returnToMainMenuImmediate();
    if (savedErrors.length > 0) {
        showBundleMenu();
    } else {
        alert('No tens errors guardats');
    }
}

function updatePrecisionDisplay() {
    const precisionEl = $('#current-precision'); const barEl = $('#precision-bar');
    if (totalPlayerMoves === 0) { precisionEl.text('—'); barEl.css('width', '0%').removeClass('good warning danger'); return; }
    const precision = Math.round((goodMoves / totalPlayerMoves) * 100);
    precisionEl.text(precision + '%'); barEl.css('width', precision + '%');
    barEl.removeClass('good warning danger');
    if (precision >= 75) barEl.addClass('good'); else if (precision >= 50) barEl.addClass('warning'); else barEl.addClass('danger');
}

function updateAIPrecisionDisplay() {
    const precisionEl = $('#current-ai-precision'); const barEl = $('#ai-precision-bar');
    if (!precisionEl.length || !barEl.length) return;
    if (totalEngineMoves === 0) { precisionEl.text('—'); barEl.css('width', '0%').removeClass('good warning danger'); return; }
    const precision = Math.round((goodEngineMoves / totalEngineMoves) * 100);
    precisionEl.text(precision + '%'); barEl.css('width', precision + '%');
    barEl.removeClass('good warning danger');
    if (precision >= 75) barEl.addClass('good'); else if (precision >= 50) barEl.addClass('warning'); else barEl.addClass('danger');
}

function updateAIPrecisionTarget() {
    const targetEl = $('#ai-precision-target');
    if (!targetEl.length) return;
    targetEl.text(isCalibrationGame ? getCalibrationPrecisionTargetText() : '—');
}

function registerEngineMovePrecision(moveStr, candidates) {
    if (!moveStr) return;
    totalEngineMoves++;
    let isGood = true;
    if (candidates && candidates.length) {
        const bestScore = Math.max(...candidates.map(c => c.score));
        const chosen = candidates.find(c => c.move === moveStr);
        if (chosen) {
            const delta = bestScore - chosen.score;
            isGood = delta <= 80;
        }
    }
    if (isGood) goodEngineMoves++;
    updateAIPrecisionDisplay();
}

function saveBlunderToBundle(fen, severity, bestMove, playerMove, bestMovePv = []) {
     if (!blunderMode) {
        const alreadyTracked = currentGameErrors.some(e => e.fen === fen);
        if (!alreadyTracked) {
            currentGameErrors.push({
                fen,
                severity,
                bestMove: bestMove || null,
                playerMove: playerMove || lastHumanMoveUci || null,
                bestMovePv: bestMovePv || []
            });
        }
    }
    if (!savedErrors.some(e => e.fen === fen)) {
        // Bloc eliminat - ja no hi ha límit per categoria
        
        savedErrors.push({
            fen: fen,
            date: new Date().toLocaleDateString(),
            severity: severity,
            elo: userELO,
            bestMove: bestMove || null,
            playerMove: playerMove || lastHumanMoveUci || null,
            bestMovePv: bestMovePv || []
        });
        saveStorage(); 
        updateDisplay(); 
    }
}

function handleGameOver(manualResign = false) {
    pendingMoveEvaluation = false;
    let msg = ""; let change = 0; let playerWon = false; let resultScore = 0.5;
    const wasLeagueMatch = (currentGameMode === 'league') && !!leagueActiveMatch;
    let leagueOutcome = 'draw';
    const finalPrecision = totalPlayerMoves > 0 ? Math.round((goodMoves / totalPlayerMoves) * 100) : 0;
    const durationSeconds = currentGameStartTs ? Math.round((Date.now() - currentGameStartTs) / 1000) : 0;
    const avgCpLoss = calculateAverageCpLoss(currentReview);
    const blundersOver200 = countBlunders(currentReview, 200);
    const tacticalPatterns = identifyTacticalPatterns(currentReview, avgCpLoss, blundersOver200);
    const calibrationGameWasActive = isCalibrationGame;
    let calibrationJustCompleted = false;
    const isFreeMode = currentGameMode === 'free';
    const isLeagueMode = currentGameMode === 'league';
    const shouldContinuousAdjust = isFreeMode && calibratgeComplet && !calibrationGameWasActive && !blunderMode;
    
    if (manualResign) { 
        msg = "T'has rendit."; resultScore = 0; leagueOutcome = 'loss'; 
    }
    else if (game.in_checkmate()) {
        if (game.turn() !== playerColor) { 
            msg = "Victòria!"; resultScore = 1; playerWon = true; leagueOutcome = 'win'; 
            sessionStats.gamesWon++; totalWins++;
            if (playerColor === 'b') sessionStats.blackWins++;
        } else { msg = "Derrota."; resultScore = 0; leagueOutcome = 'loss'; }
    } else { msg = "Taules."; resultScore = 0.5; leagueOutcome = 'draw'; }
        
    sessionStats.gamesPlayed++; totalGamesPlayed++;
    
    if (currentGameMode === 'league') sessionStats.leagueGamesPlayed++;
    else if (currentGameMode === 'free') sessionStats.freeGamesPlayed++;

    if (finalPrecision >= 70) sessionStats.highPrecisionGames++;
    if (finalPrecision >= 85) sessionStats.perfectGames++;
    
    if (!calibrationGameWasActive && !isLeagueMode && !shouldContinuousAdjust) {
        change = calculateEloDelta(resultScore);
        msg += ` (${formatEloChange(change)})`;
    }
    
    if (blunderMode && playerWon && currentBundleFen) { handleBundleSuccess(); return; }
    
    if (!calibrationGameWasActive && !isLeagueMode && !shouldContinuousAdjust) {
        userELO = Math.max(50, userELO + change);
        updateEloHistory(userELO);
        syncEngineEloFromUser();
    }
    
    if (calibrationGameWasActive) {
        isCalibrationGame = false;
        calibrationJustCompleted = recordCalibrationGame(resultScore, finalPrecision, {
            durationSeconds: durationSeconds,
            avgCpLoss: avgCpLoss,
            blunders: blundersOver200,
            tacticalPatterns: tacticalPatterns
        });
    }

    if (!blunderMode && !calibrationGameWasActive) {
        if (shouldContinuousAdjust) {
            const adjustResult = registerFreeGameAdjustment(resultScore, finalPrecision, {
                avgCpLoss: avgCpLoss,
                blunders: blundersOver200,
                durationSeconds: durationSeconds,
                tacticalPatterns: tacticalPatterns
            });
            if (adjustResult && adjustResult.feedback) {
                msg += ` · ${adjustResult.feedback}`;
            }
        } else if (!isLeagueMode) {
            adjustAIDifficulty(playerWon, finalPrecision, resultScore);
        }
    }

    if (wasLeagueMatch && !blunderMode) {
        applyLeagueAfterGame(leagueOutcome);
    }
    const reviewCounts = summarizeReview(currentReview);
    const severeErrors = currentGameErrors.slice(); // ← Usar currentGameErrors
    recordGameHistory(msg, finalPrecision, reviewCounts, { severeErrors });
    persistReviewSummary(finalPrecision, msg);
    recordActivity(); saveStorage(); checkMissions(); updateDisplay(); updateReviewChart();
    $('#status').text(msg);
    // Gestió de l'indicador de resultat
    if (leagueOutcome === 'win') setResultIndicator('win');
    else if (leagueOutcome === 'loss') setResultIndicator('loss');
    else setResultIndicator('draw');
    
    // Mostrar imatge de checkmate si és escac mat i victòria
    const showCheckmate = game.in_checkmate() && playerWon;
    if (showCheckmate) {
        const checkmateImage = $('#checkmate-image');
        if (checkmateImage.length) checkmateImage.show();
    }
    
    let reviewHeader = msg;
    if (currentStreak > 0) reviewHeader += ` · Ratxa ${currentStreak} dies`;
    
    // Guardar snapshot per poder reobrir la revisió
    lastReviewSnapshot = {
        msg: reviewHeader,
        finalPrecision: finalPrecision,
        counts: reviewCounts,
        showCheckmate: showCheckmate
    };
    
    let onClose = () => {
        if (wasLeagueMatch) { currentGameMode = 'free'; currentOpponent = null; $('#game-screen').removeClass('active').hide(); $('#league-screen').show(); renderLeague(); }
    };
    if (calibrationJustCompleted) {
        const baseClose = onClose;
        onClose = () => {
            if (typeof baseClose === 'function') baseClose();
            showCalibrationResultsScreen();
        };
    }
    $('#btn-resign').prop('disabled', true);
    
    showPostGameReview(reviewHeader, finalPrecision, reviewCounts, onClose, { showCheckmate: showCheckmate });
    if (calibrationJustCompleted) {
        showCalibrationReveal(userELO);
    }
    if (!blunderMode && !calibrationGameWasActive) {
        const latestEntry = gameHistory[gameHistory.length - 1];
        void requestGeminiReview(latestEntry, severeErrors);
    }
}

function setResultIndicator(outcome) {
    const indicator = $('#result-indicator');
    const icon = $('#result-indicator-icon');
    
    if (!outcome) {
        indicator.hide();
        return;
    }
    
    indicator.removeClass('win loss draw').show();
    
    if (outcome === 'win') {
        indicator.addClass('win');
        icon.text('🏆');
    } else if (outcome === 'loss') {
        indicator.addClass('loss');
        icon.text('💔');
    } else {
        indicator.addClass('draw');
        icon.text('🤝');
    }
}

function updateStatus() {
    if (!isEngineThinking) {
        var s = (game.turn() === 'b' ? 'Negres' : 'Blanques');
        if (game.in_check()) s += ' — Escac!';
        $('#status').text(s).css('color', 'var(--accent-cream)');
    }
}

// PWA Install functionality
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#install-banner').addClass('show');
});

$('#btn-install').on('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Resultat instal·lació: ${outcome}`);
        deferredPrompt = null;
        $('#install-banner').removeClass('show');
    }
});

$('#btn-dismiss-install').on('click', () => {
    $('#install-banner').removeClass('show');
});

// Inicialització
$(document).ready(() => {
    updateDeviceType();
    loadStorage();
    if (!isCalibrationActive()) {
        syncEngineEloFromUser();
    }
    void ensureBackupDirHandle({ prompt: false, mode: 'readwrite' });
    applyEpaperMode(loadEpaperPreference(), { skipSave: true });
    applyControlMode(loadControlMode(), { save: false, rebuild: false });
    bundleAcceptMode = loadBundleAcceptMode();
    const bSel = document.getElementById('bundle-accept-select');
    if (bSel) bSel.value = bundleAcceptMode;
    generateDailyMissions(); checkStreak(); updateDisplay(); setupEvents(); 
    if (!window.__boardResizeBound) {
        window.__boardResizeBound = true;
        window.addEventListener('resize', () => { if (board) board.resize(); });
    }

    setInterval(() => { if (getToday() !== missionsDate) generateDailyMissions(); }, 60000);
});
