// ============================================================================
// FUNCIONS PER A L'ANÀLISI I PRÀCTICA D'OBERTURES
// ============================================================================
//
// Aquest fitxer conté les funcions necessàries per:
// 1. Mostrar el nombre de jugades a revisar per cada moviment d'obertura
// 2. Obrir un calaix amb les imprecisions d'un moviment específic
// 3. Practicar moviments fins aconseguir 2 correctes al 100%
// 4. Gestionar l'estat de completitud de cada moviment
//
// ============================================================================

// Estat global per la pràctica d'obertures
let openingPracticeState = {
    activeMoveNumber: null,      // Número del moviment que s'està practicant
    activeColor: null,            // 'white' o 'black'
    correctMovesCount: 0,         // Comptador de moviments correctes consecutius
    isPracticing: false,          // Si estem en mode pràctica
    completedMoves: {},           // Objecte per guardar els moviments completats: {white: [1,2,3], black: [1,2]}
    currentPracticeFen: null,     // FEN de la posició actual de pràctica
    targetMove: null,             // Moviment objectiu que cal fer
    currentError: null            // Referència a l'error actual
};

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
                    quality: move.quality || 'unknown',
                    cpLoss: move.cpLoss || move.swing || 0,
                    bestMove: move.bestMove || '',
                    bestMoveSan: move.bestMoveSan || '',
                    fen: move.fen || '',
                    fenBefore: move.fenBefore || '',
                    comment: move.comment || '',
                    gameId: entry.timestamp || Date.now(),
                    playerMove: move.playerMove || '',
                    moveNumber: moveNumber
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
        correctMovesCount: 0,
        isPracticing: true,
        completedMoves: openingPracticeState.completedMoves || {},
        currentPracticeFen: null,
        targetMove: null,
        currentError: null
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

/**
 * Configura el tauler per la pràctica d'un moviment
 * @param {string} color - Color del jugador
 * @param {number} moveNumber - Número del moviment a practicar
 * @param {Array} errors - Errors d'aquest moviment
 */
