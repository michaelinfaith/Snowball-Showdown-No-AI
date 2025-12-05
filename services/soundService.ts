
// Simple synthesizer for game sound effects to avoid external asset dependencies
let audioCtx: AudioContext | null = null;
let musicInterval: number | null = null;
let musicNoteIndex = 0;

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const startMusic = () => {
  if (musicInterval) return;
  initAudio();
  if (!audioCtx) return;

  // Simple bassline / march
  const melody = [
    { f: 110, d: 0.2 }, { f: 0, d: 0.2 }, { f: 110, d: 0.2 }, { f: 130, d: 0.2 },
    { f: 146, d: 0.4 }, { f: 130, d: 0.2 }, { f: 110, d: 0.2 },
    { f: 98, d: 0.2 }, { f: 0, d: 0.2 }, { f: 98, d: 0.2 }, { f: 110, d: 0.2 },
    { f: 130, d: 0.4 }, { f: 110, d: 0.2 }, { f: 98, d: 0.2 }
  ];

  musicNoteIndex = 0;
  
  // Play a note every 250ms approximately (120 BPMish eighth notes)
  musicInterval = window.setInterval(() => {
    if (!audioCtx) return;
    const note = melody[musicNoteIndex % melody.length];
    musicNoteIndex++;

    if (note.f > 0) {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = note.f;
      
      // Low pass for "muffled" winter sound
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.d);

      osc.start(now);
      osc.stop(now + note.d);
    }
  }, 250);
};

export const stopMusic = () => {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
};

type SoundType = 'throw' | 'hit_enemy' | 'hit_player' | 'spawn' | 'game_over' | 'level_complete' | 'laser' | 'teleport' | 'jingle_bells' | 'bounce' | 'squish' | 'ho_ho_ho' | 'powerup_spawn' | 'powerup_collect' | 'freeze' | 'shield_hit' | 'shield_break' | 'slide';

export const playSound = (type: SoundType) => {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  switch (type) {
    case 'throw':
      // High pitch sweep down (whoosh)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;

    case 'hit_enemy':
      // White noise burst (crunch)
      osc.disconnect(); 
      const bufferSize = audioCtx.sampleRate * 0.1; // 0.1 seconds
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      noise.connect(filter);
      filter.connect(gainNode);
      
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      noise.start(now);
      break;

    case 'hit_player':
      // Low thud
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;

    case 'squish':
      // Wet squish (Sawtooth with filter sweep)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.2);
      
      const squishFilter = audioCtx.createBiquadFilter();
      squishFilter.type = 'lowpass';
      squishFilter.frequency.setValueAtTime(800, now);
      squishFilter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      
      osc.disconnect();
      osc.connect(squishFilter);
      squishFilter.connect(gainNode);

      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;

    case 'spawn':
      // Rising slide
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.1);
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;

    case 'game_over':
      // Sad trombone-ish
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.5);
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;

    case 'level_complete':
      osc.disconnect();
      const notes = [440, 554, 659]; // A major
      notes.forEach((freq, i) => {
        const o = audioCtx!.createOscillator();
        const g = audioCtx!.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g);
        g.connect(audioCtx!.destination);
        g.gain.setValueAtTime(0.1, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.3);
      });
      break;
    
    case 'laser':
      // Pew pew
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;

    case 'teleport':
      // Sci-fi wobble
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.2);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
      
      const lfo = audioCtx.createOscillator();
      lfo.frequency.value = 50;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 500;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + 0.2);

      osc.start(now);
      osc.stop(now + 0.2);
      break;
      
    case 'jingle_bells':
      // Quick jingle
      osc.disconnect();
      const jingleNotes = [783.99, 783.99, 783.99, 0, 783.99, 783.99, 783.99, 0, 783.99, 987.77, 659.25, 739.99, 783.99]; // G G G - G G G - G B E D G
      jingleNotes.forEach((freq, i) => {
        if (freq === 0) return;
        const o = audioCtx!.createOscillator();
        const g = audioCtx!.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g);
        g.connect(audioCtx!.destination);
        const startTime = now + i * 0.15;
        g.gain.setValueAtTime(0.1, startTime);
        g.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
        o.start(startTime);
        o.stop(startTime + 0.12);
      });
      break;
      
    case 'bounce':
      // Metallic ping
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case 'ho_ho_ho':
      // Deep voice
      osc.disconnect();
      const syllables = [120, 100, 80]; // Frequencies descending
      syllables.forEach((freq, i) => {
          const o = audioCtx!.createOscillator();
          const g = audioCtx!.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          
          // Deep filter
          const filter = audioCtx!.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 300;

          o.connect(filter);
          filter.connect(g);
          g.connect(audioCtx!.destination);
          
          const start = now + i * 0.4;
          g.gain.setValueAtTime(0.2, start);
          g.gain.exponentialRampToValueAtTime(0.01, start + 0.3);
          
          // Pitch drop per syllable
          o.frequency.setValueAtTime(freq, start);
          o.frequency.exponentialRampToValueAtTime(freq * 0.8, start + 0.3);

          o.start(start);
          o.stop(start + 0.35);
      });
      break;

    case 'powerup_spawn':
      // Magical chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(1760, now + 0.3);
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case 'powerup_collect':
      // Fanfare
      const pNotes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
      pNotes.forEach((f, i) => {
        const o = audioCtx!.createOscillator();
        const g = audioCtx!.createGain();
        o.type = 'square';
        o.frequency.value = f;
        o.connect(g);
        g.connect(audioCtx!.destination);
        g.gain.setValueAtTime(0.05, now + i*0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + i*0.05 + 0.1);
        o.start(now + i*0.05);
        o.stop(now + i*0.05 + 0.1);
      });
      break;
      
    case 'freeze':
      // Glassy shatter
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
      
    case 'shield_hit':
      // Deflect sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.1);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;

    case 'shield_break':
      // Shatter
      osc.disconnect();
      const nBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
      const nd = nBuf.getChannelData(0);
      for(let i=0; i<nd.length; i++) nd[i] = Math.random()*2-1;
      const src = audioCtx.createBufferSource();
      src.buffer = nBuf;
      const f = audioCtx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2000;
      src.connect(f);
      f.connect(gainNode);
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      src.start(now);
      break;

    case 'slide':
      // Windy sliding noise
      osc.disconnect();
      const sBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
      const sd = sBuf.getChannelData(0);
      for(let i=0; i<sd.length; i++) sd[i] = Math.random()*2-1;
      const sSrc = audioCtx.createBufferSource();
      sSrc.buffer = sBuf;
      const sf = audioCtx.createBiquadFilter();
      sf.type = 'bandpass';
      sf.frequency.value = 800;
      sSrc.connect(sf);
      sf.connect(gainNode);
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
      sSrc.start(now);
      break;
  }
};
