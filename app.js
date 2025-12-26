// El Tauler - Entrenador d'Escacs PWA
// app.js - Lògica principal de l'aplicació

const APP_VERSION = window.APP_VERSION || 'dev';
const STOCKFISH_URL = `stockfish.js?v=${APP_VERSION}`;

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
let gameHistory = [];
let historyBoard = null;
let historyReplay = null;
let tvBoard = null;
let tvReplay = null;

// Sistema d'IA Adaptativa
let recentGames = []; 
let aiDifficulty = 8; 
const ADAPTIVE_LEVEL_KEY = 'chess_adaptiveLevel';
const ADAPTIVE_CONFIG = {
    MIN_LEVEL: 50,
    MAX_LEVEL: 3000,
    DEFAULT_LEVEL: 75,
    CALIBRATION_MOVES: 12,
    PRECISION_HIGH: 85,
    PRECISION_MID: 70,
    PRECISION_LOW: 45,
    STREAK_DELTA: 100,
    BOOST_HIGH: 80,
    BOOST_MID: 50,
    BOOST_LOW: 25,
    PENALTY_SOFT: -40,
    PENALTY_STRONG: -80
};
const ERROR_WINDOW_N = 30;
const TH_ERR = 80;
const ERROR_TARGET = 0.35;
const STEP_ELO = 40;
const ELO_MIN = 200;
const ELO_MAX = 2000;
const CALIBRATION_ENGINE_PRECISION = 50;
const CALIBRATION_ENGINE_DIFFICULTY = 6;
let adaptiveLevel = ADAPTIVE_CONFIG.DEFAULT_LEVEL;
let recentErrors = [];
let currentElo = clampEngineElo(adaptiveLevel);
let consecutiveWins = 0;
let consecutiveLosses = 0;
let isCalibrationPhase = true;
let calibrationMoves = 0;
let calibrationGoodMoves = 0;
let isCalibrationGame = false;
let isEngineThinking = false;
let engineMoveCandidates = [];
let lastReviewSnapshot = null;

let lastPosition = null; 
let blunderMode = false;
let currentBundleFen = null;
let playerColor = 'w';
let isRandomBundleSession = false;
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
    } else if (!document.body.classList.contains(`device-${detected}`)) {
        applyDeviceType(detected);
    }
}

// DRILLS DATA (Finals)
const DRILLS = {
    basics: [
        { name: "Mate amb Rei i Dama", fen: "8/8/8/8/8/8/k7/4Q2K w - - 0 1" },
        { name: "Mate amb Rei i Torre", fen: "8/8/8/8/8/8/k7/4R2K w - - 0 1" }
    ],
    pawns: [
        { name: "Peó Passat (Quadrat)", fen: "8/8/8/8/8/k7/4P3/K7 w - - 0 1" },
        { name: "Oposició Bàsica", fen: "8/8/8/8/4k3/4P3/4K3/8 w - - 0 1" },
        { name: "Rei i Peó vs Rei", fen: "8/8/8/8/8/2k5/2P5/2K5 w - - 0 1" }
    ],
    advanced: [
        { name: "Posició de Lucena", fen: "2K5/2P1k3/8/8/8/8/1r6/2R5 w - - 0 1" },
        { name: "Final de Torres (Philidor)", fen: "2r5/8/8/8/4k3/8/3R4/3K4 w - - 0 1" }
    ]
};

function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
}

// Control del tauler (Tocar / Arrossegar)
const CONTROL_MODE_KEY = 'eltauler_control_mode';
let controlMode = null;

// Revisió d'errors (Bundle): validar només les 2 millors jugades o acceptar qualsevol jugada legal
const BUNDLE_ACCEPT_MODE_KEY = 'eltauler_bundle_accept_mode';
let bundleAcceptMode = 'top2'; // 'top2' o 'any'

const EPAPER_MODE_KEY = 'eltauler_epaper_mode';
let epaperEnabled = false;

function loadBundleAcceptMode() {
    try {
        const v = localStorage.getItem(BUNDLE_ACCEPT_MODE_KEY);
        if (v === 'top2' || v === 'any') return v;
    } catch (e) {}
    return 'top2';
}

function saveBundleAcceptMode(mode) {
    bundleAcceptMode = (mode === 'any') ? 'any' : 'top2';
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

// Estat de validació Top-2 al Bundle
let isBundleTop2Analysis = false;
let bundlePvMoves = {};
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

    const used = (headerEl ? headerEl.getBoundingClientRect().height : 0)
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

    const isPortrait = window.innerHeight >= window.innerWidth;
    if (window.innerWidth <= 520 && isPortrait) {
        size = Math.floor(window.innerWidth - 32);
    }

    size = Math.max(220, size);
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
    freeGamesPlayed: 0,
    drillsSolved: 0
};

let isAnalyzingHint = false;
let waitingForBlunderAnalysis = false;
let analysisStep = 0;
let analysisScoreStep1 = 0;
let tempAnalysisScore = 0;

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
    { id: 'drill1', text: 'Entrena 1 Final', stars: 1, check: () => sessionStats.drillsSolved >= 1 },
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

function updateLeagueBanner() {
    const banner = $('#league-banner');
    if (!banner.length) return;

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
    createNewLeague(false);
    $('#start-screen').hide(); $('#stats-screen').hide(); $('#game-screen').hide();
    $('#league-screen').show();
    renderLeague();
}

