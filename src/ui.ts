// UI System - PanelUI wiring
import {
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  eq,
  Follower,
  ScreenSpace,
  Group,
  Vector3,
} from '@iwsdk/core';
import { StationManager, Station } from './stations';
import { GameSystem } from './game';

export class UISystem extends createSystem({
  reactor: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/reactor.json')] },
  shields: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/shields.json')] },
  oxygen: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/oxygen.json')] },
  power: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/power.json')] },
  comms: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/comms.json')] },
  hud: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
  menu: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/menu.json')] },
  gameover: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/gameover.json')] },
}) {
  private stations!: StationManager;
  private gameSystem!: GameSystem;
  private stationDocs = new Map<string, { doc: UIKitDocument; entity: any }>();
  private hudDoc: UIKitDocument | null = null;
  private hudEntity: any = null;
  private menuDoc: UIKitDocument | null = null;
  private menuEntity: any = null;
  private gameoverDoc: UIKitDocument | null = null;
  private gameoverEntity: any = null;
  private hudVisible = false;
  private menuVisible = true;
  private gameoverVisible = false;

  setRefs(refs: { stations: StationManager; gameSystem: GameSystem }) {
    this.stations = refs.stations;
    this.gameSystem = refs.gameSystem;
  }

  init() {
    // Station panels
    const stationTypes = ['reactor', 'shields', 'oxygen', 'power', 'comms'] as const;
    for (const st of stationTypes) {
      const queries = this.queries as Record<string, typeof this.queries.reactor>;
      const stationDocs = this.stationDocs;
      queries[st].subscribe('qualify', (entity) => {
        const doc = PanelDocument.data.document[entity.index] as UIKitDocument;
        if (!doc) return;
        stationDocs.set(st, { doc, entity });
      });
    }

    // HUD panel (head-locked in XR)
    const hudGroup = new Group();
    hudGroup.position.set(0, 1.8, -1.5);
    hudGroup.visible = false;
    this.world.scene.add(hudGroup);

    const hudEntity = this.world.createTransformEntity(hudGroup);
    hudEntity.addComponent(PanelUI, { config: './ui/hud.json', maxWidth: 0.6, maxHeight: 0.12 });
    // Don't add ScreenSpace yet - panel starts hidden

    this.queries.hud.subscribe('qualify', (entity) => {
      const doc = PanelDocument.data.document[entity.index] as UIKitDocument;
      if (!doc) return;
      this.hudDoc = doc;
      this.hudEntity = entity;
    });

    // Menu panel
    const menuGroup = new Group();
    menuGroup.position.set(0, 1.5, -2);
    this.world.scene.add(menuGroup);

    const menuEntity = this.world.createTransformEntity(menuGroup);
    menuEntity.addComponent(PanelUI, { config: './ui/menu.json', maxWidth: 0.7, maxHeight: 0.6 });

    this.queries.menu.subscribe('qualify', (entity) => {
      const doc = PanelDocument.data.document[entity.index] as UIKitDocument;
      if (!doc) return;
      this.menuDoc = doc;
      this.menuEntity = entity;
      this.wireMenuButtons(doc);
    });

    // Game over panel
    const gameoverGroup = new Group();
    gameoverGroup.position.set(0, 1.5, -2);
    gameoverGroup.visible = false;
    this.world.scene.add(gameoverGroup);

    const gameoverEntity = this.world.createTransformEntity(gameoverGroup);
    gameoverEntity.addComponent(PanelUI, { config: './ui/gameover.json', maxWidth: 0.6, maxHeight: 0.5 });

    this.queries.gameover.subscribe('qualify', (entity) => {
      const doc = PanelDocument.data.document[entity.index] as UIKitDocument;
      if (!doc) return;
      this.gameoverDoc = doc;
      this.gameoverEntity = entity;
      this.wireGameoverButtons(doc);
      // Hide initially
      if (entity.object3D) entity.object3D.visible = false;
    });
  }

  private wireMenuButtons(doc: UIKitDocument) {
    const btnClassic = doc.getElementById('btn-classic') as UIKit.Text | undefined;
    const btnSpeed = doc.getElementById('btn-speed') as UIKit.Text | undefined;
    const btnCampaign = doc.getElementById('btn-campaign') as UIKit.Text | undefined;
    const btnZen = doc.getElementById('btn-zen') as UIKit.Text | undefined;

    btnClassic?.addEventListener('click', () => this.startGame('classic'));
    btnSpeed?.addEventListener('click', () => this.startGame('speed'));
    btnCampaign?.addEventListener('click', () => this.startGame('campaign'));
    btnZen?.addEventListener('click', () => this.startGame('zen'));
  }

  private wireGameoverButtons(doc: UIKitDocument) {
    const btnRetry = doc.getElementById('btn-retry') as UIKit.Text | undefined;
    const btnMenu = doc.getElementById('btn-menu') as UIKit.Text | undefined;

    btnRetry?.addEventListener('click', () => {
      this.gameSystem.startGame(this.gameSystem.mode, this.gameSystem.difficulty);
      this.showGameover(false);
      this.showHud(true);
    });

    btnMenu?.addEventListener('click', () => {
      this.gameSystem.state = 'menu';
      this.showGameover(false);
      this.showMenu(true);
    });
  }

  private startGame(mode: 'classic' | 'speed' | 'campaign' | 'zen') {
    this.gameSystem.startGame(mode, 'normal');
    this.showMenu(false);
    this.showHud(true);
  }

  private showHud(show: boolean) {
    if (this.hudEntity && this.hudVisible !== show) {
      this.hudVisible = show;
      if (this.hudEntity.object3D) this.hudEntity.object3D.visible = show;
      if (show) {
        this.hudEntity.addComponent(ScreenSpace, {});
        this.hudEntity.addComponent(Follower, { target: this.world.player.head });
        const ov = this.hudEntity.getVectorView(Follower, 'offsetPosition');
        if (ov) { ov[0] = 0; ov[1] = 0.25; ov[2] = -0.8; }
      } else {
        if (this.hudEntity.hasComponent(ScreenSpace)) this.hudEntity.removeComponent(ScreenSpace);
        if (this.hudEntity.hasComponent(Follower)) this.hudEntity.removeComponent(Follower);
      }
    }
  }

  private showMenu(show: boolean) {
    this.menuVisible = show;
    if (this.menuEntity?.object3D) {
      this.menuEntity.object3D.visible = show;
    }
  }

  private showGameover(show: boolean) {
    this.gameoverVisible = show;
    if (this.gameoverEntity?.object3D) {
      this.gameoverEntity.object3D.visible = show;
    }
  }

  update(_delta: number, _time: number) {
    // Update station panels
    for (const station of this.stations.stations) {
      const entry = this.stationDocs.get(station.type);
      if (!entry) continue;
      const { doc } = entry;

      const statusEl = doc.getElementById('status') as UIKit.Text | undefined;
      const crisisEl = doc.getElementById('crisis') as UIKit.Text | undefined;
      const taskEl = doc.getElementById('task') as UIKit.Text | undefined;

      if (station.active) {
        const pct = Math.floor(station.crisis);
        statusEl?.setProperties({ text: `ALERT - ${pct}%` });

        if (pct > 75) {
          crisisEl?.setProperties({ text: 'CRITICAL', backgroundColor: '#ff0000' });
        } else if (pct > 50) {
          crisisEl?.setProperties({ text: 'WARNING', backgroundColor: '#ff6600' });
        } else {
          crisisEl?.setProperties({ text: 'ACTIVE', backgroundColor: '#ffaa00' });
        }

        // Task description
        switch (station.type) {
          case 'reactor':
          case 'comms': {
            const seq = station.sequenceTarget.map(n => ['A', 'B', 'X', 'Y'][n]).join(' ');
            const done = station.sequenceInput.length;
            taskEl?.setProperties({ text: `Sequence: ${seq} (${done}/${station.sequenceTarget.length})` });
            break;
          }
          case 'shields':
          case 'oxygen': {
            taskEl?.setProperties({ text: `Pump: ${station.pumpCount}/${station.pumpTarget} (Trigger)` });
            break;
          }
          case 'power': {
            const seq = station.matchTarget.map(n => ['A', 'B', 'X', 'Y'][n]).join(' ');
            const done = station.matchInput.length;
            taskEl?.setProperties({ text: `Match: ${seq} (${done}/${station.matchTarget.length})` });
            break;
          }
        }
      } else {
        statusEl?.setProperties({ text: 'NOMINAL' });
        crisisEl?.setProperties({ text: 'OK', backgroundColor: '#115522' });
        taskEl?.setProperties({ text: 'Systems stable' });
      }
    }

    // Update HUD
    if (this.hudDoc && this.gameSystem.state === 'playing') {
      const scoreEl = this.hudDoc.getElementById('score') as UIKit.Text | undefined;
      const livesEl = this.hudDoc.getElementById('lives') as UIKit.Text | undefined;
      const timeEl = this.hudDoc.getElementById('time') as UIKit.Text | undefined;
      const streakEl = this.hudDoc.getElementById('streak') as UIKit.Text | undefined;
      const modeEl = this.hudDoc.getElementById('mode-info') as UIKit.Text | undefined;

      scoreEl?.setProperties({ text: `Score: ${this.gameSystem.score}` });
      livesEl?.setProperties({ text: `Lives: ${'*'.repeat(this.gameSystem.lives)}` });

      const mins = Math.floor(this.gameSystem.survivalTime / 60);
      const secs = Math.floor(this.gameSystem.survivalTime % 60);
      timeEl?.setProperties({ text: `${mins}:${secs.toString().padStart(2, '0')}` });

      if (this.gameSystem.streak > 1) {
        streakEl?.setProperties({ text: `Streak: ${this.gameSystem.streak}x (${this.gameSystem.comboMultiplier.toFixed(1)}x)` });
      } else {
        streakEl?.setProperties({ text: '' });
      }

      // Mode-specific info
      if (this.gameSystem.mode === 'speed') {
        modeEl?.setProperties({ text: `Speed: ${this.gameSystem.speedResolved}/${this.gameSystem.speedTarget}` });
      } else if (this.gameSystem.mode === 'campaign') {
        modeEl?.setProperties({ text: `Wave ${this.gameSystem.campaignWave} - ${this.gameSystem.campaignKills}/${this.gameSystem.campaignTarget}` });
      } else {
        modeEl?.setProperties({ text: '' });
      }
    }

    // State transitions
    if (this.gameSystem.state === 'gameover' && !this.gameoverVisible) {
      this.showHud(false);
      this.showGameover(true);

      if (this.gameoverDoc) {
        const finalScore = this.gameoverDoc.getElementById('final-score') as UIKit.Text | undefined;
        const finalTime = this.gameoverDoc.getElementById('final-time') as UIKit.Text | undefined;
        const finalCrises = this.gameoverDoc.getElementById('final-crises') as UIKit.Text | undefined;
        const finalStreak = this.gameoverDoc.getElementById('final-streak') as UIKit.Text | undefined;

        finalScore?.setProperties({ text: `Score: ${this.gameSystem.score}` });
        const mins = Math.floor(this.gameSystem.survivalTime / 60);
        const secs = Math.floor(this.gameSystem.survivalTime % 60);
        finalTime?.setProperties({ text: `Time: ${mins}:${secs.toString().padStart(2, '0')}` });
        finalCrises?.setProperties({ text: `Crises Resolved: ${this.gameSystem.crisesResolved}` });
        finalStreak?.setProperties({ text: `Best Streak: ${this.gameSystem.bestStreak}` });
      }
    }

    if (this.gameSystem.state === 'menu' && !this.menuVisible) {
      this.showMenu(true);
      this.showHud(false);
      this.showGameover(false);
    }
  }
}
