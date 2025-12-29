/**
 * ============================================================
 * EL TAULER - SISTEMA DE CALIBRATGE SIMPLIFICAT
 * ============================================================
 * 
 * Versió compacta per integrar fàcilment a l'app existent.
 * 
 * FUNCIONALITATS:
 * ---------------
 * 1. Calibratge inicial en 5 partides
 * 2. Adaptació de dificultat IA (cada partida)
 * 3. Detecció de millora real (cada 10 partides)
 * 4. Objectius personalitzats
 * 5. Recompenses (diamants ✦ blaves)
 * 6. Suggeriments d'entrenament
 * 
 * INSTRUCCIONS PER CODEX:
 * -----------------------
 * 1. Afegeix aquest fitxer al projecte
 * 2. Inicialitza amb: TaulerCalibratge.inicialitzar(stockfishWorker)
 * 3. Al final de cada partida, crida: TaulerCalibratge.finalitzarPartida(...)
 * 4. Usa TaulerCalibratge.obtenirSkillIA() per configurar Stockfish
 * 5. Guarda amb: localStorage.setItem('tauler', JSON.stringify(TaulerCalibratge.obtenirBackup()))
 * 
 * ============================================================
 */

const TaulerCalibratge = (function() {
    
    // ========================================================
    // CONFIGURACIÓ
    // ========================================================
    
    const CONFIG = {
        PARTIDES_CALIBRATGE: 5,
        RATIO_VICTORIES_OBJECTIU: 0.50,
        ELO_BASE: 400,
        ELO_MULTIPLICADOR: 22,
        PROFUNDITAT_STOCKFISH: 16
    };
    
    // ========================================================
    // ESTAT INTERN
    // ========================================================
    
    let stockfish = null;
    let estat = {
        calibratge: 'pendent',  // pendent | en_curs | completat
        nivell: 30,
        elo: 650,
        partidesCalibratge: [],
        historicResultats: [],
        historicJugador: {
            acplMitja: 80,
            precisioMitjana: 50,
            blundersMitja: 2,
            partidesJugades: 0
        },
        dimensions: { solidesa: 50, visio: 50, resilencia: 50 },
        
        // SISTEMA DE PROGRESSIÓ
        progressio: {
            historicAnalisis: [],           // Totes les anàlisis guardades
            nivellMaximAssolit: 30,         // Màxim nivell aconseguit
            partidesDesDeUltimAjust: 0,     // Comptador per ajust progressiu
            ultimaMilloraDetectada: null,   // Data última millora
            setmanaActual: 0,               // Per comparar setmanes
            estatMillora: 'normal'          // normal | millorant | estancat
        }
    };
    
    // ========================================================
    // FUNCIONS DE STOCKFISH
    // ========================================================
    
    /**
     * Obtenir avaluació d'una posició
     */
    function avaluarPosicio(fen) {
        return new Promise((resolve) => {
            let resultat = { cp: 0 };
            
            const handler = (event) => {
                const line = event.data;
                
                if (typeof line === 'string') {
                    if (line.includes('score cp')) {
                        const match = line.match(/score cp (-?\d+)/);
                        if (match) resultat.cp = parseInt(match[1]);
                    }
                    if (line.includes('score mate')) {
                        const match = line.match(/score mate (-?\d+)/);
                        if (match) resultat.cp = parseInt(match[1]) > 0 ? 9999 : -9999;
                    }
                    if (line.startsWith('bestmove')) {
                        stockfish.removeEventListener('message', handler);
                        resolve(resultat);
                    }
                }
            };
            
            stockfish.addEventListener('message', handler);
            stockfish.postMessage('position fen ' + fen);
            stockfish.postMessage('go depth ' + CONFIG.PROFUNDITAT_STOCKFISH);
        });
    }
    
    // ========================================================
    // FUNCIONS D'ANÀLISI
    // ========================================================
    
    /**
     * Classificar una jugada segons la pèrdua
     */
    function classificarJugada(perdua) {
        if (perdua <= 10) return { nom: 'excel', pes: 100 };
        if (perdua <= 25) return { nom: 'good', pes: 80 };
        if (perdua <= 50) return { nom: 'inaccuracy', pes: 50 };
        if (perdua <= 100) return { nom: 'mistake', pes: 25 };
        if (perdua <= 300) return { nom: 'blunder', pes: 0 };
        return { nom: 'catastrofe', pes: 0 };
    }
    
    /**
     * Factor d'importància segons avaluació
     */
    function factorImportancia(cp) {
        const abs = Math.abs(cp);
        if (abs < 50) return 1.2;
        if (abs < 150) return 1.0;
        if (abs < 300) return 0.7;
        if (abs < 600) return 0.4;
        return 0.2;
    }
    
    /**
     * Factor de complexitat segons FEN
     */
    function factorComplexitat(fen) {
        const peces = (fen.match(/[pnbrqkPNBRQK]/g) || []).length;
        return 0.5 + (peces / 32) * 0.5;
    }
    
    /**
     * Analitzar una partida completa
     * @param {Array} posicions - Array de strings FEN
     * @param {string} colorJugador - 'w' o 'b'
     */
    async function analitzarPartida(posicions, colorJugador) {
        const resultats = [];
        const categories = { excel: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
        
        for (let i = 0; i < posicions.length - 1; i++) {
            const fenActual = typeof posicions[i] === 'string' ? posicions[i] : posicions[i].fen;
            const fenSeguent = typeof posicions[i + 1] === 'string' ? posicions[i + 1] : posicions[i + 1].fen;
            
            // Només analitzar jugades del jugador
            const torn = fenActual.split(' ')[1];
            if (torn !== colorJugador) continue;
            
            const evalAbans = await avaluarPosicio(fenActual);
            const evalDespres = await avaluarPosicio(fenSeguent);
            
            const factor = colorJugador === 'w' ? 1 : -1;
            const perdua = Math.max(0, (evalAbans.cp * factor) - (evalDespres.cp * factor));
            
            const importancia = factorImportancia(evalAbans.cp);
            const complexitat = factorComplexitat(fenActual);
            const perduaPonderada = (perdua * importancia) / complexitat;
            
            const categoria = classificarJugada(perdua);
            categories[categoria.nom]++;
            
            resultats.push({
                perdua,
                perduaPonderada,
                pes: categoria.pes
            });
        }
        
        if (resultats.length === 0) {
            return {
                acpl: 100,
                acplPonderat: 100,
                precisioSimple: 25,
                precisioAvancada: 25,
                consistencia: 50,
                categories,
                totalJugades: 0,
                jugadesSegures: 0,
                blunders: 0
            };
        }
        
        // Calcular estadístiques
        const acpl = resultats.reduce((s, r) => s + r.perdua, 0) / resultats.length;
        const acplPonderat = resultats.reduce((s, r) => s + r.perduaPonderada, 0) / resultats.length;
        const precisioSimple = resultats.reduce((s, r) => s + r.pes, 0) / resultats.length;
        
        const mitjana = precisioSimple;
        const variancia = resultats.reduce((s, r) => s + Math.pow(r.pes - mitjana, 2), 0) / resultats.length;
        const consistencia = Math.max(0, 100 - Math.sqrt(variancia));
        
        const jugadesSegures = resultats.filter(r => r.perdua < 30).length;
        const blunders = categories.blunder + (categories.catastrofe || 0);
        
        return {
            acpl: Math.round(acpl),
            acplPonderat: Math.round(acplPonderat),
            precisioSimple: Math.round(precisioSimple),
            precisioAvancada: Math.round(precisioSimple), // Simplificat
            consistencia: Math.round(consistencia),
            categories,
            totalJugades: resultats.length,
            jugadesSegures,
            blunders
        };
    }
    
    // ========================================================
    // FUNCIONS DE CALIBRATGE
    // ========================================================
    
    /**
     * Calcular dimensions del jugador
     */
    function calcularDimensions(acpl, jugadesSegures, totalJugades, consistencia) {
        const solidesa = Math.round(100 * Math.exp(-acpl / 80));
        const visio = totalJugades > 0 ? Math.round((jugadesSegures / totalJugades) * 100) : 50;
        const resilencia = Math.round(consistencia);
        
        return {
            solidesa: Math.min(100, Math.max(0, solidesa)),
            visio: Math.min(100, Math.max(0, visio)),
            resilencia: Math.min(100, Math.max(0, resilencia))
        };
    }
    
    /**
     * Calcular nivell des de dimensions
     */
    function calcularNivell(dims) {
        return Math.round(dims.solidesa * 0.40 + dims.visio * 0.35 + dims.resilencia * 0.25);
    }
    
    /**
     * Convertir nivell a Elo
     */
    function nivellAElo(nivell) {
        return CONFIG.ELO_BASE + (nivell * CONFIG.ELO_MULTIPLICADOR);
    }
    
    /**
     * Convertir nivell a Skill de Stockfish (0-20)
     */
    function nivellASkill(nivell) {
        return Math.round(nivell / 5);
    }
    
    /**
     * Processar partida de calibratge
     */
    async function processarCalibratge(analisi, resultat, numJugades) {
        // Calcular confiança
        let confianca = 1.0;
        if (numJugades < 10) confianca *= 0.5;
        else if (numJugades < 20) confianca *= 0.8;
        if (analisi.consistencia < 50) confianca *= 0.7;
        
        // Estimar Elo d'aquesta partida
        const dims = calcularDimensions(
            analisi.acpl,
            analisi.jugadesSegures,
            analisi.totalJugades,
            analisi.consistencia
        );
        const nivellPartida = calcularNivell(dims);
        const eloPartida = nivellAElo(nivellPartida);
        
        // Afegir a partides de calibratge
        estat.partidesCalibratge.push({
            elo: eloPartida,
            confianca,
            analisi,
            resultat
        });
        
        // Si tenim 5 partides, calcular resultat final
        if (estat.partidesCalibratge.length >= CONFIG.PARTIDES_CALIBRATGE) {
            let sumaElo = 0;
            let sumaConfianca = 0;
            
            estat.partidesCalibratge.forEach(p => {
                sumaElo += p.elo * p.confianca;
                sumaConfianca += p.confianca;
            });
            
            const eloFinal = Math.round(sumaElo / sumaConfianca);
            const nivellFinal = Math.round((eloFinal - CONFIG.ELO_BASE) / CONFIG.ELO_MULTIPLICADOR);
            
            // Calcular dimensions finals (mitjana)
            const acplMitja = estat.partidesCalibratge.reduce((s, p) => s + p.analisi.acpl, 0) / CONFIG.PARTIDES_CALIBRATGE;
            const seguresMitja = estat.partidesCalibratge.reduce((s, p) => s + p.analisi.jugadesSegures, 0) / CONFIG.PARTIDES_CALIBRATGE;
            const totalMitja = estat.partidesCalibratge.reduce((s, p) => s + p.analisi.totalJugades, 0) / CONFIG.PARTIDES_CALIBRATGE;
            const consistMitja = estat.partidesCalibratge.reduce((s, p) => s + p.analisi.consistencia, 0) / CONFIG.PARTIDES_CALIBRATGE;
            
            estat.dimensions = calcularDimensions(acplMitja, seguresMitja, totalMitja, consistMitja);
            estat.nivell = nivellFinal;
            estat.elo = eloFinal;
            estat.calibratge = 'completat';
            
            return {
                completat: true,
                elo: eloFinal,
                nivell: nivellFinal,
                dimensions: estat.dimensions,
                skill: nivellASkill(nivellFinal),
                missatge: generarMissatgeCalibratge(eloFinal, estat.dimensions)
            };
        }
        
        return {
            completat: false,
            partidesRestants: CONFIG.PARTIDES_CALIBRATGE - estat.partidesCalibratge.length,
            analisi
        };
    }
    
    /**
     * Generar missatge de calibratge completat
     */
    function generarMissatgeCalibratge(elo, dims) {
        let nivellText = 'Principiant';
        if (elo > 730) nivellText = 'Novell';
        if (elo > 1060) nivellText = 'Intermedi';
        if (elo > 1390) nivellText = 'Avançat';
        if (elo > 1720) nivellText = 'Expert';
        if (elo > 2050) nivellText = 'Mestre';
        
        return `🎯 Calibratge completat!\n\nNivell: ${nivellText}\nElo: ${elo}\n\n📊 Perfil:\n• Solidesa: ${dims.solidesa}/100\n• Visió: ${dims.visio}/100\n• Resiliència: ${dims.resilencia}/100`;
    }
    
    // ========================================================
    // FUNCIONS D'ADAPTACIÓ
    // ========================================================
    
    /**
     * Adaptar dificultat després d'una partida
     */
    function adaptarDificultat(resultat, analisi) {
        estat.historicResultats.push({ resultat, precisio: analisi.precisioAvancada });
        
        // Mirar últimes 5 partides
        const recents = estat.historicResultats.slice(-5);
        const ratioVictories = recents.filter(r => r.resultat === 'victoria').length / recents.length;
        
        let ajust = 0;
        
        // Ajust principal
        if (ratioVictories > 0.60) ajust = 3;      // Guanya massa
        else if (ratioVictories < 0.40) ajust = -3; // Perd massa
        
        // Modificadors
        if (analisi.precisioAvancada > 70 && resultat === 'derrota') {
            ajust = Math.max(-1, ajust); // Juga bé però perd
        }
        if (analisi.precisioAvancada < 40 && resultat === 'victoria') {
            ajust = Math.min(0, ajust); // Guanya per sort
        }
        
        estat.nivell = Math.max(0, Math.min(100, estat.nivell + ajust));
        estat.elo = nivellAElo(estat.nivell);
        
        return {
            ajust,
            nouNivell: estat.nivell,
            nouElo: estat.elo,
            nouSkill: nivellASkill(estat.nivell),
            enZonaFlow: ratioVictories >= 0.40 && ratioVictories <= 0.60
        };
    }
    
    // ========================================================
    // FUNCIONS DE RECOMPENSES
    // ========================================================
    
    /**
     * Calcular recompenses d'una partida
     * Nota: Aquestes són estrelles de RENDIMENT (✦ blaves)
     * Diferents de les estrelles de MISSIONS (⭐ grogues)
     */
    function calcularRecompenses(analisi, resultat) {
        const recompenses = [];
        let diamants = 0;  // ✦ blaves (rendiment)
        
        // Millora personal
        if (analisi.acpl < estat.historicJugador.acplMitja * 0.9) {
            recompenses.push({ text: '🎯 Has jugat per sobre del teu nivell!', diamants: 2 });
            diamants += 2;
        }
        
        // Sense blunders
        if (analisi.blunders === 0) {
            recompenses.push({ text: '🛡️ Partida sense errors greus!', diamants: 2 });
            diamants += 2;
        }
        
        // Alta consistència
        if (analisi.consistencia > 80) {
            recompenses.push({ text: '⚡ Joc molt consistent!', diamants: 1 });
            diamants += 1;
        }
        
        // Resultat
        if (resultat === 'victoria') {
            recompenses.push({ text: '✓ Victòria!', diamants: 1 });
            diamants += 1;
        } else if (resultat === 'derrota' && analisi.precisioAvancada > 60) {
            recompenses.push({ text: '📚 Has perdut, però has jugat bé!', diamants: 1 });
            diamants += 1;
        }
        
        // Actualitzar historial
        const n = estat.historicJugador.partidesJugades;
        estat.historicJugador.acplMitja = (estat.historicJugador.acplMitja * n + analisi.acpl) / (n + 1);
        estat.historicJugador.precisioMitjana = (estat.historicJugador.precisioMitjana * n + analisi.precisioAvancada) / (n + 1);
        estat.historicJugador.blundersMitja = ((estat.historicJugador.blundersMitja || 2) * n + analisi.blunders) / (n + 1);
        estat.historicJugador.partidesJugades++;
        
        return {
            recompenses,
            diamants,  // ✦ blaves (rendiment)
            missatge: recompenses.length > 0 ? recompenses[0].text : 'Continua practicant!',
            simbolHtml: '<span style="color: #4A90D9;">✦</span>' // Per mostrar a la UI
        };
    }
    
    // ========================================================
    // FUNCIONS DE PROGRESSIÓ I MILLORA
    // ========================================================
    
    /**
     * Guardar anàlisi a l'històric
     */
    function guardarAnalisiHistoric(analisi) {
        estat.progressio.historicAnalisis.push({
            data: Date.now(),
            acpl: analisi.acpl,
            precisio: analisi.precisioAvancada,
            consistencia: analisi.consistencia,
            blunders: analisi.blunders,
            jugadesSegures: analisi.jugadesSegures,
            totalJugades: analisi.totalJugades
        });
        
        // Mantenir només últimes 100 partides
        if (estat.progressio.historicAnalisis.length > 100) {
            estat.progressio.historicAnalisis = estat.progressio.historicAnalisis.slice(-100);
        }
    }
    
    /**
     * Calcular mitjana d'un array
     */
    function mitjana(arr) {
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    
    /**
     * Detectar si el jugador està millorant de veritat
     * Compara les últimes 10 partides amb les 10 anteriors
     */
    function detectarMillora() {
        const historic = estat.progressio.historicAnalisis;
        
        if (historic.length < 15) {
            return { detectat: false, motiu: 'poques_partides' };
        }
        
        const ultimes10 = historic.slice(-10);
        const anteriors10 = historic.slice(-20, -10);
        
        if (anteriors10.length < 5) {
            return { detectat: false, motiu: 'poques_partides' };
        }
        
        // Comparar mètriques
        const acplUltim = mitjana(ultimes10.map(a => a.acpl));
        const acplAnterior = mitjana(anteriors10.map(a => a.acpl));
        
        const precisioUltim = mitjana(ultimes10.map(a => a.precisio));
        const precisioAnterior = mitjana(anteriors10.map(a => a.precisio));
        
        const blundersUltim = mitjana(ultimes10.map(a => a.blunders));
        const blundersAnterior = mitjana(anteriors10.map(a => a.blunders));
        
        // Calcular percentatges de canvi
        const canviAcpl = ((acplAnterior - acplUltim) / acplAnterior) * 100;
        const canviPrecisio = ((precisioUltim - precisioAnterior) / precisioAnterior) * 100;
        const canviBlunders = ((blundersAnterior - blundersUltim) / Math.max(1, blundersAnterior)) * 100;
        
        // Puntuació de millora (positiu = millora)
        const puntuacioMillora = (canviAcpl * 0.4) + (canviPrecisio * 0.4) + (canviBlunders * 0.2);
        
        return {
            detectat: true,
            millorant: puntuacioMillora > 5,    // Millora >5%
            estancat: puntuacioMillora < -5 || (puntuacioMillora >= -5 && puntuacioMillora <= 5 && historic.length > 30),
            puntuacio: Math.round(puntuacioMillora * 10) / 10,
            detalls: {
                acpl: { abans: Math.round(acplAnterior), ara: Math.round(acplUltim), canvi: Math.round(canviAcpl) },
                precisio: { abans: Math.round(precisioAnterior), ara: Math.round(precisioUltim), canvi: Math.round(canviPrecisio) },
                blunders: { abans: Math.round(blundersAnterior * 10) / 10, ara: Math.round(blundersUltim * 10) / 10, canvi: Math.round(canviBlunders) }
            }
        };
    }
    
    /**
     * Aplicar ajust progressiu
     * Empeny el jugador cap amunt cada 10 partides si no ha baixat
     */
    function aplicarAjustProgressiu() {
        estat.progressio.partidesDesDeUltimAjust++;
        
        let ajust = 0;
        let missatge = null;
        
        if (estat.progressio.partidesDesDeUltimAjust >= 10) {
            // Cada 10 partides, avaluar
            const millora = detectarMillora();
            
            if (millora.detectat) {
                if (millora.millorant) {
                    // Està millorant → pujar nivell més agressivament
                    ajust = 2;
                    estat.progressio.estatMillora = 'millorant';
                    estat.progressio.ultimaMilloraDetectada = Date.now();
                    missatge = {
                        tipus: 'millora',
                        text: `📈 Estàs millorant! ACPL: ${millora.detalls.acpl.canvi > 0 ? '-' : '+'}${Math.abs(millora.detalls.acpl.canvi)}%`,
                        detalls: millora.detalls
                    };
                } else if (millora.estancat) {
                    // Estancat → empenta suau + suggeriment
                    ajust = 1;
                    estat.progressio.estatMillora = 'estancat';
                    missatge = {
                        tipus: 'estancat',
                        text: '🎯 Sembla que estàs estancat. Prova els exercicis d\'entrenament!',
                        suggeriment: generarSuggerimentEntrenament()
                    };
                } else {
                    // Normal → empenta mínima
                    ajust = 1;
                    estat.progressio.estatMillora = 'normal';
                }
            }
            
            // Aplicar ajust
            if (ajust > 0 && estat.nivell >= estat.progressio.nivellMaximAssolit - 5) {
                estat.nivell = Math.min(100, estat.nivell + ajust);
                estat.elo = nivellAElo(estat.nivell);
            }
            
            // Actualitzar màxim
            if (estat.nivell > estat.progressio.nivellMaximAssolit) {
                estat.progressio.nivellMaximAssolit = estat.nivell;
            }
            
            estat.progressio.partidesDesDeUltimAjust = 0;
        }
        
        return { ajust, missatge };
    }
    
    /**
     * Generar suggeriment d'entrenament basat en febleses
     */
    function generarSuggerimentEntrenament() {
        const historic = estat.progressio.historicAnalisis.slice(-10);
        
        if (historic.length === 0) {
            return { area: 'general', exercici: 'Juga més partides per identificar àrees de millora' };
        }
        
        const acplMitja = mitjana(historic.map(a => a.acpl));
        const blundersMitja = mitjana(historic.map(a => a.blunders));
        const precisioMitja = mitjana(historic.map(a => a.precisio));
        
        // Identificar problema principal
        if (blundersMitja > 2) {
            return {
                area: 'tactica',
                exercici: 'Practica puzzles tàctics per reduir errors greus',
                prioritat: 'alta'
            };
        }
        
        if (acplMitja > 80) {
            return {
                area: 'precisio',
                exercici: 'Juga partides més lentes i pensa cada jugada',
                prioritat: 'alta'
            };
        }
        
        if (precisioMitja < 50) {
            return {
                area: 'posicional',
                exercici: 'Estudia partides de mestres i els seus plans',
                prioritat: 'mitjana'
            };
        }
        
        // Mirar dimensions
        if (estat.dimensions.solidesa < estat.dimensions.visio) {
            return {
                area: 'defensa',
                exercici: 'Practica posicions defensives i finals',
                prioritat: 'mitjana'
            };
        }
        
        return {
            area: 'general',
            exercici: 'Continua jugant i revisant les teves partides',
            prioritat: 'baixa'
        };
    }
    
    /**
     * Calcular objectius personalitzats per la propera partida
     */
    function calcularObjectius() {
        const h = estat.historicJugador;
        
        return {
            acplObjectiu: Math.round(h.acplMitja * 0.95),      // 5% millor
            precisioObjectiu: Math.round(h.precisioMitjana * 1.05), // 5% millor
            maxBlunders: Math.max(0, Math.floor(h.blundersMitja || 2) - 1), // 1 menys
            
            // Missatge motivacional
            missatge: `🎯 Objectiu: ACPL < ${Math.round(h.acplMitja * 0.95)}, Precisió > ${Math.round(h.precisioMitjana * 1.05)}%`
        };
    }
    
    /**
     * Avaluar si s'han assolit els objectius
     */
    function avaluarObjectius(analisi) {
        const objectius = calcularObjectius();
        const resultats = [];
        
        if (analisi.acpl < objectius.acplObjectiu) {
            resultats.push({
                assolit: true,
                tipus: 'acpl',
                text: `✅ ACPL objectiu assolit! (${analisi.acpl} < ${objectius.acplObjectiu})`,
                diamants: 1
            });
        }
        
        if (analisi.precisioAvancada > objectius.precisioObjectiu) {
            resultats.push({
                assolit: true,
                tipus: 'precisio',
                text: `✅ Precisió objectiu assolida! (${analisi.precisioAvancada}% > ${objectius.precisioObjectiu}%)`,
                diamants: 1
            });
        }
        
        if (analisi.blunders <= objectius.maxBlunders) {
            resultats.push({
                assolit: true,
                tipus: 'blunders',
                text: `✅ Control d'errors! (${analisi.blunders} ≤ ${objectius.maxBlunders})`,
                diamants: 1
            });
        }
        
        return {
            objectius,
            resultats,
            diamantsExtra: resultats.reduce((sum, r) => sum + (r.diamants || 0), 0),
            totAssolit: resultats.length >= 2
        };
    }
    
    // ========================================================
    // API PÚBLICA
    // ========================================================
    
    return {
        /**
         * INICIALITZAR - Cridar primer de tot
         * @param {Worker} stockfishWorker - Worker de Stockfish
         */
        inicialitzar: function(stockfishWorker) {
            stockfish = stockfishWorker;
            
            // Carregar estat guardat
            try {
                const guardat = localStorage.getItem('tauler_calibratge_estat');
                if (guardat) {
                    estat = JSON.parse(guardat);
                }
            } catch (e) {
                console.warn('No s\'ha pogut carregar estat guardat');
            }
            
            return estat.calibratge;
        },
        
        /**
         * COMENÇAR CALIBRATGE
         */
        iniciarCalibratge: function() {
            estat.calibratge = 'en_curs';
            estat.partidesCalibratge = [];
            return {
                missatge: `Començarem amb ${CONFIG.PARTIDES_CALIBRATGE} partides per determinar el teu nivell.`,
                partides: CONFIG.PARTIDES_CALIBRATGE
            };
        },
        
        /**
         * FINALITZAR PARTIDA - Cridar al final de cada partida
         * @param {Array} posicions - Array de FENs de la partida
         * @param {string} colorJugador - 'w' o 'b'
         * @param {string} resultat - 'victoria', 'derrota' o 'taules'
         * @returns {Promise} Resultat de l'anàlisi
         */
        finalitzarPartida: async function(posicions, colorJugador, resultat) {
            // Analitzar partida
            const analisi = await analitzarPartida(posicions, colorJugador);
            
            let resultatFinal = { analisi };
            
            if (estat.calibratge === 'en_curs') {
                // Partida de calibratge
                const calibratge = await processarCalibratge(analisi, resultat, posicions.length);
                resultatFinal.calibratge = calibratge;
                
            } else if (estat.calibratge === 'completat') {
                // Partida normal
                
                // 1. Guardar a l'històric
                guardarAnalisiHistoric(analisi);
                
                // 2. Adaptar dificultat (curt termini)
                resultatFinal.adaptacio = adaptarDificultat(resultat, analisi);
                
                // 3. Calcular recompenses base
                resultatFinal.recompenses = calcularRecompenses(analisi, resultat);
                
                // 4. Avaluar objectius personalitzats
                resultatFinal.objectius = avaluarObjectius(analisi);
                
                // Afegir diamants extra per objectius
                resultatFinal.recompenses.diamants += resultatFinal.objectius.diamantsExtra;
                
                // 5. Aplicar progressió (llarg termini)
                resultatFinal.progressio = aplicarAjustProgressiu();
                
                // 6. Detectar millora real
                resultatFinal.millora = detectarMillora();
            }
            
            // Guardar estat
            this.guardarEstat();
            
            return resultatFinal;
        },
        
        /**
         * OBTENIR SKILL IA - Per configurar Stockfish
         * @returns {number} Skill level (0-20)
         */
        obtenirSkillIA: function() {
            return nivellASkill(estat.nivell);
        },
        
        /**
         * OBTENIR ELO IA
         */
        obtenirEloIA: function() {
            return estat.elo;
        },
        
        /**
         * OBTENIR ESTAT COMPLET
         */
        obtenirEstat: function() {
            return {
                calibratge: estat.calibratge,
                nivell: estat.nivell,
                elo: estat.elo,
                skill: nivellASkill(estat.nivell),
                dimensions: estat.dimensions,
                partidesCalibratge: estat.partidesCalibratge.length,
                
                // Progressió
                nivellMaxim: estat.progressio.nivellMaximAssolit,
                estatMillora: estat.progressio.estatMillora,
                partidesJugades: estat.progressio.historicAnalisis.length
            };
        },
        
        /**
         * OBTENIR OBJECTIUS ACTUALS
         */
        obtenirObjectius: function() {
            return calcularObjectius();
        },
        
        /**
         * OBTENIR ESTADÍSTIQUES DE MILLORA
         */
        obtenirEstadistiquesMilora: function() {
            const millora = detectarMillora();
            
            return {
                ...millora,
                estatActual: estat.progressio.estatMillora,
                nivellMaxim: estat.progressio.nivellMaximAssolit,
                suggeriment: generarSuggerimentEntrenament()
            };
        },
        
        /**
         * OBTENIR GRÀFIC DE PROGRÉS
         * Retorna dades per mostrar evolució
         */
        obtenirDadesProgres: function() {
            const historic = estat.progressio.historicAnalisis;
            
            // Agrupar per blocs de 5 partides
            const blocs = [];
            for (let i = 0; i < historic.length; i += 5) {
                const bloc = historic.slice(i, i + 5);
                if (bloc.length >= 3) {
                    blocs.push({
                        index: blocs.length,
                        acpl: Math.round(mitjana(bloc.map(a => a.acpl))),
                        precisio: Math.round(mitjana(bloc.map(a => a.precisio))),
                        blunders: Math.round(mitjana(bloc.map(a => a.blunders)) * 10) / 10
                    });
                }
            }
            
            return {
                blocs,
                tendencia: estat.progressio.estatMillora,
                totalPartides: historic.length
            };
        },
        
        /**
         * GUARDAR ESTAT
         */
        guardarEstat: function() {
            localStorage.setItem('tauler_calibratge_estat', JSON.stringify(estat));
        },
        
        /**
         * CARREGAR DES DE BACKUP EXISTENT
         * @param {Object} backup - Backup JSON del Tauler
         */
        carregarDesDeBackup: function(backup) {
            if (backup.calibratgeNou) {
                // Ja té el nou sistema
                estat = {
                    calibratge: backup.calibratgeNou.estatCalibratge || 'pendent',
                    nivell: backup.calibratgeNou.nivell || 30,
                    elo: backup.elo || 650,
                    partidesCalibratge: backup.calibratgeNou.calibratgePartides || [],
                    historicResultats: backup.calibratgeNou.adaptador?.historicResultats || [],
                    historicJugador: backup.calibratgeNou.recompenses || { acplMitja: 80, precisioMitjana: 50, partidesJugades: 0 },
                    dimensions: backup.calibratgeNou.dimensions || { solidesa: 50, visio: 50, resilencia: 50 },
                    
                    // Progressió
                    progressio: backup.calibratgeNou.progressio || {
                        historicAnalisis: [],
                        nivellMaximAssolit: backup.calibratgeNou.nivell || 30,
                        partidesDesDeUltimAjust: 0,
                        ultimaMilloraDetectada: null,
                        setmanaActual: 0,
                        estatMillora: 'normal'
                    }
                };
            } else {
                // Migrar des de backup antic
                const nivell = Math.round((backup.elo - CONFIG.ELO_BASE) / CONFIG.ELO_MULTIPLICADOR);
                estat = {
                    calibratge: backup.isCalibrating ? 'en_curs' : (backup.totalGamesPlayed > 5 ? 'completat' : 'pendent'),
                    nivell: Math.max(0, Math.min(100, nivell)),
                    elo: backup.elo || 650,
                    partidesCalibratge: [],
                    historicResultats: [],
                    historicJugador: { acplMitja: 80, precisioMitjana: 50, partidesJugades: backup.totalGamesPlayed || 0 },
                    dimensions: { solidesa: 50, visio: 50, resilencia: 50 },
                    
                    // Progressió nova
                    progressio: {
                        historicAnalisis: [],
                        nivellMaximAssolit: Math.max(0, Math.min(100, nivell)),
                        partidesDesDeUltimAjust: 0,
                        ultimaMilloraDetectada: null,
                        setmanaActual: 0,
                        estatMillora: 'normal'
                    }
                };
            }
        },
        
        /**
         * OBTENIR BACKUP ACTUALITZAT
         * Per afegir al backup existent del Tauler
         */
        obtenirBackup: function() {
            return {
                calibratgeNou: {
                    estatCalibratge: estat.calibratge,
                    nivell: estat.nivell,
                    dimensions: estat.dimensions,
                    calibratgePartides: estat.partidesCalibratge,
                    adaptador: {
                        nivell: estat.nivell,
                        historicResultats: estat.historicResultats
                    },
                    recompenses: estat.historicJugador,
                    
                    // Progressió
                    progressio: estat.progressio
                },
                elo: estat.elo,
                currentElo: estat.elo,
                aiDifficulty: nivellASkill(estat.nivell)
            };
        },
        
        /**
         * REINICIAR TOT
         */
        reiniciar: function() {
            estat = {
                calibratge: 'pendent',
                nivell: 30,
                elo: 650,
                partidesCalibratge: [],
                historicResultats: [],
                historicJugador: { acplMitja: 80, precisioMitjana: 50, blundersMitja: 2, partidesJugades: 0 },
                dimensions: { solidesa: 50, visio: 50, resilencia: 50 },
                
                progressio: {
                    historicAnalisis: [],
                    nivellMaximAssolit: 30,
                    partidesDesDeUltimAjust: 0,
                    ultimaMilloraDetectada: null,
                    setmanaActual: 0,
                    estatMillora: 'normal'
                }
            };
            localStorage.removeItem('tauler_calibratge_estat');
        }
    };
})();

// Exportar per mòduls
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaulerCalibratge;
}
