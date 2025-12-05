
import React, { useRef, useEffect, useCallback } from 'react';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  PLAYER_RADIUS, 
  PLAYER_COLOR, 
  PLAYER_KEYBOARD_SPEED,
  ENEMY_RADIUS, 
  ENEMY_COLOR, 
  SNOWBALL_RADIUS, 
  SNOWBALL_COLOR, 
  SNOWBALL_SPEED, 
  SNOWBALL_COOLDOWN,
  ENEMY_BASE_SPEED,
  BAD_KID_COLOR,
  BAD_KID_SPEED,
  BAD_KID_RANGE,
  BAD_KID_COOLDOWN,
  REINDEER_COLOR,
  REINDEER_SPEED,
  REINDEER_TELEPORT_COOLDOWN,
  REINDEER_LASER_COOLDOWN,
  REINDEER_LASER_SPEED,
  REINDEER_AIM_DELAY,
  SCORE_PER_KILL,
  BASE_KILLS_NEEDED,
  KILLS_INCREASE_PER_LEVEL,
  BOSS_RADIUS,
  BOSS_COLOR,
  BOSS_HP_BASE,
  BOSS_SPEED,
  BOSS_ATTACK_COOLDOWN,
  BOSS_VOICE_COOLDOWN,
  BELL_RADIUS,
  BELL_SPEED,
  BELL_COLOR,
  BELL_DURATION,
  OBS_TREE_COLOR,
  OBS_ROCK_COLOR,
  OBS_SNOW_COLOR,
  SCORE_BOSS_KILL,
  YETI_COLOR,
  YETI_HP,
  YETI_POOP_COOLDOWN,
  YETI_RADIUS,
  YETI_SPEED,
  YETI_DODGE_COOLDOWN,
  HAZARD_COLOR,
  HAZARD_DAMAGE,
  HAZARD_RADIUS,
  POWERUP_SIZE,
  POWERUP_SPAWN_CHANCE,
  HELPER_RADIUS,
  HELPER_HP,
  HELPER_SPEED,
  HELPER_RANGE_COOLDOWN,
  HELPER_MELEE_COOLDOWN,
  HELPER_MELEE_RANGE,
  HELPER_DETECT_RANGE,
  ICE_FRICTION,
  SNOW_FRICTION,
  FREEZE_DURATION,
  SHIELD_MAX_HP,
  REGEN_INTERVAL,
  NARWHAL_COLOR,
  NARWHAL_SPEED,
  NARWHAL_LASER_COOLDOWN,
  NARWHAL_RADIUS,
  NARWHAL_HP,
  BOSS_ELF_COLOR,
  BOSS_ELF_SPEED,
  BOSS_ELF_HP,
  CANDY_CANE_SPEED,
  CANDY_CANE_DAMAGE,
  BOSS_GUM_COLOR,
  BOSS_GUM_HP,
  BOSS_GUM_SPEED,
  GUM_BULLET_SPEED,
  BOSS_SANTA_COLOR,
  BOSS_SANTA_HP,
  BOSS_SANTA_SPEED,
  PRESENT_SPEED
} from '../constants';
import { Player, Enemy, Projectile, GameStatus, LevelConfig, PowerUpType, Helper, PowerUpItem, IcePatch } from '../types';
import { playSound } from '../services/soundService';

interface GameCanvasProps {
  status: GameStatus;
  levelConfig: LevelConfig | null;
  activePowerups: PowerUpType[];
  lives: number;
  onGameOver: (finalScore: number) => void;
  onLevelComplete: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  onHealthUpdate: (hp: number, maxHp: number, shieldHp: number) => void;
  onAddPowerup: (type: PowerUpType) => void;
  onRemovePowerup: (type?: PowerUpType, count?: number) => void;
  onLoseLife: () => void;
  onProgressUpdate: (kills: number) => void;
}

// Utility: Distance
function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Utility: Circle-Circle Collision
function circleCircle(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
  return dist(x1, y1, x2, y2) < (r1 + r2);
}

