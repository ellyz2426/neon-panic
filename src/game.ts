// Core game system - crisis management loop
import {
  createSystem,
  InputComponent,
  Vector3,
  Raycaster,
  Vector2,
  Color,
  MeshBasicMaterial,
} from '@iwsdk/core';
import { AudioManager } from './audio';
import { StationManager, Station, StationType } from './stations';

type GameState = 'menu' | 'playing' | 'gameover';
type GameMode = 'classic' | 'speed' | 'campaign' | 'zen';
type Difficulty = 'easy' | 'normal' | 'hard';

// Achievements
interface Achievement {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  check: (gs: GameSystem) => boolean;
}

const SAVE_KEY = 'neon-panic-save';

interface SaveData {
  highScores: Record<string, number>;
  totalCrises: number;
  totalGames: number;
  achievements: string[];
  bestStreak: number;
}

export class GameSystem extends createSystem({}) {
  private audio!: AudioManager;
  private stations!: StationManager;
  state: GameState = 'menu';
  mode: GameMode = 'classic';
  difficulty: Difficulty = 'normal';
  score = 0;
  lives = 3;
  survivalTime = 0;
  crisesResolved = 0;
  streak = 0;
  bestStreak = 0;
  comboMultiplier = 1;
  private crisisTimer = 0;
  private crisisInterval = 5;
  private alarmCooldown = 0;
  private criticalCooldown = 0;
  private difficultyScale = 1;
  private focusedStation: Station | null = null;
  private raycaster = new Raycaster();
  private interactCooldown = 0;
  private musicStarted = false;

  // Speed mode
  speedTarget = 20;
  speedResolved = 0;

  // Campaign mode
  campaignWave = 1;
  campaignKills = 0;
  campaignTarget = 5;

  // Save data
  saveData: SaveData = {
    highScores: {},
    totalCrises: 0,
    totalGames: 0,
    achievements: [],
    bestStreak: 0,
  };

  achievements: Achievement[] = [
    { id: 'first_crisis', name: 'First Response', desc: 'Resolve your first crisis', unlocked: false, check: (gs) => gs.crisesResolved >= 1 },
    { id: 'ten_crises', name: 'Veteran Operator', desc: 'Resolve 10 crises in one game', unlocked: false, check: (gs) => gs.crisesResolved >= 10 },
    { id: 'twenty_crises', name: 'Crisis Master', desc: 'Resolve 20 crises in one game', unlocked: false, check: (gs) => gs.crisesResolved >= 20 },
    { id: 'fifty_crises', name: 'Station Commander', desc: 'Resolve 50 crises in one game', unlocked: false, check: (gs) => gs.crisesResolved >= 50 },
    { id: 'survive_60', name: 'Minute Man', desc: 'Survive 60 seconds in Classic', unlocked: false, check: (gs) => gs.survivalTime >= 60 },
    { id: 'survive_120', name: 'Iron Will', desc: 'Survive 120 seconds in Classic', unlocked: false, check: (gs) => gs.survivalTime >= 120 },
    { id: 'survive_180', name: 'Unbreakable', desc: 'Survive 180 seconds in Classic', unlocked: false, check: (gs) => gs.survivalTime >= 180 },
    { id: 'survive_300', name: 'Station Legend', desc: 'Survive 300 seconds in Classic', unlocked: false, check: (gs) => gs.survivalTime >= 300 },
    { id: 'streak_3', name: 'Triple Threat', desc: 'Resolve 3 crises in a row', unlocked: false, check: (gs) => gs.streak >= 3 },
    { id: 'streak_5', name: 'Hot Streak', desc: 'Resolve 5 crises in a row', unlocked: false, check: (gs) => gs.streak >= 5 },
    { id: 'streak_10', name: 'Unstoppable', desc: 'Resolve 10 crises in a row', unlocked: false, check: (gs) => gs.streak >= 10 },
    { id: 'no_damage', name: 'Perfect Start', desc: 'Resolve 5 crises without losing a life', unlocked: false, check: (gs) => gs.crisesResolved >= 5 && gs.lives === 3 },
    { id: 'speed_run', name: 'Speed Demon', desc: 'Complete Speed Run mode', unlocked: false, check: (gs) => gs.mode === 'speed' && gs.speedResolved >= gs.speedTarget },
    { id: 'score_500', name: 'High Scorer', desc: 'Score 500 points', unlocked: false, check: (gs) => gs.score >= 500 },
    { id: 'score_1000', name: 'Score Master', desc: 'Score 1000 points', unlocked: false, check: (gs) => gs.score >= 1000 },
    { id: 'campaign_w3', name: 'Wave Warrior', desc: 'Reach wave 3 in Campaign', unlocked: false, check: (gs) => gs.mode === 'campaign' && gs.campaignWave >= 3 },
    { id: 'campaign_w5', name: 'Wave Commander', desc: 'Reach wave 5 in Campaign', unlocked: false, check: (gs) => gs.mode === 'campaign' && gs.campaignWave >= 5 },
    { id: 'all_stations', name: 'Multi-Tasker', desc: 'Resolve all 5 station types', unlocked: false, check: (gs) => gs.stations.stations.every(s => s.resolved > 0) },
    { id: 'zen_master', name: 'Zen Master', desc: 'Play Zen mode for 120 seconds', unlocked: false, check: (gs) => gs.mode === 'zen' && gs.survivalTime >= 120 },
    { id: 'total_100', name: 'Dedicated', desc: 'Resolve 100 total crises across all games', unlocked: false, check: (gs) => gs.saveData.totalCrises >= 100 },
  ];

