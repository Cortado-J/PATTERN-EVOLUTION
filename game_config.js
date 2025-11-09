(function (global) {
  "use strict";

  const ORBIFOLDS = Object.freeze([
    "442",
    "*442",
    "4*2",
    "333",
    "*333",
    "3*3",
    "632",
    "*632",
    "2222",
    "*2222",
    "22×",
    "22*",
    "2*22",
    "**",
    "*×",
    "××",
    "o",
  ]);

  const ORBIFOLD_GRID_LAYOUT = Object.freeze([
    ["442", "*442", "4*2", "333", "*333", "3*3"],
    ["632", "*632", "2222", "*2222", "22×", "22*"],
    ["2*22", "**", "*×", "××", "o", null],
  ]);

  const LEVELS = Object.freeze([
    {
      id: "L1-rotate",
      label: "Rotate",
      allowed: Object.freeze(["632", "442", "333", "2222"]),
      poolSize: 10,
      runSeconds: 90,
      gate: Object.freeze({ minAccuracy: 0.9, maxMedianItemSeconds: 3 }),
    },
    {
      id: "L2-reflect",
      label: "Reflect",
      allowed: Object.freeze(["*632", "*442", "*333", "*2222"]),
      poolSize: 10,
      runSeconds: 90,
      gate: Object.freeze({ minAccuracy: 0.9, maxMedianItemSeconds: 3 }),
    },
    {
      id: "L3-mixed",
      label: "Mixed",
      allowed: Object.freeze(["3*3", "4*2", "2*22", "22*"]),
      poolSize: 10,
      runSeconds: 90,
      gate: Object.freeze({ minAccuracy: 0.9, maxMedianItemSeconds: 3 }),
    },
    {
      id: "L4-glide",
      label: "Glide",
      allowed: Object.freeze(["22×"]),
      poolSize: 10,
      runSeconds: 90,
      gate: Object.freeze({ minAccuracy: 0.9, maxMedianItemSeconds: 3 }),
    },
    {
      id: "L5-basics",
      label: "Basics",
      allowed: Object.freeze(["**", "*×", "××", "o"]),
      poolSize: 10,
      runSeconds: 90,
      gate: Object.freeze({ minAccuracy: 0.9, maxMedianItemSeconds: 3 }),
    },
  ]);

  const DEFAULT_RUN_CONFIG = Object.freeze({
    timeConstantTauSec: 6,
    basePoints: 100,
    wrongTapPenalty: 5,
    maxWrongsPerItem: 3,
    hintTimePenaltySec: 15,
    hintRunDeductSec: 15,
    streakStart: 5,
    streakBonusPerItem: 10,
  });

  const FEATURE_TOGGLES = {
    timer: true,
    hints: true,
    penalties: true,
    streaks: true,
    gating: true,
    persistence: true,
    telemetry: false,
    overlays: true,
  };

  function cloneRunConfig(overrides) {
    return Object.assign({}, DEFAULT_RUN_CONFIG, overrides || {});
  }

  function getFeatureToggles() {
    return FEATURE_TOGGLES;
  }

  function setFeatureToggle(name, enabled) {
    if (!Object.prototype.hasOwnProperty.call(FEATURE_TOGGLES, name)) {
      throw new Error(`Unknown game feature toggle: ${name}`);
    }
    FEATURE_TOGGLES[name] = Boolean(enabled);
  }

  function isFeatureEnabled(name) {
    return Boolean(FEATURE_TOGGLES[name]);
  }

  function ensureOrbifold(value) {
    if (!value) return value;
    const normalized = String(value).replace(/x/g, "×");
    return ORBIFOLDS.includes(normalized) ? normalized : value;
  }

  global.GameConfig = Object.freeze({
    ORBIFOLDS,
    ORBIFOLD_GRID_LAYOUT,
    LEVELS,
    DEFAULT_RUN_CONFIG,
    cloneRunConfig,
    getFeatureToggles,
    setFeatureToggle,
    isFeatureEnabled,
    ensureOrbifold,
  });
})(typeof window !== "undefined" ? window : this);
