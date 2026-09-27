import Phaser from 'phaser';
import { SPRITES } from '../../assets';
import type { SpriteKey } from '../../assets';
import { riverCrossing } from '../../content/levels';
import { ENTITY_VISUALS } from '../../render/entities';
import { DEPTH, aircraftHeight, heightScale, shadowAlpha, shadowOffset } from '../../render/layers';
import { SPRITE_SCALE, addSpriteImage } from '../../render/sprites';
import { TerrainRenderer } from '../../render/terrain';
import { degToRad } from '../../sim/math';
import type { Vec2 } from '../../sim/math';

const ZOOMS = [1.0, 0.72, 0.45];
/** Tank turret pivot in sprite units, exactly as the game draws it. */
const TURRET_PIVOT: Vec2 = {
  x: ENTITY_VISUALS.tank.topOrigin.x * SPRITES.tankTurret.w,
  y: ENTITY_VISUALS.tank.topOrigin.y * SPRITES.tankTurret.h,
};

/** Named camera stops for the J key. */
const POINTS: Array<{ name: string; pos: Vec2 }> = [
  { name: 'Bridge', pos: { x: 3000, y: 2645 } },
  { name: 'Outpost Bravo', pos: { x: 5250, y: 3900 } },
  { name: 'SAM Tango', pos: { x: 3700, y: 1900 } },
  { name: 'Home base', pos: { x: 950, y: 4600 } },
  { name: 'Ammo dump', pos: { x: 950, y: 750 } },
  { name: 'Village', pos: { x: 4650, y: 3300 } },
];

/**
 * River Crossing terrain with sprites at their level positions.
 * Arrows pan (Shift = fast), Z / 1-2-3 zoom, J jumps between points of interest, C toggles clouds.
 */
export class TerrainGalleryScene extends Phaser.Scene {
  private terrain: TerrainRenderer | null = null;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private shift: Phaser.Input.Keyboard.Key | null = null;
  private zoomIndex = 0;
  private targetZoom = 1;
  private pointIndex = 0;
  private clouds: Phaser.GameObjects.Image[] = [];
  private hintTimer = 0;

  constructor() {
    super('TerrainGallery');
  }

