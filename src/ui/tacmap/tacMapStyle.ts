/** Colours and switches for one look of the tactical map. CSS colour strings (Canvas 2D). */
export interface TacMapStyle {
  groundTop: string;
  groundBottom: string;
  /** Speckle noise alpha (0 disables). */
  noise: number;
  noiseLight: string;
  noiseDark: string;
  /** Hills as filled, shaded mounds. */
  hillFill: string | null;
  hillShade: string | null;
  /** Hill contour lines (topographic look). */
  contour: string | null;
  forest: string;
  forestCanopy: string;
  forestHighlight: string;
  field: Record<'wheat' | 'green' | 'plowed', string>;
  fieldRows: string;
  river: string;
  riverEdge: string;
  riverGlow: string | null;
  roadDirt: string;
  roadPaved: string;
  roadEdge: string | null;
  village: string;
  friendly: string;
  /** Grid lines every `gridSpacing` world units, or null. */
  grid: string | null;
  gridSpacing: number;
  gridLabels: string | null;
  /** Minimum on-canvas stroke widths so thin features survive tiny scales. */
  minRiverWidth: number;
  minRoadWidth: number;
}

/** Dark phosphor display: minimap. */
export const TACMAP_PHOSPHOR: TacMapStyle = {
  groundTop: '#0d1a10',
  groundBottom: '#0a140c',
  noise: 0.35,
  noiseLight: '#1c3320',
  noiseDark: '#060d07',
  hillFill: null,
  hillShade: null,
  contour: 'rgba(120, 190, 110, 0.28)',
  forest: 'rgba(40, 90, 40, 0.75)',
  forestCanopy: 'rgba(60, 130, 55, 0.85)',
  forestHighlight: 'rgba(120, 200, 100, 0.35)',
  field: { wheat: 'rgba(150, 150, 70, 0.22)', green: 'rgba(80, 150, 70, 0.22)', plowed: 'rgba(120, 95, 60, 0.25)' },
  fieldRows: 'rgba(160, 200, 120, 0.12)',
  river: '#1d6f8f',
  riverEdge: '#5fd0f0',
  riverGlow: 'rgba(80, 200, 240, 0.18)',
  roadDirt: 'rgba(170, 150, 100, 0.7)',
  roadPaved: 'rgba(200, 205, 190, 0.8)',
  roadEdge: null,
  village: 'rgba(170, 190, 160, 0.65)',
  friendly: '#5ab0ff',
  grid: 'rgba(157, 255, 122, 0.08)',
  gridSpacing: 900,
  gridLabels: null,
  minRiverWidth: 3,
  minRoadWidth: 1,
};

/** Briefing board: phosphor with a labelled grid and a touch more contrast. */
export const TACMAP_BRIEFING: TacMapStyle = {
  ...TACMAP_PHOSPHOR,
  groundTop: '#0f1f13',
  groundBottom: '#0a150d',
  contour: 'rgba(130, 200, 120, 0.3)',
  grid: 'rgba(157, 255, 122, 0.12)',
  gridLabels: 'rgba(157, 255, 122, 0.55)',
  minRiverWidth: 5,
  minRoadWidth: 1.5,
};

/** Muted natural colours: the title-screen recon backdrop. */
export const TACMAP_TERRAIN: TacMapStyle = {
  groundTop: '#6f6c45',
  groundBottom: '#5f5d3a',
  noise: 0.5,
  noiseLight: '#827f55',
  noiseDark: '#4c4a2e',
  hillFill: 'rgba(150, 140, 95, 0.35)',
  hillShade: 'rgba(40, 38, 20, 0.35)',
  contour: 'rgba(60, 55, 30, 0.35)',
  forest: 'rgba(40, 62, 30, 0.9)',
  forestCanopy: 'rgba(58, 88, 40, 0.95)',
  forestHighlight: 'rgba(110, 140, 70, 0.55)',
  field: { wheat: 'rgba(190, 170, 90, 0.55)', green: 'rgba(95, 130, 60, 0.6)', plowed: 'rgba(110, 85, 55, 0.6)' },
  fieldRows: 'rgba(40, 35, 20, 0.25)',
  river: '#2d5f73',
  riverEdge: '#8ab8b8',
  riverGlow: 'rgba(40, 70, 60, 0.5)',
  roadDirt: 'rgba(170, 145, 100, 0.95)',
  roadPaved: 'rgba(95, 95, 90, 0.95)',
  roadEdge: 'rgba(40, 36, 24, 0.5)',
  village: 'rgba(200, 190, 170, 0.9)',
  friendly: '#5ab0ff',
  grid: null,
  gridSpacing: 900,
  gridLabels: null,
  minRiverWidth: 4,
  minRoadWidth: 1.5,
};
