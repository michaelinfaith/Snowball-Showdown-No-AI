
import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameStatus, LevelConfig, PowerUpType, LeaderboardEntry } from './types';
import { generateLevel, getGameOverMessage } from './services/geminiService';
import { initAudio, playSound, startMusic, stopMusic } from './services/soundService';
import { Play, RotateCcw, Heart, Snowflake, Skull, Music, VolumeX, Zap, Trophy, Pause, X, Shield } from 'lucide-react';
import { CANVAS_HEIGHT, CANVAS_WIDTH, BASE_KILLS_NEEDED, KILLS_INCREASE_PER_LEVEL } from './constants';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [levelConfig, setLevelConfig] = useState<LevelConfig | null>(null);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(3);
  const [maxHp, setMaxHp] = useState(3);
  const [shieldHp, setShieldHp] = useState(0);
  const [lives, setLives] = useState(3);
  const [loadingText, setLoadingText] = useState("Preparing Snowballs...");
  const [gameOverMsg, setGameOverMsg] = useState("");
  const [scale, setScale] = useState(1);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [powerups, setPowerups] = useState<PowerUpType[]>([]);
  const [killsThisLevel, setKillsThisLevel] = useState(0);
  
  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [showLeaderboardInput, setShowLeaderboardInput] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const maxWidth = window.innerWidth * 0.95;
      const maxHeight = window.innerHeight * 0.95;
      const scaleX = maxWidth / CANVAS_WIDTH;
      const scaleY = maxHeight / CANVAS_HEIGHT;
      const newScale = Math.min(scaleX, scaleY, 1.2); // Limit max scale for desktop
      setScale(newScale);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    
    try {
      const saved = localStorage.getItem('snowball_leaderboard');
      if (saved) {
        setLeaderboard(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load leaderboard from storage", e);
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if ((status === GameStatus.PLAYING || status === GameStatus.PAUSED) && musicEnabled) {
      startMusic();
    } else {
      stopMusic();
    }
  }, [status, musicEnabled]);

  const startGame = async () => {
    initAudio();
    setScore(0);
    setCurrentLevel(1);
    setPowerups([]);
    setMaxHp(3);
    setShieldHp(0);
    setLives(3);
    setMusicEnabled(true);
    setShowLeaderboardInput(false);
    setKillsThisLevel(0);
    loadLevel(1);
  };
  
  const handleContinue = () => {
     setHp(maxHp);
     setShieldHp(0);
     setStatus(GameStatus.LOADING_LEVEL); 
     setTimeout(() => setStatus(GameStatus.PLAYING), 1000);
  };

  const loadLevel = async (level: number, offensivePowerupCount: number = 0) => {
    setStatus(GameStatus.LOADING_LEVEL);
    setLoadingText(`Scouting Level ${level}...`);
    setKillsThisLevel(0);
    
    try {
      const config = await generateLevel(level, offensivePowerupCount);
      setLevelConfig(config);
      setLoadingText("Ready!");
      setTimeout(() => setStatus(GameStatus.PLAYING), 1000);
    } catch (err) {
      console.error("Failed to load level", err);
      setLoadingText("Snowstorm interference. Retrying...");
    }
  };

  const handleGameOver = async (finalScore: number) => {
    setStatus(GameStatus.GAME_OVER);
    if (lives <= 0) {
      const lowestTopScore = leaderboard.length < 5 ? 0 : leaderboard[leaderboard.length - 1].score;
      if (finalScore > lowestTopScore || leaderboard.length < 5) {
         setShowLeaderboardInput(true);
      }
    }
    const msg = await getGameOverMessage(finalScore, currentLevel);
    setGameOverMsg(msg);
  };

  const submitScore = () => {
    if (!playerName.trim()) return;
    const newEntry: LeaderboardEntry = {
      name: playerName.trim().substring(0, 10),
      score: score,
      level: currentLevel,
      date: new Date().toISOString()
    };
    const newBoard = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setLeaderboard(newBoard);
    try {
      localStorage.setItem('snowball_leaderboard', JSON.stringify(newBoard));
    } catch (e) {
      console.error("Failed to save leaderboard", e);
    }
    setShowLeaderboardInput(false);
  };

  const handleLevelComplete = (levelScore: number) => {
    playSound('jingle_bells');
    
    // Prune Duplicates: Keep unique powerups, but allow ALL Vitality stacks
    let nextPowerups: PowerUpType[] = [];
    const seen = new Set<PowerUpType>();
    
    powerups.forEach(p => {
        if (p === 'VITALITY') {
            nextPowerups.push(p);
        } else {
            if (!seen.has(p)) {
                nextPowerups.push(p);
                seen.add(p);
            }
        }
    });

    // Boss Rewards (Level 7, 14, 21...)
    if (currentLevel % 7 === 0) {
       const rewardPool: PowerUpType[] = ['RAPID_FIRE', 'TRIPLE_SHOT', 'VITALITY'];
       const newPower = rewardPool[Math.floor(Math.random() * rewardPool.length)];
       
       nextPowerups.push(newPower);
       
       // Sync Vitality UI state
       if (newPower === 'VITALITY') {
           setMaxHp(m => m + 1);
       }
    }

    setPowerups(nextPowerups);

    const nextLevel = currentLevel + 1;
    setCurrentLevel(nextLevel);
    
    // Calculate offensive powerups for difficulty scaling (Excluding Vitality)
    const offensiveCount = nextPowerups.filter(p => p !== 'VITALITY').length;
    
    loadLevel(nextLevel, offensiveCount);
  };
  
  const addPowerup = (type: PowerUpType) => {
     setPowerups(prev => [...prev, type]);
     if (type === 'VITALITY') {
         setMaxHp(m => m + 1);
     }
  };

  const removePowerup = (type?: PowerUpType, count: number = 1) => {
      setPowerups(prev => {
          let updated = [...prev];
          for (let i = 0; i < count; i++) {
              if (updated.length === 0) break;
              if (type) {
                  const idx = updated.indexOf(type);
                  if (idx > -1) updated.splice(idx, 1);
              } else {
                  const idx = Math.floor(Math.random() * updated.length);
                  updated.splice(idx, 1);
              }
          }
          return updated;
      });
  };
  
  const handleHealthUpdate = (current: number, max: number, shield: number) => {
      setHp(current);
      setMaxHp(max);
      setShieldHp(shield);
  };

  const handleScoreUpdate = (s: number) => {
      setScore(s);
  };
  
  const toggleMusic = () => setMusicEnabled(!musicEnabled);
  const togglePause = () => setStatus(s => s === GameStatus.PLAYING ? GameStatus.PAUSED : GameStatus.PLAYING);
  const toggleLeaderboard = () => setShowLeaderboardModal(!showLeaderboardModal);

  const renderHeart = (index: number) => (
    <Heart 
      key={`hp-${index}`} 
      className={`w-6 h-6 sm:w-8 sm:h-8 ${index < hp ? 'text-red-500 fill-red-500' : 'text-slate-300'}`} 
    />
  );
  
  const renderShield = (index: number) => (
    <Shield
      key={`sh-${index}`}
      className={`w-6 h-6 sm:w-8 sm:h-8 ${index < shieldHp ? 'text-blue-400 fill-blue-400' : 'text-slate-700'}`}
    />
  );
  
  const killsNeeded = BASE_KILLS_NEEDED + (currentLevel - 1) * KILLS_INCREASE_PER_LEVEL;

  return (
    <div className="min-h-screen w-full bg-slate-900 font-sans select-none flex items-center justify-center py-8">
        {/* Top Bar */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-50 pointer-events-none">
             <div className="flex flex-col gap-1 pointer-events-auto">
                 <div className="bg-white/90 backdrop-blur rounded p-2 shadow-lg">
                    <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={`life-${i}`} className={`w-3 h-3 rounded-full ${i < lives ? 'bg-green-500' : 'bg-slate-300'}`} />
                        ))}
                        <span className="text-xs font-bold text-slate-500 ml-1">LIVES</span>
                    </div>
                    <div className="flex items-center gap-1">
                       {Array.from({ length: maxHp }).map((_, i) => renderHeart(i))}
                    </div>
                    {shieldHp > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                             {Array.from({ length: 3 }).map((_, i) => renderShield(i))}
                        </div>
                    )}
                 </div>
                 <div className="flex flex-wrap gap-1 max-w-[200px]">
                   {powerups.map((p, i) => (
                     <span key={`${p}-${i}`} className="text-[9px] bg-yellow-400 text-yellow-900 px-1 rounded font-bold">{p.replace('HELPER_', 'BOT ').replace('_',' ')}</span>
                   ))}
                 </div>
             </div>

             <div className="flex flex-col items-end gap-2 pointer-events-auto">
                 <div className="bg-white/90 backdrop-blur rounded p-2 shadow-lg text-right">
                    <div className="text-xl font-black text-slate-800">{score.toLocaleString()}</div>
                    <div className="text-xs font-bold text-slate-500">LEVEL {currentLevel}</div>
                    {levelConfig?.isBossLevel ? (
                       <div className="text-xs font-bold text-red-500 uppercase tracking-wider animate-pulse">BOSS FIGHT</div>
                    ) : (
                       <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Goal: {killsThisLevel} / {killsNeeded} Kills</div>
                    )}
                 </div>
                 
                 <div className="flex gap-2">
                    <button onClick={toggleMusic} className="bg-black/20 p-2 rounded-full hover:bg-black/40 text-white">
                       {musicEnabled ? <Music className="w-5 h-5"/> : <VolumeX className="w-5 h-5"/>}
                    </button>
                    {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
                       <button onClick={togglePause} className="bg-black/20 p-2 rounded-full hover:bg-black/40 text-white">
                          {status === GameStatus.PAUSED ? <Play className="w-5 h-5"/> : <Pause className="w-5 h-5"/>}
                       </button>
                    )}
                 </div>
             </div>
        </div>

        {/* Game Wrapper */}
        <div 
          className="relative shadow-2xl transition-transform duration-300 origin-center rounded-xl"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${scale})` }}
        >
          <GameCanvas 
            status={status}
            levelConfig={levelConfig}
            activePowerups={powerups}
            lives={lives}
            onGameOver={handleGameOver}
            onLevelComplete={handleLevelComplete}
            onScoreUpdate={setScore}
            onHealthUpdate={handleHealthUpdate}
            onAddPowerup={addPowerup}
            onRemovePowerup={removePowerup}
            onLoseLife={() => setLives(l => l - 1)}
            onProgressUpdate={setKillsThisLevel}
          />

          {status === GameStatus.MENU && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white z-10">
              <h1 className="text-6xl font-black mb-4 drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-white text-center">
                SNOWBALL<br/>SHOWDOWN
              </h1>
              <p className="mb-8 text-xl text-sky-100 max-w-md text-center leading-relaxed">
                Drag to Move • Auto-Throw<br/>
                <span className="text-sm opacity-75">(Gemini AI Generated Levels)</span>
              </p>
              <button onClick={startGame} className="group flex items-center gap-3 bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-full font-bold text-xl transition-all shadow-xl hover:scale-105 active:scale-95 mb-8">
                <Play className="w-6 h-6 fill-current" /> Start Fight
              </button>
              <button onClick={toggleLeaderboard} className="text-sky-300 hover:text-white flex items-center gap-2">
                 <Trophy className="w-5 h-5"/> {showLeaderboardModal ? "Hide Leaderboard" : "Show Leaderboard"}
              </button>
              {showLeaderboardModal && leaderboard.length > 0 && (
                <div className="absolute bottom-4 right-4 bg-slate-800/90 p-6 rounded-lg w-64 border border-slate-700 shadow-xl z-20">
                  <div className="flex items-center justify-between mb-4 text-yellow-400">
                    <div className="flex gap-2"><Trophy className="w-5 h-5" /><h3 className="font-bold text-lg">Top 5</h3></div>
                    <button onClick={toggleLeaderboard}><X className="w-4 h-4"/></button>
                  </div>
                  {leaderboard.map((entry, i) => (
                    <div key={i} className="flex justify-between items-center text-sm mb-2 text-slate-300 border-b border-slate-700 pb-2 last:border-0 last:pb-0">
                      <div className="flex flex-col">
                        <span className="font-bold text-white">{i+1}. {entry.name}</span>
                        <span className="text-[10px] text-slate-500">Lvl {entry.level}</span>
                      </div>
                      <span className="font-mono text-yellow-400 font-bold">{entry.score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {status === GameStatus.PAUSED && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white z-20">
               <h2 className="text-4xl font-bold mb-8">PAUSED</h2>
               <div className="flex flex-col gap-4">
                  <button onClick={togglePause} className="bg-blue-500 hover:bg-blue-400 text-white px-8 py-3 rounded-full font-bold text-lg flex items-center justify-center gap-2">
                     <Play className="w-5 h-5" /> Resume
                  </button>
                  <button onClick={() => setStatus(GameStatus.MENU)} className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-full font-bold text-lg">
                     Quit to Menu
                  </button>
               </div>
            </div>
          )}

          {status === GameStatus.LOADING_LEVEL && (
            <div className="absolute inset-0 bg-sky-900/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white z-10">
               <Snowflake className="w-16 h-16 animate-spin mb-6 text-sky-300" />
               <h2 className="text-3xl font-bold mb-2">{loadingText}</h2>
               {levelConfig?.description && <p className="text-sky-200 italic mt-4 max-w-lg text-center px-8">"{levelConfig.description}"</p>}
               {levelConfig?.bossMessage && (
                  <div className="mt-6 bg-white/10 p-4 rounded-lg border border-white/20 mx-8">
                    <p className="text-yellow-300 font-mono text-sm uppercase mb-1">Incoming Transmission:</p>
                    <p className="">"{levelConfig.bossMessage}"</p>
                  </div>
               )}
            </div>
          )}

          {status === GameStatus.GAME_OVER && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md rounded-xl flex flex-col items-center justify-center text-white z-10">
              <Skull className="w-20 h-20 text-slate-400 mb-4" />
              <h2 className="text-5xl font-black mb-2 text-red-400">FROZEN!</h2>
              <p className="text-2xl mb-6">Final Score: <span className="text-white font-bold">{score.toLocaleString()}</span></p>
              
              {lives > 0 ? (
                 <div className="flex flex-col items-center gap-4">
                    <p className="text-green-400 font-bold text-xl">LIVES REMAINING: {lives}</p>
                    <button onClick={handleContinue} className="flex items-center gap-2 bg-green-500 text-white px-8 py-4 rounded-full font-bold text-2xl hover:bg-green-400 transition-colors animate-pulse">
                        <Heart className="w-6 h-6 fill-current" /> CONTINUE
                    </button>
                 </div>
              ) : (
                  <>
                      {showLeaderboardInput ? (
                        <div className="mb-6 bg-yellow-500/20 p-6 rounded-lg border border-yellow-500/50 flex flex-col items-center animate-bounce-in">
                           <h3 className="text-yellow-300 font-bold text-xl mb-2">New High Score!</h3>
                           <input type="text" maxLength={10} placeholder="Enter Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="bg-slate-800 text-white px-4 py-2 rounded mb-3 text-center uppercase tracking-widest outline-none border border-slate-600 focus:border-blue-500" />
                           <button onClick={submitScore} className="bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold px-4 py-1 rounded">Submit</button>
                        </div>
                      ) : (
                        <div className="bg-slate-800 p-6 rounded-lg max-w-md text-center mb-8 border border-slate-700 shadow-xl transform rotate-1 mx-4">
                          <p className="text-slate-300 italic">"{gameOverMsg || 'Generating roast...'}"</p>
                        </div>
                      )}
                      <button onClick={startGame} className="flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-full font-bold text-lg hover:bg-sky-50 transition-colors">
                        <RotateCcw className="w-5 h-5" /> Try Again
                      </button>
                  </>
              )}
            </div>
          )}
        </div>
        
        <div className="absolute bottom-2 text-slate-500 text-xs text-center pointer-events-none">
           Drag Anywhere or Use WASD/Arrows to Move
        </div>
    </div>
  );
};

export default App;
