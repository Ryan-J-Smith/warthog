import Phaser from 'phaser';
import { riverCrossing } from '../../content/levels';
import { EffectsDirector } from '../../render/effects';
import { EntityRenderer, PlayerRenderer } from '../../render/entities';
import { DEPTH } from '../../render/layers';
import { addSpriteImage } from '../../render/sprites';
import { TerrainRenderer } from '../../render/terrain';
import { WorldUiRenderer } from '../../render/worldUi';
import type { Entity } from '../../sim/entities';
import type { EntitySpawn } from '../../sim/level';
import type { Vec2 } from '../../sim/math';
import type { EntityKind, ExplosionSize } from '../../sim/types';
import { FakeBattle } from '../fakes';
import { EFFECTS_HUD_KEY, EffectsHudScene, FX_FRAME } from './effectsHudScene';

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
const ENEMY_MECHS: Vec2[] = [
  { x: 3330, y: 2400 },
  { x: 3220, y: 2110 },
];
const FRIENDLY_MECHS: Vec2[] = [{ x: 3290, y: 2540 }];
/** Gallery-staged units, spawned into the fake battle's real World next to the level's own. */
const STAGED: EntitySpawn[] = [
  ...ENEMY_TANKS.map((pos): EntitySpawn => ({ kind: 'tank', pos, headingDeg: 110 })),
  ...FRIENDLY_TANKS.map((pos): EntitySpawn => ({ kind: 'friendlyTank', pos, headingDeg: -70 })),
  ...ENEMY_MECHS.map((pos): EntitySpawn => ({ kind: 'infantry', pos, headingDeg: 100 })),
  ...FRIENDLY_MECHS.map((pos): EntitySpawn => ({ kind: 'friendlyInfantry', pos, headingDeg: -80 })),
];
const ZOOMS = [1.0, 0.72, 0.45];
/** Seconds a SAM radar takes to build its lock in the SAM scenario. */
const SAM_LOCK_TIME = 1.8;
/** Seconds the rearm bar takes in the rearm scenario. */
const REARM_TIME = 3;
const KIND_FOR_SIZE: Record<ExplosionSize, EntityKind> = { small: 'truck', medium: 'tank', large: 'samSite', huge: 'ammoDump' };

const HELP =
  '1-4 explosions · G gun run · R rockets · M Maverick · B bombs · S SAM · F flares · A AA burst · T ground battle · ' +
  'H hit · X player killed · V reveal · D dump cook-off · I radio · O objective · Y weapon n/a · P rearm · K RTB · ' +
  'U HUD on/off · W/Q altitude · Z zoom · Space demo · C clear';

/**
 * Effects test bed: feeds the real EffectsDirector with events and projectiles from a toy
 * simulation over the real River Crossing terrain. Units, the player, the targeting overlays
 * (WorldUiRenderer) and the HUD (a parallel scene running the real `Hud`) are drawn by the game's
 * own renderers from the fake battle's world, so every effect is seen in context, coloured and
 * tinted exactly as in-game. U hides the HUD + targeting to see the pure effects.
 */
export class EffectsGalleryScene extends Phaser.Scene {
  private director: EffectsDirector | null = null;
  private battle: FakeBattle | null = null;
  private entityRenderer: EntityRenderer | null = null;
  private playerRenderer: PlayerRenderer | null = null;
  private worldUi: WorldUiRenderer | null = null;
  private overlays = true;
  private samLocking = false;
  private aaEngageUntil = 0;
  private rearming = 0;
  /** Attack run in progress: fire `fire` once the plane is within `range` of `target`. */
  private pendingShot: { target: Vec2; range: number; fire: () => void } | null = null;
  private radioIndex = 0;
  private objectiveIndex = 0;
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

    this.battle = new FakeBattle(CENTRE, 260, STAGED);
    this.aimTurrets();
    this.director = new EffectsDirector(this);
    this.entityRenderer = new EntityRenderer(this);
    this.playerRenderer = new PlayerRenderer(this);
    this.worldUi = new WorldUiRenderer(this);
    this.demo = params.get('demo') === '1';

