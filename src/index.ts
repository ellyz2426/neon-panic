import { World } from '@iwsdk/core';
import { GameSystem } from './game';
import { UISystem } from './ui';
import { AudioManager } from './audio';
import { StationManager } from './stations';
import { Environment } from './environment';

async function main() {
  const container = document.getElementById('scene-container') as HTMLDivElement;

  const world = await World.create(container, {
    xr: { offer: 'once' },
    input: { canvasPointerEvents: true },
    features: {
      physics: false,
      locomotion: false,
      grabbing: false,
    },
    render: {
      near: 0.01,
      far: 200,
      camera: { position: [0, 1.6, 0], lookAt: [0, 1.5, -4] },
    },
  });

  const audio = new AudioManager();
  const stations = new StationManager(world);
  const env = new Environment(world);

  env.build();
  stations.build();

  world.registerSystem(GameSystem);
  world.registerSystem(UISystem);

  const gameSystem = world.getSystem(GameSystem)!;
  gameSystem.setRefs({ audio, stations });

  const uiSystem = world.getSystem(UISystem)!;
  uiSystem.setRefs({ stations, gameSystem });
}

main();
