// === Interactive Wallpaper Evolution UI ===

let population = []; // deprecated: no longer used for display
let palettes;
let pool = []; // main list of all patterns
let gen = 0;

// Visible version tag for easy cache-busting verification
const APP_VERSION = "v1.0.4";

// Parent selection + control panel state
let selectedParents = []; // array of genomes currently selected (max 4)
let mutationRate = 0.25; // 0..1
let combineMethod = "random-trait"; // "random-trait" | "average"
let paletteOverride = -1; // -1 means mixed; otherwise index into selectedParents

// Layout caches
let wq, hq;
let thumbH = 100;

// Grid and layout constants
const GRID_COLS = 6;
const GRID_ROWS = 6; // changed from 8 to 6
const HEADER_H = 48; // title bar height
const PANEL_H = 80;  // control panel height

// Generate mode (live preview panel)
let generateMode = false;
let liveOffspring = null; // array of 4 genomes
let liveOffspringSelected = [false, false, false, false];

// UI hit regions (computed each frame)
let uiRegions = {
  genBtn: null,
  rateMinus: null,
  ratePlus: null,
  methodRandom: null,
  methodAverage: null,
  paletteCycle: null,
};

function setup() {
  createCanvas(1000, 1000);
  angleMode(RADIANS);
  noLoop();
  // Also show version in browser tab
  if (typeof document !== 'undefined') {
    document.title = `Pattern Evolution ${APP_VERSION}`;
  }

  wq = width / 2;
  hq = (height * 0.7) / 2;

  palettes = {
    warm: ["#e63946", "#f1faee", "#a8dadc", "#ffbe0b", "#fb5607"],
    cool: ["#457b9d", "#1d3557", "#a8dadc", "#118ab2", "#06d6a0"],
    earth: ["#2a9d8f", "#e9c46a", "#f4a261", "#264653", "#dda15e"],
    vivid: ["#ffb703", "#fb8500", "#023047", "#8ecae6", "#219ebc"]
  };

  // Prime pool with 6 random patterns
  for (let i = 0; i < 6; i++) pool.push(withMeta(randomGenome()));
  drawScreen();
}
