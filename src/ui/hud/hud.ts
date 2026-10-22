import type Phaser from 'phaser';
import type { SimEvent } from '../../sim/events';
import type { LevelDefinition } from '../../sim/level';
import type { MissionResults, WorldView } from '../../sim/world';
import { defendedKind, objectiveBanner, type Rect } from '../model';
import { ensureUiTextures } from '../widgets';
import { AltitudeLadder } from './altitudeLadder';
import { ArmorPanel } from './armorPanel';
import { BannerDisplay } from './bannerDisplay';
import { ComboMeter } from './comboMeter';
import { DefensePanel } from './defensePanel';
import type { HudWidget } from './hudWidget';
import { Minimap } from './minimap';
import { MissionStrip } from './missionStrip';
import { ObjectivesPanel } from './objectivesPanel';
import { OffscreenArrows } from './offscreenArrows';
import { RadioTicker } from './radioTicker';
import { StatusMessages } from './statusMessages';
import { ScreenVignette, ThreatWarnings } from './threatWarnings';
import { WeaponBar } from './weaponBar';

/** The whole in-mission HUD. Owns every widget; the Hud scene feeds it frames. */
export class Hud {
  private readonly widgets: HudWidget[];
  private readonly banners: BannerDisplay;
  private rtbAnnounced = false;

  constructor(
    scene: Phaser.Scene,
    private readonly level: LevelDefinition,
  ) {
    ensureUiTextures(scene);
    // Creation order is draw order: vignette at the back, banners on top.
    const objectives = new ObjectivesPanel(scene, level);
    this.widgets = [
      new ScreenVignette(scene),
      new OffscreenArrows(scene, level),
      new Minimap(scene, level),
      objectives,
      new MissionStrip(scene, level.parTime, missionCountdown(level)),
      new AltitudeLadder(scene, objectives.bottom + 14),
      new ArmorPanel(scene),
      new WeaponBar(scene),
      new RadioTicker(scene),
      new ComboMeter(scene),
      new DefensePanel(scene, level),
      new StatusMessages(scene),
      new ThreatWarnings(scene),
    ];
    this.banners = new BannerDisplay(scene);
  }

  update(view: WorldView, events: readonly SimEvent[], dt: number, now: number, camera: Rect): void {
    const frame = { view, events, dt, now, camera };
    for (const widget of this.widgets) widget.update(frame);
    for (const e of events) {
      if (e.type === 'zoneCleared') {
        this.banners.show({ headline: `${e.name.toUpperCase()} CLEARED`, sub: `+${e.bonus} · SUPPLY DROP ON THE SITE`, tone: 'good' });
        continue;
      }
      if (e.type === 'defenseWaveStarted') {
        this.banners.show({ headline: `WAVE ${e.wave + 1} INBOUND`, sub: `${e.wave + 1} OF ${e.total} · HOLD THE BASE`, tone: 'bad' });
        continue;
      }
      if (e.type === 'defenseWaveCleared' && e.wave + 1 < e.total) {
        this.banners.show({ headline: `WAVE ${e.wave + 1} CLEARED`, sub: `+${e.bonus} GOLD · BUILD, THEN PRESS R`, tone: 'good' });
        continue;
      }
      if (e.type !== 'objectiveUpdated') continue;
      const o = view.objectives.find((ob) => ob.id === e.objectiveId);
      if (o) this.banners.show(objectiveBanner(o, e.status, defendedKind(this.level, o.id)));
    }
    if (view.rtb && !this.rtbAnnounced && !view.ended) {
      this.rtbAnnounced = true;
      const optionalsOpen = view.objectives.some((o) => !o.primary && o.status === 'active');
      this.banners.show({
        headline: 'RETURN TO BASE',
        sub: optionalsOpen ? 'PRIMARIES RESOLVED — OPTIONALS STILL OPEN UNTIL YOU LAND' : 'PRIMARIES RESOLVED — LAND LOW OVER THE STRIP',
        tone: 'info',
      });
    }
  }

  missionEnded(results: MissionResults): void {
    const won = results.outcome === 'victory';
    this.banners.show(
      {
        headline: won ? 'MISSION COMPLETE' : 'MISSION FAILED',
        sub: won ? 'OUTSTANDING WORK, WARTHOG' : 'ALL UNITS, FALL BACK',
        tone: won ? 'good' : 'bad',
      },
      null,
    );
  }

  destroy(): void {
    for (const widget of this.widgets) widget.destroy();
    this.banners.destroy();
  }
}

/** A score-attack mission's time limit (the clock counts down), else null. */
function missionCountdown(level: LevelDefinition): number | null {
  for (const def of level.objectives) if (def.kind === 'interdict' && def.primary) return def.timeLimit;
  return null;
}