  setRefs(refs: { audio: AudioManager; stations: StationManager }) {
    this.audio = refs.audio;
    this.stations = refs.stations;
    this.loadSave();
  }

  startGame(mode: GameMode = 'classic', diff: Difficulty = 'normal') {
    this.state = 'playing';
    this.mode = mode;
    this.difficulty = diff;
    this.score = 0;
    this.lives = mode === 'zen' ? 99 : 3;
    this.survivalTime = 0;
    this.crisesResolved = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.comboMultiplier = 1;
    this.crisisTimer = 2; // first crisis after 2s
    this.difficultyScale = 1;
    this.focusedStation = null;
    this.speedResolved = 0;
    this.campaignWave = 1;
    this.campaignKills = 0;
    this.campaignTarget = 5;
    this.interactCooldown = 0;

    // Difficulty settings
    switch (diff) {
      case 'easy':
        this.crisisInterval = 7;
        break;
      case 'normal':
        this.crisisInterval = 5;
        break;
      case 'hard':
        this.crisisInterval = 3;
        break;
    }

    // Reset all stations
    this.stations.stations.forEach(s => this.stations.resetStation(s));

    if (!this.musicStarted) {
      this.audio.startMusic();
      this.musicStarted = true;
    }
  }

  endGame() {
    this.state = 'gameover';
    this.audio.playGameOver();

    // Save high score
    const key = `${this.mode}_${this.difficulty}`;
    if (!this.saveData.highScores[key] || this.score > this.saveData.highScores[key]) {
      this.saveData.highScores[key] = this.score;
    }
    this.saveData.totalGames++;
    if (this.bestStreak > this.saveData.bestStreak) {
      this.saveData.bestStreak = this.bestStreak;
    }
    this.saveSave();
  }