  create(): void {
    const level = riverCrossing;
    const params = new URLSearchParams(window.location.search);
    const cam = this.cameras.main;
    const start = POINTS[Number(params.get('point') ?? '0')] ?? POINTS[0];
    if (start) cam.centerOn(start.pos.x, start.pos.y);
    if (params.has('x') && params.has('y')) cam.centerOn(Number(params.get('x')), Number(params.get('y')));
    this.zoomIndex = Math.max(0, ZOOMS.indexOf(Number(params.get('zoom') ?? '1')));
    this.targetZoom = ZOOMS[this.zoomIndex] ?? 1;
    cam.setZoom(this.targetZoom);

    this.terrain = new TerrainRenderer(this, level);
    this.terrain.build();
    this.placeSprites();

    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.shift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      kb.on('keydown-Z', () => this.setZoom((this.zoomIndex + 1) % ZOOMS.length));
      kb.on('keydown-ONE', () => this.setZoom(0));
      kb.on('keydown-TWO', () => this.setZoom(1));
      kb.on('keydown-THREE', () => this.setZoom(2));
      kb.on('keydown-J', () => this.jump());
      kb.on('keydown-C', () => this.clouds.forEach((c) => c.setVisible(!c.visible)));
    }
  }

  private setZoom(index: number): void {
    this.zoomIndex = index;
    this.targetZoom = ZOOMS[index] ?? 1;
  }

  private jump(): void {
    this.pointIndex = (this.pointIndex + 1) % POINTS.length;
    const p = POINTS[this.pointIndex];
    if (p) this.cameras.main.centerOn(p.pos.x, p.pos.y);
  }

  override update(_time: number, delta: number): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Linear(cam.zoom, this.targetZoom, Math.min(1, delta / 250)));
    if (this.cursors) {
      const speed = ((this.shift?.isDown ? 2400 : 700) * delta) / 1000 / cam.zoom;
      if (this.cursors.left.isDown) cam.scrollX -= speed;
      if (this.cursors.right.isDown) cam.scrollX += speed;
      if (this.cursors.up.isDown) cam.scrollY -= speed;
      if (this.cursors.down.isDown) cam.scrollY += speed;
    }
    this.hintTimer -= delta;
    if (this.hintTimer <= 0 && this.terrain) {
      this.hintTimer = 250;
      const s = this.terrain.stats;
      const hint = document.getElementById('hint');
      if (hint) {
        hint.textContent =
          `zoom ${cam.zoom.toFixed(2)} · centre ${Math.round(cam.midPoint.x)},${Math.round(cam.midPoint.y)} · ` +
          `far ${s.farBaked}/${s.farTotal} · near ${s.nearResident} (${s.nearBakes} bakes) · ` +
          `${(s.textureBytes / 1048576).toFixed(1)} MB · worst bake ${s.worstBakeMs.toFixed(1)} ms · build ${s.buildMs.toFixed(0)} ms · ` +
          `${Math.round(this.game.loop.actualFps)} fps  |  arrows pan · Z zoom · J jump · C clouds`;
      }
    }
  }

  private placeSprites(): void {
    const level = riverCrossing;
    const add = (key: SpriteKey, pos: Vec2, headingDeg = 0, depth: number = DEPTH.ground, pivot?: Vec2): Phaser.GameObjects.Image =>
      addSpriteImage(this, pos.x, pos.y, key, pivot).setRotation(degToRad(headingDeg)).setDepth(depth);
    const outpost = level.entities.find((e) => e.kind === 'outpost')?.pos ?? { x: 0, y: 0 };
    const aimAt = (from: Vec2, to: Vec2): number => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

    for (const e of level.entities) {
      const h = e.headingDeg ?? 0;
      switch (e.kind) {
        case 'homeBase':
          add('homeBase', e.pos, h, DEPTH.ground - 2);
          break;
        case 'outpost':
          add('outpost', e.pos, h, DEPTH.ground - 2);
          break;
        case 'bridge':
          add('bridge', e.pos, h, DEPTH.ground - 2);
          break;
        case 'ammoDump':
          add('ammoDump', e.pos, h, DEPTH.ground - 2);
          break;
        case 'samSite':
          add('samBase', e.pos, 0, DEPTH.ground - 1);
          add('samLauncher', e.pos, h);
          break;
        case 'aaGun':
          add('aaHull', e.pos, h);
          add('aaTurret', e.pos, h + 20);
          break;
        case 'tank':
          add('tankHull', e.pos, h);
          add('tankTurret', e.pos, aimAt(e.pos, outpost), DEPTH.ground, TURRET_PIVOT);
          break;
        case 'truck':
          add('truck', e.pos, h);
          break;
        case 'infantry':
          add('infantry', e.pos, aimAt(e.pos, outpost));
          break;
        case 'friendlyTank':
          add('friendlyTankHull', e.pos, h);
          add('friendlyTankTurret', e.pos, 0, DEPTH.ground, TURRET_PIVOT);
          break;
        case 'friendlyInfantry':
          add('friendlyInfantry', e.pos, 0);
          break;
        case 'cache':
          add('cache', e.pos, 0, DEPTH.ground - 1);
          break;
        default:
          break;
      }
    }

    // A slice of the armor column on the approach to the bridge.
    const column: Array<[SpriteKey, SpriteKey | null, Vec2, number]> = [
      ['tankHull', 'tankTurret', { x: 2995, y: 2470 }, 95],
      ['tankHull', 'tankTurret', { x: 2975, y: 2420 }, 110],
      ['aaHull', 'aaTurret', { x: 2935, y: 2375 }, 130],
      ['truck', null, { x: 2895, y: 2335 }, 135],
      ['truck', null, { x: 2855, y: 2300 }, 140],
      ['tankWreck', null, { x: 2790, y: 2230 }, 150],
      ['truckWreck', null, { x: 2760, y: 2200 }, 160],
    ];
    for (const [hull, top, pos, deg] of column) {
      add(hull, pos, deg);
      if (top) add(top, pos, deg - 8, DEPTH.ground, top === 'tankTurret' ? TURRET_PIVOT : undefined);
    }

    // The player: A-10 at Low with its shadow.
    const spawn = level.player.spawn;
    const height = aircraftHeight(0);
    const off = shadowOffset(height);
    add('a10', { x: spawn.x + off.x, y: spawn.y + off.y }, level.player.headingDeg, DEPTH.airShadows)
      .setTintFill(0x000000)
      .setAlpha(shadowAlpha(height))
      .setScale(SPRITE_SCALE * heightScale(height));
    add('a10', spawn, level.player.headingDeg, DEPTH.air).setScale(SPRITE_SCALE * heightScale(height));
    // Another near the bridge so the scale reads against the column.
    const pass = { x: 3120, y: 2560 };
    add('a10', { x: pass.x + off.x, y: pass.y + off.y }, -150, DEPTH.airShadows)
      .setTintFill(0x000000)
      .setAlpha(shadowAlpha(height))
      .setScale(SPRITE_SCALE * heightScale(height));
    add('a10', pass, -150, DEPTH.air).setScale(SPRITE_SCALE * heightScale(height));

    // A few clouds (toggle with C).
    const cloudKeys: SpriteKey[] = ['cloud1', 'cloud2', 'cloud3', 'cloud4'];
    const spots: Vec2[] = [
      { x: 2400, y: 2000 },
      { x: 4200, y: 3000 },
      { x: 1500, y: 3800 },
      { x: 5600, y: 1500 },
      { x: 3300, y: 4300 },
      { x: 6300, y: 3600 },
    ];
    spots.forEach((p, i) => {
      const key = cloudKeys[i % cloudKeys.length] ?? 'cloud1';
      this.clouds.push(addSpriteImage(this, p.x, p.y, key).setDepth(DEPTH.clouds).setAlpha(0.85).setScale(SPRITE_SCALE * 1.6).setVisible(false));
    });
  }
}
