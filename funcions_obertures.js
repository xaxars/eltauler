// ============================================================================
// FUNCIONS PER A L'ANÀLISI I PRÀCTICA D'OBERTURES
// ============================================================================
//
// Aquest fitxer conté les funcions necessàries per:
// 1. Mostrar el nombre de jugades a revisar per cada moviment d'obertura
// 2. Obrir un calaix amb les imprecisions d'un moviment específic
// 3. Practicar una seqüència de 2 moviments correctes per resoldre l'error
// 4. Gestionar l'estat de completitud de cada moviment
//
// ============================================================================

let lessonBoard = null;
let lessonGame = new Chess();

// Estat global per la pràctica d'obertures
let openingPracticeState = {
    activeMoveNumber: null,      // Número del moviment que s'està practicant
    activeColor: null,            // 'white' o 'black'
    practiceStep: 1,              // Pas actual dins la seqüència (1 o 2)
    practiceSequence: null,       // Seqüència fixa amb resposta de l'oponent i 2a jugada
    isSequenceReady: false,       // Quan la seqüència està preparada per Stockfish
    practiceErrorIndex: null,     // Índex de l'error dins la llista
    practiceErrorsCount: null,    // Nombre total d'errors en aquest moviment
    isPracticing: false,          // Si estem en mode pràctica
    completedMoves: {},           // Objecte per guardar els moviments completats: {white: [1,2,3], black: [1,2]}
    currentPracticeFen: null,     // FEN de la posició actual de pràctica
    targetMove: null,             // Moviment objectiu que cal fer
    currentError: null,           // Referència a l'error actual
    lastPracticeMoveNumber: null, // Moviment per reobrir la llista d'errors
    lastPracticeColor: null       // Color per reobrir la llista d'errors
};

let openingGeminiHintPending = false;
let openingLessonReviewPending = false;
let openingLessonReviewData = null;
const OPENING_LESSON_REVIEW_STORAGE = 'eltauler_opening_lesson_review';

const OPENING_PRACTICE_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
let practiceTapEnabled = false;
let practiceTapSelectedSquare = null;
let practiceLastTapEventTs = 0;

// ============================================================================
// 1. CONSTRUCCIÓ DE DADES AMB DETALL D'ERRORS
// ============================================================================

/**
 * Construeix estadístiques detallades d'obertures incloent errors específics
 * @param {Array} entries - Historial de partides
 * @returns {Object} Estadístiques amb errors detallats per moviment
 */
function buildDetailedOpeningStats(entries) {
    const initMoves = () => Array.from({ length: 10 }, () => ({
        sum: 0,
        count: 0,
        errors: []  // Array d'objectes amb dades de cada error
    }));

    const stats = { white: initMoves(), black: initMoves() };

    (entries || []).forEach(entry => {
        const colorKey = entry.playerColor === 'b' ? 'black' : 'white';
        const reviews = Array.isArray(entry.review) ? entry.review : [];

        reviews.forEach(move => {
            const moveNumber = move.moveNumber || 0;
            if (moveNumber < 1 || moveNumber > 10) return;

            const isCorrect = move.quality === 'excel' || move.quality === 'good';
            const moveData = stats[colorKey][moveNumber - 1];

            moveData.sum += isCorrect ? 1 : 0;
            moveData.count += 1;

            // Si no és correcte, afegir als errors
            if (!isCorrect) {
                moveData.errors.push({
                    gameDate: entry.date || 'Sense data',
                    moveNotation: move.move || move.playerMoveSan || '?',
                    playerMoveSan: move.playerMoveSan || move.move || '',
                    quality: move.quality || 'unknown',
                    cpLoss: move.cpLoss || move.swing || 0,
                    bestMove: move.bestMove || '',
                    bestMoveSan: move.bestMoveSan || '',
                    bestMovePv: move.bestMovePv || [],
                    fen: move.fen || '',
                    fenBefore: move.fenBefore || '',
                    comment: move.comment || '',
                    gameId: entry.timestamp || Date.now(),
                    playerMove: move.playerMove || '',
                    moveNumber: moveNumber,
                    pgn: entry.pgn || '',
                    playerColor: entry.playerColor || 'w',
                    moves: entry.moves || []
                });
            }
        });
    });

    return stats;
}

/**
 * Calcula el nombre de jugades a revisar per cada moviment
 * @param {Object} moveData - Dades d'un moviment específic
 * @returns {number} Nombre d'errors en aquest moviment
 */
function getReviewCount(moveData) {
    return moveData.errors ? moveData.errors.length : 0;
}

// ============================================================================
// 2. RENDERITZACIÓ AMB COLUMNA D'ERRORS
// ============================================================================

/**
 * Renderitza les estadístiques d'obertures amb columna d'errors clicable
 * @param {Object} stats - Estadístiques detallades d'obertures
 */
function renderDetailedOpeningStats(stats) {
    const container = $('#lesson-stats');
    if (!container.length) return;

    const entries = gameHistory.slice(-10);
    if (!entries.length) {
        container.html('<div>No hi ha partides per analitzar encara.</div>');
        return;
    }

    const sections = [
        { key: 'white', label: 'Blanques' },
        { key: 'black', label: 'Negres' }
    ];

    const html = sections.map(section => {
        const rows = stats[section.key].map((item, idx) => {
            const precision = item.count ? Math.round((item.sum / item.count) * 100) : 0;
            const reviewCount = getReviewCount(item);
            const moveNumber = idx + 1;
            const isCompleted = isMovePracticeCompleted(section.key, moveNumber);

            // Determinar color i classe segons precisió
            let precisionClass = 'precision-low';
            if (precision >= 75) precisionClass = 'precision-high';
            else if (precision >= 50) precisionClass = 'precision-medium';

            // Botó de revisió (només si hi ha errors)
            const reviewBtn = reviewCount > 0
                ? `<button class="btn-review-move ${isCompleted ? 'completed' : ''}"
                           data-color="${section.key}"
                           data-move="${moveNumber}"
                           ${isCompleted ? 'disabled' : ''}>
                       ${reviewCount} ${isCompleted ? '✓' : ''}
                   </button>`
                : `<span class="no-errors">—</span>`;

            return `
                <div class="opening-move-row">
                    <span class="move-number">Mov. ${moveNumber}:</span>
                    <span class="precision-value ${precisionClass}">
                        ${item.count ? `${precision}%` : '—'}
                    </span>
                    <span class="review-count-cell">
                        ${reviewBtn}
                    </span>
                </div>
            `;
        }).join('');

        return `
            <div class="lesson-stats-section">
                <div class="lesson-stats-title">${section.label}</div>
                <div class="lesson-stats-grid opening-stats-grid">${rows}</div>
            </div>
        `;
    }).join('');

    container.html(html);

    // Afegir event listeners als botons de revisió
    $('.btn-review-move').off('click').on('click', function() {
        const color = $(this).data('color');
        const moveNumber = $(this).data('move');
        openMoveReviewDrawer(color, moveNumber, stats);
    });
}

// ========================================================================
// 2.1. RESENYA AMB GEMINI PER A LLIÇÓ
// ========================================================================

function getLessonGeminiApiKey() {
    if (typeof geminiApiKey !== 'undefined' && geminiApiKey) {
        return geminiApiKey;
    }
    return localStorage.getItem('chess_gemini_api_key');
}