  update(delta: number, _time: number) {
    if (this.state !== 'playing') return;

    this.survivalTime += delta;
    this.interactCooldown = Math.max(0, this.interactCooldown - delta);
    this.alarmCooldown = Math.max(0, this.alarmCooldown - delta);
    this.criticalCooldown = Math.max(0, this.criticalCooldown - delta);

    // Increase difficulty over time
    this.difficultyScale = 1 + this.survivalTime / 60;

    // Crisis timer - spawn new crises
    this.crisisTimer -= delta;
    if (this.crisisTimer <= 0) {
      this.spawnCrisis();
      const interval = this.crisisInterval / this.difficultyScale;
      this.crisisTimer = Math.max(1.5, interval);
    }

    // Update active stations
    for (const station of this.stations.stations) {
      if (station.active) {
        // Crisis meter fills
        const rate = station.crisisRate * this.difficultyScale;
        station.crisis = Math.min(100, station.crisis + rate * delta);

        // Update station light intensity based on crisis
        const intensity = 0.5 + (station.crisis / 100) * 2;
        station.light.intensity = intensity;

        // Flash light when critical
        if (station.crisis > 75) {
          const flash = Math.sin(_time * 8) > 0 ? 1 : 0.3;
          station.light.intensity = intensity * flash;

          if (this.criticalCooldown <= 0) {
            this.audio.playCritical();
            this.criticalCooldown = 1;
          }
        }

        // Station overloaded - lose a life
        if (station.crisis >= 100) {
          this.stationFailed(station);
        }
      } else {
        // Idle station - dim light
        station.light.intensity = 0.3;
      }

      // Update interact cooldown
      station.interactCooldown = Math.max(0, station.interactCooldown - delta);
    }

    // Handle input
    this.handleInput();

    // Check achievements
    this.checkAchievements();

    // Speed mode win check
    if (this.mode === 'speed' && this.speedResolved >= this.speedTarget) {
      this.score += Math.max(0, Math.floor(300 - this.survivalTime * 2));
      this.endGame();
    }
  }

  private spawnCrisis() {
    // Find inactive stations
    const inactive = this.stations.stations.filter(s => !s.active);
    if (inactive.length === 0) return;

    // Campaign: controlled spawning
    if (this.mode === 'campaign') {
      const maxActive = Math.min(this.campaignWave, 4);
      const active = this.stations.stations.filter(s => s.active).length;
      if (active >= maxActive) return;
    }

    const station = inactive[Math.floor(Math.random() * inactive.length)];
    this.stations.activateStation(station);
    if (this.alarmCooldown <= 0) {
      this.audio.playAlarm();
      this.alarmCooldown = 0.5;
    }
  }

  private stationFailed(station: Station) {
    this.lives--;
    this.streak = 0;
    this.comboMultiplier = 1;
    this.audio.playFailure();
    this.stations.resetStation(station);

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  resolveStation(station: Station) {
    station.resolved++;
    this.crisesResolved++;
    this.streak++;
    this.saveData.totalCrises++;

    if (this.streak > this.bestStreak) {
      this.bestStreak = this.streak;
    }

    // Combo multiplier
    this.comboMultiplier = 1 + Math.floor(this.streak / 3) * 0.5;

    // Score based on remaining crisis (faster = more points)
    const timeBonus = Math.floor((100 - station.crisis) / 10);
    const basePoints = 10 + timeBonus;
    this.score += Math.floor(basePoints * this.comboMultiplier);

    this.audio.playSuccess();
    this.stations.resetStation(station);

    if (this.mode === 'speed') {
      this.speedResolved++;
    }

    if (this.mode === 'campaign') {
      this.campaignKills++;
      if (this.campaignKills >= this.campaignTarget) {
        this.campaignWave++;
        this.campaignKills = 0;
        this.campaignTarget = 5 + this.campaignWave * 2;
      }
    }
  }

  private handleInput() {
    if (this.interactCooldown > 0) return;

    // XR controller input
    const right = this.input.xr.gamepads.right;
    const left = this.input.xr.gamepads.left;

    let triggerPressed = false;
    let buttonIndex = -1;

    if (right) {
      if (right.getButtonDown(InputComponent.Trigger)) {
        triggerPressed = true;
      }
      if (right.getButtonDown(InputComponent.A_Button)) buttonIndex = 0;
      if (right.getButtonDown(InputComponent.B_Button)) buttonIndex = 1;
    }
    if (left) {
      if (left.getButtonDown(InputComponent.Trigger)) {
        triggerPressed = true;
      }
      if (left.getButtonDown(InputComponent.A_Button)) buttonIndex = 2;
      if (left.getButtonDown(InputComponent.B_Button)) buttonIndex = 3;
    }

    // Keyboard fallback
    if (this.input.keyboard.getKeyDown('Space') || this.input.keyboard.getKeyDown('Enter')) {
      triggerPressed = true;
    }
    if (this.input.keyboard.getKeyDown('Digit1')) buttonIndex = 0;
    if (this.input.keyboard.getKeyDown('Digit2')) buttonIndex = 1;
    if (this.input.keyboard.getKeyDown('Digit3')) buttonIndex = 2;
    if (this.input.keyboard.getKeyDown('Digit4')) buttonIndex = 3;

    // Find station being looked at (raycast from camera)
    if (triggerPressed || buttonIndex >= 0) {
      const station = this.findLookedAtStation();
      if (station && station.active) {
        this.interactWithStation(station, triggerPressed, buttonIndex);
      }
    }
  }

  private findLookedAtStation(): Station | null {
    // Raycast from camera forward
    this.raycaster.setFromCamera(new Vector2(0, 0), this.camera);

    const targets = this.stations.stations.map(s => s.interactTarget);
    const hits = this.raycaster.intersectObjects(targets);

    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      return this.stations.stations.find(s => s.interactTarget === hitMesh) || null;
    }
    return null;
  }

