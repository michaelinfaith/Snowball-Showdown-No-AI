
import { LevelConfig, Obstacle, IcePatch, PowerUpType } from "../types";
import { 
  OBS_TREE_COLOR, 
  OBS_ROCK_COLOR, 
  OBS_SNOW_COLOR, 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT 
} from "../constants";

// Static data for procedural generation
const THEMES = [
  "Winter Wonderland",
  "Frozen Tundra",
  "Icy Archipelago",
  "Glacial Pass",
  "Snowy Forest",
  "Blizzard Beach",
  "Frosty Peaks"
];

const DESCRIPTIONS = [
  "Watch your step, it's slippery out here!",
  "The snowmen have fortified their position.",
  "Perfect weather for a snowball fight.",
  "Don't eat the yellow snow.",
  "It's quiet... too quiet.",
  "Reinforcements have arrived!"
];

const ROASTS = [
  "You got iced!",
  "Chill out, it's just a game.",
  "That was cold.",
  "Snow way you lost that.",
  "You've been put on ice.",
  "Better luck next winter.",
  "Frostbitten and forgotten.",
  "The snowmen claim another victim."
];

// Utility for random numbers
const random = (min: number, max: number) => Math.random() * (max - min) + min;

export const generateLevel = async (levelNumber: number, offensivePowerupCount: number = 0): Promise<LevelConfig> => {
  // Simulate async delay slightly for "loading" feel
  await new Promise(resolve => setTimeout(resolve, 500));

  const isBossLevel = levelNumber % 7 === 0;
  const isFactoryLevel = levelNumber % 5 === 0 && !isBossLevel;
  
  // 1. Determine Difficulty Context & Reset Logic
  let enemySpeedMultiplier = 1.0 + (levelNumber * 0.05); // Base linear increase
  
  // Dampening logic
  if (levelNumber === 8 || levelNumber === 9 || levelNumber === 15) {
      enemySpeedMultiplier = 1.0; // Reset speed for new acts
  }

  // Cap speed multiplier
  enemySpeedMultiplier = Math.min(enemySpeedMultiplier, 2.0);

  // 2. Generate Map Layout
  const obstacles: Obstacle[] = [];
  const icePatches: IcePatch[] = [];
  const initialPowerups: { x: number, y: number, type: PowerUpType }[] = [];

  let themeName = THEMES[levelNumber % THEMES.length];
  let description = DESCRIPTIONS[levelNumber % DESCRIPTIONS.length];

  if (isFactoryLevel) {
      themeName = "Toy Factory";
      description = "Navigate the maze and grab the loot!";
      
      const cols = 6;
      const rows = 5;
      const cellW = CANVAS_WIDTH / cols;
      const cellH = CANVAS_HEIGHT / rows;
      
      for(let r=0; r<rows; r++){
          for(let c=0; c<cols; c++){
              // Skip center for player spawn
              if ((r === 2 || r === 3) && (c === 2 || c === 3)) continue;
              
              const cx = c * cellW + cellW/2;
              const cy = r * cellH + cellH/2;
              const radius = Math.min(cellW, cellH) * 0.35;
              
              // 60% chance of box (wall), otherwise chance of loot
              if (Math.random() > 0.4) {
                  obstacles.push({
                      id: `box-${r}-${c}`,
                      x: cx, y: cy,
                      radius: radius,
                      color: '#92400e' // Bronze/Brown box
                  });
              } else {
                  // 40% chance of loot in empty space
                  if (Math.random() < 0.4) {
                       const types: PowerUpType[] = ['RAPID_FIRE', 'TRIPLE_SHOT', 'VITALITY', 'HELPER_RANGE', 'HELPER_MELEE', 'SHIELD', 'REGEN'];
                       initialPowerups.push({
                           x: cx, y: cy,
                           type: types[Math.floor(Math.random() * types.length)]
                       });
                  }
              }
          }
      }
  } else {
      // Standard Generation
      const numObstacles = isBossLevel ? random(2, 5) : random(6, 12);
      const numIce = random(1, 4);

      // Helper to check distance from center (Player Spawn)
      const isTooCloseToCenter = (x: number, y: number, r: number) => {
        const dist = Math.sqrt((x - CANVAS_WIDTH/2)**2 + (y - CANVAS_HEIGHT/2)**2);
        return dist < (150 + r);
      };

      // Generate Obstacles
      for (let i = 0; i < numObstacles; i++) {
        let attempts = 0;
        let valid = false;
        let obs: any = {};

        while (!valid && attempts < 20) {
          const typeRoll = Math.random();
          const type = typeRoll > 0.6 ? 'tree' : (typeRoll > 0.3 ? 'rock' : 'snow');
          const radius = random(20, 60);
          const x = random(radius, CANVAS_WIDTH - radius);
          const y = random(radius, CANVAS_HEIGHT - radius);
          
          let color = OBS_ROCK_COLOR;
          if (type === 'tree') color = OBS_TREE_COLOR;
          if (type === 'snow') color = OBS_SNOW_COLOR;

          if (!isTooCloseToCenter(x, y, radius)) {
            // Simple overlap check with existing obstacles
            let overlap = false;
            for (const existing of obstacles) {
               const d = Math.sqrt((x - existing.x)**2 + (y - existing.y)**2);
               if (d < radius + existing.radius) overlap = true;
            }
            if (!overlap) {
              obs = { id: `obs-${levelNumber}-${i}`, x, y, radius, color };
              valid = true;
            }
          }
          attempts++;
        }
        if (valid) obstacles.push(obs);
      }

      // Generate Ice Patches
      for (let i = 0; i < numIce; i++) {
         const radiusX = random(30, 80);
         const radiusY = random(30, 80);
         const x = random(radiusX, CANVAS_WIDTH - radiusX);
         const y = random(radiusY, CANVAS_HEIGHT - radiusY);
         const rotation = random(0, Math.PI);
         
         icePatches.push({
             id: `ice-${levelNumber}-${i}`,
             x, y, radiusX, radiusY, rotation
         });
      }
  }

  // 3. Boss Configuration
  let bossMessage = "";

  if (isBossLevel) {
    if (levelNumber === 14) {
       themeName = "Santa's Workshop Gone Wrong";
       description = "The Elf Foreman is here to cancel your Christmas.";
       bossMessage = "Back to work!";
    } else if (levelNumber === 21) {
       themeName = "Candy Kingdom";
       description = "It sticks to everything!";
       bossMessage = "Chew on this!";
    } else if (levelNumber === 28) {
       themeName = "Silent Night";
       description = "He sees you when you're sleeping...";
       bossMessage = "HO HO HO! NO SURVIVORS!";
    } else {
       description = "A giant foe approaches!";
       bossMessage = "I will crush you!";
    }
  }

  // 4. Enemy Composition Logic
  let enemyComposition: LevelConfig['enemyComposition'] = 'mixed';
  if (levelNumber > 3) enemyComposition = 'mixed';
  if (levelNumber > 5 && Math.random() > 0.7) enemyComposition = 'rush';
  if (levelNumber > 8) enemyComposition = 'chaos';
  if (isBossLevel) enemyComposition = 'mixed'; 

  // 5. Spawn Rate Logic (Difficulty scaling)
  let adjustedLevel = levelNumber;
  if (levelNumber > 7) adjustedLevel = levelNumber - 4;
  if (levelNumber > 14) adjustedLevel = levelNumber - 8;

  // Base spawn rate gets faster as you go
  let spawnRate = Math.max(400, 1800 - (adjustedLevel * 120));
  
  // Post-level 10 intensity
  if (levelNumber > 10) {
      spawnRate = Math.max(250, spawnRate * 0.6);
  }
  
  // Powerup Scaling (Punish hoarding powerups)
  const extraPowerups = Math.max(0, offensivePowerupCount - 5);
  if (extraPowerups > 0) {
      const powerupMult = Math.pow(0.9, extraPowerups);
      spawnRate = Math.max(150, spawnRate * powerupMult);
  }

  return {
    levelNumber,
    themeName,
    description,
    obstacles,
    icePatches,
    initialPowerups,
    enemySpawnRate: spawnRate,
    enemySpeedMultiplier: enemySpeedMultiplier,
    bossMessage,
    enemyComposition,
    isBossLevel
  };
};

export const getGameOverMessage = async (score: number, level: number): Promise<string> => {
   const index = Math.floor(Math.random() * ROASTS.length);
   return ROASTS[index];
}