function getLessonGeminiModelId() {
    if (typeof GEMINI_MODEL_ID !== 'undefined' && GEMINI_MODEL_ID) {
        return GEMINI_MODEL_ID;
    }
    return 'gemini-3-flash-preview';
}

function formatLessonQualityCounts(counts) {
    const labels = {
        inaccuracy: 'imprecisions',
        mistake: 'errors',
        blunder: 'blunders',
        unknown: 'desconeguts'
    };
    return Object.entries(counts)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => `${labels[key] || key} ${value}`)
        .join(', ');
}

function buildLessonReviewSummary(stats, totalGames) {
    const items = [];
    let totalErrors = 0;

    ['white', 'black'].forEach(colorKey => {
        stats[colorKey].forEach((moveData, idx) => {
            const errors = moveData.errors || [];
            if (!errors.length) return;
            const avgCpLoss = Math.round(errors.reduce((sum, err) => sum + (err.cpLoss || 0), 0) / errors.length);
            const qualityCounts = errors.reduce((acc, err) => {
                const key = err.quality || 'unknown';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            totalErrors += errors.length;
            items.push({
                color: colorKey,
                moveNumber: idx + 1,
                errors: errors.length,
                avgCpLoss,
                qualityCounts
            });
        });
    });

    items.sort((a, b) => {
        if (b.errors !== a.errors) return b.errors - a.errors;
        return b.avgCpLoss - a.avgCpLoss;
    });

    return {
        totalGames,
        totalErrors,
        items: items.slice(0, 6)
    };
}

function buildLessonReviewPrompt(summary) {
    const itemsText = summary.items.length
        ? summary.items.map((item, idx) => {
            const colorLabel = item.color === 'white' ? 'Blanques' : 'Negres';
            const qualityText = formatLessonQualityCounts(item.qualityCounts);
            const qualityLine = qualityText ? ` | Tipus: ${qualityText}` : '';
            return `${idx + 1}. ${colorLabel} moviment ${item.moveNumber}: ${item.errors} errors, pèrdua mitjana ${item.avgCpLoss} cp${qualityLine}`;
        }).join('\n')
        : 'No hi ha errors destacables.';

    return `Ets un entrenador d'escacs expert. Genera una ressenya de millora de les obertures basada en l'anàlisi de ${summary.totalGames} partides recents.

DADES CLAU:
${itemsText}

INSTRUCCIONS:
- Escriu en català.
- No facis servir notació algebraica (e4, Nf3, etc.).
- No incloguis llistes de moviments ni cap tipus de coordenada (files, columnes o caselles).
- Menciona les peces pel seu nom i posició relativa al costat del rei o de la reina.
- Parla de peces i conceptes (control del centre, desenvolupament, seguretat del rei).
- Dona entre 3 i 5 recomanacions concretes i accionables.
- Mantén un to clar, motivador i directe.
- Màxim 250 paraules.

Genera la ressenya ara:`;
}

function formatLessonGeminiReviewText(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function buildOpeningMovesList(entries) {
    const initMoves = () => Array.from({ length: 10 }, () => []);
    const list = { white: initMoves(), black: initMoves() };

    (entries || []).forEach(entry => {
        const moves = Array.isArray(entry.moves) ? entry.moves : [];
        for (let idx = 0; idx < 10; idx++) {
            const whiteMove = moves[idx * 2];
            const blackMove = moves[idx * 2 + 1];
            if (whiteMove && !list.white[idx].includes(whiteMove)) {
                list.white[idx].push(whiteMove);
            }
            if (blackMove && !list.black[idx].includes(blackMove)) {
                list.black[idx].push(blackMove);
            }
        }
    });

    return list;
}

function formatOpeningMovesListHtml(list) {
    if (!list || !Array.isArray(list.white) || !Array.isArray(list.black)) return '';
    const renderSection = (label, moves) => {
        const items = moves.map((entry, idx) => {
            const content = entry.length ? entry.join(', ') : '—';
            return `<li><strong>${idx + 1}.</strong> ${content}</li>`;
        }).join('');
        return `
            <div class="lesson-opening-move-section">
                <div class="lesson-opening-move-title">${label}</div>
                <ul class="lesson-opening-move-list">${items}</ul>
            </div>
        `;
    };

    return `
        <div class="lesson-opening-move-block">
            <div class="lesson-opening-move-subtitle">Llistat de moviments (1-10)</div>
            ${renderSection('Blanques', list.white)}
            ${renderSection('Negres', list.black)}
        </div>
    `;
}

function saveLessonGeminiReview(reviewData) {
    if (!reviewData) return;
    localStorage.setItem(OPENING_LESSON_REVIEW_STORAGE, JSON.stringify(reviewData));
}

function loadLessonGeminiReview() {
    const stored = localStorage.getItem(OPENING_LESSON_REVIEW_STORAGE);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch (error) {
        console.warn('[Lesson Review] Dades guardades corruptes.', error);
        return null;
    }
}

function renderLessonGeminiReviewHtml(reviewData) {
    if (!reviewData || !reviewData.text) return '';
    const formatted = formatLessonGeminiReviewText(reviewData.text);
    const movesHtml = formatOpeningMovesListHtml(reviewData.movesList);
    return `
        <h4>📋 Ressenya d'obertures</h4>
        ${movesHtml}
        <div>${formatted}</div>
    `;
}

function updateLessonReviewUI(summary) {
    const container = $('#lesson-review');
    const reviewBox = $('#lesson-gemini-review');
    const btn = $('#btn-generate-lesson-review');
    const storedReview = loadLessonGeminiReview();

    if (!container.length) return;

    if (!summary || summary.totalGames === 0) {
        if (storedReview && storedReview.text) {
            container.show();
            reviewBox.html(renderLessonGeminiReviewHtml(storedReview)).fadeIn();
            initLessonPracticeBoard();
        } else {
            container.hide();
            reviewBox.hide().empty();
            $('#lesson-practice-area').hide();
        }
        btn.prop('disabled', true);
        return;
    }

    container.show();
    if (storedReview && storedReview.text) {
        reviewBox.html(renderLessonGeminiReviewHtml(storedReview)).show();
        initLessonPracticeBoard();
    } else {
        reviewBox.hide().empty();
        $('#lesson-practice-area').hide();
    }
    btn.prop('disabled', false).text('⚔️ Ressenya d\'obertures');
}

async function generateLessonReview() {
    if (openingLessonReviewPending) return;
    if (!openingLessonReviewData || openingLessonReviewData.totalGames === 0) {
        alert('Primer has d\'analitzar les obertures.');
        return;
    }

    const apiKey = getLessonGeminiApiKey();
    if (!apiKey) {
        alert('Configura la clau de Gemini per generar ressenyes.');
        return;
    }

    const btn = $('#btn-generate-lesson-review');
    const reviewBox = $('#lesson-gemini-review');
    btn.prop('disabled', true).text('⚔️ Generant ressenya...');
    openingLessonReviewPending = true;

    try {
        const prompt = buildLessonReviewPrompt(openingLessonReviewData);
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${getLessonGeminiModelId()}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 1500,
                        topP: 0.95,
                        topK: 40
                    }
                })
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text).join('').trim();
        if (!text) throw new Error('Resposta buida de Gemini');

        const movesList = buildOpeningMovesList(gameHistory.slice(-10));
        const reviewData = { text, movesList, generatedAt: new Date().toISOString() };
        saveLessonGeminiReview(reviewData);
        reviewBox.html(renderLessonGeminiReviewHtml(reviewData)).fadeIn();
        initLessonPracticeBoard();
    } catch (error) {
        console.error('[Lesson Review] Error:', error);
        reviewBox.html('<div style="color:var(--severity-high);">❌ No s\'ha pogut generar la ressenya. Revisa la clau de Gemini.</div>').fadeIn();
    } finally {
        openingLessonReviewPending = false;
        btn.prop('disabled', false).text('⚔️ Ressenya d\'obertures');
    }
}

