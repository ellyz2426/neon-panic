// Station types and crisis management
import {
  World,
  Mesh,
  Group,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Color,
  Vector3,
  PointLight,
  RingGeometry,
  DoubleSide,
  AdditiveBlending,
  Float32BufferAttribute,
  BufferGeometry,
  LineSegments,
  LineBasicMaterial,
  PanelUI,
} from '@iwsdk/core';

export type StationType = 'reactor' | 'shields' | 'oxygen' | 'power' | 'comms';

export interface Station {
  type: StationType;
  label: string;
  color: string;
  crisis: number; // 0-100, 100 = critical failure
  crisisRate: number; // per second
  active: boolean; // currently in crisis
  resolved: number; // times resolved
  angle: number; // position angle in room
  group: Group;
  light: PointLight;
  panelEntity: ReturnType<World['createTransformEntity']> | null;
  interactTarget: Mesh;
  interactCooldown: number;
  // Station-specific state
  sequenceTarget: number[];
  sequenceInput: number[];
  pumpCount: number;
  pumpTarget: number;
  matchTarget: number[];
  matchInput: number[];
}

const STATION_DEFS: { type: StationType; label: string; color: string; angle: number }[] = [
  { type: 'reactor', label: 'REACTOR', color: '#ff3333', angle: 0 },
  { type: 'shields', label: 'SHIELDS', color: '#3399ff', angle: Math.PI * 0.4 },
  { type: 'oxygen', label: 'OXYGEN', color: '#33ff66', angle: Math.PI * 0.8 },
  { type: 'power', label: 'POWER', color: '#ffaa00', angle: Math.PI * 1.2 },
  { type: 'comms', label: 'COMMS', color: '#cc33ff', angle: Math.PI * 1.6 },
];

const STATION_RADIUS = 4;

export class StationManager {
  stations: Station[] = [];
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  build() {
    for (const def of STATION_DEFS) {
      const x = Math.sin(def.angle) * STATION_RADIUS;
      const z = -Math.cos(def.angle) * STATION_RADIUS;

      const group = new Group();
      group.position.set(x, 0, z);
      group.lookAt(0, 0, 0);

      // Station console base
      const consoleMat = new MeshStandardMaterial({
        color: new Color(0x111122),
        emissive: new Color(def.color).multiplyScalar(0.1),
        metalness: 0.8,
        roughness: 0.3,
      });

      const consoleBase = new Mesh(
        new BoxGeometry(1.6, 1.0, 0.6),
        consoleMat
      );
      consoleBase.position.set(0, 0.5, 0);
      group.add(consoleBase);

      // Console top (angled screen area)
      const consoleTop = new Mesh(
        new BoxGeometry(1.6, 0.05, 0.8),
        new MeshStandardMaterial({
          color: new Color(0x000000),
          emissive: new Color(def.color).multiplyScalar(0.05),
          metalness: 0.9,
          roughness: 0.1,
        })
      );
      consoleTop.position.set(0, 1.02, -0.1);
      consoleTop.rotation.x = -0.3;
      group.add(consoleTop);

      // Status light strip on console front
      const stripGeo = new BoxGeometry(1.4, 0.05, 0.02);
      const stripMat = new MeshBasicMaterial({
        color: new Color(def.color),
        transparent: true,
        opacity: 0.8,
      });
      const strip = new Mesh(stripGeo, stripMat);
      strip.position.set(0, 0.9, -0.31);
      group.add(strip);

      // Side pillars
      for (const side of [-1, 1]) {
        const pillar = new Mesh(
          new BoxGeometry(0.08, 1.8, 0.08),
          new MeshStandardMaterial({
            color: 0x222233,
            emissive: new Color(def.color).multiplyScalar(0.15),
            metalness: 0.7,
            roughness: 0.4,
          })
        );
        pillar.position.set(side * 0.85, 0.9, 0);
        group.add(pillar);

        // Top cap light
        const cap = new Mesh(
          new SphereGeometry(0.06, 8, 8),
          new MeshBasicMaterial({ color: new Color(def.color) })
        );
        cap.position.set(side * 0.85, 1.85, 0);
        group.add(cap);
      }

      // Interaction target (invisible large hit area)
      const interactTarget = new Mesh(
        new BoxGeometry(1.8, 1.5, 1.0),
        new MeshBasicMaterial({ visible: false })
      );
      interactTarget.position.set(0, 0.75, 0);
      group.add(interactTarget);

      // Station point light
      const light = new PointLight(new Color(def.color), 0.5, 6);
      light.position.set(0, 2.0, -0.5);
      group.add(light);

      this.world.scene.add(group);

      // Create panel entity for UI
      const panelGroup = new Group();
      panelGroup.position.set(0, 1.4, -0.15);
      panelGroup.rotation.x = -0.2;
      panelGroup.scale.set(0.7, 0.7, 0.7);
      group.add(panelGroup);

      const panelEntity = this.world.createTransformEntity(panelGroup);
      panelEntity.addComponent(PanelUI, {
        config: `./ui/${def.type}.json`,
        maxWidth: 0.5,
        maxHeight: 0.35,
      });

      const station: Station = {
        type: def.type,
        label: def.label,
        color: def.color,
        crisis: 0,
        crisisRate: 3 + Math.random() * 2, // 3-5 per second base
        active: false,
        resolved: 0,
        angle: def.angle,
        group,
        light,
        panelEntity,
        interactTarget,
        interactCooldown: 0,
        sequenceTarget: [],
        sequenceInput: [],
        pumpCount: 0,
        pumpTarget: 8,
        matchTarget: [],
        matchInput: [],
      };

      this.stations.push(station);
    }
  }

  getStation(type: StationType): Station | undefined {
    return this.stations.find(s => s.type === type);
  }

  resetStation(station: Station) {
    station.crisis = 0;
    station.active = false;
    station.sequenceTarget = [];
    station.sequenceInput = [];
    station.pumpCount = 0;
    station.matchTarget = [];
    station.matchInput = [];
    station.interactCooldown = 0;
  }

  activateStation(station: Station) {
    station.active = true;
    station.crisis = 20 + Math.random() * 20;

    // Set up station-specific challenge
    switch (station.type) {
      case 'reactor': {
        // Press 3-5 buttons in sequence
        const len = 3 + Math.floor(Math.random() * 3);
        station.sequenceTarget = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
        station.sequenceInput = [];
        break;
      }
      case 'shields': {
        // Rapid trigger pulls
        station.pumpCount = 0;
        station.pumpTarget = 6 + Math.floor(Math.random() * 5);
        break;
      }
      case 'oxygen': {
        // Rapid trigger pumping
        station.pumpCount = 0;
        station.pumpTarget = 8 + Math.floor(Math.random() * 6);
        break;
      }
      case 'power': {
        // Match 3-4 colored switches
        const len = 3 + Math.floor(Math.random() * 2);
        station.matchTarget = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
        station.matchInput = [];
        break;
      }
      case 'comms': {
        // Repeat signal pattern
        const len = 3 + Math.floor(Math.random() * 3);
        station.sequenceTarget = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
        station.sequenceInput = [];
        break;
      }
    }
  }
}
