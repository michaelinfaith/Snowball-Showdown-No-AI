
export interface Vector2D {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2D;
  radius: number;
  color: string;
  velocity: Vector2D;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  shieldHp: number;
  maxShieldHp: number;
  lives: number;
  isDragging: boolean;
  lastHitTime?: number; 
  isFrozen: boolean;
  freezeTime: number;
  lastRegenTime: number;
}

export type EnemyType = 'snowman' | 'bad_kid' | 'reindeer' | 'boss_bells' | 'abominable' | 'boss_elf' | 'narwhal' | 'boss_gum' | 'boss_santa';

export interface Enemy extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  type: EnemyType;
  lastShotTime: number; 
  lastTeleportTime?: number; 
  lastActionTime?: number; 
  lastDodgeTime?: number; 
  lastVoiceLineTime?: number; 
  attackRange: number;
  movementOffset?: Vector2D; 
}

export interface Projectile extends Entity {
  damage: number;
  fromPlayer: boolean;
  isLaser?: boolean; 
  isCandyCane?: boolean;
  isLightning?: boolean;
  bounces?: boolean; 
  bouncesLeft?: number;
  isHazard?: boolean; 
  seeking?: boolean;
  explosive?: boolean;
  shrapnel?: boolean;
  createdAt: number; 
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface IcePatch {
  id: string;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
}

export type PowerUpType = 'RAPID_FIRE' | 'TRIPLE_SHOT' | 'VITALITY' | 'HELPER_RANGE' | 'HELPER_MELEE' | 'SHIELD' | 'REGEN';

export interface LevelConfig {
  levelNumber: number;
  themeName: string;
  description: string;
  obstacles: Obstacle[];
  icePatches: IcePatch[];
  initialPowerups?: { x: number, y: number, type: PowerUpType }[];
  enemySpawnRate: number; 
  enemySpeedMultiplier: number;
  bossMessage?: string;
  enemyComposition: 'mixed' | 'rush' | 'range' | 'chaos';
  isBossLevel: boolean;
}

export interface PowerUpItem {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  createdAt: number;
  persistent?: boolean;
}

export interface Helper extends Entity {
  type: 'RANGE' | 'MELEE';
  hp: number;
  maxHp: number;
  lastActionTime: number;
  targetId?: string;
}

export enum GameStatus {
  MENU = 'MENU',
  LOADING_LEVEL = 'LOADING_LEVEL',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  date: string;
}