// ========================================================================
// 2.2. TAULER DE PRÀCTICA LLIURE (10 MOVIMENTS)
// ========================================================================

function initLessonPracticeBoard() {
    $('#lesson-practice-area').show();
    lessonGame = new Chess();

    const config = {
        draggable: true,
        position: 'start',
        onDrop: onDropLesson,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };

    if (lessonBoard) lessonBoard.destroy();
    lessonBoard = Chessboard('lessonBoard', config);
    $(window).resize(lessonBoard.resize);

    $('#btn-lesson-hint').off('click').on('click', getLessonHint);
    $('#btn-lesson-maxim').off('click').on('click', getLessonMaxim);
    $('#btn-lesson-reset').off('click').on('click', () => {
        lessonGame.reset();
        lessonBoard.start();
        $('#lesson-maxim-output').empty();
    });
}

function onDropLesson(source, target) {
    const move = lessonGame.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    if (lessonGame.history().length > 20) {
        alert('Has arribat al límit de 10 moviments per a aquesta pràctica.');
        lessonGame.undo();
        return 'snapback';
    }
    $('#lesson-maxim-output').empty();
}

function getLessonHint() {
    if (!stockfishReady) return;
    $('#btn-lesson-hint').text('⏳...');

    lessonHintCallback = (move) => {
        $('#btn-lesson-hint').text('💡 Pista');
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        lessonBoard.move(`${from}-${to}`);
        lessonGame.move({ from, to, promotion: 'q' });
    };

    stockfish.postMessage(`position fen ${lessonGame.fen()}`);
    stockfish.postMessage('go depth 15');
}