// Utility: Point in Ellipse (rotated)
function pointInRotatedEllipse(x: number, y: number, ex: number, ey: number, rx: number, ry: number, rotation: number) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const dx = x - ex;
    const dy = y - ey;
    const tdx = cos * dx + sin * dy;
    const tdy = -sin * dx + cos * dy;
    return (tdx * tdx) / (rx * rx) + (tdy * tdy) / (ry * ry) <= 1;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  status, 
  levelConfig, 
  activePowerups,
  lives,
  onGameOver, 
  onLevelComplete,
  onScoreUpdate,
  onHealthUpdate,
  onAddPowerup,
  onRemovePowerup,
  onLoseLife,
  onProgressUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs
  const playerRef = useRef<Player>({
    id: 'player',
    pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    radius: PLAYER_RADIUS,
    color: PLAYER_COLOR,
    velocity: { x: 0, y: 0 },
    hp: 3,
    maxHp: 3,
    shieldHp: 0,
    maxShieldHp: 0,
    lives: 3,
    isDragging: false,
    lastHitTime: 0,
    isFrozen: false,
    freezeTime: 0,
    lastRegenTime: 0
  });
  
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const helpersRef = useRef<Helper[]>([]);
  const powerupItemsRef = useRef<PowerUpItem[]>([]);
  const scoreRef = useRef(0);
  const killsThisLevelRef = useRef(0);
  const yetisSpawnedRef = useRef(0);
  const lastShotTimeRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const animationFrameRef = useRef<number>(0);
  
  // Boss State Refs
  const bossRef = useRef<Enemy | null>(null);

  // Input State
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const dragOffsetRef = useRef({ x: 0, y: 0 }); 
  const keysPressed = useRef<Set<string>>(new Set());

  // Input Listeners for Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        keysPressed.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        keysPressed.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Sync Helpers/Powerups state changes
  useEffect(() => {
    if (activePowerups.includes('SHIELD')) {
        if (playerRef.current.maxShieldHp === 0) {
            playerRef.current.maxShieldHp = SHIELD_MAX_HP;
            playerRef.current.shieldHp = SHIELD_MAX_HP;
        }
    } else {
        playerRef.current.maxShieldHp = 0;
        playerRef.current.shieldHp = 0;
    }

    const targetRange = activePowerups.filter(p => p === 'HELPER_RANGE').length;
    const targetMelee = activePowerups.filter(p => p === 'HELPER_MELEE').length;
    
    let rangeHelpers = helpersRef.current.filter(h => h.type === 'RANGE');
    let meleeHelpers = helpersRef.current.filter(h => h.type === 'MELEE');

    while (rangeHelpers.length > targetRange) rangeHelpers.pop();
    while (meleeHelpers.length > targetMelee) meleeHelpers.pop();

    while (rangeHelpers.length < targetRange) {
        rangeHelpers.push({
            id: `helper-range-${Date.now()}-${rangeHelpers.length}`,
            pos: { x: playerRef.current.pos.x + (Math.random()-0.5)*50, y: playerRef.current.pos.y + (Math.random()-0.5)*50 },
            radius: HELPER_RADIUS,
            color: '#60a5fa',
            velocity: {x:0,y:0},
            type: 'RANGE',
            hp: HELPER_HP,
            maxHp: HELPER_HP,
            lastActionTime: 0
        });
    }

    while (meleeHelpers.length < targetMelee) {
        meleeHelpers.push({
            id: `helper-melee-${Date.now()}-${meleeHelpers.length}`,
            pos: { x: playerRef.current.pos.x + (Math.random()-0.5)*50, y: playerRef.current.pos.y + (Math.random()-0.5)*50 },
            radius: HELPER_RADIUS,
            color: '#4ade80',
            velocity: {x:0,y:0},
            type: 'MELEE',
            hp: HELPER_HP,
            maxHp: HELPER_HP,
            lastActionTime: 0
        });
    }
    helpersRef.current = [...rangeHelpers, ...meleeHelpers];
  }, [activePowerups]);

  // Initialize/Reset Game
  const initGame = useCallback(() => {
    const bonusHp = activePowerups.filter(p => p === 'VITALITY').length * 1;
    const maxHp = 3 + bonusHp;
    
    playerRef.current = {
      id: 'player',
      pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
      radius: PLAYER_RADIUS,
      color: PLAYER_COLOR,
      velocity: { x: 0, y: 0 },
      hp: maxHp, 
      maxHp: maxHp,
      shieldHp: 0,
      maxShieldHp: 0,
      lives: 3, 
      isDragging: false,
      lastHitTime: 0,
      isFrozen: false,
      freezeTime: 0,
      lastRegenTime: performance.now()
    };
    enemiesRef.current = [];
    projectilesRef.current = [];
    helpersRef.current = [];
    powerupItemsRef.current = [];
    bossRef.current = null;
    lastShotTimeRef.current = performance.now();
    lastSpawnTimeRef.current = performance.now();
    keysPressed.current.clear();
    onHealthUpdate(maxHp, maxHp, 0);
    killsThisLevelRef.current = 0;
    onProgressUpdate(0);
    yetisSpawnedRef.current = 0;
  }, [activePowerups, onHealthUpdate, onProgressUpdate]);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      startLoop();
    } else {
      stopLoop();
      if (status === GameStatus.LOADING_LEVEL && levelConfig) {
          enemiesRef.current = [];
          projectilesRef.current = [];
          
          // Load initial powerups if any
          powerupItemsRef.current = [];
          if (levelConfig.initialPowerups) {
              levelConfig.initialPowerups.forEach((p, idx) => {
                 powerupItemsRef.current.push({
                     id: `init-pu-${idx}`,
                     x: p.x,
                     y: p.y,
                     type: p.type,
                     createdAt: performance.now(),
                     persistent: true
                 });
              });
          }

          bossRef.current = null;
          playerRef.current.pos = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
          playerRef.current.velocity = {x: 0, y: 0};
          keysPressed.current.clear();
          playerRef.current.isFrozen = false;
          
          const bonusHp = activePowerups.filter(p => p === 'VITALITY').length * 1;
          playerRef.current.maxHp = 3 + bonusHp;
          if (playerRef.current.hp < playerRef.current.maxHp) {
             playerRef.current.hp = Math.min(playerRef.current.maxHp, playerRef.current.hp + 1); 
          }

          playerRef.current.lastHitTime = 0;
          onHealthUpdate(playerRef.current.hp, playerRef.current.maxHp, playerRef.current.shieldHp);
          killsThisLevelRef.current = 0;
          onProgressUpdate(0);
          yetisSpawnedRef.current = 0;
      } else if (status === GameStatus.MENU) {
          initGame(); 
          scoreRef.current = 0;
      }
    }
    return () => stopLoop();
  }, [status, initGame, levelConfig]);

  const startLoop = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    const loop = (timestamp: number) => {
      update(timestamp);
      draw(timestamp);
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const takeDamage = (amount: number, timestamp: number) => {
    if (timestamp - (playerRef.current.lastHitTime || 0) < 1000) return;

    if (playerRef.current.shieldHp > 0) {
        playerRef.current.shieldHp -= amount;
        playSound('shield_hit');
        if (playerRef.current.shieldHp <= 0) {
            playSound('shield_break');
            onRemovePowerup('SHIELD', 1); 
        }
    } else {
        playerRef.current.hp -= amount;
        playSound('hit_player');
    }

    playerRef.current.lastHitTime = timestamp;
    onHealthUpdate(playerRef.current.hp, playerRef.current.maxHp, playerRef.current.shieldHp);
    
    if (playerRef.current.hp <= 0) {
      if (lives > 0) {
        onLoseLife(); 
      }
      playSound('game_over');
      onGameOver(scoreRef.current);
    }
  };

  const update = (timestamp: number) => {
    if (!levelConfig) return;

    const killEnemy = (index: number, e: Enemy) => {
        enemiesRef.current.splice(index, 1);
        if (e.type.startsWith('boss')) {
            scoreRef.current += SCORE_BOSS_KILL;
            bossRef.current = null;
        } else {
            scoreRef.current += SCORE_PER_KILL;
            killsThisLevelRef.current += 1;
            onProgressUpdate(killsThisLevelRef.current);
        }
        onScoreUpdate(scoreRef.current);
    };

    if (activePowerups.includes('REGEN')) {
        if (timestamp - playerRef.current.lastRegenTime > REGEN_INTERVAL) {
            if (playerRef.current.hp < playerRef.current.maxHp && playerRef.current.hp > 0) {
                playerRef.current.hp += 1;
                onHealthUpdate(playerRef.current.hp, playerRef.current.maxHp, playerRef.current.shieldHp);
            }
            playerRef.current.lastRegenTime = timestamp;
        }
    }

    if (playerRef.current.isFrozen) {
        if (timestamp - playerRef.current.freezeTime > FREEZE_DURATION) {
            playerRef.current.isFrozen = false;
            playSound('shield_break'); 
        }
    }

    // 1. Boss Spawning
    if (levelConfig.isBossLevel && !bossRef.current && killsThisLevelRef.current === 0) {
        let bossType: Enemy['type'] = 'boss_bells';
        let bossHp = BOSS_HP_BASE;
        let bossRadius = BOSS_RADIUS;
        let bossColor = BOSS_COLOR;
        let bossSpeed = BOSS_SPEED;

        if (levelConfig.levelNumber === 14) {
            bossType = 'boss_elf';
            bossHp = BOSS_ELF_HP;
            bossRadius = 30;
            bossColor = BOSS_ELF_COLOR;
            bossSpeed = BOSS_ELF_SPEED;
        } else if (levelConfig.levelNumber === 21) {
            bossType = 'boss_gum';
            bossHp = BOSS_GUM_HP;
            bossRadius = 45;
            bossColor = BOSS_GUM_COLOR;
            bossSpeed = BOSS_GUM_SPEED;
        } else if (levelConfig.levelNumber === 28) {
            bossType = 'boss_santa';
            bossHp = BOSS_SANTA_HP;
            bossRadius = 50;
            bossColor = BOSS_SANTA_COLOR;
            bossSpeed = BOSS_SANTA_SPEED;
        }

        const boss: Enemy = {
            id: 'boss',
            pos: { x: CANVAS_WIDTH / 2, y: -bossRadius * 2 },
            velocity: { x: 0, y: 0 },
            radius: bossRadius,
            color: bossColor,
            hp: bossHp,
            maxHp: bossHp,
            speed: bossSpeed,
            type: bossType,
            lastShotTime: timestamp,
            attackRange: 1000,
            lastDodgeTime: 0,
            lastVoiceLineTime: timestamp
        };
        enemiesRef.current.push(boss);
        bossRef.current = boss;
        playSound('spawn');
    }

    // 2. Player Movement Processing
    let onIce = false;
    for (const ice of levelConfig.icePatches) {
        if (pointInRotatedEllipse(playerRef.current.pos.x, playerRef.current.pos.y, ice.x, ice.y, ice.radiusX, ice.radiusY, ice.rotation)) {
            onIce = true;
            break;
        }
    }
    
    const friction = onIce ? ICE_FRICTION : SNOW_FRICTION;
    let dx = 0;
    let dy = 0;

    if (!playerRef.current.isFrozen) {
        if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) dy -= 1;
        if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) dy += 1;
        if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) dx -= 1;
        if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len > 0) { dx /= len; dy /= len; }
            playerRef.current.velocity.x += dx * (onIce ? 0.2 : 2.0); 
            playerRef.current.velocity.y += dy * (onIce ? 0.2 : 2.0);
            playerRef.current.isDragging = false; 
        } else if (playerRef.current.isDragging) {
            const targetX = mouseRef.current.x + dragOffsetRef.current.x;
            const targetY = mouseRef.current.y + dragOffsetRef.current.y;
            const diffX = targetX - playerRef.current.pos.x;
            const diffY = targetY - playerRef.current.pos.y;
            
            if (onIce) {
                const d = Math.sqrt(diffX*diffX + diffY*diffY);
                if (d > 5) {
                    playerRef.current.velocity.x += (diffX / d) * 0.3;
                    playerRef.current.velocity.y += (diffY / d) * 0.3;
                }
            } else {
                playerRef.current.velocity.x += diffX * 0.2;
                playerRef.current.velocity.y += diffY * 0.2;
            }
        }
    }

    playerRef.current.pos.x += playerRef.current.velocity.x;
    playerRef.current.pos.y += playerRef.current.velocity.y;
    
    playerRef.current.velocity.x *= friction;
    playerRef.current.velocity.y *= friction;
    
    if (onIce && (Math.abs(playerRef.current.velocity.x) > 0.5 || Math.abs(playerRef.current.velocity.y) > 0.5)) {
        if (Math.random() < 0.1) playSound('slide');
    }

    playerRef.current.pos.x = Math.max(PLAYER_RADIUS, Math.min(CANVAS_WIDTH - PLAYER_RADIUS, playerRef.current.pos.x));
    playerRef.current.pos.y = Math.max(PLAYER_RADIUS, Math.min(CANVAS_HEIGHT - PLAYER_RADIUS, playerRef.current.pos.y));

    for (const obs of levelConfig.obstacles) {
      if (circleCircle(playerRef.current.pos.x, playerRef.current.pos.y, PLAYER_RADIUS, obs.x, obs.y, obs.radius)) {
        const angle = Math.atan2(playerRef.current.pos.y - obs.y, playerRef.current.pos.x - obs.x);
        playerRef.current.pos.x = obs.x + Math.cos(angle) * (obs.radius + PLAYER_RADIUS + 1);
        playerRef.current.pos.y = obs.y + Math.sin(angle) * (obs.radius + PLAYER_RADIUS + 1);
        playerRef.current.velocity.x *= 0.5;
        playerRef.current.velocity.y *= 0.5;
      }
    }
    
    // 2.5 Powerup Spawning (Random Chance)
    if (!levelConfig.isBossLevel && Math.random() < POWERUP_SPAWN_CHANCE) {
       let px = 0, py = 0, valid = false;
       for(let k=0; k<5; k++) {
          px = Math.random() * (CANVAS_WIDTH - 100) + 50;
          py = Math.random() * (CANVAS_HEIGHT - 100) + 50;
          let hitObs = false;
          for(const obs of levelConfig.obstacles) {
             if (circleCircle(px, py, POWERUP_SIZE, obs.x, obs.y, obs.radius)) hitObs = true;
          }
          if (!hitObs) { valid = true; break; }
       }
       if (valid) {
          const types: PowerUpType[] = ['RAPID_FIRE', 'TRIPLE_SHOT', 'VITALITY', 'HELPER_RANGE', 'HELPER_MELEE', 'SHIELD', 'REGEN'];
          const type = types[Math.floor(Math.random() * types.length)];
          powerupItemsRef.current.push({
             id: `pu-${timestamp}`,
             x: px, y: py,
             type: type,
             createdAt: timestamp
          });
          playSound('powerup_spawn');
       }
    }
    
    for (let i = powerupItemsRef.current.length - 1; i >= 0; i--) {
        const item = powerupItemsRef.current[i];
        if (circleCircle(playerRef.current.pos.x, playerRef.current.pos.y, PLAYER_RADIUS, item.x, item.y, POWERUP_SIZE/2)) {
            onAddPowerup(item.type);
            playSound('powerup_collect');
            powerupItemsRef.current.splice(i, 1);
        } else if (!item.persistent && timestamp - item.createdAt > 10000) {
            powerupItemsRef.current.splice(i, 1);
        }
    }

    // 3. Player Auto-Throw
    let cooldown = SNOWBALL_COOLDOWN;
    if (activePowerups.includes('RAPID_FIRE')) cooldown = 250;

    if (!playerRef.current.isFrozen && timestamp - lastShotTimeRef.current > cooldown) {
      let target: Enemy | null = null;
      if (bossRef.current) {
        target = bossRef.current;
      } else {
        let nearestDist = Infinity;
        enemiesRef.current.forEach(enemy => {
          const d = dist(playerRef.current.pos.x, playerRef.current.pos.y, enemy.pos.x, enemy.pos.y);
          if (d < nearestDist) {
            nearestDist = d;
            target = enemy;
          }
        });
      }

      if (target) {
        const t = target as Enemy;
        const angle = Math.atan2(t.pos.y - playerRef.current.pos.y, t.pos.x - playerRef.current.pos.x);
        
        const shotCount = activePowerups.includes('TRIPLE_SHOT') ? 3 : 1;
        const spreadAngle = 0.2; 

        for(let i=0; i<shotCount; i++) {
           let fireAngle = angle;
           if (shotCount === 3) fireAngle = angle + (i - 1) * spreadAngle;

           const spread = (Math.random() - 0.5) * 0.05;
           const velX = Math.cos(fireAngle + spread) * SNOWBALL_SPEED;
           const velY = Math.sin(fireAngle + spread) * SNOWBALL_SPEED;

           projectilesRef.current.push({
             id: `proj-p-${timestamp}-${i}`,
             pos: { x: playerRef.current.pos.x, y: playerRef.current.pos.y },
             velocity: { x: velX, y: velY },
             radius: SNOWBALL_RADIUS,
             color: SNOWBALL_COLOR,
             damage: 1,
             fromPlayer: true,
             createdAt: timestamp
           });
        }
        playSound('throw');
        lastShotTimeRef.current = timestamp;
      }
    }

    // 3.5 Helpers Logic
    for (let i = helpersRef.current.length - 1; i >= 0; i--) {
        const helper = helpersRef.current[i];
        let target: Enemy | null = null;
        let minDist = 10000;

        enemiesRef.current.forEach(e => {
            const d = dist(helper.pos.x, helper.pos.y, e.pos.x, e.pos.y);
            if (d < minDist) {
                minDist = d;
                target = e;
            }
        });

        let moveX = 0;
        let moveY = 0;
        let baseSpeed = HELPER_SPEED;

        if (helper.type === 'MELEE' && minDist < HELPER_DETECT_RANGE && target) {
             const angle = Math.atan2(target.pos.y - helper.pos.y, target.pos.x - helper.pos.x);
             moveX = Math.cos(angle);
             moveY = Math.sin(angle);
             baseSpeed = HELPER_SPEED * 1.5;
        } else {
             const dToPlayer = dist(helper.pos.x, helper.pos.y, playerRef.current.pos.x, playerRef.current.pos.y);
             const followDist = helper.type === 'MELEE' ? 50 : 80;
             if (dToPlayer > followDist) {
                 const angle = Math.atan2(playerRef.current.pos.y - helper.pos.y, playerRef.current.pos.x - helper.pos.x);
                 moveX = Math.cos(angle);
                 moveY = Math.sin(angle);
             }
        }
        
        for (const obs of levelConfig.obstacles) {
            const d = dist(helper.pos.x, helper.pos.y, obs.x, obs.y);
            const avoidDist = obs.radius + helper.radius + 30;
            if (d < avoidDist) {
                const force = (avoidDist - d) / avoidDist;
                moveX += (helper.pos.x - obs.x) / d * force * 5; 
                moveY += (helper.pos.y - obs.y) / d * force * 5;
            }
        }
        
        const len = Math.sqrt(moveX*moveX + moveY*moveY);
        if (len > 0) {
            helper.pos.x += (moveX / len) * baseSpeed;
            helper.pos.y += (moveY / len) * baseSpeed;
        }
        
        const cooldown = helper.type === 'MELEE' ? HELPER_MELEE_COOLDOWN : HELPER_RANGE_COOLDOWN;
        if (timestamp - helper.lastActionTime > cooldown && target) {
             if (helper.type === 'RANGE' && minDist < 300) {
                  const angle = Math.atan2(target.pos.y - helper.pos.y, target.pos.x - helper.pos.x);
                  projectilesRef.current.push({
                      id: `proj-h-${helper.id}-${timestamp}`,
                      pos: { x: helper.pos.x, y: helper.pos.y },
                      velocity: { x: Math.cos(angle)*SNOWBALL_SPEED, y: Math.sin(angle)*SNOWBALL_SPEED },
                      radius: SNOWBALL_RADIUS - 1,
                      color: '#93c5fd', 
                      damage: 1,
                      fromPlayer: true,
                      createdAt: timestamp
                  });
                  playSound('throw');
                  helper.lastActionTime = timestamp;
             } else if (helper.type === 'MELEE' && minDist < HELPER_MELEE_RANGE) {
                  target.hp -= 1;
                  const angle = Math.atan2(target.pos.y - helper.pos.y, target.pos.x - helper.pos.x);
                  target.pos.x += Math.cos(angle) * 30;
                  target.pos.y += Math.sin(angle) * 30;
                  
                  if (target.hp <= 0) {
                     const idx = enemiesRef.current.indexOf(target);
                     if (idx > -1) killEnemy(idx, target);
                  }
                  playSound('hit_enemy');
                  helper.lastActionTime = timestamp;
             }
        }

        enemiesRef.current.forEach(e => {
             if (dist(helper.pos.x, helper.pos.y, e.pos.x, e.pos.y) < helper.radius + e.radius) {
                 helper.hp -= 0.05; 
             }
        });
        if (helper.hp <= 0) {
            playSound('squish'); 
            onRemovePowerup(helper.type === 'MELEE' ? 'HELPER_MELEE' : 'HELPER_RANGE', 1);
            helpersRef.current.splice(i, 1); 
        }
    }

    // 4. Spawn Minions
    if (!levelConfig.isBossLevel && timestamp - lastSpawnTimeRef.current > levelConfig.enemySpawnRate) {
      const count = Math.random() > 0.6 ? 2 : 1;
      
      for(let i=0; i<count; i++) {
          const edge = Math.floor(Math.random() * 4);
          let ex = 0, ey = 0;
          switch(edge) {
            case 0: ex = Math.random() * CANVAS_WIDTH; ey = -ENEMY_RADIUS; break;
            case 1: ex = CANVAS_WIDTH + ENEMY_RADIUS; ey = Math.random() * CANVAS_HEIGHT; break;
            case 2: ex = Math.random() * CANVAS_WIDTH; ey = CANVAS_HEIGHT + ENEMY_RADIUS; break;
            case 3: ex = -ENEMY_RADIUS; ey = Math.random() * CANVAS_HEIGHT; break;
          }
          ex += (Math.random() - 0.5) * 40;
          ey += (Math.random() - 0.5) * 40;

          const rand = Math.random();
          let type: Enemy['type'] = 'snowman';
          const comp = levelConfig.enemyComposition;
          
          if (comp === 'chaos') {
             if (rand > 0.9 && levelConfig.levelNumber > 10) type = 'narwhal';
             else if (rand > 0.85) type = 'reindeer';
             else if (rand > 0.7 && levelConfig.levelNumber > 7) {
                if (levelConfig.levelNumber === 8 && yetisSpawnedRef.current >= 1) type = 'snowman'; 
                else type = 'abominable';
             }
             else if (rand > 0.5) type = 'bad_kid';
          } else if (comp === 'range') {
            type = rand > 0.3 ? 'bad_kid' : 'snowman';
          } else if (comp === 'mixed') {
            type = rand > 0.6 ? 'bad_kid' : 'snowman';
          }

          if (type === 'abominable') yetisSpawnedRef.current++;

          let speed = ENEMY_BASE_SPEED;
          let color = ENEMY_COLOR;
          let maxHp = 1;
          
          if (type === 'bad_kid') { 
              speed = BAD_KID_SPEED; 
              color = BAD_KID_COLOR;
              if (levelConfig.levelNumber > 7) speed *= 1.3;
          }
          if (type === 'reindeer') { speed = REINDEER_SPEED; color = REINDEER_COLOR; maxHp = 2; }
          if (type === 'abominable') { speed = YETI_SPEED; color = YETI_COLOR; maxHp = YETI_HP; }
          if (type === 'narwhal') { speed = NARWHAL_SPEED; color = NARWHAL_COLOR; maxHp = NARWHAL_HP; }

          enemiesRef.current.push({
            id: `enemy-${timestamp}-${i}`,
            pos: { x: ex, y: ey },
            velocity: { x: 0, y: 0 },
            radius: type === 'abominable' ? YETI_RADIUS : (type === 'narwhal' ? NARWHAL_RADIUS : ENEMY_RADIUS),
            color: color,
            hp: maxHp,
            maxHp: maxHp,
            speed: speed * levelConfig.enemySpeedMultiplier,
            type: type,
            lastShotTime: timestamp,
            lastTeleportTime: timestamp,
            lastActionTime: timestamp,
            lastDodgeTime: 0,
            attackRange: BAD_KID_RANGE,
            movementOffset: {x: 0, y: 0}
          });
      }
      playSound('spawn');
      lastSpawnTimeRef.current = timestamp;
    }

    // 5. Update Projectiles
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
      const p = projectilesRef.current[i];
      
      if (p.isHazard) {
         if (timestamp - p.createdAt > 10000) { 
             projectilesRef.current.splice(i, 1);
         } else if (dist(p.pos.x, p.pos.y, playerRef.current.pos.x, playerRef.current.pos.y) < p.radius + playerRef.current.radius) {
            takeDamage(HAZARD_DAMAGE, timestamp);
            projectilesRef.current.splice(i, 1);
            playSound('squish');
         }
         continue; 
      }
      
      // Seeking logic
      if (p.seeking) {
          const angle = Math.atan2(playerRef.current.pos.y - p.pos.y, playerRef.current.pos.x - p.pos.x);
          p.velocity.x = p.velocity.x * 0.95 + Math.cos(angle) * GUM_BULLET_SPEED * 0.05;
          p.velocity.y = p.velocity.y * 0.95 + Math.sin(angle) * GUM_BULLET_SPEED * 0.05;
          const spd = Math.sqrt(p.velocity.x**2 + p.velocity.y**2);
          if (spd > 0) {
              p.velocity.x = (p.velocity.x / spd) * GUM_BULLET_SPEED;
              p.velocity.y = (p.velocity.y / spd) * GUM_BULLET_SPEED;
          }
      }

      p.pos.x += p.velocity.x;
      p.pos.y += p.velocity.y;
      
      // Bounce Check
      if (p.bounces) {
        let bounced = false;
        if (p.pos.x < p.radius || p.pos.x > CANVAS_WIDTH - p.radius) {
          p.velocity.x *= -1;
          p.pos.x = Math.max(p.radius, Math.min(CANVAS_WIDTH - p.radius, p.pos.x));
          bounced = true;
        }
        if (p.pos.y < p.radius || p.pos.y > CANVAS_HEIGHT - p.radius) {
          p.velocity.y *= -1;
          p.pos.y = Math.max(p.radius, Math.min(CANVAS_HEIGHT - p.radius, p.pos.y));
          bounced = true;
        }
        if (bounced) playSound('bounce');
        if (timestamp - p.createdAt > BELL_DURATION) {
            projectilesRef.current.splice(i, 1);
            continue;
        }
      } else {
        if (p.pos.x < 0 || p.pos.x > CANVAS_WIDTH || p.pos.y < 0 || p.pos.y > CANVAS_HEIGHT) {
          projectilesRef.current.splice(i, 1);
          continue;
        }
      }

      // Obstacle Collision
      let hitObs = false;
      for (const obs of levelConfig.obstacles) {
        if (circleCircle(p.pos.x, p.pos.y, p.radius, obs.x, obs.y, obs.radius)) {
          if (p.isLaser && obs.color === OBS_ROCK_COLOR && (p.bouncesLeft ?? 0) > 0) {
               p.velocity.x *= -1;
               p.velocity.y *= -1;
               p.bouncesLeft = (p.bouncesLeft ?? 1) - 1;
               playSound('bounce');
               const angle = Math.atan2(p.pos.y - obs.y, p.pos.x - obs.x);
               p.pos.x = obs.x + Math.cos(angle) * (obs.radius + p.radius + 1);
               p.pos.y = obs.y + Math.sin(angle) * (obs.radius + p.radius + 1);
          } else if (p.bounces) {
             p.velocity.x *= -1; p.velocity.y *= -1; playSound('bounce');
          } else {
             if (p.explosive) {
                 for(let k=0; k<8; k++) {
                     const a = (Math.PI*2/8) * k;
                     projectilesRef.current.push({
                         id: `shrapnel-${timestamp}-${k}`,
                         pos: {x: p.pos.x, y: p.pos.y},
                         velocity: {x: Math.cos(a)*5, y: Math.sin(a)*5},
                         radius: 3,
                         color: '#fca5a5',
                         damage: 1,
                         fromPlayer: false,
                         shrapnel: true,
                         createdAt: timestamp
                     });
                 }
                 playSound('squish');
             }
             projectilesRef.current.splice(i, 1);
          }
          hitObs = true;
          break;
        }
      }
      if (hitObs && !p.bounces && !p.isLaser) continue;

      if (p.fromPlayer) {
        let hitEnemy = false;
        for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
          const e = enemiesRef.current[j];
          if (dist(p.pos.x, p.pos.y, e.pos.x, e.pos.y) < p.radius + e.radius) {
            projectilesRef.current.splice(i, 1);
            e.hp -= p.damage;
            
            if (e.hp <= 0) {
              killEnemy(j, e);
            }
            playSound('hit_enemy');
            hitEnemy = true;
            break;
          }
        }
        if (hitEnemy) continue;
      } else {
        if (dist(p.pos.x, p.pos.y, playerRef.current.pos.x, playerRef.current.pos.y) < p.radius + playerRef.current.radius) {
          if (!p.bounces) projectilesRef.current.splice(i, 1); 
          
          if (p.explosive) {
             for(let k=0; k<8; k++) {
                 const a = (Math.PI*2/8) * k;
                 projectilesRef.current.push({
                     id: `shrapnel-${timestamp}-${k}`,
                     pos: {x: p.pos.x, y: p.pos.y},
                     velocity: {x: Math.cos(a)*5, y: Math.sin(a)*5},
                     radius: 3,
                     color: '#fca5a5',
                     damage: 1,
                     fromPlayer: false,
                     shrapnel: true,
                     createdAt: timestamp
                 });
             }
          }

          if (p.isLightning) {
             playerRef.current.isFrozen = true;
             playerRef.current.freezeTime = timestamp;
             playSound('freeze');
             takeDamage(1, timestamp);
          } else {
             takeDamage(1, timestamp);
          }
        }
        helpersRef.current.forEach(h => {
             if (dist(p.pos.x, p.pos.y, h.pos.x, h.pos.y) < p.radius + h.radius) {
                 if (!p.bounces) projectilesRef.current.splice(i, 1);
                 h.hp -= 1;
             }
        });
      }
    }

    // 6. Update Enemies
    for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
      const e = enemiesRef.current[i];
      const dToPlayer = dist(e.pos.x, e.pos.y, playerRef.current.pos.x, playerRef.current.pos.y);

      // Boss Logic
      if (e.type === 'boss_gum') {
          const angle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
          let moveX = Math.cos(angle) * e.speed;
          let moveY = Math.sin(angle) * e.speed;

          // Add Avoidance for Boss
          for (const obs of levelConfig.obstacles) {
            const d = dist(e.pos.x, e.pos.y, obs.x, obs.y);
            const avoidDist = obs.radius + e.radius + 40;
            if (d < avoidDist) {
               const force = (avoidDist - d) / avoidDist;
               moveX += (e.pos.x - obs.x)/d * force * 2;
               moveY += (e.pos.y - obs.y)/d * force * 2;
            }
          }

          e.pos.x += moveX;
          e.pos.y += moveY;
          
          if (timestamp - e.lastShotTime > 1500) {
              projectilesRef.current.push({
                  id: `gum-${timestamp}`,
                  pos: { x: e.pos.x, y: e.pos.y },
                  velocity: { 
                      x: Math.cos(angle) * GUM_BULLET_SPEED, 
                      y: Math.sin(angle) * GUM_BULLET_SPEED 
                  },
                  radius: 8,
                  color: '#f472b6',
                  damage: 1,
                  fromPlayer: false,
                  seeking: true,
                  createdAt: timestamp
              });
              playSound('throw');
              e.lastShotTime = timestamp;
          }

      } else if (e.type === 'boss_santa') {
          e.pos.x += Math.sin(timestamp * 0.001) * e.speed * 2;
          
          if (timestamp - e.lastShotTime > 2000) {
              const angle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
              projectilesRef.current.push({
                  id: `present-${timestamp}`,
                  pos: { x: e.pos.x, y: e.pos.y },
                  velocity: { 
                      x: Math.cos(angle) * PRESENT_SPEED, 
                      y: Math.sin(angle) * PRESENT_SPEED 
                  },
                  radius: 12,
                  color: '#16a34a',
                  damage: 1,
                  fromPlayer: false,
                  explosive: true,
                  createdAt: timestamp
              });
              playSound('throw');
              e.lastShotTime = timestamp;
          }

      } else if (e.type === 'boss_elf') {
          const angle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
          let moveX = Math.cos(angle) * e.speed;
          let moveY = Math.sin(angle) * e.speed;

          // Avoidance
          for (const obs of levelConfig.obstacles) {
            const d = dist(e.pos.x, e.pos.y, obs.x, obs.y);
            const avoidDist = obs.radius + e.radius + 40;
            if (d < avoidDist) {
               const force = (avoidDist - d) / avoidDist;
               moveX += (e.pos.x - obs.x)/d * force * 2;
               moveY += (e.pos.y - obs.y)/d * force * 2;
            }
          }

          e.pos.x += moveX;
          e.pos.y += moveY;
          
          if (timestamp - (e.lastDodgeTime || 0) > 1000) {
              for(const p of projectilesRef.current) {
                  if (p.fromPlayer && dist(p.pos.x, p.pos.y, e.pos.x, e.pos.y) < 100) {
                      e.pos.x += (Math.random()-0.5)*100;
                      e.pos.y += (Math.random()-0.5)*100;
                      e.lastDodgeTime = timestamp;
                      playSound('throw'); 
                  }
              }
          }
          if (timestamp - e.lastShotTime > 1500) {
              for(let k=0; k<5; k++) {
                  const spread = (k - 2) * 0.3;
                  projectilesRef.current.push({
                      id: `candy-${timestamp}-${k}`,
                      pos: { x: e.pos.x, y: e.pos.y },
                      velocity: { 
                          x: Math.cos(angle + spread) * CANDY_CANE_SPEED, 
                          y: Math.sin(angle + spread) * CANDY_CANE_SPEED 
                      },
                      radius: 8,
                      color: '#ef4444',
                      damage: CANDY_CANE_DAMAGE,
                      fromPlayer: false,
                      isCandyCane: true,
                      createdAt: timestamp
                  });
              }
              playSound('throw');
              e.lastShotTime = timestamp;
          }

      } else if (e.type === 'narwhal') {
          const angle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
          let moveX = Math.cos(angle) * e.speed;
          let moveY = Math.sin(angle) * e.speed;

          // Avoidance
          for (const obs of levelConfig.obstacles) {
            const d = dist(e.pos.x, e.pos.y, obs.x, obs.y);
            const avoidDist = obs.radius + e.radius + 40;
            if (d < avoidDist) {
               const force = (avoidDist - d) / avoidDist;
               moveX += (e.pos.x - obs.x)/d * force * 3;
               moveY += (e.pos.y - obs.y)/d * force * 3;
            }
          }
          const ts = Math.sqrt(moveX*moveX + moveY*moveY);
          if (ts > 0) {
              moveX = (moveX/ts) * e.speed;
              moveY = (moveY/ts) * e.speed;
          }

          e.pos.x += moveX;
          e.pos.y += moveY;

          if (timestamp - e.lastShotTime > NARWHAL_LASER_COOLDOWN) {
              projectilesRef.current.push({
                  id: `lightning-${e.id}-${timestamp}`,
                  pos: { x: e.pos.x, y: e.pos.y },
                  velocity: { 
                      x: Math.cos(angle) * 15, 
                      y: Math.sin(angle) * 15 
                  },
                  radius: 4,
                  color: '#60a5fa',
                  damage: 1,
                  fromPlayer: false,
                  isLightning: true,
                  createdAt: timestamp
              });
              playSound('laser');
              e.lastShotTime = timestamp;
          }
      } 
      else if (e.type === 'boss_bells') {
         const targetPos = playerRef.current.pos;
         const angle = Math.atan2(targetPos.y - e.pos.y, targetPos.x - e.pos.x);
         e.pos.x += Math.cos(angle) * e.speed;
         e.pos.y += Math.sin(angle) * e.speed;

         if (timestamp - (e.lastVoiceLineTime || 0) > BOSS_VOICE_COOLDOWN && Math.random() < 0.005) {
             playSound('ho_ho_ho');
             e.lastVoiceLineTime = timestamp;
         }

         if (timestamp - e.lastShotTime > BOSS_ATTACK_COOLDOWN) {
            const baseAngle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
            for (let k = -1; k <= 1; k++) {
               const fireAngle = baseAngle + (k * 0.3);
               projectilesRef.current.push({
                 id: `bell-${timestamp}-${k}`,
                 pos: { x: e.pos.x, y: e.pos.y },
                 velocity: { x: Math.cos(fireAngle) * BELL_SPEED, y: Math.sin(fireAngle) * BELL_SPEED },
                 radius: BELL_RADIUS,
                 color: BELL_COLOR,
                 damage: 1,
                 fromPlayer: false,
                 bounces: true,
                 createdAt: timestamp
               });
            }
            playSound('throw');
            e.lastShotTime = timestamp;
         }
      } 
      else if (e.type === 'reindeer') {
        if (timestamp - (e.lastTeleportTime || 0) > REINDEER_TELEPORT_COOLDOWN) {
           let attempts = 0;
           while (attempts < 10) {
            const tx = Math.random() * (CANVAS_WIDTH - 100) + 50;
            const ty = Math.random() * (CANVAS_HEIGHT - 100) + 50;
            let valid = true;
            if (dist(tx, ty, playerRef.current.pos.x, playerRef.current.pos.y) < 200) valid = false;
            for (const obs of levelConfig.obstacles) {
              if (circleCircle(tx, ty, e.radius, obs.x, obs.y, obs.radius)) valid = false;
            }
            if (valid) {
              e.pos.x = tx; e.pos.y = ty;
              playSound('teleport');
              e.lastTeleportTime = timestamp;
              break;
            }
            attempts++;
           }
        }
        const timeSinceTeleport = timestamp - (e.lastTeleportTime || 0);
        if (timeSinceTeleport > REINDEER_AIM_DELAY && timestamp - e.lastShotTime > REINDEER_LASER_COOLDOWN) {
            const shotAngle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
            projectilesRef.current.push({
              id: `laser-${e.id}-${timestamp}`,
              pos: { x: e.pos.x, y: e.pos.y },
              velocity: { x: Math.cos(shotAngle) * REINDEER_LASER_SPEED, y: Math.sin(shotAngle) * REINDEER_LASER_SPEED },
              radius: 3,
              color: '#ef4444',
              damage: 1,
              fromPlayer: false,
              isLaser: true,
              bouncesLeft: 2, 
              createdAt: timestamp
            });
            playSound('laser');
            e.lastShotTime = timestamp;
        }
      }
      else if (e.type === 'abominable') {
          let isDodging = false;
          let dodgeX = 0, dodgeY = 0;
          if (timestamp - (e.lastDodgeTime || 0) > YETI_DODGE_COOLDOWN) {
            for(const p of projectilesRef.current) {
                if (p.fromPlayer && dist(p.pos.x, p.pos.y, e.pos.x, e.pos.y) < 150) {
                    const dot = p.velocity.x * (e.pos.x - p.pos.x) + p.velocity.y * (e.pos.y - p.pos.y);
                    if (dot > 0) { 
                        isDodging = true;
                        dodgeX = -p.velocity.y; dodgeY = p.velocity.x;
                        e.lastDodgeTime = timestamp; 
                        break; 
                    }
                }
            }
          }

          let moveX = 0, moveY = 0;
          if (isDodging) {
              moveX = dodgeX; moveY = dodgeY;
          } else {
             const angle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
             moveX = Math.cos(angle) * e.speed;
             moveY = Math.sin(angle) * e.speed;
          }

          if (timestamp - (e.lastActionTime || 0) > YETI_POOP_COOLDOWN) {
             let validSpot = true;
             for (const obs of levelConfig.obstacles) {
                 if (circleCircle(e.pos.x, e.pos.y, HAZARD_RADIUS, obs.x, obs.y, obs.radius)) validSpot = false;
             }
             if (validSpot) {
                 projectilesRef.current.push({
                     id: `poop-${e.id}-${timestamp}`,
                     pos: { x: e.pos.x, y: e.pos.y },
                     velocity: { x: 0, y: 0 },
                     radius: HAZARD_RADIUS,
                     color: HAZARD_COLOR,
                     damage: HAZARD_DAMAGE,
                     fromPlayer: false,
                     isHazard: true,
                     createdAt: timestamp
                 });
                 playSound('squish');
                 e.lastActionTime = timestamp;
             }
          }

          // Avoidance
          for (const obs of levelConfig.obstacles) {
            const d = dist(e.pos.x, e.pos.y, obs.x, obs.y);
            const avoidDist = obs.radius + e.radius + 40;
            if (d < avoidDist) {
               const force = (avoidDist - d) / avoidDist;
               moveX += (e.pos.x - obs.x)/d * force * 3;
               moveY += (e.pos.y - obs.y)/d * force * 3;
            }
          }

          const ts = Math.sqrt(moveX*moveX + moveY*moveY);
          if (ts > 0) {
             moveX = (moveX/ts) * e.speed * (isDodging ? 2.5 : 1); 
             moveY = (moveY/ts) * e.speed * (isDodging ? 2.5 : 1);
          }
          
          e.pos.x += moveX; e.pos.y += moveY;
      }
      else {
          let moveX = 0, moveY = 0;
          const angle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
          
          if (e.type === 'bad_kid') {
            if (!e.movementOffset || Math.random() < 0.05) {
                e.movementOffset = {
                    x: (Math.random() - 0.5) * 2,
                    y: (Math.random() - 0.5) * 2
                };
            }
            if (dToPlayer < e.attackRange) {
               moveX = Math.cos(angle + Math.PI/2) * e.speed * 0.5 + e.movementOffset.x;
               moveY = Math.sin(angle + Math.PI/2) * e.speed * 0.5 + e.movementOffset.y;
            } else {
               moveX = Math.cos(angle) * e.speed + e.movementOffset.x;
               moveY = Math.sin(angle) * e.speed + e.movementOffset.y;
            }
          } else {
             moveX = Math.cos(angle) * e.speed;
             moveY = Math.sin(angle) * e.speed;
          }

          for (const obs of levelConfig.obstacles) {
            const d = dist(e.pos.x, e.pos.y, obs.x, obs.y);
            const avoidDist = obs.radius + e.radius + 40;
            if (d < avoidDist) {
               const force = (avoidDist - d) / avoidDist;
               moveX += (e.pos.x - obs.x)/d * force * 3;
               moveY += (e.pos.y - obs.y)/d * force * 3;
            }
          }
          
          const separationWeight = e.type === 'snowman' ? 0.02 : 0.05;
          enemiesRef.current.forEach((other, idx) => {
            if (i !== idx && !other.type.startsWith('boss')) {
              const d = dist(e.pos.x, e.pos.y, other.pos.x, other.pos.y);
              if (d < e.radius * 2) {
                 moveX += (e.pos.x - other.pos.x) * separationWeight;
                 moveY += (e.pos.y - other.pos.y) * separationWeight;
              }
            }
          });

          const ts = Math.sqrt(moveX*moveX + moveY*moveY);
          if (ts > e.speed) { moveX = (moveX/ts)*e.speed; moveY = (moveY/ts)*e.speed; }
          
          let nextX = e.pos.x + moveX;
          let nextY = e.pos.y + moveY;
          
          for (const obs of levelConfig.obstacles) {
            if (circleCircle(nextX, nextY, e.radius, obs.x, obs.y, obs.radius)) {
               const d = dist(nextX, nextY, obs.x, obs.y);
               const overlap = (e.radius + obs.radius) - d;
               if (d > 0) {
                 nextX += ((nextX - obs.x)/d) * overlap;
                 nextY += ((nextY - obs.y)/d) * overlap;
               }
            }
          }
          e.pos.x = nextX; e.pos.y = nextY;

          if (e.type === 'bad_kid') {
            const levelCooldownReduction = (levelConfig.levelNumber - 1) * 100;
            const currentCooldown = Math.max(500, BAD_KID_COOLDOWN - levelCooldownReduction);
            
            if (dToPlayer < e.attackRange + 50 && timestamp - e.lastShotTime > currentCooldown) {
                const shotAngle = Math.atan2(playerRef.current.pos.y - e.pos.y, playerRef.current.pos.x - e.pos.x);
                projectilesRef.current.push({
                  id: `proj-e-${e.id}-${timestamp}`,
                  pos: { x: e.pos.x, y: e.pos.y },
                  velocity: { x: Math.cos(shotAngle) * SNOWBALL_SPEED * 0.8, y: Math.sin(shotAngle) * SNOWBALL_SPEED * 0.8 },
                  radius: SNOWBALL_RADIUS,
                  color: '#fecaca',
                  damage: 1,
                  fromPlayer: false,
                  createdAt: timestamp
                });
                playSound('throw');
                e.lastShotTime = timestamp;
            }
          }
      }

      if (dist(e.pos.x, e.pos.y, playerRef.current.pos.x, playerRef.current.pos.y) < e.radius + playerRef.current.radius) {
        if (!e.type.startsWith('boss')) {
           enemiesRef.current.splice(i, 1);
        }
        takeDamage(1, timestamp);
      }
    }

    if (levelConfig.isBossLevel) {
       const hasBoss = enemiesRef.current.some(e => e.type.startsWith('boss'));
       if (!hasBoss && bossRef.current === null && enemiesRef.current.length === 0) { 
           onLevelComplete(scoreRef.current);
       }
    } else {
        const killsNeeded = BASE_KILLS_NEEDED + (levelConfig.levelNumber - 1) * KILLS_INCREASE_PER_LEVEL;
        if (killsThisLevelRef.current >= killsNeeded) {
            onLevelComplete(scoreRef.current);
        }
    }
  };

  const draw = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !levelConfig) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Background
    ctx.fillStyle = 'rgba(241, 245, 249, 0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Ice Patches
    levelConfig.icePatches.forEach(ice => {
        ctx.save();
        ctx.translate(ice.x, ice.y);
        ctx.rotate(ice.rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, ice.radiusX, ice.radiusY, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    });

    const timeSinceHit = timestamp - (playerRef.current.lastHitTime || 0);
    if (timeSinceHit < 200) {
      ctx.fillStyle = `rgba(239, 68, 68, ${0.3 * (1 - timeSinceHit/200)})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.save();
      ctx.translate((Math.random()-0.5)*10, (Math.random()-0.5)*10);
    } else {
      ctx.save();
    }
    
    // Safe Zone
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 150, 0, Math.PI * 2);
    ctx.stroke();

    // Obstacles
    levelConfig.obstacles.forEach(obs => {
      ctx.beginPath();
      ctx.ellipse(obs.x, obs.y + obs.radius * 0.8, obs.radius, obs.radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fill();

      if (obs.color === OBS_TREE_COLOR) {
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - obs.radius);
        ctx.lineTo(obs.x + obs.radius, obs.y + obs.radius);
        ctx.lineTo(obs.x - obs.radius, obs.y + obs.radius);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - obs.radius * 0.5);
        ctx.lineTo(obs.x + obs.radius * 0.8, obs.y + obs.radius * 0.8);
        ctx.lineTo(obs.x - obs.radius * 0.8, obs.y + obs.radius * 0.8);
        ctx.fillStyle = '#14532d';
        ctx.fill();
      } else if (obs.color === OBS_SNOW_COLOR) {
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0'; 
        ctx.beginPath();
        ctx.arc(obs.x - 10, obs.y - 10, obs.radius * 0.5, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(obs.x - obs.radius*0.3, obs.y - obs.radius*0.3, obs.radius * 0.2, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();
      }
    });

    // Powerups
    powerupItemsRef.current.forEach(item => {
       ctx.save();
       const pulse = Math.sin(timestamp * 0.005) * 2;
       ctx.translate(item.x, item.y + pulse);
       if (item.type === 'SHIELD') ctx.fillStyle = '#60a5fa';
       else if (item.type === 'REGEN') ctx.fillStyle = '#f472b6';
       else ctx.fillStyle = '#facc15';
       ctx.fillRect(-10, -10, 20, 20);
       ctx.fillStyle = '#ef4444'; 
       ctx.fillRect(-3, -10, 6, 20); 
       ctx.fillRect(-10, -3, 20, 6); 
       ctx.restore();
    });

    // Helpers
    helpersRef.current.forEach(h => {
        ctx.beginPath();
        ctx.arc(h.pos.x, h.pos.y, h.radius, 0, Math.PI*2);
        ctx.fillStyle = h.color;
        ctx.fill();
        if (h.type === 'RANGE') {
            ctx.beginPath();
            ctx.arc(h.pos.x, h.pos.y - 8, 6, 0, Math.PI*2);
            ctx.fillStyle = '#eff6ff';
            ctx.fill();
            ctx.fillStyle = '#60a5fa'; 
            ctx.fillRect(h.pos.x - 5, h.pos.y - 2, 10, 3);
        } else {
            ctx.beginPath();
            ctx.moveTo(h.pos.x - 5, h.pos.y - 5);
            ctx.lineTo(h.pos.x + 5, h.pos.y - 5);
            ctx.lineTo(h.pos.x, h.pos.y - 15);
            ctx.fillStyle = '#15803d'; 
            ctx.fill();
        }
        if (h.hp < h.maxHp) {
            const pct = Math.max(0, h.hp / h.maxHp);
            ctx.fillStyle = 'red';
            ctx.fillRect(h.pos.x - 8, h.pos.y - 15, 16, 3);
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(h.pos.x - 8, h.pos.y - 15, 16 * pct, 3);
        }
    });

    // Projectiles
    projectilesRef.current.forEach(p => {
      ctx.save();
      if (p.isLightning) {
         ctx.beginPath();
         ctx.strokeStyle = '#60a5fa';
         ctx.lineWidth = 3;
         ctx.moveTo(p.pos.x, p.pos.y);
         ctx.lineTo(p.pos.x - p.velocity.x * 3, p.pos.y - p.velocity.y * 3);
         ctx.stroke();
      } else if (p.isLaser) {
         ctx.beginPath();
         ctx.strokeStyle = p.color;
         ctx.lineWidth = 3;
         ctx.moveTo(p.pos.x, p.pos.y);
         ctx.lineTo(p.pos.x - p.velocity.x * 2, p.pos.y - p.velocity.y * 2); 
         ctx.stroke();
      } else if (p.isHazard) {
         ctx.fillStyle = p.color;
         ctx.beginPath();
         ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
         ctx.fill();
         ctx.fillStyle = '#552508'; 
         ctx.beginPath();
         ctx.arc(p.pos.x - 2, p.pos.y - 2, 3, 0, Math.PI * 2);
         ctx.fill();
      } else if (p.shrapnel) {
         ctx.fillStyle = p.color;
         ctx.beginPath();
         ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
         ctx.fill();
      } else if (p.seeking) {
         ctx.fillStyle = p.color;
         ctx.beginPath();
         ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
         ctx.fill();
         ctx.strokeStyle = '#fbcfe8';
         ctx.lineWidth = 2;
         ctx.stroke();
      } else if (p.explosive) {
         // Present
         ctx.fillStyle = p.color;
         ctx.fillRect(p.pos.x-8, p.pos.y-8, 16, 16);
         ctx.fillStyle = '#facc15';
         ctx.fillRect(p.pos.x-2, p.pos.y-8, 4, 16); // Ribbon vert
         ctx.fillRect(p.pos.x-8, p.pos.y-2, 16, 4); // Ribbon horz
      } else if (p.isCandyCane) {
         // Rotating candy cane
         ctx.translate(p.pos.x, p.pos.y);
         ctx.rotate(timestamp * 0.01);
         ctx.fillStyle = '#ffffff';
         ctx.beginPath();
         ctx.arc(0, 0, p.radius, 0, Math.PI*2);
         ctx.fill();
         ctx.strokeStyle = '#ef4444';
         ctx.lineWidth = 3;
         ctx.beginPath();
         ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
         ctx.moveTo(0, -5); ctx.lineTo(5, 0);
         ctx.moveTo(-5, 0); ctx.lineTo(0, 5);
         ctx.stroke();
      } else {
         ctx.beginPath();
         ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
         ctx.fillStyle = p.color;
         ctx.fill();
         if (p.bounces) {
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1;
            ctx.stroke();
         }
      }
      ctx.restore();
    });

    // Enemies
    enemiesRef.current.forEach(e => {
      // Draw Boss Health Bar
      if (e.type.startsWith('boss')) {
         const hpPct = Math.max(0, e.hp / e.maxHp);
         ctx.fillStyle = 'black';
         ctx.fillRect(e.pos.x - 40, e.pos.y - e.radius - 20, 80, 8);
         ctx.fillStyle = '#ef4444';
         ctx.fillRect(e.pos.x - 39, e.pos.y - e.radius - 19, 78 * hpPct, 6);
      }

      if (e.type === 'boss_bells') {
         ctx.beginPath();
         ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI*2);
         ctx.fillStyle = e.color; 
         ctx.fill();
         ctx.fillStyle = 'black';
         ctx.fillRect(e.pos.x - e.radius, e.pos.y, e.radius * 2, 10);

      } else if (e.type === 'boss_elf') {
         ctx.beginPath();
         ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
         ctx.fillStyle = e.color;
         ctx.fill();
         // Hat
         ctx.beginPath();
         ctx.moveTo(e.pos.x - e.radius, e.pos.y - 10);
         ctx.lineTo(e.pos.x + e.radius, e.pos.y - 10);
         ctx.lineTo(e.pos.x, e.pos.y - e.radius * 2);
         ctx.fillStyle = '#166534';
         ctx.fill();
         // Sword
         ctx.save();
         ctx.translate(e.pos.x, e.pos.y);
         ctx.rotate(timestamp * 0.005);
         ctx.fillStyle = '#9ca3af';
         ctx.fillRect(15, -2, 40, 4);
         ctx.fillStyle = '#4b5563';
         ctx.fillRect(15, -6, 4, 12);
         ctx.restore();

      } else if (e.type === 'boss_gum') {
          // Amoeba wobble
          ctx.beginPath();
          const r = e.radius;
          for (let a = 0; a < Math.PI * 2; a += 0.1) {
              const rOff = Math.sin(a * 5 + timestamp * 0.01) * 5;
              const px = e.pos.x + Math.cos(a) * (r + rOff);
              const py = e.pos.y + Math.sin(a) * (r + rOff);
              if (a === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = e.color;
          ctx.fill();
          // Eyes
          ctx.fillStyle = 'white';
          ctx.beginPath(); ctx.arc(e.pos.x - 15, e.pos.y - 10, 8, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(e.pos.x + 15, e.pos.y - 10, 8, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'black';
          ctx.beginPath(); ctx.arc(e.pos.x - 15, e.pos.y - 10, 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(e.pos.x + 15, e.pos.y - 10, 3, 0, Math.PI*2); ctx.fill();

      } else if (e.type === 'boss_santa') {
          // Sleigh body
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(e.pos.x - 30, e.pos.y, 60, 20);
          // Runners
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(e.pos.x - 35, e.pos.y + 25);
          ctx.lineTo(e.pos.x + 40, e.pos.y + 25);
          ctx.quadraticCurveTo(e.pos.x + 50, e.pos.y + 15, e.pos.x + 45, e.pos.y + 10);
          ctx.stroke();
          // Santa Body
          ctx.beginPath();
          ctx.arc(e.pos.x, e.pos.y - 10, 20, 0, Math.PI * 2);
          ctx.fillStyle = e.color;
          ctx.fill();
          // Bag
          ctx.beginPath();
          ctx.arc(e.pos.x - 20, e.pos.y - 15, 15, 0, Math.PI * 2);
          ctx.fillStyle = '#065f46';
          ctx.fill();

      } else if (e.type === 'narwhal') {
         ctx.beginPath();
         ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI*2);
         ctx.fillStyle = e.color;
         ctx.fill();
         ctx.beginPath();
         ctx.moveTo(e.pos.x, e.pos.y - 10);
         ctx.lineTo(e.pos.x + 5, e.pos.y - e.radius - 20);
         ctx.lineTo(e.pos.x - 5, e.pos.y - 10);
         ctx.fillStyle = '#fcd34d'; 
         ctx.fill();

      } else if (e.type === 'reindeer') {
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y + 2, 3, 0, Math.PI * 2);
        ctx.fill();
        // Antlers
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.pos.x - 5, e.pos.y - 10);
        ctx.lineTo(e.pos.x - 12, e.pos.y - 20);
        ctx.moveTo(e.pos.x + 5, e.pos.y - 10);
        ctx.lineTo(e.pos.x + 12, e.pos.y - 20);
        ctx.stroke();

      } else if (e.type === 'abominable') {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(e.pos.x - 10, e.pos.y + 15, 8, 12, 0, 0, Math.PI*2);
        ctx.ellipse(e.pos.x + 10, e.pos.y + 15, 8, 12, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = e.color; 
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        // Fur
        for(let k=0; k<6; k++) {
            const angle = k * (Math.PI/3);
            ctx.beginPath();
            ctx.moveTo(e.pos.x + Math.cos(angle)*e.radius*0.5, e.pos.y + Math.sin(angle)*e.radius*0.5);
            ctx.lineTo(e.pos.x + Math.cos(angle)*e.radius*1.1, e.pos.y + Math.sin(angle)*e.radius*1.1);
            ctx.stroke();
        }
        // Face
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(e.pos.x - 8, e.pos.y - 5);
        ctx.lineTo(e.pos.x - 2, e.pos.y - 2); // Angry brow left
        ctx.moveTo(e.pos.x + 8, e.pos.y - 5);
        ctx.lineTo(e.pos.x + 2, e.pos.y - 2); // Angry brow right
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillRect(e.pos.x - 8, e.pos.y, 4, 4); // Eye L
        ctx.fillRect(e.pos.x + 4, e.pos.y, 4, 4); // Eye R
        ctx.fillRect(e.pos.x - 6, e.pos.y + 10, 12, 3); // Mouth

      } else if (e.type === 'snowman') {
        ctx.strokeStyle = '#cbd5e1'; 
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y - e.radius * 0.8, e.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.stroke();
        // Hat
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(e.pos.x - 10, e.pos.y - e.radius * 1.5, 20, 3);
        ctx.fillRect(e.pos.x - 7, e.pos.y - e.radius * 1.5 - 12, 14, 12);
        // Face
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(e.pos.x - 3, e.pos.y - e.radius * 0.8 - 2, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(e.pos.x + 3, e.pos.y - e.radius * 0.8 - 2, 2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y - e.radius * 0.8 + 2, 2, 0, Math.PI*2); ctx.fill();

      } else {
        // Bad Kid
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = e.color; 
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(e.pos.x - 5, e.pos.y + 5);
        ctx.lineTo(e.pos.x + 5, e.pos.y + 5);
        ctx.stroke();
        // Hat (Beanie)
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y - 5, e.radius, Math.PI, 0);
        ctx.fill();
      }
    });

    const p = playerRef.current;
    
    // Player
    if (p.shieldHp > 0) {
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.radius + 8, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.4 + Math.sin(timestamp*0.01)*0.2})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.isFrozen ? '#93c5fd' : p.color; 
    ctx.fill();
    
    // Hat
    ctx.fillStyle = activePowerups.includes('RAPID_FIRE') ? '#f59e0b' : '#ef4444'; 
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y - 5, p.radius, Math.PI, 0);
    ctx.fill();
    // Pom pom
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(p.pos.x + p.radius, p.pos.y - 5, 4, 0, Math.PI*2);
    ctx.fill();

    // Drag Line
    if (p.isDragging && !p.isFrozen) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(p.pos.x, p.pos.y);
      ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore(); 

    if (levelConfig.isBossLevel && bossRef.current) {
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText("BOSS FIGHT!", CANVAS_WIDTH / 2, 40);
        const barWidth = 400;
        const barHeight = 20;
        const x = CANVAS_WIDTH / 2 - barWidth / 2;
        const y = 50;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, barWidth, barHeight);
        const hpPct = Math.max(0, bossRef.current.hp / bossRef.current.maxHp);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + 2, y + 2, (barWidth - 4) * hpPct, barHeight - 4);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (status !== GameStatus.PLAYING) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    playerRef.current.isDragging = true;
    dragOffsetRef.current = {
        x: playerRef.current.pos.x - x,
        y: playerRef.current.pos.y - y
    };
    mouseRef.current = { x, y, isDown: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (status !== GameStatus.PLAYING) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    mouseRef.current = { x, y, isDown: mouseRef.current.isDown };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    playerRef.current.isDragging = false;
    mouseRef.current.isDown = false;
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="rounded-xl shadow-2xl bg-white cursor-crosshair border-4 border-slate-200 touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
      }}
    />
  );
};

export default GameCanvas;
