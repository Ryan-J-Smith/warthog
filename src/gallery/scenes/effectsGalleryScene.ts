import Phaser from 'phaser';
import type { SpriteKey } from '../../assets';
import { riverCrossing } from '../../content/levels';
import { EffectsDirector } from '../../render/effects';
import { ENTITY_VISUALS } from '../../render/entities';
import { DEPTH, aircraftHeight, heightScale, shadowAlpha, shadowOffset } from '../../render/layers';
import { SPRITE_SCALE, addSpriteImage } from '../../render/sprites';
import { TerrainRenderer } from '../../render/terrain';
import type { Vec2 } from '../../sim/math';
import type { EntityKind, ExplosionSize } from '../../sim/types';
import { FakeBattle } from '../fakes';

const CENTRE: Vec2 = { x: 3400, y: 2230 };
const SAM_SITE: Vec2 = { x: 3700, y: 1900 };
const AA_GUNS: Vec2[] = [
  { x: 3480, y: 2060 },
  { x: 3230, y: 2360 },
];
const ENEMY_TANKS: Vec2[] = [
  { x: 3300, y: 2130 },
  { x: 3440, y: 2290 },
  { x: 3560, y: 2170 },
  { x: 3150, y: 2230 },
];
const FRIENDLY_TANKS: Vec2[] = [
  { x: 3150, y: 2480 },
  { x: 3420, y: 2520 },
];
const ZOOMS = [1.0, 0.72, 0.45];
/** Tank turret pivot (normalised), exactly as the game draws it. */
const TURRET_ORIGIN = ENTITY_VISUALS.tank.topOrigin;
const KIND_FOR_SIZE: Record<ExplosionSize, EntityKind> = { small: 'truck', medium: 'tank', large: 'samSite', huge: 'ammoDump' };

const HELP =
  '1-4 explosions · G gun run · R rockets · M Maverick · B bombs · S SAM · F flares · A AA burst · T ground battle · ' +
  'H hit · X player killed · V reveal · D dump cook-off · W/Q altitude · Z zoom · Space demo · C clear';

/**
 * Effects test bed: feeds the real EffectsDirector with events and projectiles from a toy
 * simulation over the real River Crossing terrain.
 */
export class EffectsGalleryScene extends Phaser.Scene {
  private director: EffectsDirector | null = null;
  private battle: FakeBattle | null = null;
  private plane: Phaser.GameObjects.Image | null = null;
  private planeShadow: Phaser.GameObjects.Image | null = null;
  private gunTime = 0;
  private gunAcc = 0;
  private battleAmbience = true;
  private ambienceAcc = 0;
  private demo = false;
  private demoAcc = 0;
  private demoStep = 0;
  private zoomIndex = 0;
  private hintTimer = 0;

  constructor() {
    super('EffectsGallery');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const cam = this.cameras.main;
    cam.centerOn(CENTRE.x, CENTRE.y);
    this.zoomIndex = Math.max(0, ZOOMS.indexOf(Number(params.get('zoom') ?? '1')));
    cam.setZoom(ZOOMS[this.zoomIndex] ?? 1);

    new TerrainRenderer(this, riverCrossing).build();
    this.placeSprites();

    this.battle = new FakeBattle(CENTRE, 260);
    this.director = new EffectsDirector(this);
    this.plane = addSpriteImage(this, 0, 0, 'a10').setDepth(DEPTH.air);
    this.planeShadow = addSpriteImage(this, 0, 0, 'a10').setDepth(DEPTH.airShadows).setTintFill(0x000000);
    this.demo = params.get('demo') === '1';

    const kb = this.input.keyboard;
    if (kb) {
      const on = (key: string, fn: () => void): void => {
        kb.on(`keydown-${key}`, fn);
      };
      on('ONE', () => this.explode('small'));
      on('TWO', () => this.explode('medium'));
      on('THREE', () => this.explode('large'));
      on('FOUR', () => this.explode('huge'));
      on('G', () => this.gunRun());
      on('R', () => this.battle?.rocketSalvo());
      on('M', () => this.maverick());
      on('B', () => this.bombs());
      on('S', () => this.sam());
      on('F', () => this.battle?.flares());
      on('A', () => this.aa());
      on('T', () => (this.battleAmbience = !this.battleAmbience));
      on('H', () => this.emitNow({ type: 'playerHit', pos: { ...this.playerPos() }, damage: 3, source: 'aa' }));
      on('X', () => this.emitNow({ type: 'playerDestroyed', pos: { ...this.playerPos() } }));
      on('V', () => this.reveal());
      on('D', () => this.cookOff());
      on('W', () => this.battle?.setAltitude(Math.min(2, (this.battle?.player.alt ?? 0) + 1)));
      on('Q', () => this.battle?.setAltitude(Math.max(0, (this.battle?.player.alt ?? 0) - 1)));
      on('Z', () => {
        this.zoomIndex = (this.zoomIndex + 1) % ZOOMS.length;
      });
      on('SPACE', () => (this.demo = !this.demo));
      on('C', () => this.scene.restart());
    }
  }