async function getLessonMaxim() {
    const apiKey = getLessonGeminiApiKey();
    if (!apiKey) return alert('Configura Gemini per veure màximes.');

    $('#lesson-maxim-output').html('<span style="opacity:0.5">Meditant màxima...</span>');

    const prompt = `Ets un mestre d'escacs expert en l'estratègia de "L'Art de la Guerra" de Sun Tzu.
Donada la posició actual en FEN: ${lessonGame.fen()}
Genera una màxima breu (màxim 2 línies) inspirada en Sun Tzu que ajudi el jugador a plantejar el següent moviment en aquesta obertura.
Escriu només la màxima en català.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getLessonGeminiModelId()}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "L'oportunitat es troba en el mig de les dificultats.";
        $('#lesson-maxim-output').text(`"${text.trim()}"`);
    } catch (e) {
        $('#lesson-maxim-output').text('El general que guanya la batalla fa molts càlculs abans de lluitar.');
    }
}

// ============================================================================
// 3. CALAIX DE REVISIÓ D'ERRORS
// ============================================================================

/**
 * Obre un calaix amb els errors d'un moviment específic
 * @param {string} color - 'white' o 'black'
 * @param {number} moveNumber - Número del moviment (1-10)
 * @param {Object} stats - Estadístiques detallades
 */
function openMoveReviewDrawer(color, moveNumber, stats) {
    const moveData = stats[color][moveNumber - 1];
    const errors = moveData.errors || [];

    if (errors.length === 0) {
        alert('No hi ha errors per revisar en aquest moviment.');
        return;
    }

    // Crear el HTML del calaix amb botons individuals per cada error
    const drawerHtml = `
        <div class="move-review-drawer-overlay" id="move-review-drawer">
            <div class="move-review-drawer-content">
                <div class="drawer-header">
                    <h3>Errors al moviment ${moveNumber} (${color === 'white' ? 'Blanques' : 'Negres'})</h3>
                    <button class="btn-close-drawer">✕</button>
                </div>

                <div class="drawer-body">
                    <div class="drawer-instructions">
                        <p>📋 Selecciona un error per practicar:</p>
                    </div>
                    <div class="error-list">
                        ${errors.map((error, idx) => `
                            <div class="error-item" data-error-idx="${idx}">
                                <div class="error-header">
                                    <span class="error-number">#${idx + 1}</span>
                                    <span class="error-date">${error.gameDate}</span>
                                    <span class="error-quality quality-${error.quality}">${error.quality}</span>
                                </div>
                                <div class="error-details">
                                    <div><strong>Jugada feta:</strong> ${error.moveNotation}</div>
                                    <div><strong>Millor jugada:</strong> ${error.bestMoveSan || error.bestMove}</div>
                                    <div><strong>Pèrdua de CP:</strong> ${Math.round(error.cpLoss)}</div>
                                    ${error.comment ? `<div class="error-comment">${error.comment}</div>` : ''}
                                </div>
                                <div class="error-actions">
                                    <button class="btn btn-sm btn-practice-error"
                                            data-error-idx="${idx}"
                                            data-color="${color}"
                                            data-move="${moveNumber}">
                                        🎯 Practicar aquest error
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="drawer-footer">
                    <button class="btn btn-primary btn-practice-random"
                            data-color="${color}"
                            data-move="${moveNumber}">
                        🎲 Practicar error aleatori
                    </button>
                    <button class="btn btn-secondary btn-close-drawer">Tancar</button>
                </div>
            </div>
        </div>
    `;

    // Afegir al DOM
    $('#app-container').append(drawerHtml);

    // Event listeners per tancar
    $('.btn-close-drawer').off('click').on('click', closeMoveReviewDrawer);
    
    // Event listener per practicar error específic
    $('.btn-practice-error').off('click').on('click', function() {
        const errorIdx = parseInt($(this).data('error-idx'));
        const color = $(this).data('color');
        const moveNumber = $(this).data('move');
        closeMoveReviewDrawer();
        startMovePractice(color, moveNumber, errors, errorIdx);
    });
    
    // Event listener per practicar error aleatori
    $('.btn-practice-random').off('click').on('click', function() {
        const color = $(this).data('color');
        const moveNumber = $(this).data('move');
        closeMoveReviewDrawer();
        startMovePractice(color, moveNumber, errors, null);
    });

    // Animació d'obertura
    setTimeout(() => {
        $('#move-review-drawer').addClass('open');
    }, 10);
}

/**
 * Tanca el calaix de revisió d'errors
 */
function closeMoveReviewDrawer() {
    const drawer = $('#move-review-drawer');
    drawer.removeClass('open');
    setTimeout(() => {
        drawer.remove();
    }, 300);
}

// ============================================================================
// 4. SISTEMA DE PRÀCTICA DE MOVIMENTS
// ============================================================================

/**
 * Inicia la pràctica d'un moviment específic
 * @param {string} color - 'white' o 'black'
 * @param {number} moveNumber - Número del moviment
 * @param {Array} errors - Llista d'errors per aquest moviment
 */
function startMovePractice(color, moveNumber, errors, errorIdx = null) {
    // Inicialitzar estat de pràctica
    openingPracticeState = {
        activeMoveNumber: moveNumber,
        activeColor: color,
        practiceStep: 1,
        practiceSequence: null,
        isSequenceReady: false,
        practiceErrorIndex: null,
        practiceErrorsCount: null,
        isPracticing: true,
        completedMoves: openingPracticeState.completedMoves || {},
        currentPracticeFen: null,
        targetMove: null,
        currentError: null,
        lastPracticeMoveNumber: moveNumber,
        lastPracticeColor: color
    };

    // Navegar a la pantalla de joc
    $('#lesson-screen').hide();
    $('#game-screen').show();
    $('#start-screen').hide();

    // Configurar el tauler per la pràctica
    setupPracticeBoard(color, moveNumber, errors, errorIdx);

    // Actualitzar UI
    updatePracticeUI();
}

function isValidPracticeFen(fen) {
    if (!fen) return null;
    try {
        const testGame = new Chess(fen);
        return testGame.fen() ? fen : null;
    } catch (e) {
        return null;
    }
}

function computePracticeTargetPly(errorToPractice) {
    const moveNumber = Number.isFinite(errorToPractice.moveNumber) ? errorToPractice.moveNumber : 1;
    const isBlack = errorToPractice.playerColor === 'b';
    return Math.max(0, (moveNumber - 1) * 2 + (isBlack ? 1 : 0));
}

function rebuildFenFromPgn(errorToPractice) {
    if (!errorToPractice.pgn) return null;
    try {
        const tempGame = new Chess();
        const loaded = tempGame.load_pgn(errorToPractice.pgn);
        if (!loaded) throw new Error('No s\'ha pogut carregar el PGN');

        const history = tempGame.history({ verbose: true });
        const targetPly = computePracticeTargetPly(errorToPractice);

        tempGame.reset();
        for (let i = 0; i < history.length && i < targetPly; i++) {
            tempGame.move(history[i]);
        }

        return isValidPracticeFen(tempGame.fen());
    } catch (e) {
        console.error('❌ Error reconstruint FEN des de PGN:', e);
        return null;
    }
}

function rebuildFenFromMoves(errorToPractice) {
    if (!Array.isArray(errorToPractice.moves) || !errorToPractice.moves.length) return null;
    try {
        const tempGame = new Chess();
        const targetPly = computePracticeTargetPly(errorToPractice);

        for (let i = 0; i < errorToPractice.moves.length && i < targetPly; i++) {
            const moveSan = errorToPractice.moves[i];
            const moved = tempGame.move(moveSan, { sloppy: true });
            if (!moved) break;
        }

        return isValidPracticeFen(tempGame.fen());
    } catch (e) {
        console.error('❌ Error reconstruint FEN des de moviments:', e);
        return null;
    }
}

function buildPracticeFenFromError(errorToPractice) {
    const fenBefore = isValidPracticeFen(errorToPractice.fenBefore);
    if (fenBefore) {
        return { fen: fenBefore, source: 'fenBefore' };
    }

    const pgnFen = rebuildFenFromPgn(errorToPractice);
    if (pgnFen) {
        return { fen: pgnFen, source: 'pgn' };
    }

    const movesFen = rebuildFenFromMoves(errorToPractice);
    if (movesFen) {
        return { fen: movesFen, source: 'moves' };
    }

    if (errorToPractice.fen) {
        try {
            const tempGame = new Chess(errorToPractice.fen);
            const history = tempGame.history({ verbose: true });

            if (history.length > 0) {
                tempGame.undo();
                const fen = isValidPracticeFen(tempGame.fen());
                if (fen) {
                    return { fen, source: 'fen' };
                }
            }
        } catch (e) {
            console.error('❌ Error reconstruint FEN:', e);
        }
    }

    return { fen: OPENING_PRACTICE_START_FEN, source: 'fallback' };
}

/**
 * Configura el tauler per la pràctica d'un moviment
 * @param {string} color - Color del jugador
 * @param {number} moveNumber - Número del moviment a practicar
 * @param {Array} errors - Errors d'aquest moviment
 */
function setupPracticeBoard(color, moveNumber, errors, errorIdx = null) {
    console.log('🎯 Iniciant pràctica...');
    disablePracticeTapToMove();
    
    // Seleccionar error (específic o aleatori)
    const selectedIdx = errorIdx !== null ? errorIdx : Math.floor(Math.random() * errors.length);
    const errorToPractice = errors[selectedIdx];
    
    console.log('Error seleccionat:', errorToPractice);
    
    // Guardar referència a l'error actual
    openingPracticeState.currentError = errorToPractice;
    openingPracticeState.practiceErrorIndex = selectedIdx + 1;
    openingPracticeState.practiceErrorsCount = errors.length;
    openingPracticeState.practiceStep = 1;
    openingPracticeState.practiceSequence = null;
    openingPracticeState.isSequenceReady = false;

    const practiceFenData = buildPracticeFenFromError(errorToPractice);
    const practiceFen = practiceFenData.fen;
    if (!practiceFen) {
        console.error('❌ No hi ha cap FEN disponible!');
        alert('Error: No es pot carregar la posició per practicar.');
        returnToLessonScreen();
        return;
    }
    console.log(`✅ FEN preparat (${practiceFenData.source}):`, practiceFen);

    // Inicialitzar joc amb el FEN validat
    game = new Chess(practiceFen);
    openingPracticeState.currentPracticeFen = practiceFen;
    
    console.log('🎮 Joc inicialitzat amb FEN:', game.fen());

    // Es prepara la seqüència amb Stockfish després del setup del tauler
    openingPracticeState.targetMove = null;

    // Configurar color del jugador
    playerColor = color === 'white' ? 'w' : 'b';
    
    console.log('🎨 Color del jugador:', playerColor);

    // Destruir tauler anterior si existeix
    if (board) {
        try {
            board.destroy();
        } catch (e) {
            console.warn('⚠️ Error destruint tauler anterior:', e);
        }
    }

    // Inicialitzar nou tauler
    try {
        const isTapMode = controlMode === 'tap' && typeof isTouchDevice === 'function' && isTouchDevice();
        board = Chessboard('myBoard', {
            draggable: !isTapMode,
            position: game.fen(),
            orientation: playerColor === 'w' ? 'white' : 'black',
            onDragStart: onDragStart,
            onDrop: onDropPractice,
            onSnapEnd: onSnapEnd,
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });
        if (isTapMode) {
            if (typeof disableTapToMove === 'function') disableTapToMove();
            enablePracticeTapToMove();
        }
        
        console.log('✅ Tauler creat amb èxit');
        
        // Forçar actualització de la posició
        setTimeout(() => {
            board.position(game.fen());
            console.log('🔄 Posició del tauler actualitzada');
        }, 100);
        
    } catch (e) {
        console.error('❌ Error creant tauler:', e);
        alert('Error: No es pot crear el tauler.');
        returnToLessonScreen();
        return;
    }

    // Actualitzar UI
    $('#game-mode-title').text(`🎯 Pràctica: Moviment ${moveNumber} (${color === 'white' ? 'Blanques' : 'Negres'})`);
    $('#status').html(`
        <div style="margin-bottom: 8px;">
            <strong>Preparant la seqüència amb Stockfish...</strong>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">
            Error #${selectedIdx + 1} de ${errors.length} | Pas 1 de 2
        </div>
    `);

    // Activar botons de pista
    $('#btn-hint').show().prop('disabled', false);
    $('#btn-brain-hint').show().prop('disabled', false);
    
    // Actualitzar text dels botons
    $('#btn-hint').html('💡 Pista');
    $('#btn-brain-hint').html('<img src="brain.svg" alt="Cervell"><span>Màxima</span>');
    
    console.log('✅ Setup complet!');

    void preparePracticeSequenceFromError(errorToPractice, practiceFen);
}

async function preparePracticeSequenceFromError(errorToPractice, initialFen) {
    if (!initialFen) return;
    if (!stockfish && typeof ensureStockfish === 'function') {
        ensureStockfish();
    }

    let waitCount = 0;
    while (!stockfishReady && waitCount < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
    }

    if (!stockfishReady || !stockfish) {
        console.error('❌ Stockfish no està disponible per preparar la seqüència');
        alert('Error: No es pot preparar l\'exercici amb Stockfish.');
        returnToLessonScreen();
        return;
    }

    try {
        const playerMove1 = errorToPractice.bestMove
            || (await analyzePositionEnriched(stockfish, initialFen, 15, 2))?.bestMove?.move;

        if (!playerMove1) {
            throw new Error('No s\'ha pogut obtenir la millor jugada inicial');
        }

        const tempGame1 = new Chess(initialFen);
        const move1 = tempGame1.move({
            from: playerMove1.slice(0, 2),
            to: playerMove1.slice(2, 4),
            promotion: playerMove1.length > 4 ? playerMove1[4] : undefined
        });

        if (!move1) {
            throw new Error('No s\'ha pogut aplicar la millor jugada inicial');
        }

        const afterPlayerFen = tempGame1.fen();
        await new Promise(resolve => setTimeout(resolve, 300));

        const opponentAnalysis = await analyzePositionEnriched(stockfish, afterPlayerFen, 15, 1);
        const opponentMove = opponentAnalysis?.bestMove?.move;

        if (!opponentMove) {
            throw new Error('No s\'ha pogut obtenir la resposta de l\'oponent');
        }

        const tempGame2 = new Chess(afterPlayerFen);
        const move2 = tempGame2.move({
            from: opponentMove.slice(0, 2),
            to: opponentMove.slice(2, 4),
            promotion: opponentMove.length > 4 ? opponentMove[4] : undefined
        });

        if (!move2) {
            throw new Error('No s\'ha pogut aplicar la resposta de l\'oponent');
        }

        const afterOpponentFen = tempGame2.fen();
        await new Promise(resolve => setTimeout(resolve, 300));

        const step2Analysis = await analyzePositionEnriched(stockfish, afterOpponentFen, 15, 2);
        const playerMove2 = step2Analysis?.bestMove?.move;

        if (!playerMove2) {
            throw new Error('No s\'ha pogut obtenir la segona jugada');
        }

        openingPracticeState.practiceSequence = {
            initialFen,
            afterPlayerFen,
            afterOpponentFen,
            step1: { playerMove: playerMove1 },
            opponentMove: { move: opponentMove },
            step2: { playerMove: playerMove2 },
            fullSequence: [playerMove1, opponentMove, playerMove2]
        };
        openingPracticeState.isSequenceReady = true;
        openingPracticeState.practiceStep = 1;
        openingPracticeState.targetMove = playerMove1;
        updatePracticeStatus();
    } catch (error) {
        console.error('❌ Error preparant seqüència de pràctica:', error);
        alert('Error: No es pot preparar l\'exercici. Torna-ho a provar.');
        returnToLessonScreen();
    }
}

/**
 * Gestiona la caiguda d'una peça durant la pràctica (callback del tauler)
 * @param {string} source - Casella d'origen
 * @param {string} target - Casella de destinació
 * @returns {string} 'snapback' si el moviment és invàlid
 */
function onDropPractice(source, target) {
    if (!openingPracticeState.isSequenceReady) {
        showFeedback('info', '⏳ Preparant la seqüència amb Stockfish...');
        return 'snapback';
    }
    // Verificar si és el torn del jugador
    if (game.turn() !== playerColor) {
        return 'snapback';
    }

    if (typeof clearEngineMoveHighlights === 'function') {
        clearEngineMoveHighlights();
    } else {
        $('#myBoard .square-55d63').removeClass('engine-move');
    }

    // Intentar fer el moviment
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Sempre promocionar a reina per simplicitat
    });

    // Si el moviment no és vàlid, tornar enrere
    if (move === null) {
        return 'snapback';
    }

    // Comprovar si és el moviment correcte
    checkPracticeMove(move);
}