  private interactWithStation(station: Station, trigger: boolean, button: number) {
    if (station.interactCooldown > 0) return;

    switch (station.type) {
      case 'reactor':
      case 'comms': {
        // Sequence input - press buttons in order
        if (button >= 0) {
          this.audio.playTone(button);
          station.sequenceInput.push(button);
          station.interactCooldown = 0.2;

          // Check if sequence matches so far
          const idx = station.sequenceInput.length - 1;
          if (station.sequenceInput[idx] !== station.sequenceTarget[idx]) {
            // Wrong! Reset input
            station.sequenceInput = [];
            this.audio.playFailure();
            station.crisis = Math.min(100, station.crisis + 10);
          } else if (station.sequenceInput.length >= station.sequenceTarget.length) {
            // Complete!
            this.resolveStation(station);
          }
          this.interactCooldown = 0.15;
        }
        break;
      }
      case 'shields':
      case 'oxygen': {
        // Pump action - rapid triggers
        if (trigger) {
          station.pumpCount++;
          this.audio.playPump();
          station.interactCooldown = 0.1;

          if (station.pumpCount >= station.pumpTarget) {
            this.resolveStation(station);
          }
          this.interactCooldown = 0.1;
        }
        break;
      }
      case 'power': {
        // Match colored switches
        if (button >= 0) {
          this.audio.playTone(button);
          station.matchInput.push(button);
          station.interactCooldown = 0.2;

          const idx = station.matchInput.length - 1;
          if (station.matchInput[idx] !== station.matchTarget[idx]) {
            station.matchInput = [];
            this.audio.playFailure();
            station.crisis = Math.min(100, station.crisis + 10);
          } else if (station.matchInput.length >= station.matchTarget.length) {
            this.resolveStation(station);
          }
          this.interactCooldown = 0.15;
        }
        break;
      }
    }
  }

  private checkAchievements() {
    for (const ach of this.achievements) {
      if (!ach.unlocked && !this.saveData.achievements.includes(ach.id)) {
        if (ach.check(this)) {
          ach.unlocked = true;
          this.saveData.achievements.push(ach.id);
          this.saveSave();
        }
      }
    }
  }

  private loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        this.saveData = JSON.parse(raw);
        // Restore achievement states
        for (const ach of this.achievements) {
          ach.unlocked = this.saveData.achievements.includes(ach.id);
        }
      }
    } catch (_e) { /* ignore */ }
  }

  private saveSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
    } catch (_e) { /* ignore */ }
  }

  getHighScore(mode: string, diff: string): number {
    return this.saveData.highScores[`${mode}_${diff}`] || 0;
  }
}