  override update(_time: number, delta: number): void {
    const battle = this.battle;
    const director = this.director;
    if (!battle || !director) return;
    const dt = Math.min(delta, 50) / 1000;
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Linear(cam.zoom, ZOOMS[this.zoomIndex] ?? 1, Math.min(1, delta / 250)));

    if (this.gunTime > 0) this.stepGun(dt);
    battle.step(dt);
    if (this.battleAmbience) this.stepAmbience(dt);
    if (this.demo) this.stepDemo(dt);

    director.handleEvents(battle.drain());
    director.update(delta, battle.world);

    // Plane + shadow.
    const pl = battle.player;
    const h = aircraftHeight(pl.alt);
    const off = shadowOffset(h);
    this.plane?.setPosition(pl.pos.x, pl.pos.y).setRotation(pl.heading).setScale(SPRITE_SCALE * heightScale(h));
    this.planeShadow?.setPosition(pl.pos.x + off.x, pl.pos.y + off.y).setRotation(pl.heading).setScale(SPRITE_SCALE).setAlpha(shadowAlpha(h));

    this.hintTimer -= delta;
    if (this.hintTimer <= 0) {
      this.hintTimer = 250;
      const s = director.stats;
      const hint = document.getElementById('hint');
      if (hint) {
        hint.textContent = `${Math.round(this.game.loop.actualFps)} fps · particles ${s.particles} · projectiles ${s.projectiles} · fires ${s.wreckFires} · alt ${pl.alt} ${this.demo ? '· DEMO' : ''} | ${HELP}`;
      }
    }
  }

  // ---------------------------------------------------------------------------

  private playerPos(): Vec2 {
    return this.battle?.player.pos ?? CENTRE;
  }

  private emitNow(e: Parameters<FakeBattle['emit']>[0]): void {
    this.battle?.emit(e);
  }

  private randomNear(radius: number): Vec2 {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * radius;
    return { x: CENTRE.x + Math.cos(a) * d, y: CENTRE.y + Math.sin(a) * d };
  }

  private explode(size: ExplosionSize): void {
    const pos = this.randomNear(260);
    this.emitNow({ type: 'entityDestroyed', entityId: 0, kind: KIND_FOR_SIZE[size], team: 'enemy', pos, size });
    this.emitNow({ type: 'scoreAwarded', points: { small: 100, medium: 300, large: 1500, huge: 2000 }[size], reason: 'kill', pos });
  }

  private gunRun(): void {
    this.gunTime = 1.6;
    this.emitNow({ type: 'gunStarted' });
  }

  private stepGun(dt: number): void {
    const battle = this.battle;
    if (!battle) return;
    const pl = battle.player;
    const h = pl.heading;
    const range = pl.alt < 0.5 ? 170 : 280;
    const spread = pl.alt < 0.5 ? 14 : 34;
    const muzzle = { x: pl.pos.x + Math.cos(h) * 42, y: pl.pos.y + Math.sin(h) * 42 };
    const target = { x: pl.pos.x + Math.cos(h) * range, y: pl.pos.y + Math.sin(h) * range };
    battle.emit({ type: 'gunFiring', muzzle, target, heading: h });
    this.gunAcc += dt * 70;
    while (this.gunAcc >= 1) {
      this.gunAcc -= 1;
      const pos = { x: target.x + (Math.random() - 0.5) * 2 * spread, y: target.y + (Math.random() - 0.5) * 2 * spread };
      const armored = ENEMY_TANKS.some((t) => Math.hypot(t.x - pos.x, t.y - pos.y) < 22);
      battle.later(0.25, () => battle.emit({ type: 'gunImpact', pos, hit: armored || Math.random() < 0.1, armored }));
    }
    this.gunTime -= dt;
    if (this.gunTime <= 0) battle.emit({ type: 'gunStopped' });
  }

  private maverick(): void {
    const pl = this.playerPos();
    const target = ENEMY_TANKS.reduce((best, t) => (Math.hypot(t.x - pl.x, t.y - pl.y) > Math.hypot(best.x - pl.x, best.y - pl.y) ? t : best));
    this.battle?.setAltitude(1);
    this.battle?.maverick(target);
  }

  private bombs(): void {
    if ((this.battle?.player.alt ?? 0) < 1) this.battle?.setAltitude(1);
    this.battle?.bombs();
  }

  private sam(): void {
    if ((this.battle?.player.alt ?? 0) < 1) this.battle?.setAltitude(1);
    this.battle?.samLaunch(SAM_SITE);
  }

  private aa(): void {
    for (const gun of AA_GUNS) this.battle?.aaBurst(gun);
  }

  private reveal(): void {
    const pos = this.randomNear(200);
    this.emitNow({ type: 'entityRevealed', entityId: 0, kind: 'cache', pos });
    this.emitNow({ type: 'scoreAwarded', points: 500, reason: 'cache', pos });
  }

  private cookOff(): void {
    const battle = this.battle;
    if (!battle) return;
    const base = this.randomNear(150);
    battle.emit({ type: 'entityDestroyed', entityId: 0, kind: 'ammoDump', team: 'enemy', pos: base, size: 'huge' });
    battle.emit({ type: 'scoreAwarded', points: 2000, reason: 'Ammo dump', pos: base });
    for (let i = 0; i < 9; i++) {
      const size: ExplosionSize = i % 4 === 3 ? 'large' : i % 2 ? 'medium' : 'small';
      battle.later(0.35 + i * 0.32 + Math.random() * 0.2, () =>
        battle.emit({ type: 'secondaryExplosion', pos: { x: base.x + (Math.random() - 0.5) * 140, y: base.y + (Math.random() - 0.5) * 110 }, size }),
      );
    }
  }

  private stepAmbience(dt: number): void {
    const battle = this.battle;
    if (!battle) return;
    this.ambienceAcc += dt * 2.2;
    while (this.ambienceAcc >= 1) {
      this.ambienceAcc -= 1;
      const enemyShoots = Math.random() < 0.55;
      const from = enemyShoots ? pick(ENEMY_TANKS) : pick(FRIENDLY_TANKS);
      const to = enemyShoots ? pick(FRIENDLY_TANKS) : pick(ENEMY_TANKS);
      const tank = Math.random() < 0.45;
      const jitter = (v: Vec2): Vec2 => ({ x: v.x + (Math.random() - 0.5) * 40, y: v.y + (Math.random() - 0.5) * 40 });
      battle.emit({
        type: 'groundFire',
        shooterKind: tank ? (enemyShoots ? 'tank' : 'friendlyTank') : enemyShoots ? 'infantry' : 'friendlyInfantry',
        from: tank ? from : jitter(from),
        to: jitter(to),
      });
    }
  }

  private stepDemo(dt: number): void {
    this.demoAcc += dt;
    if (this.demoAcc < 1.4) return;
    this.demoAcc = 0;
    const actions: Array<() => void> = [
      () => this.gunRun(),
      () => this.battle?.rocketSalvo(),
      () => this.explode('medium'),
      () => this.aa(),
      () => this.bombs(),
      () => this.sam(),
      () => this.battle?.flares(),
      () => this.explode('large'),
      () => this.maverick(),
      () => this.reveal(),
      () => this.explode('small'),
      () => this.cookOff(),
      () => this.battle?.setAltitude(0),
    ];
    actions[this.demoStep % actions.length]?.();
    this.demoStep++;
  }

  private placeSprites(): void {
    const put = (key: SpriteKey, p: Vec2, deg: number, depth: number = DEPTH.ground): void => {
      addSpriteImage(this, p.x, p.y, key).setRotation((deg * Math.PI) / 180).setDepth(depth);
    };
    put('samBase', SAM_SITE, 0, DEPTH.ground - 1);
    put('samLauncher', SAM_SITE, 200);
    for (const g of AA_GUNS) {
      put('aaHull', g, 200);
      put('aaTurret', g, 230);
    }
    for (const t of ENEMY_TANKS) {
      put('tankHull', t, 110);
      addSpriteImage(this, t.x, t.y, 'tankTurret').setOrigin(TURRET_ORIGIN.x, TURRET_ORIGIN.y).setRotation(1.9).setDepth(DEPTH.ground);
    }
    for (const t of FRIENDLY_TANKS) {
      put('friendlyTankHull', t, -70);
      addSpriteImage(this, t.x, t.y, 'friendlyTankTurret').setOrigin(TURRET_ORIGIN.x, TURRET_ORIGIN.y).setRotation(-1.4).setDepth(DEPTH.ground);
    }
    put('truckWreck', { x: 3360, y: 2330 }, 30);
  }
}

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('pick on empty list');
  return item;
}