function clearPracticeTapSelection() {
    practiceTapSelectedSquare = null;
    $('#myBoard .square-55d63').removeClass('tap-selected tap-move');
}

function highlightPracticeTapSelection(square) {
    $('#myBoard .square-55d63').removeClass('tap-selected tap-move');
    const sel = $(`#myBoard .square-55d63[data-square='${square}']`);
    sel.addClass('tap-selected');

    const moves = game ? game.moves({ square: square, verbose: true }) : [];
    for (const mv of moves) {
        $(`#myBoard .square-55d63[data-square='${mv.to}']`).addClass('tap-move');
    }
}

function commitPracticeMoveFromTap(from, to) {
    const move = game.move({ from: from, to: to, promotion: 'q' });
    if (move === null) return false;
    if (typeof clearEngineMoveHighlights === 'function') {
        clearEngineMoveHighlights();
    } else {
        $('#myBoard .square-55d63').removeClass('engine-move');
    }
    board.position(game.fen());
    checkPracticeMove(move);
    return true;
}

function enablePracticeTapToMove() {
    if (practiceTapEnabled) return;
    practiceTapEnabled = true;
    const boardEl = document.getElementById('myBoard');
    if (boardEl) boardEl.style.touchAction = 'none';

    $('#myBoard').off('.practice-tapmove')
        .on(`pointerdown.practice-tapmove touchstart.practice-tapmove`, '.square-55d63', function(e) {
            if (!openingPracticeState.isPracticing || !game) return;

            if (e && e.preventDefault) e.preventDefault();

            const nowTs = Date.now();
            if (nowTs - practiceLastTapEventTs < 180) return;
            practiceLastTapEventTs = nowTs;

            const square = $(this).attr('data-square');
            if (!square) return;

            if (!practiceTapSelectedSquare) {
                const p = game.get(square);
                if (!p || p.color !== game.turn()) return;
                practiceTapSelectedSquare = square;
                highlightPracticeTapSelection(square);
                return;
            }

            if (square === practiceTapSelectedSquare) {
                clearPracticeTapSelection();
                return;
            }

            const moved = commitPracticeMoveFromTap(practiceTapSelectedSquare, square);
            if (moved) {
                clearPracticeTapSelection();
                return;
            }

            const p2 = game.get(square);
            if (p2 && p2.color === game.turn()) {
                practiceTapSelectedSquare = square;
                highlightPracticeTapSelection(square);
            }
        });
}

