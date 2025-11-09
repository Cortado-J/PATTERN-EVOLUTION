(function (global) {
  "use strict";

  /**
   * @typedef {import("./game_config.js").Orbifold} Orbifold
   */

  const GamePhase = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    ENDED: "ended",
  });

  const ItemStatus = Object.freeze({
    PENDING: "pending",
    ACTIVE: "active",
    RESOLVED: "resolved",
  });

  /**
   * @typedef {Object} HintState
   * @property {number} count
   * @property {boolean[]} active
   */

  /**
   * @param {PatternItem[]} items
   * @param {string} levelId
   * @param {number} runSeconds
   * @returns {RunState}
   */
  function createRunState(items, levelId, runSeconds) {
    return {
      levelId,
      items,
      index: 0,
      runTimeRemaining: runSeconds,
      score: 0,
      longestStreak: 0,
      currentStreak: 0,
      stats: [],
      status: GamePhase.IDLE,
    };
  }

  /**
   * @param {PatternItem} item
   * @returns {ItemResult}
   */
  function createItemResult(item) {
    return {
      itemId: item.id,
      truth: item.truth,
      wrongs: 0,
      hintsUsed: 0,
      itemTimeMs: 0,
      effectiveTimeMs: 0,
      points: 0,
      assisted: false,
    };
  }

  /**
   * @returns {HintState}
   */
  function createHintState() {
    return {
      count: 0,
      active: [false, false, false, false],
    };
  }

  function cloneResult(result) {
    return Object.assign({}, result);
  }

  function clamp01(value) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function median(values) {
    if (!values || values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  function filterNonAssisted(results) {
    return results.filter(r => !r.assisted);
  }

  const GameModels = Object.freeze({
    GamePhase,
    ItemStatus,
    createRunState,
    createItemResult,
    createHintState,
    cloneResult,
    clamp01,
    median,
    filterNonAssisted,
  });

  global.GameModels = GameModels;
})(typeof window !== "undefined" ? window : this);
