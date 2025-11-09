(function (global) {
  "use strict";

  const STORAGE_KEYS = {
    progress: "pattern_game_progress",
    runs: "pattern_game_runs", // stores array of run summaries
  };

  const DEFAULT_PROGRESS = Object.freeze({
    unlockedLevels: ["L1-rotate"],
    confusionMatrix: {},
    featureWeakness: {
      rotations: 0,
      mirrors: 0,
      glides: 0,
    },
  });

  function safeParse(json, fallback) {
    if (!json) return fallback;
    try {
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (err) {
      console.warn("GamePersistence.parse error", err);
    }
    return fallback;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadProgress() {
    if (typeof window === "undefined" || !window.localStorage) {
      return deepClone(DEFAULT_PROGRESS);
    }
    const stored = window.localStorage.getItem(STORAGE_KEYS.progress);
    const parsed = safeParse(stored, DEFAULT_PROGRESS);
    return Object.assign({}, DEFAULT_PROGRESS, parsed || {});
  }

  function saveProgress(progress) {
    if (typeof window === "undefined" || !window.localStorage) {
      return Promise.resolve();
    }
    try {
      const cloned = deepClone(progress || DEFAULT_PROGRESS);
      window.localStorage.setItem(
        STORAGE_KEYS.progress,
        JSON.stringify(cloned)
      );
    } catch (err) {
      console.warn("GamePersistence.saveProgress error", err);
    }
    return Promise.resolve();
  }

  function loadRunHistory() {
    if (typeof window === "undefined" || !window.localStorage) {
      return [];
    }
    const stored = window.localStorage.getItem(STORAGE_KEYS.runs);
    return safeParse(stored, []);
  }

  function saveRunSummary(summary) {
    if (typeof window === "undefined" || !window.localStorage) {
      return Promise.resolve();
    }
    try {
      const runs = loadRunHistory();
      runs.push(summary);
      window.localStorage.setItem(STORAGE_KEYS.runs, JSON.stringify(runs));
    } catch (err) {
      console.warn("GamePersistence.saveRunSummary error", err);
    }
    return Promise.resolve();
  }

  function clearAll() {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEYS.progress);
    window.localStorage.removeItem(STORAGE_KEYS.runs);
  }

  const GamePersistence = Object.freeze({
    loadProgress,
    saveProgress,
    saveRunSummary,
    loadRunHistory,
    clearAll,
    DEFAULT_PROGRESS,
  });

  global.GamePersistence = GamePersistence;
})(typeof window !== "undefined" ? window : this);