function disablePracticeTapToMove() {
    if (!practiceTapEnabled) return;
    practiceTapEnabled = false;
    $('#myBoard').off('.practice-tapmove');
    const boardEl = document.getElementById('myBoard');
    if (boardEl) boardEl.style.touchAction = '';
    clearPracticeTapSelection();
}

/**
 * Comprova si el moviment practicat és correcte
 * @param {Object} move - Objecte del moviment realitzat
 */
function checkPracticeMove(move) {
    const sequence = openingPracticeState.practiceSequence;
    if (!sequence) {
        showFeedback('error', '❌ Encara no tenim la seqüència preparada.');
        game.undo();
        board.position(game.fen());
        return;
    }

    const expectedMove = openingPracticeState.practiceStep === 1
        ? sequence.step1.playerMove
        : sequence.step2.playerMove;
    const moveUci = move.from + move.to + (move.promotion || '');

    if (moveUci !== expectedMove) {
        showFeedback('error', '✗ No és el millor moviment. Torna-ho a provar.');
        const targetStep = openingPracticeState.practiceStep === 2 ? 2 : 1;
        resetPracticeSequence(targetStep);
        return;
    }

    if (openingPracticeState.practiceStep === 1) {
        showFeedback('success', '✓ Bona! Completem la seqüència.');
        openingPracticeState.practiceStep = 2;
        openingPracticeState.targetMove = sequence.step2.playerMove;
        applyPracticeOpponentMove(sequence.opponentMove.move);
        updatePracticeStatus('Completa la seqüència amb el segon moviment.');
        return;
    }

    showFeedback('success', '✓ Excel·lent! Seqüència completada.');
    completePractice();
}

function applyPracticeOpponentMove(uciMove) {
    if (!uciMove) return;
    const applied = game.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove.length > 4 ? uciMove[4] : undefined
    });
    if (!applied) {
        console.error('❌ No s\'ha pogut aplicar la resposta de l\'oponent.');
        resetPracticeSequence();
        return;
    }
    board.position(game.fen());
    if (typeof highlightEngineMove === 'function') {
        highlightEngineMove(uciMove.slice(0, 2), uciMove.slice(2, 4));
    } else {
        $('#myBoard .square-55d63').removeClass('engine-move');
        $(`#myBoard .square-55d63[data-square='${uciMove.slice(0, 2)}']`).addClass('engine-move');
        $(`#myBoard .square-55d63[data-square='${uciMove.slice(2, 4)}']`).addClass('engine-move');
    }
}

function resetPracticeSequence(targetStep = 1) {
    const sequence = openingPracticeState.practiceSequence;
    const shouldResetToStep2 = targetStep === 2 && sequence?.afterOpponentFen;
    const targetFen = shouldResetToStep2
        ? sequence.afterOpponentFen
        : openingPracticeState.currentPracticeFen;

    if (targetFen) {
        game.load(targetFen);
        board.position(game.fen());
    }

    if (shouldResetToStep2) {
        openingPracticeState.practiceStep = 2;
        openingPracticeState.targetMove = sequence.step2.playerMove;
        updatePracticeStatus('Torna-ho a provar des de la segona part.');
        return;
    }

    openingPracticeState.practiceStep = 1;
    if (sequence) {
        openingPracticeState.targetMove = sequence.step1.playerMove;
    }
    updatePracticeStatus('Torna-ho a provar des del principi.');
}

/**
 * Completa la pràctica d'un moviment
 */
function completePractice() {
    const { activeColor, activeMoveNumber } = openingPracticeState;

    // Marcar com a completat
    if (!openingPracticeState.completedMoves[activeColor]) {
        openingPracticeState.completedMoves[activeColor] = [];
    }
    openingPracticeState.completedMoves[activeColor].push(activeMoveNumber);

    // Guardar a localStorage
    saveCompletedPractices();

    // Mostrar missatge de felicitació
    showCompletionModal();
}

/**
 * Mostra el modal de felicitació per completar la pràctica
 */
function showCompletionModal() {
    const { activeColor, activeMoveNumber } = openingPracticeState;

    const modalHtml = `
        <div class="modal-overlay" id="practice-complete-modal">
            <div class="modal-content">
                <div class="modal-title">🎉 Pràctica completada!</div>
                <div class="subtitle">
                    Has completat la pràctica del moviment ${activeMoveNumber}
                    (${activeColor === 'white' ? 'Blanques' : 'Negres'}) amb 2 moviments consecutius.
                </div>
                <div class="practice-complete-actions">
                    <button class="btn btn-primary" id="btn-practice-continue">
                        Tornar a l'anàlisi
                    </button>
                    <button class="btn btn-primary" id="btn-practice-random">
                        🎲 Practicar error aleatori
                    </button>
                    <button class="btn btn-secondary" id="btn-practice-back">
                        Tornar enrere
                    </button>
                    <button class="btn btn-secondary" id="btn-practice-menu">
                        Menú principal
                    </button>
                </div>
            </div>
        </div>
    `;

    $('body').append(modalHtml);

    $('#btn-practice-continue').off('click').on('click', () => {
        $('#practice-complete-modal').remove();
        returnToLessonScreen();
    });

    $('#btn-practice-back').off('click').on('click', () => {
        $('#practice-complete-modal').remove();
        returnToLessonScreen(true);
    });

    $('#btn-practice-random').off('click').on('click', () => {
        $('#practice-complete-modal').remove();
        startRandomOpeningPracticeFromLesson({ fallbackToLesson: true });
    });

    $('#btn-practice-menu').off('click').on('click', () => {
        $('#practice-complete-modal').remove();
        returnToStartScreen();
    });
}

function startRandomOpeningPracticeFromLesson({ fallbackToLesson = false } = {}) {
    const stats = analyzeLastOpenings();
    const color = openingPracticeState.lastPracticeColor;
    const moveNumber = openingPracticeState.lastPracticeMoveNumber;
    const errors = stats?.[color]?.[moveNumber - 1]?.errors || [];

    if (!errors.length) {
        alert('No hi ha errors disponibles per practicar.');
        if (fallbackToLesson) {
            returnToLessonScreen();
        }
        return;
    }

    startMovePractice(color, moveNumber, errors, null);
}

/**
 * Torna a la pantalla de lliçons i actualitza l'anàlisi
 */
function returnToLessonScreen(reopenDrawer = false) {
    openingPracticeState.isPracticing = false;
    disablePracticeTapToMove();

    $('#game-screen').hide();
    $('#lesson-screen').show();
    $('#btn-practice-random-lesson').hide();

    // Re-analitzar i re-renderitzar amb les dades actualitzades
    const stats = analyzeLastOpenings();

    if (reopenDrawer && stats && openingPracticeState.lastPracticeMoveNumber && openingPracticeState.lastPracticeColor) {
        openMoveReviewDrawer(
            openingPracticeState.lastPracticeColor,
            openingPracticeState.lastPracticeMoveNumber,
            stats
        );
    }
}

