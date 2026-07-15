// Environment setup - holodeck aesthetic
import {
  World,
  Mesh,
  Group,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  RingGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  LineSegments,
  LineBasicMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  AmbientLight,
  PointLight,
  Fog,
  DoubleSide,
  AdditiveBlending,
  Points,
  PointsMaterial,
  Scene,
} from '@iwsdk/core';

export class Environment {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  build() {
    const scene = this.world.scene;

    // Dark space station fog
    scene.fog = new Fog(0x000811, 8, 30);
    scene.background = new Color(0x000811);

    // Ambient light
    scene.add(new AmbientLight(0x112233, 0.3));

    // Central overhead light
    const overhead = new PointLight(0x4466aa, 1.5, 15);
    overhead.position.set(0, 4, 0);
    scene.add(overhead);

    // Floor - hex grid pattern
    this.buildFloor(scene);

    // Walls - curved station walls
    this.buildWalls(scene);

    // Ceiling
    this.buildCeiling(scene);

    // Central command pillar
    this.buildCenterPillar(scene);

    // Ambient particles (floating dust/sparks)
    this.buildParticles(scene);
  }

  private buildFloor(scene: Scene) {
    // Main floor disc
    const floorGeo = new CylinderGeometry(7, 7, 0.05, 32);
    const floorMat = new MeshStandardMaterial({
      color: 0x0a0a1a,
      metalness: 0.9,
      roughness: 0.3,
      emissive: new Color(0x111133),
      emissiveIntensity: 0.1,
    });
    const floor = new Mesh(floorGeo, floorMat);
    floor.position.y = -0.025;
    scene.add(floor);

    // Grid lines on floor
    const gridLines = new Group();
    const gridMat = new LineBasicMaterial({
      color: 0x1a2244,
      transparent: true,
      opacity: 0.4,
    });

    // Concentric rings
    for (let r = 1; r <= 6; r++) {
      const ringGeo = new BufferGeometry();
      const pts: number[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(Math.cos(a) * r, 0.01, Math.sin(a) * r);
      }
      ringGeo.setAttribute('position', new Float32BufferAttribute(pts, 3));
      gridLines.add(new LineSegments(ringGeo, gridMat));
    }

    // Radial lines
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute([
        0, 0.01, 0,
        Math.cos(a) * 7, 0.01, Math.sin(a) * 7,
      ], 3));
      gridLines.add(new LineSegments(geo, gridMat));
    }

    scene.add(gridLines);
  }

  private buildWalls(scene: Scene) {
    // Segmented curved walls
    const wallSegments = 24;
    const wallRadius = 6.5;
    const wallHeight = 3.5;

    for (let i = 0; i < wallSegments; i++) {
      const a = (i / wallSegments) * Math.PI * 2;
      const x = Math.sin(a) * wallRadius;
      const z = -Math.cos(a) * wallRadius;

      const panel = new Mesh(
        new BoxGeometry(1.6, wallHeight, 0.08),
        new MeshStandardMaterial({
          color: 0x0d0d22,
          metalness: 0.8,
          roughness: 0.4,
          emissive: new Color(0x0a1530),
          emissiveIntensity: 0.2,
        })
      );
      panel.position.set(x, wallHeight / 2, z);
      panel.lookAt(0, wallHeight / 2, 0);
      scene.add(panel);

      // Horizontal accent strips on every other panel
      if (i % 2 === 0) {
        const strip = new Mesh(
          new BoxGeometry(1.5, 0.02, 0.09),
          new MeshBasicMaterial({
            color: 0x2244aa,
            transparent: true,
            opacity: 0.5,
          })
        );
        strip.position.set(x, 1.5, z);
        strip.lookAt(0, 1.5, 0);
        scene.add(strip);
      }
    }
  }

  private buildCeiling(scene: Scene) {
    const ceilGeo = new CylinderGeometry(7, 7, 0.1, 32);
    const ceilMat = new MeshStandardMaterial({
      color: 0x080818,
      metalness: 0.9,
      roughness: 0.2,
    });
    const ceiling = new Mesh(ceilGeo, ceilMat);
    ceiling.position.y = 3.5;
    scene.add(ceiling);

    // Ceiling light ring
    const ringGeo = new RingGeometry(2, 2.3, 32);
    const ringMat = new MeshBasicMaterial({
      color: 0x3355aa,
      transparent: true,
      opacity: 0.6,
      side: DoubleSide,
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 3.44;
    scene.add(ring);
  }

  private buildCenterPillar(scene: Scene) {
    // Central command pillar
    const pillar = new Mesh(
      new CylinderGeometry(0.3, 0.4, 3.5, 8),
      new MeshStandardMaterial({
        color: 0x111133,
        metalness: 0.9,
        roughness: 0.2,
        emissive: new Color(0x0a1540),
        emissiveIntensity: 0.3,
      })
    );
    pillar.position.y = 1.75;
    scene.add(pillar);

    // Rotating ring around pillar
    const holoRing = new Mesh(
      new RingGeometry(0.5, 0.55, 32),
      new MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.4,
        side: DoubleSide,
      })
    );
    holoRing.rotation.x = Math.PI / 2;
    holoRing.position.y = 2.5;
    scene.add(holoRing);

    // Top beacon
    const beacon = new Mesh(
      new SphereGeometry(0.15, 16, 16),
      new MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.8,
      })
    );
    beacon.position.y = 3.3;
    scene.add(beacon);

    const beaconLight = new PointLight(0x44aaff, 0.8, 8);
    beaconLight.position.y = 3.3;
    scene.add(beaconLight);
  }

  private buildParticles(scene: Scene) {
    const count = 200;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 5;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.5 + Math.random() * 2.5;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));

    const particles = new Points(
      geo,
      new PointsMaterial({
        color: 0x4488ff,
        size: 0.015,
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(particles);
  }
}