function renderLeague() {
    if (!currentLeague) return;
    const me = getLeaguePlayer('me');
    if (me) me.elo = userELO;

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

        tr.append(`<td>${p.name}</td>`);
        tr.append(`<td class="num">${p.elo}</td>`);
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
        leagueGamesPlayed: 0, freeGamesPlayed: 0, drillsSolved: 0
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
        playLeague: 1, playFree: 1, bundleLow: 1, bundleMed: 1, bundleHigh: 1,
        drill1: 1
    };
    const getValue = (id) => {
        if (id === 'playLeague') return sessionStats.leagueGamesPlayed;
        if (id === 'playFree') return sessionStats.freeGamesPlayed;
        if (id === 'bundleLow') return sessionStats.bundlesSolvedLow;
        if (id === 'bundleMed') return sessionStats.bundlesSolvedMed;
        if (id === 'bundleHigh') return sessionStats.bundlesSolvedHigh;
        if (id === 'drill1') return sessionStats.drillsSolved;
        
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

function clampAdaptiveLevel(level) {
    if (isNaN(level)) return ADAPTIVE_CONFIG.DEFAULT_LEVEL;
    return Math.max(ADAPTIVE_CONFIG.MIN_LEVEL, Math.min(ADAPTIVE_CONFIG.MAX_LEVEL, level));
}

function clampEngineElo(elo) {
    if (isNaN(elo)) return Math.round(Math.max(ELO_MIN, Math.min(ELO_MAX, adaptiveLevel)));
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
    return isCalibrationGame ? CALIBRATION_ENGINE_DIFFICULTY : aiDifficulty;
}

function getAdaptiveNormalized() {
    return Math.max(0, Math.min(1, (adaptiveLevel - ADAPTIVE_CONFIG.MIN_LEVEL) / (ADAPTIVE_CONFIG.MAX_LEVEL - ADAPTIVE_CONFIG.MIN_LEVEL)));
}

function precisionToAdaptiveLevel(precision) {
    const normalized = Math.max(0, Math.min(1, (precision || 0) / 100));
    return Math.round(ADAPTIVE_CONFIG.MIN_LEVEL + normalized * (ADAPTIVE_CONFIG.MAX_LEVEL - ADAPTIVE_CONFIG.MIN_LEVEL));
}

function precisionToUserElo(precision) {
    const normalized = Math.max(0, Math.min(1, (precision || 0) / 100));
    return Math.round(ELO_MIN + normalized * (ELO_MAX - ELO_MIN));
}

function applyCalibrationResult(precision) {
    const safePrecision = Math.max(0, Math.min(100, typeof precision === 'number' ? precision : 50));
    adaptiveLevel = clampAdaptiveLevel(precisionToAdaptiveLevel(safePrecision));
    aiDifficulty = levelToDifficulty(adaptiveLevel);
    currentElo = clampEngineElo(adaptiveLevel);
    applyEngineEloStrength(currentElo);
    updateAdaptiveEngineEloLabel();
    userELO = Math.max(50, precisionToUserElo(safePrecision));
    updateEloHistory(userELO);
}

function finalizeCalibration() {
    const avgPrecision = calibrationMoves > 0 ? Math.round((calibrationGoodMoves / calibrationMoves) * 100) : 50;
    applyCalibrationResult(avgPrecision);
    isCalibrationPhase = false;
    saveStorage();
}

function finalizeCalibrationFromPrecision(precision) {
    const safePrecision = Math.max(0, Math.min(100, typeof precision === 'number' ? precision : 50));
    applyCalibrationResult(safePrecision);
    calibrationMoves = ADAPTIVE_CONFIG.CALIBRATION_MOVES;
    calibrationGoodMoves = Math.round((safePrecision / 100) * ADAPTIVE_CONFIG.CALIBRATION_MOVES);
    isCalibrationPhase = false;
    saveStorage();
}

function registerCalibrationMove(isGood) {
    if (!isCalibrationPhase || isCalibrationGame || blunderMode || currentGameMode === 'drill') return;
    if (calibrationMoves >= ADAPTIVE_CONFIG.CALIBRATION_MOVES) return;
    calibrationMoves += 1;
    if (isGood) calibrationGoodMoves += 1;
    if (calibrationMoves >= ADAPTIVE_CONFIG.CALIBRATION_MOVES) finalizeCalibration();
    else saveStorage();
}

function adjustAIDifficulty(playerWon, precision, resultScore = null) {
    const normalizedScore = (typeof resultScore === 'number') ? resultScore : (playerWon ? 1 : 0);
    const safePrecision = Math.max(0, Math.min(100, typeof precision === 'number' ? precision : 50));

    recentGames.push({ result: normalizedScore, precision: safePrecision });
    if (recentGames.length > 20) recentGames.shift();
    
    if (normalizedScore === 1) { consecutiveWins++; consecutiveLosses = 0; } 
    else if (normalizedScore === 0) { consecutiveLosses++; consecutiveWins = 0; }
    else { consecutiveWins = 0; consecutiveLosses = 0; }

    if (isCalibrationPhase) {
        saveStorage();
        return;
    }
    
    const recentWindow = recentGames.slice(-8);
    const avgScore = recentWindow.length > 0 ? recentWindow.reduce((sum, g) => {
        const scoreValue = (typeof g.result === 'number') ? g.result : (g.won ? 1 : 0);
        return sum + scoreValue;
    }, 0) / recentWindow.length : 0.5;
    const avgPrecision = recentWindow.length > 0 ? recentWindow.reduce((sum, g) => sum + (typeof g.precision === 'number' ? g.precision : 50), 0) / recentWindow.length : 50;
    
    let adjustment = 0;
    if (avgPrecision >= ADAPTIVE_CONFIG.PRECISION_HIGH && avgScore >= 0.6) adjustment += ADAPTIVE_CONFIG.BOOST_HIGH;
    else if (avgPrecision >= ADAPTIVE_CONFIG.PRECISION_MID && avgScore >= 0.55) adjustment += ADAPTIVE_CONFIG.BOOST_MID;
    else if (avgPrecision >= 60 && avgScore >= 0.5) adjustment += ADAPTIVE_CONFIG.BOOST_LOW;

    if (avgPrecision < ADAPTIVE_CONFIG.PRECISION_LOW && avgScore < 0.45) adjustment += ADAPTIVE_CONFIG.PENALTY_SOFT;
    if (avgPrecision < 40 && avgScore < 0.35) adjustment += ADAPTIVE_CONFIG.PENALTY_STRONG;

    if (consecutiveWins >= 3) { adjustment += ADAPTIVE_CONFIG.STREAK_DELTA; consecutiveWins = 0; }
    if (consecutiveLosses >= 3) { adjustment -= ADAPTIVE_CONFIG.STREAK_DELTA; consecutiveLosses = 0; }
    
    adaptiveLevel = clampAdaptiveLevel(adaptiveLevel + adjustment);
    aiDifficulty = levelToDifficulty(adaptiveLevel); // per compatibilitat amb dades antigues
    saveStorage();
}

function getOpponentElo() {
    return (currentOpponent && typeof currentOpponent.elo === 'number') ? currentOpponent.elo : userELO;
}

function getAIDepth() {
    const randomness = Math.floor(Math.random() * 3) - 1;
    const effectiveDifficulty = getEffectiveAIDifficulty();
    
    if (isCalibrationGame || currentGameMode !== 'league') {
        return Math.max(1, Math.min(15, effectiveDifficulty + randomness));
    }

    const oppElo = getOpponentElo();   
    const delta = (oppElo - userELO);
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
    const target = CALIBRATION_ENGINE_PRECISION / 100;
    const currentPrecision = totalEngineMoves > 0 ? (goodEngineMoves / totalEngineMoves) : target;

    let pickGood = true;
    if (badCandidates.length === 0) pickGood = true;
    else if (goodCandidates.length === 0) pickGood = false;
    else if (currentPrecision < target) pickGood = true;
    else if (currentPrecision > target) pickGood = false;
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
    const calPhase = localStorage.getItem('chess_isCalibrationPhase'); if (calPhase !== null) isCalibrationPhase = (calPhase === 'true');
    const calMoves = localStorage.getItem('chess_calibrationMoves'); if (calMoves) calibrationMoves = parseInt(calMoves);
    const calGood = localStorage.getItem('chess_calibrationGoodMoves'); if (calGood) calibrationGoodMoves = parseInt(calGood);
    const league = localStorage.getItem('chess_currentLeague'); if (league) currentLeague = JSON.parse(league);
    const lMatch = localStorage.getItem('chess_leagueActiveMatch'); if (lMatch) leagueActiveMatch = JSON.parse(lMatch);
    const reviews = localStorage.getItem('chess_reviewHistory'); if (reviews) reviewHistory = JSON.parse(reviews);
    const gameHistoryStored = localStorage.getItem('chess_gameHistory'); if (gameHistoryStored) gameHistory = JSON.parse(gameHistoryStored);
    const storedElo = localStorage.getItem('chess_currentElo');
    currentElo = clampEngineElo(storedElo ? parseInt(storedElo) : adaptiveLevel);
    const storedRecentErrors = localStorage.getItem('chess_recentErrors');
    if (storedRecentErrors) {
        try {
            const parsed = JSON.parse(storedRecentErrors);
            if (Array.isArray(parsed)) {
                recentErrors = parsed.map(Boolean).slice(-ERROR_WINDOW_N);
            }
        } catch (e) {}
    }
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
    localStorage.setItem('chess_isCalibrationPhase', String(isCalibrationPhase));
    localStorage.setItem('chess_calibrationMoves', calibrationMoves);
    localStorage.setItem('chess_calibrationGoodMoves', calibrationGoodMoves);
    localStorage.setItem('chess_reviewHistory', JSON.stringify(reviewHistory));
    localStorage.setItem('chess_gameHistory', JSON.stringify(gameHistory));    
    localStorage.setItem('chess_currentElo', currentElo);
    localStorage.setItem('chess_recentErrors', JSON.stringify(recentErrors));
    if (currentLeague) localStorage.setItem('chess_currentLeague', JSON.stringify(currentLeague)); else localStorage.removeItem('chess_currentLeague');
    if (leagueActiveMatch) localStorage.setItem('chess_leagueActiveMatch', JSON.stringify(leagueActiveMatch)); else localStorage.removeItem('chess_leagueActiveMatch');
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

function updateDisplay() {
    engineELO = Math.round(currentElo);  
    $('#current-elo').text(userELO); $('#game-elo').text(userELO);
    $('#current-stars').text(totalStars); $('#game-stars').text(totalStars);
    updateAdaptiveEngineEloLabel();
    
    let total = savedErrors.length;
    $('#bundle-info').text(total > 0 ? `${total} errors guardats` : 'Cap error desat');
    $('#game-bundles').text(total);
    updateStreakDisplay(); updateMissionsDisplay(); updateLeagueBanner();
}

function updateStatsDisplay() {
    $('#stats-total-games').text(totalGamesPlayed);
    $('#stats-total-wins').text(totalWins);
    $('#stats-bundles-count').text(savedErrors.length);
    $('#stats-max-streak').text(maxStreak);
    updateEloChart();
    updateReviewChart();
}

function updateEloChart() {
    const ctx = document.getElementById('elo-chart').getContext('2d');
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

function classifyMoveQuality(swing) {
    if (swing <= 30) return 'excel';
    if (swing <= 80) return 'good';
    if (swing <= 200) return 'inaccuracy';
    if (swing <= 600) return 'mistake';
    return 'blunder';
}

function registerMoveReview(swing) {
    if (blunderMode || currentGameMode === 'drill') return;
    const quality = classifyMoveQuality(Math.abs(swing));
    currentReview.push({
        move: lastHumanMoveUci || '—',
        swing: Math.abs(swing),
        quality: quality
    });
}

function summarizeReview(entries) {
    const base = { excel: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    (entries || []).forEach(item => {
        if (base[item.quality] !== undefined) base[item.quality]++;
    });
    return base;
}

function persistReviewSummary(finalPrecision, resultLabel) {
    if (blunderMode || currentGameMode === 'drill') { currentReview = []; return; }
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
    if (mode === 'catalan') return 'Obertura Catalana';
    if (mode === 'free') return 'Amistosa';
    if (mode === 'drill') return 'Finals';
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

const TV_FALLBACK_POOL = [
    {
        id: 'carlsen-caruana-wcc2018-g12',
        white: 'Magnus Carlsen',
        black: 'Fabiano Caruana',
        whiteElo: 2835,
        blackElo: 2832,
        event: 'World Chess Championship 2018',
        date: '2018.11.26',
        result: '1/2-1/2',
        pgnText: `[Event "World Chess Championship 2018"]
[Site "London"]
[Date "2018.11.26"]
[Round "12"]
[White "Carlsen, Magnus"]
[Black "Caruana, Fabiano"]
[Result "1/2-1/2"]
[WhiteElo "2835"]
[BlackElo "2832"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. h3 d6 9. c3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Bd7 14. Nf1 Rac8 15. Ne3 Nc6 16. d5 Nb4 17. Bb1 a5 18. a3 Na6 19. b4 g6 20. Bd2 Qb8 21. Bd3 Nc7 22. Rc1 Nxd5 23. Nxd5 Nxd5 24. exd5 Rxc1 25. Qxc1 Rc8 26. Qb1 axb4 27. axb4 Bf6 28. Rc1 Rxc1+ 29. Qxc1 Qa8 30. Bc3 Qa2 31. Bb1 Qa6 1/2-1/2`
    },
    {
        id: 'kasparov-topalov-1999',
        white: 'Garry Kasparov',
        black: 'Veselin Topalov',
        whiteElo: 2851,
        blackElo: 2700,
        event: 'Hoogovens Wijk aan Zee',
        date: '1999.01.20',
        result: '1-0',
        pgnText: `[Event "Hoogovens"]
[Site "Wijk aan Zee"]
[Date "1999.01.20"]
[White "Kasparov, Garry"]
[Black "Topalov, Veselin"]
[Result "1-0"]
[WhiteElo "2851"]
[BlackElo "2700"]

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
[Black "Duke of Brunswick and Count Isouard"]
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
        pgnText: `[Event "World Championship"]
[Site "Reykjavik"]
[Date "1972.07.23"]
[Round "6"]
[White "Fischer, Robert James"]
[Black "Spassky, Boris"]
[Result "1-0"]

1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8 14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6 20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5 27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7 32. Qe5 Qe8 33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6 39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4 1-0`
    },
    {
        id: 'ding-nepo-wcc2023-g12',
        white: 'Ding Liren',
        black: 'Ian Nepomniachtchi',
        whiteElo: 2788,
        blackElo: 2795,
        event: 'World Chess Championship 2023',
        date: '2023.04.28',
        result: '1-0',
        pgnText: `[Event "World Chess Championship 2023"]
[Site "Astana"]
[Date "2023.04.28"]
[Round "12"]
[White "Ding, Liren"]
[Black "Nepomniachtchi, Ian"]
[Result "1-0"]
[WhiteElo "2788"]
[BlackElo "2795"]

1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O 6. e3 c5 7. dxc5 Bxc5 8. Qc2 Nc6 9. a3 Qa5 10. Rd1 Rd8 11. Be2 Ne4 12. O-O Nxc3 13. bxc3 Be7 14. cxd5 Rxd5 15. c4 Rd7 16. Rd2 e5 17. Bg3 Bf6 18. Rfd1 Rxd2 19. Rxd2 Be6 20. h3 h6 21. Nd4 Bxd4 22. Rxd4 Qxa3 23. Rxd8+ Nxd8 24. Qd2 Nc6 25. Qd6 Qc1+ 26. Kh2 Qxc4 27. Qxe5 Qc2 28. Qb8+ Qc8 29. Qb3 Qc7 30. Qd5 Qc2 31. Kg1 Ne7 32. Qe5 Qc1+ 33. Kh2 Ng6 34. Qb8+ Kh7 35. Bd6 Bd7 36. Qxa7 Qf4+ 37. Bg3 Qb4 38. Bf3 Qd2 39. Qa8 b5 40. Qa1 Qb4 41. Bd5 Nf4 42. Qa7 Qd2 43. exf4 Qxd5 44. Qxf7 Qd4 45. Qf5+ Kg8 46. Be5 Qd1 47. Qe4 Be6 48. Qxb1 1-0`
    }
];

const MIN_TV_MOVES = 21;
let lastTvDynamicId = null;

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

function loadHistoryEntry(entry) {
    if (!entry) return;
    stopHistoryPlayback();
    initHistoryBoard();
    historyReplay = {
        entry: entry,
        game: new Chess(),
        moves: entry.moves || [],
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
    if (!entry) {
        resultEl.text('—');
        precisionEl.text('—');
        metaEl.text('Selecciona una partida per veure detalls.');
        breakdown.empty();
        updateHistoryProgress();
        updateHistoryControls();
        return;
    }

    resultEl.text(entry.result || '—');
    precisionEl.text(typeof entry.precision === 'number' ? `${entry.precision}%` : '—');
    const movesLabel = entry.moves ? `${entry.moves.length} jugades` : '0 jugades';
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
    updateHistoryProgress();
    updateHistoryControls();
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
    const hasEntry = tvReplay && tvReplay.moves;
    const movesCount = hasEntry ? tvReplay.moves.length : 0;
    const atStart = !hasEntry || tvReplay.moveIndex === 0;
    const atEnd = !hasEntry || tvReplay.moveIndex >= movesCount;

    playBtn.prop('disabled', !hasEntry || movesCount === 0 || tvReplay.isPlaying || atEnd);
    pauseBtn.prop('disabled', !hasEntry || !tvReplay.isPlaying);
    prevBtn.prop('disabled', !hasEntry || atStart || tvReplay.isPlaying);
    nextBtn.prop('disabled', !hasEntry || atEnd || tvReplay.isPlaying);
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
    updateTvProgress();
    updateTvControls();
}

function initTvBoard() {
    if (tvBoard) return;
    const boardEl = document.getElementById('tv-board');
    if (!boardEl) return;
    tvBoard = Chessboard('tv-board', {
        draggable: false,
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
    resizeTvBoardToViewport();
}

function setTvStatus(message, isError = false) {
    const status = $('#tv-status');
    status.text(message || '');
    status.css('color', isError ? 'var(--severity-high)' : 'var(--text-secondary)');
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
const TOP_PLAYERS_CACHE_MS = 3600000; // 1 hora

async function getTopPlayers() {
    const now = Date.now();
    if (cachedTopPlayers && (now - topPlayersCacheTime) < TOP_PLAYERS_CACHE_MS) {
        return cachedTopPlayers;
    }

    const categories = ['classical', 'rapid', 'blitz', 'bullet'];
    const allUsers = new Set();

    for (const cat of categories) {
        try {
            const response = await fetch(`https://lichess.org/api/player/top/50/${cat}`);
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

    // Fallback si falla
    return cachedTopPlayers || ['DrNykterstein', 'penguingim1', 'Fins0', 'lance5500'];
}

async function fetchLichessTvGame() {
    const topPlayers = await getTopPlayers();
    const user = topPlayers[Math.floor(Math.random() * topPlayers.length)];
    
    try {
        const response = await fetch(
            `https://lichess.org/api/games/user/${user}?max=100&finished=true&perfType=bullet,blitz,rapid,classical&clocks=false&evals=false`,
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
        
        // Filtrar partides amb mínim 20 jugades
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
        
        const entry = {
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
        
        lastTvDynamicId = gameId;
        return entry;
    } catch (err) {
        console.warn('fetchLichessTvGame error:', err);
        return null;
    }
}

async function loadTvGame(entry) {
    if (!entry) return;
    stopTvPlayback();
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
      const dynamicEntry = await fetchLichessTvGame();
    if (dynamicEntry) {
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

function tvStepForward() {
    if (!tvReplay || !tvReplay.moves || tvReplay.moveIndex >= tvReplay.moves.length) return;
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
            const movesCount = entry.moves ? entry.moves.length : 0;
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
        ? entry.errors.map(err => ({ fen: err.fen, severity: err.severity }))
        : [];
    const msg = entry.result || 'Partida';
    const precision = typeof entry.precision === 'number' ? entry.precision : 0;
    const counts = entry.counts || { excel: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    showPostGameReview(msg, precision, counts, null, { showCheckmate: false });
}

function recordGameHistory(resultLabel, finalPrecision, counts) {
    if (blunderMode || currentGameMode === 'drill') return;
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
        errors: currentGameErrors.map(err => ({ fen: err.fen, severity: err.severity })),
        playerColor: playerColor,
        opponent: currentOpponent || null,
        pgn: game.pgn()
    };
    gameHistory.push(entry);
    if (gameHistory.length > 60) gameHistory = gameHistory.slice(-60);
}

function checkShareSupport() {
    if (navigator.canShare && navigator.share) $('#btn-smart-share').show();
}

function setupEvents() {
    checkShareSupport();
    $('#btn-new-game').click(() => {
        currentGameMode = 'free';
        currentOpponent = null;
        if (leagueActiveMatch) { leagueActiveMatch = null; saveStorage(); }
        startGame(false);
    });

    $('#league-banner').on('click', () => { startLeagueRound(); });
    $('#btn-league-banner-play').on('click', (e) => { e.stopPropagation(); startLeagueRound(); });

    // NOU ESDEVENIMENT: Obertura Catalana
    $('#btn-catalan').click(() => {
        currentGameMode = 'catalan';
        currentOpponent = null;
        startGame(false);
    });

    $('#btn-badges').click(() => { updateBadgesModal(); $('#badges-modal').css('display', 'flex'); });
    
    $('#btn-stats').click(() => { $('#start-screen').hide(); $('#stats-screen').show(); updateStatsDisplay(); });
    $('#btn-history').click(() => {
        $('#start-screen').hide();
        $('#history-screen').show();
        initHistoryBoard();
        renderGameHistory();
    });
    $('#btn-tv').click(() => {
        $('#start-screen').hide();
        $('#tv-screen').show();
        initTvBoard();
        void loadRandomTvGame();
        setTimeout(() => { resizeTvBoardToViewport(); }, 0);
    });
    
    $('#btn-league').click(() => { openLeague(); });
    $('#btn-back-league').click(() => { $('#league-screen').hide(); $('#start-screen').show(); });
    $('#btn-league-new').click(() => { createNewLeague(true); openLeague(); });
    $('#btn-league-play').click(() => { startLeagueRound(); });

    $('#btn-drills').click(() => { showDrillsMenu(); });

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
    $('#btn-back-tv').click(() => {
        stopTvPlayback();
        stopTvPlayback();
        $('#tv-screen').hide();
        $('#start-screen').show();
    });
    
    $('#history-play').off('click').on('click', () => { startHistoryPlayback(); });
    $('#history-pause').off('click').on('click', () => { stopHistoryPlayback(); });
    $('#history-prev').off('click').on('click', () => { historyStepBack(); });
    $('#history-next').off('click').on('click', () => { historyStepForward(); });
    $('#tv-play').off('click').on('click', () => { startTvPlayback(); });
    $('#tv-pause').off('click').on('click', () => { stopTvPlayback(); });
    $('#tv-prev').off('click').on('click', () => { tvStepBack(); });
    $('#tv-next').off('click').on('click', () => { tvStepForward(); });
    $('#tv-next-game').off('click').on('click', () => { void loadRandomTvGame(); });
    $('#tv-restart').off('click').on('click', () => { resetTvReplay(); });
    $('#tv-menu').off('click').on('click', () => {
        stopTvPlayback();
        $('#tv-screen').hide();
        $('#start-screen').show();
    });
    $('.tv-card.gold').off('click').on('click', () => {
        const boardEl = document.getElementById('tv-board');
        if (boardEl) boardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                leagueGamesPlayed: 0, freeGamesPlayed: 0, drillsSolved: 0
            };
            eloHistory = []; totalGamesPlayed = 0; totalWins = 0; maxStreak = 0;
            adaptiveLevel = ADAPTIVE_CONFIG.DEFAULT_LEVEL;
            aiDifficulty = levelToDifficulty(adaptiveLevel); recentGames = []; consecutiveWins = 0; consecutiveLosses = 0;
            currentLeague = null; leagueActiveMatch = null;
            reviewHistory = []; currentReview = []; gameHistory = [];
            saveStorage(); generateDailyMissions(); updateDisplay();
            $('#stats-screen').hide(); $('#start-screen').show(); $('#confirm-delete-panel').hide();
            alert('Totes les dades han estat esborrades. Comença de nou!');
        }
    });
    
    $('#btn-hint').click(() => {
        if (!stockfish && !ensureStockfish()) { $('#status').text("Motor Stockfish no disponible").css('color', '#c62828'); return; }
        if (game.game_over()) return;
        isAnalyzingHint = true;
        $('#status').text("Buscant objectiu clau...");
        stockfish.postMessage(`position fen ${game.fen()}`);
        stockfish.postMessage('go depth 15');
    });

    $('#btn-smart-share').click(async () => {
        const data = {
            elo: userELO, bundles: savedErrors, streak: currentStreak, lastPracticeDate: lastPracticeDate,
            totalStars: totalStars, unlockedBadges: unlockedBadges, todayMissions: todayMissions, missionsDate: missionsDate,
            sessionStats: sessionStats, eloHistory: eloHistory, totalGamesPlayed: totalGamesPlayed, 
            totalWins: totalWins, maxStreak: maxStreak,
            aiDifficulty: aiDifficulty, adaptiveLevel: adaptiveLevel, recentGames: recentGames, consecutiveWins: consecutiveWins, 
            consecutiveLosses: consecutiveLosses, currentLeague: currentLeague, leagueActiveMatch: leagueActiveMatch,
            reviewHistory: reviewHistory, date: new Date().toLocaleDateString()
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const file = new File([blob], `eltauler_backup_${totalStars}stars.json`, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'El Tauler - Progrés', text: `ELO: ${userELO} | ★${totalStars}` }); } 
            catch (e) { console.log('Cancel·lat'); }
        }
    });

    $('#btn-export').click(() => {
        const data = {
            elo: userELO, bundles: savedErrors, streak: currentStreak, lastPracticeDate: lastPracticeDate,
            totalStars: totalStars, unlockedBadges: unlockedBadges, todayMissions: todayMissions, missionsDate: missionsDate,
            sessionStats: sessionStats, eloHistory: eloHistory, totalGamesPlayed: totalGamesPlayed,
            totalWins: totalWins, maxStreak: maxStreak,
            aiDifficulty: aiDifficulty, adaptiveLevel: adaptiveLevel, recentGames: recentGames, consecutiveWins: consecutiveWins,
            consecutiveLosses: consecutiveLosses, currentLeague: currentLeague, leagueActiveMatch: leagueActiveMatch,
            reviewHistory: reviewHistory, gameHistory: gameHistory, date: new Date().toLocaleDateString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `eltauler_backup_${totalStars}stars.json`; a.click();
        URL.revokeObjectURL(url);
    });

    $('#btn-import').click(() => $('#file-input').click());
    $('#file-input').change((e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (confirm(`Importar dades? ELO: ${data.elo || 50}, Estrelles: ${data.totalStars || 0}`)) {
                    userELO = data.elo || 50; savedErrors = data.bundles || [];
                    currentStreak = data.streak || 0; lastPracticeDate = data.lastPracticeDate || null;
                    totalStars = data.totalStars || 0; unlockedBadges = data.unlockedBadges || [];
                    todayMissions = restoreMissions(data.todayMissions || []); missionsDate = data.missionsDate || null;
                    sessionStats = data.sessionStats || { 
                        gamesPlayed: 0, gamesWon: 0, bundlesSolved: 0, 
                        bundlesSolvedLow: 0, bundlesSolvedMed: 0, bundlesSolvedHigh: 0,
                        highPrecisionGames: 0, perfectGames: 0, blackWins: 0,
                        leagueGamesPlayed: 0, freeGamesPlayed: 0, drillsSolved: 0
                    };
                    eloHistory = data.eloHistory || []; totalGamesPlayed = data.totalGamesPlayed || 0; totalWins = data.totalWins || 0; maxStreak = data.maxStreak || 0;
                    adaptiveLevel = clampAdaptiveLevel(typeof data.adaptiveLevel === 'number' ? data.adaptiveLevel : difficultyToLevel(data.aiDifficulty || 8));
                    aiDifficulty = levelToDifficulty(adaptiveLevel); recentGames = data.recentGames || []; consecutiveWins = data.consecutiveWins || 0; consecutiveLosses = data.consecutiveLosses || 0;
                    currentLeague = data.currentLeague || null;
                    leagueActiveMatch = data.leagueActiveMatch || null;
                    reviewHistory = data.reviewHistory || [];
                    gameHistory = data.gameHistory || [];
                    saveStorage(); updateDisplay(); alert('Dades importades!');
                }
            } catch (err) { alert('Error llegint l\'arxiu'); }
        };
        reader.readAsText(file);
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
        $('#game-screen').hide();
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
        showBundleMenu();
    });
}

// --- DRILLS LOGIC ---
function showDrillsMenu() {
    $('#bundle-modal').remove();

    let html = '<div class="modal-overlay" id="bundle-modal" style="display:flex;"><div class="modal-content">';
    html += '<div class="modal-title">🎓 Entrenament</div>';
    html += '<div class="bundle-folder-list">';

    const categories = [
        { id: 'basics', title: 'Bàsics', icon: '♟️' },
        { id: 'pawns', title: 'Peons', icon: '🏗️' },
        { id: 'advanced', title: 'Avançats', icon: '🔥' }
    ];

    categories.forEach(cat => {
        const drills = DRILLS[cat.id];
        html += `<div class="bundle-section drill open">`;
        html += '<div class="bundle-section-header">';
        html += `<div class="bundle-section-title">${cat.icon} ${cat.title}</div>`;
        html += '</div>';

        html += '<div class="bundle-section-content" style="display:block;">';
        html += '<div class="bundle-list">';
        drills.forEach((d) => {
            html += `<div class="drill-item" onclick="startDrill('${d.fen}', '${d.name}')">`;
            html += `<div><strong>${d.name}</strong></div>`;
            html += '</div>';
        });
        html += '</div></div></div>';
    });

    html += '</div>'; 
    html += '<button class="close-modal" onclick="$(\'#bundle-modal\').remove()">Tancar</button></div></div>';
    $('body').append(html);
}

window.startDrill = function(fen, name) {
    $('#bundle-modal').remove(); 
    
    currentGameMode = 'drill';
    currentOpponent = null;
    $('#game-mode-title').text('🎓 ' + name);
    
    startGame(false, fen); 
};

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
                html += `<div class="bundle-item ${severityClass}" onclick="startBundleGame('${err.fen}')">`;
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

    ['high', 'med', 'low'].forEach((sevKey) => {
        if (groups[sevKey].length > 0) $('#bundle-modal .bundle-section.' + sevKey).addClass('open');
    });

    $('#bundle-modal .bundle-section-header').off('click').on('click', function() {
        $(this).closest('.bundle-section').toggleClass('open');
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

window.startBundleGame = function(fen) {
    isRandomBundleSession = false;
    isMatchErrorReviewSession = false;
    matchErrorQueue = [];
    currentMatchError = null;
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
    $('#bundle-modal').remove();
    currentGameMode = 'bundle';
    currentOpponent = null;
    startGame(true, choice.fen);
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
    returnToMainMenuImmediate();
}

function promptMatchErrorNext() {
    const remaining = matchErrorQueue.length;
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
}

function startGame(isBundle, fen = null) {
    currentReview = [];
    lastReviewSnapshot = null;
    setResultIndicator(null);
    const checkmateImage = $('#checkmate-image');
    if (checkmateImage.length) checkmateImage.hide();
        if (!isBundle) {
        currentGameErrors = [];
        matchErrorQueue = [];
        currentMatchError = null;
        isMatchErrorReviewSession = false;
    }
    applyControlMode(loadControlMode(), { save: false, rebuild: false });
    $('#bundle-success-overlay').hide();
    if (!isBundle) isRandomBundleSession = false;
    
    $('#start-screen').hide(); 
    $('#stats-screen').hide(); 
    $('#league-screen').hide(); 
    $('#history-screen').hide();
    $('#game-screen').show();
    
    blunderMode = isBundle; 
    isCalibrationGame = isCalibrationPhase && !isBundle && currentGameMode !== 'drill';
    currentBundleFen = fen;
    lastHumanMoveUci = null;
    isBundleTop2Analysis = false;
    bundlePvMoves = {};
    if (isBundle) { bundleAcceptMode = loadBundleAcceptMode(); }

    totalPlayerMoves = 0; 
    goodMoves = 0;
    totalEngineMoves = 0;
    goodEngineMoves = 0;
    isEngineThinking = false;
    pendingMoveEvaluation = false;
    
    updatePrecisionDisplay();
    updateAIPrecisionDisplay();
    updateAIPrecisionTarget();
    
    game = new Chess(fen || undefined); 
    
    let boardOrientation = 'white';
    
    // LÒGICA DE COLORS
    if (currentGameMode === 'drill') {
        playerColor = game.turn();
        boardOrientation = (playerColor === 'w') ? 'white' : 'black';
    } else if (currentGameMode === 'catalan') {
        playerColor = 'b';
        boardOrientation = 'black';
    } else if (isBundle) {
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
        $('#engine-elo').text('Calibratge');
        $('#game-mode-title').text('🎯 Partida de calibratge');
    } else if (currentGameMode === 'drill') {
        $('#engine-elo').text('Mestre');
        $('#engine-elo').text('Mestre');
    } else if (isBundle) {
        currentGameMode = 'bundle';
        currentOpponent = null;
        $('#engine-elo').text('Anàlisi');
        $('#game-mode-title').text(isMatchErrorReviewSession ? '🔍 Errors de la partida' : '📚 Bundle');
    } else if (currentGameMode === 'catalan') {
        $('#engine-elo').text('Mestre Català (Adaptatiu)');
        $('#game-mode-title').text('🐉 Obertura Catalana');
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
    
    $('.square-55d63').removeClass('highlight-hint');
    clearEngineMoveHighlights();
    updateStatus();
    
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
    if ((currentGameMode === 'drill' || blunderMode) && game.turn() !== playerColor) return false;
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

    // LÒGICA ESPECIAL OBERTURA CATALANA
    if (currentGameMode === 'catalan' && game.turn() === 'w') {
        const history = game.history().length;
        let forcedMove = null;

        if (history === 0) forcedMove = 'd2d4';
        else if (history === 2) forcedMove = 'c2c4';
        else if (history === 4) forcedMove = 'g2g3';
        else if (history === 6) forcedMove = 'f1g2';

        if (forcedMove) {
            const moveObj = game.move({ from: forcedMove.substring(0,2), to: forcedMove.substring(2,4), promotion: 'q' });
            if (moveObj) {
                game.undo();
                
                isEngineThinking = true;
                $('#status').text("El Mestre Català mou...");
                setTimeout(() => {
                    const fromSq = forcedMove.substring(0,2);
                    const toSq = forcedMove.substring(2,4);
                    game.move({ from: fromSq, to: toSq });
                    board.position(game.fen());
                    isEngineThinking = false;
                    requestAnimationFrame(() => highlightEngineMove(fromSq, toSq));
                    registerEngineMovePrecision(forcedMove, null);
                    
                    if (pendingMoveEvaluation && !$('#blunder-alert').is(':visible')) {
                        goodMoves++; registerCalibrationMove(true); pendingMoveEvaluation = false; updatePrecisionDisplay();
                    }
                    updateStatus();
                    if (game.game_over()) handleGameOver();
                }, 800);
                return;
            }
        }
    }

    isEngineThinking = true; 
    $('#status').text("L'adversari pensa...");
        
    const depth = (currentGameMode === 'drill') ? 20 : (isCalibrationGame ? Math.max(4, getAIDepth() - 2) : getAIDepth()); 
    const skillLevel = getEngineSkillLevel();
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

    if (blunderMode && currentBundleFen && bundleAcceptMode === 'top2') {
        isBundleTop2Analysis = true;
        bundlePvMoves = {};
        stockfish.postMessage('setoption name MultiPV value 2');
        stockfish.postMessage(`position fen ${lastPosition}`);
        stockfish.postMessage('go depth 12');
        return;
    }

    waitingForBlunderAnalysis = true;
    analysisStep = 1;
    tempAnalysisScore = 0;

    stockfish.postMessage(`position fen ${lastPosition}`);
    stockfish.postMessage('go depth 10');
}

function handleEngineMessage(msg) {
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
    if (msg.indexOf('score cp') !== -1) {
        let match = msg.match(/score cp (-?\d+)/);
        if (match) tempAnalysisScore = parseInt(match[1]);
    }
    if (msg.indexOf('score mate') !== -1) {
         let match = msg.match(/score mate (-?\d+)/);
         if (match) {
             let mates = parseInt(match[1]);
             tempAnalysisScore = mates > 0 ? 10000 : -10000;
         }
    }

    trackEngineCandidate(msg);
    
    // Validació Top-2 en mode Bundle
    if (isBundleTop2Analysis) {
        const pvMatch = msg.match(/multipv\s+([12]).*?\spv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (pvMatch) {
            bundlePvMoves[pvMatch[1]] = pvMatch[2];
        }

        if (msg.indexOf('bestmove') !== -1) {
            isBundleTop2Analysis = false;
            try { stockfish.postMessage('setoption name MultiPV value 1'); } catch (e) {}

            const accepted = [bundlePvMoves['1'], bundlePvMoves['2']].filter(Boolean);
            const played = lastHumanMoveUci || '';
            const ok = accepted.length > 0 ? accepted.includes(played) : false;

            if (ok) {
                if (pendingMoveEvaluation) { goodMoves++; registerCalibrationMove(true); pendingMoveEvaluation = false; updatePrecisionDisplay(); }
                handleBundleSuccess();
            } else {
                if (pendingMoveEvaluation) {
                    pendingMoveEvaluation = false;
                    totalPlayerMoves = Math.max(0, totalPlayerMoves - 1);
                    updatePrecisionDisplay();
                }
                showBundleTryAgainModal();
            }
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
            analysisScoreStep1 = tempAnalysisScore;
            analysisStep = 2;
            stockfish.postMessage(`position fen ${game.fen()}`);
            stockfish.postMessage('go depth 10');
        }
        else if (analysisStep === 2) {
            let swing = tempAnalysisScore + analysisScoreStep1;
            if (!isCalibrationGame && !blunderMode && currentGameMode === 'free') {
                const delta = swing;
                const isError = delta > TH_ERR;
                recentErrors.push(isError);
                if (recentErrors.length > ERROR_WINDOW_N) recentErrors.shift();
                if (recentErrors.length === ERROR_WINDOW_N) {
                    const errorRate = recentErrors.reduce((sum, value) => sum + (value ? 1 : 0), 0) / ERROR_WINDOW_N;
                    const previousElo = currentElo;
                    if (errorRate > ERROR_TARGET + 0.05) currentElo -= STEP_ELO;
                    else if (errorRate < ERROR_TARGET - 0.05) currentElo += STEP_ELO;
                    currentElo = clampEngineElo(currentElo);
                    if (currentElo !== previousElo) {
                        applyEngineEloStrength(currentElo);
                        updateAdaptiveEngineEloLabel();
                    }
                }
                saveStorage();
            }           
            waitingForBlunderAnalysis = false;
            registerMoveReview(swing);
            
            if (swing > 250 && !blunderMode && currentGameMode !== 'drill') {
                let severity = 'low';
                if (swing > 800) severity = 'high';
                else if (swing > 500) severity = 'med';

                $('#blunder-alert').removeClass('alert-low alert-med alert-high')
                    .addClass('alert-' + severity).show();

                if (pendingMoveEvaluation) { registerCalibrationMove(false); pendingMoveEvaluation = false; updatePrecisionDisplay(); }
                saveBlunderToBundle(lastPosition, severity);

                engineMoveTimeout = setTimeout(() => {
                    if (!game.game_over()) makeEngineMove();
                }, 1500);

            } else {
                if (blunderMode) handleBundleSuccess();
                else if (!game.game_over()) makeEngineMove();
            }
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
                if (pendingMoveEvaluation && !$('#blunder-alert').is(':visible')) {
                    goodMoves++; registerCalibrationMove(true); pendingMoveEvaluation = false; updatePrecisionDisplay();
                }
                game.move({ from: fromSq, to: toSq, promotion: promotion });
                board.position(game.fen());
                highlightEngineMove(fromSq, toSq);
                updateStatus();
                if (game.game_over()) handleGameOver();
            }, 900);
        }
    }
}

function resetBundleToStartPosition() {
    const fen = currentBundleFen || lastPosition || null;
    if (!fen) return;
    try { game.load(fen); } catch (e) { return; }
    board.position(game.fen());

    lastHumanMoveUci = null;
    waitingForBlunderAnalysis = false;
    isEngineThinking = false;
    $('.square-55d63').removeClass('highlight-hint tap-selected tap-move');
    clearEngineMoveHighlights();
    clearTapSelection();
    $('#blunder-alert').hide();
    $('#status').text("Tornar a intentar");
}

function showBundleTryAgainModal() {
    $('#bundle-retry-modal').remove();
    let html = '<div class="modal-overlay" id="bundle-retry-modal" style="display:flex;">';
    html += '<div class="modal-content">';
    html += '<div class="modal-title">Tornar a intentar</div>';
    html += '<div style="margin:12px 0; color:var(--text-secondary); line-height:1.4;">Aquesta no és una de les dues millors opcions. Prova una altra jugada.</div>';
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
        $('#start-screen').hide(); $('#league-screen').hide(); $('#game-screen').hide(); $('#stats-screen').show();
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
    $('#game-screen').hide(); $('#league-screen').hide(); $('#stats-screen').hide(); $('#start-screen').show();
    if (stockfish) stockfish.postMessage('stop');
    clearTapSelection();
    isMatchErrorReviewSession = false;
    matchErrorQueue = [];
    currentMatchError = null;
}

function handleBundleSuccess() {
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
    
    saveStorage(); updateDisplay(); checkMissions();
    board.draggable = false;

    if (isMatchErrorReviewSession) {
        promptMatchErrorNext();
    } else if (isRandomBundleSession) {
        showRandomBundleSuccessOverlay();
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
    targetEl.text(isCalibrationGame ? `${CALIBRATION_ENGINE_PRECISION}%` : '—');
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

function saveBlunderToBundle(fen, severity) {
     if (!blunderMode && currentGameMode !== 'drill') {
        const alreadyTracked = currentGameErrors.some(e => e.fen === fen);
        if (!alreadyTracked) currentGameErrors.push({ fen, severity });
    }
    if (!savedErrors.some(e => e.fen === fen)) {
        let typeErrors = savedErrors.filter(e => e.severity === severity);
        if (typeErrors.length >= 10) {
            let furthestError = typeErrors.reduce((prev, curr) => {
                  let prevDiff = Math.abs((prev.elo || 400) - userELO);
                let currDiff = Math.abs((curr.elo || 400) - userELO);
                return (currDiff > prevDiff) ? curr : prev;
            });
            savedErrors = savedErrors.filter(e => e !== furthestError);
        }
        
        savedErrors.push({ fen: fen, date: new Date().toLocaleDateString(), severity: severity, elo: userELO });
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
    const calibrationGameWasActive = isCalibrationGame;
    
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
    
    // LÒGICA DRILLS
    if (currentGameMode === 'drill') {
        if (playerWon) {
            alert("Entrenament completat! 🎉");
            sessionStats.drillsSolved++;
            checkMissions();
            returnToMainMenuImmediate();
            return;
        } else {
            if(confirm("Entrenament fallit. Vols tornar-ho a provar?")) {
                game.undo(); board.position(game.fen()); return;
            } else {
                returnToMainMenuImmediate(); return;
            }
        }
    }

    change = calculateEloDelta(resultScore);
    msg += ` (${formatEloChange(change)})`;

    if (blunderMode && playerWon && currentBundleFen) { handleBundleSuccess(); return; }
    
    userELO = Math.max(50, userELO + change); 
    updateEloHistory(userELO);
    
    if (calibrationGameWasActive) {
        finalizeCalibrationFromPrecision(finalPrecision);
        isCalibrationGame = false;
    }

    if (!blunderMode && currentGameMode !== 'drill' && !calibrationGameWasActive) {
        adjustAIDifficulty(playerWon, finalPrecision, resultScore);
    }

    if (wasLeagueMatch && !blunderMode) {
        applyLeagueAfterGame(leagueOutcome);
    }
    
    const reviewCounts = summarizeReview(currentReview);
    recordGameHistory(msg, finalPrecision, reviewCounts);
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
    
    const onClose = () => {
        if (wasLeagueMatch) { currentGameMode = 'free'; currentOpponent = null; $('#game-screen').hide(); $('#league-screen').show(); renderLeague(); }
    };
    showPostGameReview(reviewHeader, finalPrecision, reviewCounts, onClose, { showCheckmate: showCheckmate });
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
    saveEpaperPreference(epaperEnabled);
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