function showStoredLessonReview() {
    const container = $('#lesson-review');
    const reviewBox = $('#lesson-gemini-review');
    const btn = $('#btn-generate-lesson-review');
    const storedReview = loadLessonGeminiReview();
    const hasSummary = openingLessonReviewData && openingLessonReviewData.totalGames > 0;

    if (!container.length) return;

    if (storedReview && storedReview.text) {
        container.show();
        reviewBox.html(renderLessonGeminiReviewHtml(storedReview)).show();
        btn.prop('disabled', !hasSummary).text('⚔️ Ressenya d\'obertures');
    }
}

/**
 * Torna a la pantalla d'inici
 */
function returnToStartScreen() {
    openingPracticeState.isPracticing = false;
    disablePracticeTapToMove();

    $('#game-screen').hide();
    $('#lesson-screen').hide();
    $('#start-screen').show();
    $('#btn-practice-random-lesson').hide();
}

// ============================================================================
// 5. PERSISTÈNCIA DE DADES
// ============================================================================

/**
 * Guarda les pràctiques completades a localStorage
 */
function saveCompletedPractices() {
    const data = JSON.stringify(openingPracticeState.completedMoves);
    localStorage.setItem('eltauler_completed_practices', data);
}

/**
 * Carrega les pràctiques completades des de localStorage
 */
function loadCompletedPractices() {
    const data = localStorage.getItem('eltauler_completed_practices');
    if (data) {
        try {
            openingPracticeState.completedMoves = JSON.parse(data);
        } catch (e) {
            openingPracticeState.completedMoves = {};
        }
    }
}

/**
 * Comprova si un moviment ja ha estat completat
 * @param {string} color - 'white' o 'black'
 * @param {number} moveNumber - Número del moviment
 * @returns {boolean} True si està completat
 */
function isMovePracticeCompleted(color, moveNumber) {
    const completed = openingPracticeState.completedMoves[color] || [];
    return completed.includes(moveNumber);
}

// ============================================================================
// 6. SISTEMA DE PISTES AMB GEMINI
// ============================================================================

function getOpeningErrorSeverity(cpLoss) {
    if (!Number.isFinite(cpLoss)) return null;
    if (cpLoss > 800) return 'high';
    if (cpLoss > 500) return 'med';
    return 'low';
}

function buildOpeningPracticeGeminiPrompt(error) {
    const context = {};
    if (openingPracticeState.currentPracticeFen) {
        context.fen = openingPracticeState.currentPracticeFen;
    }
    if (error) {
        context.playerMove = error.playerMoveSan || error.moveNotation || error.playerMove || '';
        context.bestMove = error.bestMoveSan || error.bestMove || '';
        context.bestMovePv = Array.isArray(error.bestMovePv) ? error.bestMovePv : [];
        const severity = getOpeningErrorSeverity(error.cpLoss);
        if (severity) context.severity = severity;
    }

    if (typeof buildGeminiBundleHintPrompt === 'function') {
        const stepNumber = openingPracticeState.practiceStep === 2 ? 2 : 1;
        const basePrompt = buildGeminiBundleHintPrompt(stepNumber, context);
        if (!basePrompt) return null;
        const aesopInstruction = `\nINSTRUCCIONS ADDICIONALS:\n- Inspira cada màxima en una faula d'Esop amb animals, adaptada a l'estratègia dels escacs\n- Usa animals com a metàfora per reforçar el consell tàctic o estratègic sense perdre claredat\n`;
        return basePrompt.replace('\nGenera ara', `${aesopInstruction}\nGenera ara`);
    }

    const stepNumber = openingPracticeState.practiceStep === 2 ? 2 : 1;
    const sentenceCount = stepNumber === 1 ? 2 : 1;
    const sentenceText = sentenceCount === 1 ? '1 frase' : '2 frases';

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
- Inspira cada màxima en una faula d'Esop amb animals, adaptada a l'estratègia dels escacs
- Usa animals com a metàfora per reforçar el consell tàctic o estratègic sense perdre claredat

Genera ara ${sentenceText} específica${sentenceCount === 1 ? '' : 's'} per aquesta posició:`;
}

async function requestGeminiOpeningPracticeHint(error) {
    if (!geminiApiKey) return null;
    const prompt = buildOpeningPracticeGeminiPrompt(error);
    if (!prompt) return null;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
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

    let html = '<div style="padding:12px; background:rgba(100,150,255,0.12); border-left:3px solid #6495ed; border-radius:8px; line-height:1.6; max-height:300px; overflow-y:auto;">';
    html += '<div style="font-weight:600; color:var(--accent-gold); margin-bottom:6px;">💡 Principis d\'escacs:</div>';
    validLines.forEach(line => {
        html += `<div style="font-style:italic; margin:4px 0;">${line.trim()}</div>`;
    });
    html += '</div>';

    return html;
}

/**
 * Demana una pista bàsica (destacar caselles)
 */
function showPracticeHint() {
    if (!openingPracticeState.isPracticing) return;

    const targetMove = openingPracticeState.targetMove;
    if (!targetMove || targetMove.length < 4) return;

    const to = targetMove.substring(2, 4);

    // Destacar caselles al tauler
    highlightSquares([to], 'hint');

    $('#status').text(`💡 Pista: Mou cap a ${to}`);

    // Eliminar destacat després de 3 segons
    setTimeout(() => {
        clearHighlights();
        updatePracticeStatus();
    }, 3000);
}

/**
 * Demana una anàlisi màxima amb Gemini
 */
async function showGeminiPracticeHint() {
    if (!openingPracticeState.isPracticing) return;
    if (!geminiApiKey) {
        alert('Cal configurar la clau API de Gemini a la configuració.');
        return;
    }
    if (openingGeminiHintPending) return;

    openingGeminiHintPending = true;
    const statusEl = $('#status');
    statusEl.html('<div style="padding:8px; background:rgba(100,100,255,0.15); border-radius:8px;">🧠 Generant màxima d\'escacs...</div>');
    $('#btn-brain-hint').prop('disabled', true);

    try {
        const html = await requestGeminiOpeningPracticeHint(openingPracticeState.currentError);
        if (!html) throw new Error('No s\'ha pogut generar la màxima');
        statusEl.html(html);
    } catch (error) {
        console.error('Error en anàlisi Gemini:', error);
        statusEl.html('<div style="padding:10px; background:rgba(255,100,100,0.2); border-radius:8px;">❌ No s\'ha pogut generar la màxima. Torna-ho a provar.</div>');
    } finally {
        openingGeminiHintPending = false;
        $('#btn-brain-hint').prop('disabled', false);
    }
}

/**
 * Sol·licita anàlisi d'un moviment a Gemini
 * @param {string} fen - Posició FEN
 * @param {string} targetMove - Moviment objectiu
 * @returns {Promise<string>} Anàlisi de Gemini
 */
async function requestGeminiMoveAnalysis(fen, targetMove) {
    const prompt = `Analitza aquesta posició d'escacs i explica per què el moviment ${targetMove} és el millor:

FEN: ${fen}
Millor moviment: ${targetMove}

Proporciona:
1. Una explicació tàctica del moviment
2. Els plans principals que segueixen
3. Errors comuns a evitar en aquesta posició

Resposta en català, màxim 200 paraules.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    }

    throw new Error("No s'ha pogut obtenir resposta de Gemini");
}