function setupPracticeBoard(color, moveNumber, errors, errorIdx = null) {
    console.log('🎯 Iniciant pràctica...');
    
    // Seleccionar error (específic o aleatori)
    const selectedIdx = errorIdx !== null ? errorIdx : Math.floor(Math.random() * errors.length);
    const errorToPractice = errors[selectedIdx];
    
    console.log('Error seleccionat:', errorToPractice);
    
    // Guardar referència a l'error actual
    openingPracticeState.currentError = errorToPractice;

    // CRITICA: Usar fenBefore si està disponible, sinó reconstruir
    let practiceFen;
    
    if (errorToPractice.fenBefore) {
        // ✅ CAS IDEAL: Tenim el FEN abans del moviment
        practiceFen = errorToPractice.fenBefore;
        console.log('✅ Usant fenBefore:', practiceFen);
    } else if (errorToPractice.fen) {
        // ⚠️ CAS ALTERNATIU: Intentar reconstruir des del FEN després
        console.warn('⚠️ No hi ha fenBefore, intentant reconstruir...');
        try {
            const tempGame = new Chess(errorToPractice.fen);
            const history = tempGame.history({ verbose: true });
            
            if (history.length > 0) {
                // Desfer l'últim moviment per obtenir la posició anterior
                tempGame.undo();
                practiceFen = tempGame.fen();
                console.log('✅ FEN reconstruït:', practiceFen);
            } else {
                // No hi ha història, usar FEN inicial
                practiceFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
                console.warn('⚠️ No hi ha història, usant FEN inicial');
            }
        } catch (e) {
            console.error('❌ Error reconstruint FEN:', e);
            // Fallback: FEN inicial
            practiceFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        }
    } else {
        // ❌ CAS CRÍTIC: No hi ha cap FEN
        console.error('❌ No hi ha cap FEN disponible!');
        alert('Error: No es pot carregar la posició per practicar.');
        returnToLessonScreen();
        return;
    }

    // Validar el FEN abans d'usar-lo
    try {
        const testGame = new Chess(practiceFen);
        if (!testGame.fen()) {
            throw new Error('FEN invàlid');
        }
    } catch (e) {
        console.error('❌ FEN invàlid:', practiceFen, e);
        alert('Error: La posició a practicar no és vàlida.');
        returnToLessonScreen();
        return;
    }

    // Inicialitzar joc amb el FEN validat
    game = new Chess(practiceFen);
    openingPracticeState.currentPracticeFen = practiceFen;
    
    console.log('🎮 Joc inicialitzat amb FEN:', game.fen());

    // Guardar el millor moviment com a objectiu
    openingPracticeState.targetMove = errorToPractice.bestMove;
    
    console.log('🎯 Moviment objectiu:', openingPracticeState.targetMove);

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
        board = ChessBoard('myBoard', {
            draggable: true,
            position: game.fen(),
            orientation: playerColor === 'w' ? 'white' : 'black',
            onDragStart: onDragStart,
            onDrop: onDropPractice,
            onSnapEnd: onSnapEnd
        });
        
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
            <strong>Troba el millor moviment!</strong>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">
            Error #${selectedIdx + 1} de ${errors.length} | 
            Progressió: ${openingPracticeState.correctMovesCount}/2 correctes
        </div>
    `);

    // Activar botons de pista
    $('#btn-hint').show().prop('disabled', false);
    $('#btn-brain-hint').show().prop('disabled', false);
    
    // Actualitzar text dels botons
    $('#btn-hint').html('💡 Pista');
    $('#btn-brain-hint').html('<img src="brain.svg" alt="Cervell"><span>Màxima</span>');
    
    console.log('✅ Setup complet!');
}

/**
 * Gestiona la caiguda d'una peça durant la pràctica (callback del tauler)
 * @param {string} source - Casella d'origen
 * @param {string} target - Casella de destinació
 * @returns {string} 'snapback' si el moviment és invàlid
 */
function onDropPractice(source, target) {
    // Verificar si és el torn del jugador
    if (game.turn() !== playerColor) {
        return 'snapback';
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

/**
 * Comprova si el moviment practicat és correcte
 * @param {Object} move - Objecte del moviment realitzat
 */
function checkPracticeMove(move) {
    const targetMove = openingPracticeState.targetMove;

    // Analitzar amb Stockfish per verificar si és òptim
    analyzePracticeMove(move, (isCorrect, evaluation) => {
        if (isCorrect) {
            // Moviment correcte!
            openingPracticeState.correctMovesCount++;

            showFeedback('success', '✓ Excel·lent! Moviment correcte.');

            if (openingPracticeState.correctMovesCount >= 2) {
                // Completat!
                completePractice();
            } else {
                // Preparar següent intent
                setTimeout(() => {
                    setupNextPracticeAttempt();
                }, 1500);
            }
        } else {
            // Moviment incorrecte
            showFeedback('error', '✗ No és el millor moviment. Prova de nou.');

            // Desfer moviment i tornar a intentar
            game.undo();
            board.position(game.fen());
        }
    });
}

/**
 * Analitza un moviment de pràctica amb Stockfish
 * @param {Object} move - Moviment a analitzar
 * @param {Function} callback - Funció callback amb (isCorrect, evaluation)
 */
function analyzePracticeMove(move, callback) {
    if (!stockfish || !stockfishReady) {
        callback(false, null);
        return;
    }

    const fen = openingPracticeState.currentPracticeFen;

    // Configurar Stockfish per analitzar
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage('go depth 15');

    let bestMove = null;
    let evaluation = null;

    const handleMessage = (event) => {
        const line = event.data || event;

        // Capturar millor moviment
        if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            bestMove = parts[1];

            // Verificar si coincideix
            const moveUci = move.from + move.to + (move.promotion || '');
            const isCorrect = bestMove === moveUci;

            stockfish.removeEventListener('message', handleMessage);
            callback(isCorrect, evaluation);
        }

        // Capturar avaluació
        if (line.includes('score cp')) {
            const match = line.match(/score cp (-?\d+)/);
            if (match) {
                evaluation = parseInt(match[1], 10);
            }
        }
    };

    stockfish.addEventListener('message', handleMessage);
}

/**
 * Prepara el següent intent de pràctica
 */
function setupNextPracticeAttempt() {
    // Tornar a la posició inicial
    game.load(openingPracticeState.currentPracticeFen);
    board.position(game.fen());

    $('#status').text(`Intents correctes: ${openingPracticeState.correctMovesCount}/2. Continua!`);
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
                    (${activeColor === 'white' ? 'Blanques' : 'Negres'}) amb 2 moviments perfectes.
                </div>
                <div class="practice-complete-actions">
                    <button class="btn btn-primary" id="btn-practice-continue">
                        Tornar a l'anàlisi
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

    $('#btn-practice-menu').off('click').on('click', () => {
        $('#practice-complete-modal').remove();
        returnToStartScreen();
    });
}

/**
 * Torna a la pantalla de lliçons i actualitza l'anàlisi
 */
function returnToLessonScreen() {
    openingPracticeState.isPracticing = false;

    $('#game-screen').hide();
    $('#lesson-screen').show();

    // Re-analitzar i re-renderitzar amb les dades actualitzades
    analyzeLastOpenings();
}

/**
 * Torna a la pantalla d'inici
 */
function returnToStartScreen() {
    openingPracticeState.isPracticing = false;

    $('#game-screen').hide();
    $('#lesson-screen').hide();
    $('#start-screen').show();
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

/**
 * Demana una pista bàsica (destacar caselles)
 */
function showPracticeHint() {
    if (!openingPracticeState.isPracticing) return;

    const targetMove = openingPracticeState.targetMove;
    if (!targetMove || targetMove.length < 4) return;

    const from = targetMove.substring(0, 2);
    const to = targetMove.substring(2, 4);

    // Destacar caselles al tauler
    highlightSquares([from, to], 'hint');

    $('#status').text(`💡 Pista: Mou des de ${from} cap a ${to}`);

    // Eliminar destacat després de 3 segons
    setTimeout(() => {
        clearHighlights();
        $('#status').text('Troba el millor moviment!');
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

    $('#status').text('🧠 Analitzant amb Gemini...');
    $('#btn-brain-hint').prop('disabled', true);

    const fen = openingPracticeState.currentPracticeFen;
    const targetMove = openingPracticeState.targetMove;

    try {
        const analysis = await requestGeminiMoveAnalysis(fen, targetMove);

        // Mostrar anàlisi en un modal
        showGeminiAnalysisModal(analysis);

        $('#status').text('Troba el millor moviment!');
    } catch (error) {
        console.error('Error en anàlisi Gemini:', error);
        $('#status').text("Error en l'anàlisi. Torna-ho a provar.");
    } finally {
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
function updatePracticeUI() {
    const { activeMoveNumber, activeColor, correctMovesCount, currentError } = openingPracticeState;
    
    // Assegurar que estem a la pantalla correcta
    $('#game-screen').show();
    $('#lesson-screen').hide();
    $('#start-screen').hide();
    
    // Actualitzar títol
    $('#game-mode-title').text(
        `🎯 Pràctica: Moviment ${activeMoveNumber} (${activeColor === 'white' ? 'Blanques' : 'Negres'})`
    );
    
    // Actualitzar status amb informació útil
    $('#status').html(`
        <div style="margin-bottom: 8px;">
            <strong>Troba el millor moviment!</strong>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">
            Progressió: <strong style="color: var(--accent-gold);">${correctMovesCount}/2</strong> moviments correctes
        </div>
    `);
    
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
    $('#btn-back').show();
    $('#btn-resign').hide();
    
    // Missatge informatiu sobre pistes (només primera vegada)
    if (correctMovesCount === 0) {
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

    console.log("Sistema de pràctica d'obertures inicialitzat");
}

// ============================================================================
// FI DEL FITXER
// ============================================================================
