
import React, { useState, useEffect } from 'react';
import { Player, GamePhase, TileType, ZoneType, Question, MysteryEvent, ZONE_COSTS } from './types';
import { BOARD_TILES, TOTAL_TILES, PLAYER_COLORS, SUBJECTS, AVATARS } from './constants';
import { Button, Modal, Card } from './components/UI';
import { fetchQuestion, fetchMysteryEvent, fetchAICommentary, fetchExplanation } from './services/geminiService';
import { MotorChallenge, MemoryChallenge, LogicChallenge, CreativityChallenge } from './components/Challenges';

const SAVE_KEY_PREFIX = 'zd_save_';

interface SavedGame {
  id: string;
  date: string;
  players: Player[];
  currentPlayerIndex: number;
}

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>('SETUP');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceResult, setDiceResult] = useState(1);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [activeMystery, setActiveMystery] = useState<MysteryEvent | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [challengeType, setChallengeType] = useState<ZoneType | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [shake, setShake] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  // Feedback Visual y Guardado
  const [aiCommentary, setAiCommentary] = useState<string>('');
  const [particles, setParticles] = useState<{ id: number; text: string; color: string }[]>([]);
  const [questionFeedback, setQuestionFeedback] = useState<{ isCorrect: boolean; explanation: string; correctAnswer: string } | null>(null);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);

  const currentPlayer = players[currentPlayerIndex];

  // Carga de partidas al inicio
  useEffect(() => {
    const games: SavedGame[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SAVE_KEY_PREFIX)) {
        try {
          games.push(JSON.parse(localStorage.getItem(key) || ''));
        } catch (e) { console.error(e); }
      }
    }
    setSavedGames(games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, [phase]);

  const saveGame = () => {
    const id = Date.now().toString();
    const saveObj: SavedGame = {
      id,
      date: new Date().toLocaleString(),
      players,
      currentPlayerIndex
    };
    localStorage.setItem(`${SAVE_KEY_PREFIX}${id}`, JSON.stringify(saveObj));
    spawnJuice("MISIÓN GUARDADA", "#10b981");
  };

  const loadGame = (game: SavedGame) => {
    setPlayers(game.players);
    setCurrentPlayerIndex(game.currentPlayerIndex);
    setPhase('BOARD');
  };

  const deleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem(`${SAVE_KEY_PREFIX}${id}`);
    setSavedGames(prev => prev.filter(g => g.id !== id));
  };

  const spawnJuice = (text: string, color: string = '#4f46e5') => {
    const id = Date.now();
    setParticles(prev => [...prev, { id, text, color }]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 2500);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const setupGame = (count: number, names: string[], selectedAvatars: string[]) => {
    const newPlayers: Player[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      name: names[i] || `Explorador ${i + 1}`,
      avatar: selectedAvatars[i],
      color: PLAYER_COLORS[i],
      currentTileIndex: 0,
      zonePoints: 0,
      conqueredZones: [],
      inventory: [],
    }));
    setPlayers(newPlayers);
    setPhase('BOARD');
  };

  const rollDice = async () => {
    setPhase('DICE_ROLLING');
    const result = Math.floor(Math.random() * 6) + 1;
    setDiceResult(result);
    fetchAICommentary(currentPlayer.name, result).then(setAiCommentary);
    setTimeout(() => startMovement(result), 1200);
  };

  const startMovement = async (steps: number) => {
    setIsMoving(true);
    let currentSteps = 0;
    const moveStep = () => {
      if (currentSteps < steps) {
        setPlayers(prev => {
          const updated = [...prev];
          updated[currentPlayerIndex].currentTileIndex = (updated[currentPlayerIndex].currentTileIndex + 1) % TOTAL_TILES;
          return updated;
        });
        currentSteps++;
        setTimeout(moveStep, 250);
      } else {
        setIsMoving(false);
        handleTileLand();
      }
    };
    moveStep();
  };

  const handleTileLand = async () => {
    const tile = BOARD_TILES[currentPlayer.currentTileIndex];
    if (tile.type === TileType.SUBJECT) {
      setLoading(true);
      const question = await fetchQuestion(SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)]);
      setActiveQuestion(question);
      setPhase('QUESTION');
      setLoading(false);
    } else if (tile.type === TileType.MYSTERY) {
      setLoading(true);
      const event = await fetchMysteryEvent();
      setActiveMystery(event);
      setPhase('MYSTERY_EVENT');
      setLoading(false);
    } else if (tile.type === TileType.BONUS) {
      spawnJuice("+1 PTO", '#f59e0b');
      setPlayers(prev => {
        const updated = [...prev];
        updated[currentPlayerIndex].zonePoints += 1;
        return updated;
      });
      triggerShake();
      nextTurn();
    } else {
      nextTurn();
    }
  };

  const applyMystery = () => {
    if (!activeMystery) return;
    setPlayers(prev => {
      const updated = [...prev];
      const p = updated[currentPlayerIndex];
      if (activeMystery.effectType === 'POINTS') {
        p.zonePoints = Math.max(0, p.zonePoints + activeMystery.value);
        spawnJuice(`${activeMystery.value > 0 ? '+' : ''}${activeMystery.value} PTS`, '#a855f7');
        triggerShake();
      } else if (activeMystery.effectType === 'MOVE') {
        p.currentTileIndex = (p.currentTileIndex + activeMystery.value + TOTAL_TILES) % TOTAL_TILES;
      } else if (activeMystery.effectType === 'POWERUP') {
        p.inventory.push("NÚCLEO ESTELAR");
        spawnJuice("+POWERUP", '#3b82f6');
      }
      return updated;
    });
    setActiveMystery(null);
    nextTurn();
  };

  const submitAnswer = async () => {
    if (!activeQuestion) return;
    const isCorrect = answerInput.toLowerCase().trim() === activeQuestion.answer.toLowerCase().trim();
    if (isCorrect) {
      spawnJuice("+2 PUNTOS", '#4f46e5');
      setPlayers(prev => {
        const updated = [...prev];
        updated[currentPlayerIndex].zonePoints += 2;
        return updated;
      });
      triggerShake();
      setQuestionFeedback({ isCorrect: true, explanation: "¡Brillante! Tu intelecto brilla como una supernova.", correctAnswer: activeQuestion.answer });
    } else {
      setLoading(true);
      const explanation = await fetchExplanation(activeQuestion.question, activeQuestion.answer);
      setQuestionFeedback({ isCorrect: false, explanation, correctAnswer: activeQuestion.answer });
      setLoading(false);
    }
    setActiveQuestion(null);
    setAnswerInput('');
  };

  const nextTurn = () => {
    setCurrentPlayerIndex((prev) => (prev + 1) % players.length);
    setAiCommentary('');
    setQuestionFeedback(null);
    setPhase('BOARD');
  };

  const completeChallenge = (pointsAwarded = 0) => {
    setPlayers(prev => {
      const updated = [...prev];
      const p = updated[currentPlayerIndex];
      if (challengeType) {
        p.conqueredZones.push(challengeType);
        p.zonePoints += pointsAwarded;
      }
      return updated;
    });
    setChallengeType(null);
    if (players[currentPlayerIndex].conqueredZones.length >= 4) {
       setPhase('WIN_SCREEN');
    } else {
      nextTurn();
    }
  };

  if (phase === 'SETUP') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-slate-950 gap-6 overflow-y-auto custom-scrollbar">
        <div className="text-center animate-in fade-in slide-in-from-top duration-1000">
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 drop-shadow-2xl mb-1">
            ZONE DOMINATION
          </h1>
          <p className="text-slate-400 font-bold tracking-[0.2em] uppercase text-[10px] md:text-xs">Estación de Mando Galáctico</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 w-full max-w-6xl items-start">
          <SetupScreen onComplete={setupGame} onShowInstructions={() => setShowInstructions(true)} />
          
          <Card className="bg-slate-900/60 border-white/5 p-6 rounded-[2rem] flex flex-col h-full max-h-[600px]">
            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              💾 MISIONES EN PAUSA
            </h3>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
              {savedGames.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 italic py-6">
                  <span className="text-3xl mb-2">📭</span>
                  No hay misiones guardadas
                </div>
              ) : (
                savedGames.map(game => (
                  <div 
                    key={game.id} 
                    onClick={() => loadGame(game)}
                    className="bg-slate-800/40 hover:bg-indigo-600/20 border border-white/5 p-4 rounded-xl cursor-pointer transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-indigo-400 font-black text-[10px]">{game.date}</span>
                      <button 
                        onClick={(e) => deleteSave(game.id, e)}
                        className="text-rose-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {game.players.map(p => (
                        <div key={p.id} className="flex items-center gap-1 bg-black/30 px-1.5 py-0.5 rounded-lg text-[10px] font-medium border border-white/5">
                          <span>{p.avatar}</span>
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Modal isOpen={showInstructions}>
          <Card className="p-8 space-y-6 bg-slate-900 border-indigo-500/50">
            <h2 className="text-3xl font-black text-indigo-400 text-center uppercase tracking-widest">Protocolo de Misión</h2>
            <div className="space-y-4 text-slate-300 text-sm md:text-base leading-relaxed">
              <p>1. 🎲 **Movimiento**: Lanza el dado para avanzar por el tablero galáctico.</p>
              <p>2. Land on **?**: Responde preguntas académicas para ganar puntos.</p>
              <p>3. Land on **🌀**: Eventos de misterio que pueden darte puntos, moverte o darte Power-ups.</p>
              <p>4. Land on **⭐**: ¡Punto de bono directo!</p>
              <p>5. 🗺️ **Conquista**: Usa tus puntos en el Panel de Conquista para enfrentar retos de Memoria, Lógica, Creatividad o Motor.</p>
              <p>6. 🏆 **Victoria**: El primer explorador en conquistar las 4 zonas dominará la galaxia.</p>
            </div>
            <Button onClick={() => setShowInstructions(false)} className="w-full">ENTENDIDO</Button>
          </Card>
        </Modal>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative flex flex-col bg-slate-950 transition-all overflow-hidden ${shake ? 'animate-bounce' : ''}`}>
      
      <div className="absolute inset-0 z-0 opacity-30 transition-colors duration-1000 ease-in-out" style={{ background: `radial-gradient(circle at center, ${currentPlayer?.color}44 0%, #020617 80%)` }} />
      <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />

      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        {particles.map(p => (
          <div key={p.id} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl md:text-5xl font-black italic pointer-events-none" style={{ color: p.color, animation: 'floatJuice 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards', textShadow: `0 0 20px ${p.color}, 0 0 40px ${p.color}aa` }}>
            {p.text}
          </div>
        ))}
      </div>

      {/* HUD SUPERIOR */}
      <div className="p-2 md:p-4 bg-slate-900/90 backdrop-blur-3xl border-b border-white/10 flex justify-between items-center z-50 sticky top-0 shadow-xl">
        <div className="flex items-center gap-3 md:gap-6">
          <div className="relative group">
            <div className="w-12 h-12 md:w-20 md:h-20 rounded-[1rem] md:rounded-[1.5rem] flex items-center justify-center text-3xl md:text-5xl border-2 border-white/20 transition-all group-hover:scale-105 shadow-inner" style={{ backgroundColor: currentPlayer?.color }}>
               {currentPlayer?.avatar}
            </div>
            {aiCommentary && (
              <div className="absolute top-0 left-full ml-4 w-40 md:w-60 bg-indigo-950/95 border border-indigo-400/50 p-2 md:p-4 rounded-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-left duration-500 z-[60] shadow-xl">
                <p className="text-[10px] md:text-xs italic text-indigo-100 leading-tight">"{aiCommentary}"</p>
                <div className="absolute -left-1.5 top-4 w-3 h-3 bg-indigo-950 border-l border-t border-indigo-400/50 rotate-[-45deg]" />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-white leading-none mb-1">{currentPlayer?.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-black text-[10px] md:text-sm">PTS: {currentPlayer?.zonePoints}</span>
              {currentPlayer?.inventory.length > 0 && (
                <div className="flex gap-1 bg-black/30 p-1 rounded-lg border border-white/5">
                  {currentPlayer.inventory.map((item, i) => (
                    <div key={i} title={item} className="text-xs md:text-sm animate-pulse">💠</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <button 
            onClick={saveGame}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-lg hover:bg-emerald-600 transition-all shadow-lg"
            title="Guardar"
          >
            💾
          </button>
          
          <div className="flex gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-white/5">
             {Object.values(ZoneType).map(zone => (
               <div key={zone} className={`w-8 h-8 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition-all duration-500 border-2 ${currentPlayer?.conqueredZones.includes(zone) ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-800/40 border-slate-700 opacity-20'}`}>
                 <span className="text-xs md:text-lg">
                    {zone === ZoneType.CRITICAL_THINKING && '🧠'}
                    {zone === ZoneType.MEMORY && '👁️'}
                    {zone === ZoneType.CREATIVITY && '🎨'}
                    {zone === ZoneType.MOTOR && '⚡'}
                 </span>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* TABLERO */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 md:p-6 perspective-1000 z-10 overflow-hidden">
        <div className="relative grid grid-cols-13 grid-rows-13 gap-0.5 md:gap-1.5 max-w-4xl w-full aspect-square p-2 md:p-4 bg-slate-900/90 rounded-[2rem] md:rounded-[4rem] border-4 border-white/10 shadow-2xl transition-transform duration-1000" style={{ transform: 'rotateX(15deg)' }}>
          {BOARD_TILES.map((tile, i) => {
            let x = 0, y = 0;
            if (i < 13) { x = i; y = 0; }
            else if (i < 25) { x = 12; y = i - 12; }
            else if (i < 37) { x = 36 - i; y = 12; }
            else { x = 0; y = 48 - i; }

            const isCurrentTile = players.some(p => p.currentTileIndex === i && p.id === currentPlayer?.id);

            return (
              <div 
                key={i} 
                style={{ gridColumnStart: x + 1, gridRowStart: y + 1 }} 
                className={`relative border rounded-lg flex items-center justify-center text-[8px] md:text-base font-black transition-all 
                  ${tile.type === TileType.SUBJECT ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 
                    tile.type === TileType.MYSTERY ? 'bg-purple-600/30 border-purple-400/50 text-purple-200' : 
                    tile.type === TileType.BONUS ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 
                    'bg-slate-800/30 border-slate-700/50 text-slate-600'} 
                  ${isCurrentTile ? 'border-white z-20 scale-110 ring-2 ring-white/50 bg-white/10' : ''}`}
              >
                {tile.label}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {players.map((p) => p.currentTileIndex === i && (
                      <div key={p.id} className={`text-xl md:text-4xl transition-all ${p.id === currentPlayer?.id ? 'animate-bounce scale-125' : 'opacity-60'}`} style={{ filter: `drop-shadow(0 0 10px ${p.color})`, zIndex: p.id === currentPlayer?.id ? 50 : 10 }}>{p.avatar}</div>
                  ))}
                </div>
                {/* Indicador de casilla activa */}
                {isCurrentTile && (
                  <div className="absolute -top-6 bg-white text-slate-900 text-[8px] px-1 rounded font-bold animate-pulse whitespace-nowrap">AQUÍ ESTÁS</div>
                )}
              </div>
            );
          })}

          {/* CENTRO DEL TABLERO - DADO REDUCIDO */}
          <div className="col-start-5 col-end-10 row-start-5 row-end-10 flex flex-col items-center justify-center gap-3 md:gap-6 bg-slate-950/60 rounded-[2rem] md:rounded-[4rem] border border-white/5 backdrop-blur-md shadow-inner relative">
             {phase === 'DICE_ROLLING' ? (
               <div className="text-5xl md:text-8xl animate-spin text-white">🎲</div>
             ) : phase === 'BOARD' && !isMoving ? (
               <div className="flex flex-col items-center gap-2 md:gap-4">
                 <button 
                  onClick={rollDice} 
                  className="w-24 h-24 md:w-40 md:h-40 rounded-full bg-indigo-600 border-[6px] md:border-[10px] border-indigo-400 text-xl md:text-4xl font-black shadow-xl hover:scale-110 active:scale-95 transition-all relative overflow-hidden group"
                 >
                   <span className="relative z-10 text-white">TIRAR</span>
                   <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                 </button>
                 <div className="text-white font-black text-[10px] md:text-lg opacity-60">Result: {diceResult}</div>
               </div>
             ) : (
               <div className="text-xl md:text-4xl font-black italic text-white animate-pulse tracking-tight text-center px-4">EN CAMINO...</div>
             )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-900/95 flex justify-center border-t border-white/10 z-40">
        <Button onClick={() => setPhase('ZONE_CONQUEST')} className="w-full max-w-lg py-4 md:py-6 text-xl md:text-2xl rounded-2xl bg-gradient-to-r from-slate-800 to-indigo-900 hover:brightness-125 transition-all">
          🗺️ PANEL DE CONQUISTA
        </Button>
      </div>

      {/* Modales */}
      <Modal isOpen={phase === 'MYSTERY_EVENT'}>
        <Card className="bg-purple-900/90 border-purple-400 text-center space-y-6 p-10 rounded-[3rem] shadow-2xl">
          <div className="text-7xl animate-bounce mb-2">🌀</div>
          <h2 className="text-3xl font-black italic text-white leading-tight">{activeMystery?.title}</h2>
          <p className="text-lg text-purple-200 leading-snug">{activeMystery?.description}</p>
          <Button onClick={applyMystery} className="w-full py-6 bg-white text-purple-900 text-2xl font-black rounded-2xl">ACEPTAR</Button>
        </Card>
      </Modal>

      <Modal isOpen={phase === 'QUESTION' && !questionFeedback}>
        <Card className="text-center space-y-8 border-indigo-500/50 bg-slate-900/98 p-10 rounded-[3rem]">
          <div className="bg-indigo-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{activeQuestion?.subject}</div>
          <h2 className="text-3xl md:text-4xl font-black text-white italic leading-tight">"{activeQuestion?.question}"</h2>
          <input autoFocus value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitAnswer()} className="w-full bg-slate-950 border-2 border-slate-700 rounded-2xl p-5 text-center text-white text-2xl outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="..." />
          <Button onClick={submitAnswer} className="w-full py-6 text-2xl font-black bg-indigo-600">TRANSMITIR</Button>
        </Card>
      </Modal>

      <Modal isOpen={!!questionFeedback}>
        <Card className={`text-center space-y-6 p-10 rounded-[3rem] border-4 ${questionFeedback?.isCorrect ? 'border-emerald-500 bg-emerald-950/95' : 'border-rose-500 bg-rose-950/95'}`}>
          <div className="text-6xl">{questionFeedback?.isCorrect ? '✨' : '📚'}</div>
          <h2 className={`text-3xl font-black italic ${questionFeedback?.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>{questionFeedback?.isCorrect ? '¡ÉXITO!' : '¡DATA ADQUIRIDA!'}</h2>
          <div className="bg-black/30 p-6 rounded-2xl border border-white/5">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Verdad Galáctica:</p>
            <p className="text-2xl font-black text-white">{questionFeedback?.correctAnswer}</p>
          </div>
          <p className="text-white text-sm md:text-base italic leading-relaxed opacity-90">{questionFeedback?.explanation}</p>
          <Button onClick={nextTurn} className={`w-full py-6 text-2xl font-black rounded-2xl ${questionFeedback?.isCorrect ? 'bg-emerald-600' : 'bg-rose-600'}`}>SIGUIENTE</Button>
        </Card>
      </Modal>

      <Modal isOpen={phase === 'ZONE_CONQUEST' && !challengeType}>
        <Card className="space-y-6 bg-slate-900/98 border-slate-700 p-8 rounded-[3rem] shadow-2xl">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
             <h2 className="text-2xl md:text-4xl font-black italic text-indigo-400">CENTRO DE CONQUISTA</h2>
             <button onClick={() => setPhase('BOARD')} className="text-4xl text-slate-600 hover:text-white transition-all">×</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Object.values(ZoneType).map((zone) => {
              const isConquered = currentPlayer?.conqueredZones.includes(zone);
              const canAfford = currentPlayer?.zonePoints >= ZONE_COSTS[zone];
              return (
                <div key={zone} onClick={() => !isConquered && canAfford && setChallengeType(zone)} className={`relative p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 shadow-lg ${isConquered ? 'bg-emerald-500/10 border-emerald-500' : canAfford ? 'bg-indigo-600/10 border-indigo-500 cursor-pointer hover:scale-105 active:brightness-125' : 'bg-slate-800 border-slate-700 opacity-20 grayscale'}`}>
                  <div className="text-5xl">{zone === ZoneType.CRITICAL_THINKING && '🧠'}{zone === ZoneType.MEMORY && '👁️'}{zone === ZoneType.CREATIVITY && '🎨'}{zone === ZoneType.MOTOR && '⚡'}</div>
                  <div className="text-center font-black text-white text-sm md:text-xl">{isConquered ? 'OK' : `${ZONE_COSTS[zone]} PTS`}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </Modal>

      <Modal isOpen={challengeType !== null}>
        <div className="w-full max-w-xl">
           {challengeType === ZoneType.MOTOR && <MotorChallenge onComplete={completeChallenge} />}
           {challengeType === ZoneType.MEMORY && <MemoryChallenge onComplete={() => completeChallenge(0)} />}
           {challengeType === ZoneType.CRITICAL_THINKING && <LogicChallenge onComplete={() => completeChallenge(0)} />}
           {challengeType === ZoneType.CREATIVITY && <CreativityChallenge onComplete={() => completeChallenge(0)} />}
        </div>
      </Modal>

      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/98 backdrop-blur-3xl">
          <div className="text-center space-y-8 animate-pulse">
            <div className="relative w-32 h-32 mx-auto"><div className="absolute inset-0 border-8 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" /></div>
            <p className="text-white text-2xl md:text-4xl font-black italic tracking-widest">CONECTANDO...</p>
          </div>
        </div>
      )}

      {phase === 'WIN_SCREEN' && (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center text-center p-8 animate-in zoom-in duration-1000">
           <div className="text-[10rem] md:text-[15rem] mb-8 animate-bounce">{currentPlayer?.avatar}</div>
           <h1 className="text-6xl md:text-[8rem] font-black italic mb-4 leading-none" style={{ color: currentPlayer?.color }}>¡{currentPlayer?.name} DOMINA!</h1>
           <p className="text-2xl md:text-4xl text-slate-400 mb-12">Victoria galáctica total.</p>
           <Button onClick={() => window.location.reload()} className="px-16 py-8 text-3xl md:text-5xl rounded-full bg-indigo-600 font-black">NUEVA MISIÓN</Button>
        </div>
      )}

      <style>{`
        @keyframes floatJuice {
          0% { transform: translate(-50%, -50%) scale(0.6) rotate(0deg); opacity: 0; }
          15% { transform: translate(-50%, -60%) scale(1.2) rotate(-5deg); opacity: 1; }
          100% { transform: translate(-80vw, -80vh) scale(1.5) rotate(15deg); opacity: 0; }
        }
        .perspective-1000 { perspective: 1500px; }
      `}</style>
    </div>
  );
};

const SetupScreen: React.FC<{ onComplete: (count: number, names: string[], avatars: string[]) => void; onShowInstructions: () => void }> = ({ onComplete, onShowInstructions }) => {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(['Explorador 1', 'Explorador 2', 'Explorador 3', 'Explorador 4']);
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([]);

  return (
    <Card className="w-full bg-slate-900/60 border-white/10 p-6 rounded-[2rem] space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-black text-indigo-400 uppercase tracking-widest">Nueva Misión</h3>
        <button onClick={onShowInstructions} className="text-[10px] font-bold text-slate-400 hover:text-white underline">VER INSTRUCCIONES</button>
      </div>
      
      <div className="flex justify-between items-center bg-slate-800/40 p-3 rounded-xl border border-white/5">
        <span className="font-bold text-xs">Tripulantes:</span>
        <div className="flex gap-2">
          {[2, 3, 4].map(n => (
            <button key={n} onClick={() => setCount(n)} className={`w-8 h-8 rounded-lg font-black text-xs transition-all ${count === n ? 'bg-indigo-600 border border-white scale-110' : 'bg-slate-700 opacity-50'}`}>{n}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2 bg-slate-800/20 p-3 rounded-xl border border-white/5">
            <input 
              value={names[i]} 
              onChange={e => { const n = [...names]; n[i] = e.target.value; setNames(n); }} 
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-indigo-500" 
              placeholder={`Explorador ${i+1}`} 
            />
            <div className="flex flex-wrap gap-1.5 justify-center">
              {AVATARS.map(a => (
                <button 
                  key={a} 
                  onClick={() => { const s = [...selectedAvatars]; s[i] = a; setSelectedAvatars(s); }} 
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center border-2 transition-all ${selectedAvatars[i] === a ? 'bg-indigo-600 border-white scale-110' : 'bg-slate-900/30 border-slate-800 opacity-40 hover:opacity-100'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button 
        disabled={selectedAvatars.filter(Boolean).length < count} 
        onClick={() => onComplete(count, names, selectedAvatars)} 
        className="w-full py-4 text-xl rounded-xl bg-indigo-600 shadow-xl hover:scale-105"
      >
        INICIAR MISIÓN
      </Button>
    </Card>
  );
};

export default App;