    // The real HUD runs as a parallel scene fed by FX_FRAME (like the game's HudScene).
    if (this.game.scene.getScene(EFFECTS_HUD_KEY)) this.scene.launch(EFFECTS_HUD_KEY);
    else this.scene.add(EFFECTS_HUD_KEY, new EffectsHudScene(this), true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop(EFFECTS_HUD_KEY);
      this.entityRenderer?.destroy();
      this.playerRenderer?.destroy();
      this.worldUi?.destroy();
    });

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
      on('R', () => this.rockets());
      on('M', () => this.maverick());
      on('B', () => this.bombs());
      on('S', () => this.sam());
      on('F', () => this.battle?.flares());
      on('A', () => this.aa());
      on('T', () => (this.battleAmbience = !this.battleAmbience));
      on('H', () => this.hit());
      on('X', () => this.killPlayer());
      on('V', () => this.reveal());
      on('D', () => this.cookOff());
      on('W', () => this.battle?.setAltitude(Math.min(2, (this.battle?.player.alt ?? 0) + 1)));
      on('Q', () => this.battle?.setAltitude(Math.max(0, (this.battle?.player.alt ?? 0) - 1)));
      on('Z', () => {
        this.zoomIndex = (this.zoomIndex + 1) % ZOOMS.length;
      });
      on('I', () => this.radio());
      on('O', () => this.objectiveBanner());
      on('Y', () => this.weaponUnavailable());
      on('P', () => this.rearm());
      on('K', () => this.toggleRtb());
      on('U', () => this.toggleOverlays());
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
    this.stepAttackRun();
    this.stepThreats(dt);
    this.stepPlayer(dt);
    battle.step(dt);
    if (this.battleAmbience) this.stepAmbience(dt);
    if (this.demo) this.stepDemo(dt);

    const view = battle.world;
    const events = battle.drain();
    director.handleEvents(events);
    director.update(delta, view);
    this.entityRenderer?.sync(view, events);
    this.playerRenderer?.sync(view);
    this.worldUi?.sync(view);
    this.events.emit(FX_FRAME, view, events);
    const pl = battle.player;

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

  /** The enemy tank most nearly ahead of the plane (and far enough for the pipper to reach). */
  private nearestTank(): Vec2 {
    const p = this.battle?.player;
    if (!p) return CENTRE;
    const score = (t: Vec2): number => {
      const d = Math.hypot(t.x - p.pos.x, t.y - p.pos.y);
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(t.y - p.pos.y, t.x - p.pos.x) - p.heading), Math.cos(Math.atan2(t.y - p.pos.y, t.x - p.pos.x) - p.heading)));
      return off * 320 + Math.abs(d - 460);
    };
    return ENEMY_TANKS.reduce((best, t) => (score(t) < score(best) ? t : best));
  }

  /** Gun run: turn in on a tank, then walk the rounds onto it (pipper lights up red). */
  private gunRun(): void {
    const battle = this.battle;
    if (!battle) return;
    battle.player.selectedWeapon = 'gun';
    if (battle.player.alt > 1) battle.setAltitude(0);
    const target = this.nearestTank();
    battle.attackRun(target, 3);
    this.pendingShot = {
      target,
      range: 200,
      fire: () => {
        this.gunTime = 1.4;
        battle.player.firing = true;
        this.emitNow({ type: 'gunStarted' });
      },
    };
  }

  /** Fires the pending attack-run weapon once the plane closes to its range. */
  private stepAttackRun(): void {
    const shot = this.pendingShot;
    const p = this.battle?.player;
    if (!shot || !p) return;
    if (Math.hypot(shot.target.x - p.pos.x, shot.target.y - p.pos.y) > shot.range) return;
    this.pendingShot = null;
    shot.fire();
  }

  private stepGun(dt: number): void {
    const battle = this.battle;
    if (!battle) return;
    const pl = battle.player;
    const h = pl.heading;
    // Gun tracking as in the game: the pipper slides back toward the nose while firing.
    pl.gunDip = Math.min(0.5, pl.gunDip + 0.7 * dt);
    const range = (pl.alt < 0.5 ? 170 : 280) * (1 - pl.gunDip);
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
    if (this.gunTime <= 0) {
      pl.firing = false;
      battle.emit({ type: 'gunStopped' });
    }
  }

  /** Rockets: select them (reticle) and fire a salvo. */
  private rockets(): void {
    const battle = this.battle;
    if (!battle) return;
    battle.player.selectedWeapon = 'rockets';
    if (battle.player.alt > 1) battle.setAltitude(1);
    const target = this.nearestTank();
    battle.attackRun(target, 3);
    this.pendingShot = { target, range: 300, fire: () => battle.rocketSalvo() };
  }

  /**
   * Maverick at Medium: turn in toward the SAM site, then select the Maverick so the real
   * WeaponSystem builds the lock on a steady picture (brackets spin in amber, then lock red),
   * then fire. The seeker prefers air-defence emitters, so it settles on the SAM or an AA gun.
   */
  private maverick(): void {
    const battle = this.battle;
    if (!battle) return;
    battle.setAltitude(1);
    battle.attackRun(SAM_SITE, 3.2);
    battle.later(0.8, () => {
      battle.player.selectedWeapon = 'maverick';
    });
    battle.later(2.8, () => {
      const pl = battle.player.pos;
      const locked = battle.player.lockTargetId !== null ? battle.state.findById(battle.player.lockTargetId) : undefined;
      const fallback = ENEMY_TANKS.reduce((best, t) => (Math.hypot(t.x - pl.x, t.y - pl.y) > Math.hypot(best.x - pl.x, best.y - pl.y) ? t : best));
      battle.maverick(locked ? { ...locked.pos } : fallback);
    });
  }

  /** Bombs: CCIP reticle + fall line (at Medium, or High if already there). */
  private bombs(): void {
    const battle = this.battle;
    if (!battle) return;
    battle.player.selectedWeapon = 'bombs';
    if (battle.player.alt < 1) battle.setAltitude(1);
    const target = this.nearestTank();
    battle.attackRun(target, 3);
    this.pendingShot = { target, range: battle.player.alt > 1.5 ? 380 : 260, fire: () => battle.bombs() };
  }

  /** SAM: the radar builds a lock (MISSILE LOCK + bold ring), then launches (MISSILE LAUNCH + vignette). */
  private sam(): void {
    const battle = this.battle;
    const site = this.samSite();
    if (!battle || !site?.sam || this.samLocking) return;
    if (battle.player.alt < 1) battle.setAltitude(1);
    site.sam.locking = true;
    site.sam.lock = 0;
    battle.player.radarLocks = 1;
    battle.emit({ type: 'samLockStarted', siteId: site.id, pos: { ...site.pos } });
    this.samLocking = true;
  }

  /** AA: bursts from the level's AA guns, whose rings go bold while engaging. */
  private aa(): void {
    const battle = this.battle;
    if (!battle) return;
    if (battle.player.alt > 1) battle.setAltitude(1);
    for (const gun of AA_GUNS) battle.aaBurst(gun);
    this.aaEngageUntil = battle.world.time + 2;
  }

  private samSite(): Entity | undefined {
    return this.battle?.state.entities.find((e) => e.kind === 'samSite');
  }

  /** SAM lock build-up, AA engagement flags, and air defences tracking the plane. */
  private stepThreats(dt: number): void {
    const battle = this.battle;
    if (!battle) return;
    const pl = battle.player.pos;
    const site = this.samSite();
    if (site?.sam) {
      site.sam.launcherHeading = Math.atan2(pl.y - site.pos.y, pl.x - site.pos.x);
      if (this.samLocking) {
        site.sam.lock = Math.min(1, site.sam.lock + dt / SAM_LOCK_TIME);
        if (site.sam.lock >= 1) {
          this.samLocking = false;
          site.sam.locking = false;
          site.sam.lock = 0;
          battle.player.radarLocks = 0;
          battle.samLaunch(SAM_SITE, 160);
        }
      }
    }
    const engaging = battle.world.time < this.aaEngageUntil;
    for (const e of battle.state.entities) {
      if (!e.aa) continue;
      e.aa.engaging = engaging && Math.hypot(e.pos.x - pl.x, e.pos.y - pl.y) < e.aa.range + 200;
      e.turretHeading = Math.atan2(pl.y - e.pos.y, pl.x - e.pos.x);
    }
  }

  /** Respawn after a kill, invulnerability blink, and the rearm bar. */
  private stepPlayer(dt: number): void {
    const p = this.battle?.player;
    if (!p) return;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (!p.alive) p.respawnIn = Math.max(0, p.respawnIn - dt);
    if (this.rearming > 0) {
      this.rearming = Math.max(0, this.rearming - dt);
      p.rearm = 1 - this.rearming / REARM_TIME;
      if (this.rearming === 0) {
        p.rearm = 0;
        p.hp = p.maxHp;
        p.ammo = { gun: 1150, rockets: 8, maverick: 4, bombs: 6 };
        p.flares = 8;
        this.battle?.emit({ type: 'rearmCompleted' });
      }
    }
  }

  /** Enemy turrets aim at the friendlies and vice versa, for a battle-in-progress look. */
  private aimTurrets(): void {
    const state = this.battle?.state;
    if (!state) return;
    for (const e of state.entities) {
      if (e.kind !== 'tank' && e.kind !== 'friendlyTank') continue;
      const foes = state.entities.filter((o) => o.team !== e.team && (o.kind === 'tank' || o.kind === 'friendlyTank'));
      const foe = foes.reduce<Entity | null>((best, o) => (!best || Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < Math.hypot(best.pos.x - e.pos.x, best.pos.y - e.pos.y) ? o : best), null);
      if (foe) e.turretHeading = Math.atan2(foe.pos.y - e.pos.y, foe.pos.x - e.pos.x);
    }
  }

  // --- HUD scenarios --------------------------------------------------------

  /** Player hit: armour drops to the low-armour warning and the damage vignette flashes. */
  private hit(): void {
    const battle = this.battle;
    if (!battle) return;
    const p = battle.player;
    p.hp = Math.max(14, p.hp - 24);
    battle.emit({ type: 'playerHit', pos: { ...p.pos }, damage: 24, source: 'aa' });
  }

  /** Player shot down: WARTHOG DOWN + respawn countdown, back after 2.5 s with invulnerability. */
  private killPlayer(): void {
    const battle = this.battle;
    if (!battle || !battle.player.alive) return;
    const p = battle.player;
    battle.emit({ type: 'playerDestroyed', pos: { ...p.pos } });
    p.alive = false;
    p.respawnIn = 2.5;
    battle.later(2.5, () => {
      p.alive = true;
      p.hp = p.maxHp;
      p.invulnerable = 2;
    });
  }

  /** Next radio line from the level's script. */
  private radio(): void {
    const cues = riverCrossing.radio;
    const cue = cues[this.radioIndex++ % cues.length];
    if (cue) this.battle?.emit({ type: 'radio', speaker: cue.speaker, text: cue.text, tone: cue.tone });
  }

  /** Resolve the next objective (completed, every third one failed) → the objective banner. */
  private objectiveBanner(): void {
    const state = this.battle?.state;
    if (!state) return;
    const open = state.objectives.filter((o) => o.status === 'active');
    if (open.length === 0) {
      for (const o of state.objectives) o.status = 'active';
      return;
    }
    const o = open[0];
    if (!o) return;
    o.status = this.objectiveIndex++ % 3 === 2 ? 'failed' : 'completed';
    this.battle?.emit({ type: 'objectiveUpdated', objectiveId: o.id, status: o.status });
  }

  /** Bombs selected at Low: greyed weapon with its reason + the "TOO LOW" status message. */
  private weaponUnavailable(): void {
    const battle = this.battle;
    if (!battle) return;
    battle.setAltitude(0);
    battle.player.selectedWeapon = 'bombs';
    battle.emit({ type: 'weaponUnavailable', weapon: 'bombs', reason: 'tooLow' });
  }

  private rearm(): void {
    this.rearming = REARM_TIME;
  }

  private toggleRtb(): void {
    const state = this.battle?.state;
    if (!state) return;
    state.rtb = !state.rtb;
    state.rtbAt = state.rtb ? state.time : null;
  }

  /** U: hide/show the HUD and the targeting overlays (pure effects underneath). */
  private toggleOverlays(): void {
    this.overlays = !this.overlays;
    this.scene.setVisible(this.overlays, EFFECTS_HUD_KEY);
    if (this.overlays) this.worldUi = new WorldUiRenderer(this);
    else {
      this.worldUi?.destroy();
      this.worldUi = null;
    }
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
      () => this.rockets(),
      () => this.explode('medium'),
      () => this.aa(),
      () => this.radio(),
      () => this.bombs(),
      () => this.sam(),
      () => this.battle?.flares(),
      () => this.hit(),
      () => this.explode('large'),
      () => this.maverick(),
      () => this.objectiveBanner(),
      () => this.reveal(),
      () => this.explode('small'),
      () => this.cookOff(),
      () => this.battle?.setAltitude(0),
    ];
    actions[this.demoStep % actions.length]?.();
    this.demoStep++;
  }

  /** Static decor (the units themselves are real entities drawn by the EntityRenderer). */
  private placeSprites(): void {
    addSpriteImage(this, 3360, 2330, 'truckWreck').setRotation((30 * Math.PI) / 180).setDepth(DEPTH.ground - 0.5);
  }
}

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('pick on empty list');
  return item;
}