/**
 * Mostra el modal amb l'anàlisi de Gemini
 * @param {string} analysis - Text d'anàlisi
 */
function showGeminiAnalysisModal(analysis) {
    const modalHtml = `
        <div class="modal-overlay" id="gemini-analysis-modal">
            <div class="modal-content">
                <div class="modal-title">🧠 Anàlisi de Gemini</div>
                <div class="gemini-analysis-content">
                    ${analysis.replace(/\n/g, '<br>')}
                </div>
                <button class="btn btn-primary" id="btn-close-gemini">Entesos!</button>
            </div>
        </div>
    `;

    $('body').append(modalHtml);

    $('#btn-close-gemini').off('click').on('click', () => {
        $('#gemini-analysis-modal').remove();
    });
}

// ============================================================================
// 7. FUNCIONS AUXILIARS
// ============================================================================

/**
 * Actualitza elements bàsics de la UI durant la pràctica
 */
function updatePracticeStatus(messageOverride = null) {
    const { practiceStep, practiceErrorIndex, practiceErrorsCount, isSequenceReady } = openingPracticeState;
    const stepLabel = practiceStep === 2 ? 'Pas 2 de 2' : 'Pas 1 de 2';
    const helperText = isSequenceReady
        ? 'Troba el millor moviment!'
        : 'Preparant la seqüència amb Stockfish...';

    const mainLine = messageOverride || helperText;
    const errorInfo = (practiceErrorIndex && practiceErrorsCount)
        ? `Error #${practiceErrorIndex} de ${practiceErrorsCount}`
        : 'Error seleccionat';

    $('#status').html(`
        <div style="margin-bottom: 8px;">
            <strong>${mainLine}</strong>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">
            ${errorInfo} | ${stepLabel}
        </div>
    `);
}

/**
 * Actualitza elements bàsics de la UI durant la pràctica
 */
function updatePracticeUI() {
    const { activeMoveNumber, activeColor, practiceStep, currentError } = openingPracticeState;
    
    // Assegurar que estem a la pantalla correcta
    $('#game-screen').show();
    $('#lesson-screen').hide();
    $('#start-screen').hide();
    
    // Actualitzar títol
    $('#game-mode-title').text(
        `🎯 Pràctica: Moviment ${activeMoveNumber} (${activeColor === 'white' ? 'Blanques' : 'Negres'})`
    );
    
    // Actualitzar status amb informació útil
    updatePracticeStatus();
    
    // Mostrar informació de l'error si està disponible
    if (currentError) {
        const errorInfo = `
            <div style="margin-top: 8px; padding: 8px; background: rgba(201,162,39,0.1); border-radius: 6px; font-size: 0.8rem;">
                <div>Millor jugada: <strong>${currentError.bestMoveSan || currentError.bestMove}</strong></div>
                <div>Pèrdua: <strong>${Math.round(currentError.cpLoss)} CP</strong></div>
            </div>
        `;
        // Opcionalment afegir això si vols mostrar més info
        // $('#status').append(errorInfo);
    }
    
    // Assegurar que els botons estan visibles i actius
    $('#btn-hint').show().prop('disabled', false).css('opacity', '1');
    $('#btn-brain-hint').show().prop('disabled', false).css('opacity', '1');
    $('#btn-practice-random-lesson').show().prop('disabled', false).css('opacity', '1');
    $('#btn-back').show();
    $('#btn-resign').hide();
    
    // Missatge informatiu sobre pistes (només primera vegada)
    if (practiceStep === 1) {
        setTimeout(() => {
            showFeedback('info', '💡 Pots usar les pistes si necessites ajuda!');
        }, 1000);
    }
}

/**
 * Mostra feedback visual a l'usuari
 * @param {string} type - 'success' o 'error'
 * @param {string} message - Missatge a mostrar
 */
function showFeedback(type, message) {
    let feedbackClass;
    switch(type) {
        case 'success':
            feedbackClass = 'feedback-success';
            break;
        case 'error':
            feedbackClass = 'feedback-error';
            break;
        case 'info':
            feedbackClass = 'feedback-info';
            break;
        default:
            feedbackClass = 'feedback-info';
    }
    
    const feedbackHtml = `
        <div class="practice-feedback ${feedbackClass}">
            ${message}
        </div>
    `;
    
    // Eliminar feedback anterior si existeix
    $('.practice-feedback').remove();
    
    // Afegir nou feedback
    $('.board-container').append(feedbackHtml);
    
    // Eliminar després de 2 segons (3 per info)
    const duration = type === 'info' ? 3000 : 2000;
    setTimeout(() => {
        $('.practice-feedback').fadeOut(() => {
            $('.practice-feedback').remove();
        });
    }, duration);
}

/**
 * Destaca caselles al tauler
 * @param {Array} squares - Array de caselles (ex: ['e2', 'e4'])
 * @param {string} type - Tipus de destacat ('hint', 'target', etc.)
 */
function highlightSquares(squares, type) {
    clearHighlights();

    squares.forEach(square => {
        $(`#myBoard .square-${square}`).addClass(`highlight-${type}`);
    });
}

/**
 * Elimina tots els destacats del tauler
 */
function clearHighlights() {
    $('#myBoard [class*="highlight-"]').removeClass(function(index, className) {
        return (className.match(/\bhighlight-\S+/g) || []).join(' ');
    });
}

// ============================================================================
// 8. SUBSTITUCIÓ DE LA FUNCIÓ ORIGINAL analyzeLastOpenings
// ============================================================================

/**
 * AQUESTA FUNCIÓ SUBSTITUEIX L'ORIGINAL analyzeLastOpenings()
 * Analitza les últimes obertures amb funcionalitat millorada
 */
function analyzeLastOpenings() {
    const entries = gameHistory.slice(-10);
    const stats = buildDetailedOpeningStats(entries);
    loadCompletedPractices();
    renderDetailedOpeningStats(stats);
    openingLessonReviewData = buildLessonReviewSummary(stats, entries.length);
    updateLessonReviewUI(openingLessonReviewData);
    return stats;
}

// ============================================================================
// 9. INICIALITZACIÓ
// ============================================================================

/**
 * Inicialitza el sistema de pràctica d'obertures
 * AQUESTA FUNCIÓ CAL CRIDAR-LA A L'INICI DE L'APP (setup o init)
 */
function initOpeningPracticeSystem() {
    // Carregar pràctiques completades
    loadCompletedPractices();

    // Afegir event listeners per pistes durant pràctica
    $('#btn-hint').off('click.practice').on('click.practice', function() {
        if (openingPracticeState.isPracticing) {
            showPracticeHint();
        }
    });

    $('#btn-brain-hint').off('click.practice').on('click.practice', function() {
        if (openingPracticeState.isPracticing) {
            showGeminiPracticeHint();
        }
    });

    $('#btn-practice-random-lesson').off('click.practice').on('click.practice', function() {
        if (openingPracticeState.isPracticing) {
            startRandomOpeningPracticeFromLesson();
        }
    });

    $('#btn-generate-lesson-review').off('click.lessonReview').on('click.lessonReview', function() {
        generateLessonReview();
    });

    console.log("Sistema de pràctica d'obertures inicialitzat");
}

// ============================================================================
// FI DEL FITXER
// ============================================================================
