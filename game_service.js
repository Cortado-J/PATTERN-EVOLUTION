(function (global) {
  "use strict";

  const GameConfig = global.GameConfig;
  const GameModels = global.GameModels;
  const GamePersistence = global.GamePersistence;

  if (!GameConfig) {
    throw new Error("GameConfig must be loaded before GameService");
  }
  if (!GameModels) {
    throw new Error("GameModels must be loaded before GameService");
  }

  const {
    GamePhase,
    ItemStatus,
    createRunState,
    createItemResult,
    createHintState,
    cloneResult,
    clamp01,
    median,
    filterNonAssisted,
  } = GameModels;

  const hintFactorTable = [1, 0.75, 0.5, 0.25, 0];

  const DEFAULT_CLOCK = {
    now() {
      if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
      }
      return Date.now();
    },
  };

  const DEFAULT_RENDERERS = Object.freeze({
    hint1: function noop() {},
    hint2: function noop() {},
    hint3: function noop() {},
    hint4: function noop() {},
  });

  const EVENTS = Object.freeze({
    RUN_STARTED: "run-started",
    RUN_TICK: "run-tick",
    RUN_ENDED: "run-ended",
    ITEM_ACTIVE: "item-active",
    ITEM_RESOLVED: "item-resolved",
    HINT_USED: "hint-used",
    GUESS_EVALUATED: "guess-evaluated",
    SCORE_UPDATED: "score-updated",
  });

  function ensureArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value.slice() : [value];
  }

  function eventPayload(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function toSeconds(ms) {
    return ms / 1000;
  }

  function fromSeconds(sec) {
    return sec * 1000;
  }

  function copyProgress(progress) {
    return JSON.parse(JSON.stringify(progress));
  }

  function normalizeOrbifold(input) {
    return GameConfig.ensureOrbifold(input);
  }

  function getLevels() {
    return GameConfig.LEVELS;
  }

  function findLevel(levelId) {
    return GameConfig.getLevel(levelId);
  }

  function getNextLevel(currentLevelId) {
    const current = findLevel(currentLevelId);
    if (!current) return null;
    const levels = getLevels().filter(lvl => lvl.modeId === current.modeId);
    levels.sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = levels.findIndex(lvl => lvl.id === currentLevelId);
    if (idx < 0) return null;
    return levels[idx + 1] || null;
  }

  function shuffleInPlace(array, randomFn) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function pickDistinct(array, count, randomFn) {
    if (array.length <= count) {
      return array.slice(0, count);
    }
    const clone = array.slice();
    shuffleInPlace(clone, randomFn);
    return clone.slice(0, count);
  }

  function deepFreeze(obj) {
    if (!obj || typeof obj !== "object") return obj;
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(name => {
      const value = obj[name];
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        deepFreeze(value);
      }
    });
    return obj;
  }

  function computeItemPoints(result, cfg) {
    if (!result) return 0;
    const config = cfg || GameConfig.DEFAULT_RUN_CONFIG;
    const hints = typeof result.hintsUsed === "number" ? result.hintsUsed : 0;
    const wrongs = typeof result.wrongs === "number" ? result.wrongs : 0;
    const assisted = Boolean(result.assisted);

    if (assisted || hints >= 4 || wrongs >= config.maxWrongsPerItem) {
      return 0;
    }

    const rawSeconds = toSeconds(result.itemTimeMs || 0);
    const effectiveSeconds = rawSeconds + config.hintTimePenaltySec * hints;
    const s = clamp01(Math.exp(-effectiveSeconds / config.timeConstantTauSec));
    const g = Math.pow(0.5, wrongs);
    const hIndex = Math.min(Math.max(hints, 0), hintFactorTable.length - 1);
    const h = hintFactorTable[hIndex];
    const baseScore = Math.floor(config.basePoints * s * g * h);
    const penalty = config.wrongTapPenalty * wrongs;
    const total = Math.max(0, baseScore - penalty);
    return total;
  }

  function updateConfusion(progress, result) {
    if (!result || !result.truth || !result.picked || result.truth === result.picked) return;
    const truth = result.truth;
    const picked = result.picked;
    if (!progress.confusionMatrix[truth]) {
      progress.confusionMatrix[truth] = {};
    }
    const current = progress.confusionMatrix[truth][picked] || 0;
    progress.confusionMatrix[truth][picked] = current + 1;
  }

  function updateFeatureWeakness(progress, result) {
    if (!result) return;
    const weaknesses = progress.featureWeakness;
    const hints = result.hintsUsed || 0;
    if (hints >= 1) weaknesses.rotations += 1;
    if (hints >= 2) weaknesses.mirrors += 1;
    if (hints >= 3) weaknesses.glides += 1;
  }

  function createEmitter() {
    const listeners = new Map();
    return {
      on(event, handler) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(handler);
        return () => this.off(event, handler);
      },
      off(event, handler) {
        if (!listeners.has(event)) return;
        listeners.get(event).delete(handler);
      },
      emit(event, payload) {
        if (!listeners.has(event)) return;
        listeners.get(event).forEach(fn => {
          try {
            fn(payload);
          } catch (err) {
            console.warn("GameService listener error", err);
          }
        });
      },
    };
  }

  class GameService {
    constructor(options) {
      const opts = options || {};
      this.random = typeof opts.random === "function" ? opts.random : Math.random;
      this.clock = opts.clock || DEFAULT_CLOCK;
      this.itemBank = ensureArray(opts.itemBank);
      this.itemSelector = typeof opts.selectItems === "function" ? opts.selectItems : null;

function findLevel(levelId) {
  return GameConfig.getLevel(levelId);
}

function getNextLevel(currentLevelId) {
  const current = findLevel(currentLevelId);
  if (!current) return null;
  const levels = getLevels().filter(lvl => lvl.modeId === current.modeId);
  levels.sort((a, b) => (a.order || 0) - (b.order || 0));
  const idx = levels.findIndex(lvl => lvl.id === currentLevelId);
  if (idx < 0) return null;
  return levels[idx + 1] || null;
}

function shuffleInPlace(array, randomFn) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
      if (!Array.isArray(this.progress.unlockedLevels)) {
        this.progress.unlockedLevels = [];
      }
      if (!this.progress.selectedModeId) {
        this.progress.selectedModeId = GameConfig.DEFAULT_MODE_ID;
      }
      if (!this.progress.lastLevelId || !findLevel(this.progress.lastLevelId)) {
        this.progress.lastLevelId = GameConfig.DEFAULT_LEVEL_ID;
      }
      GameConfig.ALWAYS_UNLOCKED_LEVEL_IDS.forEach((id) => {
        if (!this.progress.unlockedLevels.includes(id)) {
          this.progress.unlockedLevels.push(id);
        }
      });
      if (this.progress.lastLevelId && !this.progress.unlockedLevels.includes(this.progress.lastLevelId)) {
        this.progress.unlockedLevels.push(this.progress.lastLevelId);
      }

      this.emitter = createEmitter();

      this.resetRuntimeState();
    }

    resetRuntimeState() {
      this.runState = null;
      this.currentLevel = null;
      this.currentResult = null;
      this.currentHintState = null;
      this.currentItemStartedAt = null;
      this.currentItemStatus = ItemStatus.PENDING;
      this.disabledOrbs = new Set();
      this.telemetryBuffer = [];
    }

    loadProgress() {
      if (!this.isFeatureEnabled("persistence") || !this.persistence || !this.persistence.loadProgress) {
        return copyProgress(GamePersistence ? GamePersistence.DEFAULT_PROGRESS : { unlockedLevels: [], confusionMatrix: {}, featureWeakness: { rotations: 0, mirrors: 0, glides: 0 } });
      }
      return copyProgress(this.persistence.loadProgress());
    }

    saveProgress() {
      if (!this.isFeatureEnabled("persistence") || !this.persistence || !this.persistence.saveProgress) {
        return Promise.resolve();
      }
      const snapshot = copyProgress(this.progress);
      return this.persistence.saveProgress(snapshot);
    }

    saveRunSummary(summary) {
      if (!this.isFeatureEnabled("persistence") || !this.persistence || !this.persistence.saveRunSummary) {
        return Promise.resolve();
      }
      return this.persistence.saveRunSummary(summary);
    }

    on(event, handler) {
      return this.emitter.on(event, handler);
    }

    off(event, handler) {
      this.emitter.off(event, handler);
    }

    setItemBank(items) {
      this.itemBank = ensureArray(items);
    }

    startRun(levelId, options) {
      const fallbackLevelId = this.progress?.lastLevelId || GameConfig.DEFAULT_LEVEL_ID;
      const resolvedLevelId = levelId || fallbackLevelId;
      console.log("[DEBUG] startRun: Starting with levelId:", resolvedLevelId);
      const runOptions = options || {};
      const providedLevel = runOptions.level ? Object.assign({}, runOptions.level) : null;
      const level = providedLevel || findLevel(resolvedLevelId);
      if (!level) {
        const available = getLevels().map(lvl => lvl.id).join(", ");
        throw new Error(`Unknown level id: ${resolvedLevelId}. Available levels: ${available}`);
      }

      const items = runOptions.items || this.selectItemsForLevel(level, runOptions);
      console.log("[DEBUG] startRun: Selected items count:", items?.length);
      if (!items || items.length === 0) {
        console.error("[DEBUG] startRun: No pattern items available");
        throw new Error(`No pattern items available for level ${levelId}`);
      }
      if (items.length < level.poolSize) {
        console.warn(`Provided item pool smaller than expected poolSize (${items.length} < ${level.poolSize})`);
      }

      const sampled = items.slice(0, level.poolSize);
      console.log("[DEBUG] startRun: Sampled items:", sampled.length);
      this.applyFeatureOverrides(runOptions.featureOverrides);
      this.configureRunConfig(runOptions.runConfigOverrides);
      this.runState = createRunState(sampled, level.id, level.runSeconds);
      this.runState.status = GamePhase.RUNNING;
      this.currentLevel = level;
      this.currentResult = null;
      this.currentHintState = null;
      this.currentItemStartedAt = null;
      this.currentItemStatus = ItemStatus.PENDING;
      this.disabledOrbs = new Set();
      this.telemetryBuffer = [];

      console.log("[DEBUG] startRun: About to emit telemetry");
      this.emitTelemetry("runStart", { levelId: level.id, runSeconds: level.runSeconds });
      console.log("[DEBUG] startRun: About to emit RUN_STARTED event");
      this.emitter.emit(EVENTS.RUN_STARTED, {
        runState: eventPayload(this.runState),
        level: eventPayload(level),
      });
      console.log("[DEBUG] startRun: RUN_STARTED event emitted");

      console.log("[DEBUG] startRun: About to activateCurrentItem");
      this.activateCurrentItem();
      console.log("[DEBUG] startRun: activateCurrentItem completed");
      return eventPayload(this.runState);
    }

    endRun(metadata) {
      if (!this.runState || this.runState.status === GamePhase.ENDED) {
        return null;
      }

      this.runState.status = GamePhase.ENDED;
      const reason = metadata && metadata.reason ? metadata.reason : "manual";

      const summary = this.buildRunSummary(reason);
      const gatePassed = this.evaluateGate(summary);
      this.updateProgressAfterRun(summary, gatePassed);

      this.emitTelemetry("runEnd", { reason, summary, gatePassed });
      this.emitter.emit(EVENTS.RUN_ENDED, {
        summary,
        gatePassed,
        reason,
      });

      this.resetRuntimeState();

      if (this.isFeatureEnabled("persistence")) {
        this.saveRunSummary(summary);
        this.saveProgress();
      }

      return summary;
    }

    onItemShown(itemId) {
      if (!this.runState || this.runState.status !== GamePhase.RUNNING) return;
      const item = this.getCurrentItem();
      if (!item || item.id !== itemId) return;
      this.emitTelemetry("itemStart", { itemId, index: this.runState.index });
    }

    onGuess(orbifold) {
      if (!this.runState || this.runState.status !== GamePhase.RUNNING) return;
      const item = this.getCurrentItem();
      if (!item) return;
      if (this.currentItemStatus !== ItemStatus.ACTIVE) return;

      const guess = normalizeOrbifold(orbifold);
      if (!guess) return;
      if (this.disabledOrbs.has(guess)) return;

      const correct = guess === normalizeOrbifold(item.truth);
      if (correct) {
        this.handleCorrectGuess(guess);
      } else {
        this.handleWrongGuess(guess);
      }
    }

    onHintRequest(order) {
      if (!this.isFeatureEnabled("hints")) return;
      if (!this.runState || this.runState.status !== GamePhase.RUNNING) return;
      if (this.currentItemStatus !== ItemStatus.ACTIVE) return;
      if (order < 1 || order > 4) return;

      const expected = (this.currentHintState ? this.currentHintState.count : 0) + 1;
      if (order !== expected) {
        return;
      }

      this.applyHint(order);
    }

    onTick(deltaMs) {
      if (!this.runState || this.runState.status !== GamePhase.RUNNING) return;
      const deltaSeconds = deltaMs / 1000;

      if (this.isFeatureEnabled("timer")) {
        this.runState.runTimeRemaining = Math.max(0, this.runState.runTimeRemaining - deltaSeconds);
        if (this.runState.runTimeRemaining <= 0) {
          this.handleRunTimeout();
          return;
        }
      }

      if (this.currentItemStartedAt && this.currentResult) {
        this.currentResult.itemTimeMs = this.clock.now() - this.currentItemStartedAt;
      }

      this.emitter.emit(EVENTS.RUN_TICK, {
        deltaMs,
        runState: eventPayload(this.runState),
      });
    }

    getCurrentItem() {
      if (!this.runState || !this.runState.items) return null;
      return this.runState.items[this.runState.index] || null;
    }

    selectItemsForLevel(level, options) {
      if (this.itemSelector) {
        return this.itemSelector(level, options || {});
      }
      const allowed = new Set(level.allowed.map(normalizeOrbifold));
      const pool = this.itemBank.filter(item => allowed.has(normalizeOrbifold(item.truth)));
      if (pool.length === 0) {
        console.warn(`Item bank has no entries for level ${level.id}`);
        return [];
      }
      const selected = pickDistinct(pool, level.poolSize, this.random.bind(Math));
      return selected;
    }

    applyHint(order) {
      if (!this.currentHintState) {
        this.currentHintState = createHintState();
      }
      const item = this.getCurrentItem();
      if (!item) return;

      this.currentHintState.count = order;
      this.currentHintState.active[order - 1] = true;

      if (this.currentResult) {
        this.currentResult.hintsUsed = order;
      }

      if (this.isFeatureEnabled("penalties") && this.isFeatureEnabled("timer")) {
        const deduct = this.runConfig.hintRunDeductSec;
        this.runState.runTimeRemaining = Math.max(0, this.runState.runTimeRemaining - deduct);
        if (this.runState.runTimeRemaining <= 0) {
          this.handleRunTimeout();
          return;
        }
      }

      this.triggerHintOverlay(order, item.id);
      this.resetStreakDueToHint();

      this.emitter.emit(EVENTS.HINT_USED, {
        order,
        itemId: item.id,
        runState: eventPayload(this.runState),
      });

      if (order === 4) {
        this.resolveCurrentItem({
          assisted: true,
          reason: "hint4",
          picked: null,
          advance: true,
        });
      }
    }

    triggerHintOverlay(order, itemId) {
      if (!this.isFeatureEnabled("overlays")) return;
      switch (order) {
        case 1:
          this.renderers.hint1(itemId);
          break;
        case 2:
          this.renderers.hint2(itemId);
          break;
        case 3:
          this.renderers.hint3(itemId);
          break;
        case 4:
          this.renderers.hint4(itemId);
          break;
        default:
          break;
      }
    }

    handleCorrectGuess(guess) {
      this.emitTelemetry("guess", { guess, correct: true });
      this.resolveCurrentItem({
        assisted: false,
        reason: "correct",
        picked: guess,
        advance: true,
        correct: true,
      });
    }

    handleWrongGuess(guess) {
      this.emitTelemetry("guess", { guess, correct: false });
      this.disabledOrbs.add(guess);
      if (this.currentResult) {
        this.currentResult.wrongs += 1;
        this.currentResult.picked = guess;
      }

      this.resetStreakDueToWrong();

      this.emitter.emit(EVENTS.GUESS_EVALUATED, {
        guess,
        correct: false,
        runState: eventPayload(this.runState),
        result: this.currentResult ? cloneResult(this.currentResult) : null,
      });

      if (this.currentResult && this.currentResult.wrongs >= this.runConfig.maxWrongsPerItem) {
        this.resolveCurrentItem({
          assisted: true,
          reason: "max-wrongs",
          picked: this.currentResult.picked,
          advance: true,
        });
      }
    }

    resetStreakDueToWrong() {
      if (!this.isFeatureEnabled("streaks")) return;
      if (!this.runState) return;
      this.runState.currentStreak = 0;
    }

    resetStreakDueToHint() {
      if (!this.isFeatureEnabled("streaks")) return;
      if (!this.runState) return;
      this.runState.currentStreak = 0;
    }

    resolveCurrentItem(options) {
      if (!this.runState || !this.currentResult || this.currentItemStatus !== ItemStatus.ACTIVE) {
        return;
      }
      const opts = options || {};
      const now = this.clock.now();
      const item = this.getCurrentItem();

      this.currentResult.itemTimeMs = now - this.currentItemStartedAt;
      const hints = this.currentResult.hintsUsed || 0;
      this.currentResult.effectiveTimeMs = this.currentResult.itemTimeMs + fromSeconds(this.runConfig.hintTimePenaltySec * hints / 1);
      if (typeof opts.picked !== "undefined" && opts.picked !== null) {
        this.currentResult.picked = normalizeOrbifold(opts.picked);
      } else if (opts.correct) {
        this.currentResult.picked = normalizeOrbifold(item.truth);
      }

      this.currentResult.assisted = Boolean(opts.assisted);

      const basePoints = opts.correct ? computeItemPoints(this.currentResult, this.runConfig) : 0;
      let totalPoints = basePoints;

      if (this.isFeatureEnabled("streaks")) {
        if (!this.currentResult.assisted && this.currentResult.wrongs === 0 && hints === 0 && opts.correct) {
          this.runState.currentStreak += 1;
          if (this.runState.currentStreak >= this.runConfig.streakStart) {
            totalPoints += this.runConfig.streakBonusPerItem;
          }
        } else {
          this.runState.currentStreak = 0;
        }
        this.runState.longestStreak = Math.max(this.runState.longestStreak, this.runState.currentStreak);
      }

      this.currentResult.points = this.currentResult.assisted ? 0 : totalPoints;
      this.runState.score += this.currentResult.points;

      const resultSnapshot = cloneResult(this.currentResult);
      this.runState.stats.push(resultSnapshot);

      this.emitter.emit(EVENTS.ITEM_RESOLVED, {
        itemId: item ? item.id : null,
        result: resultSnapshot,
        runState: eventPayload(this.runState),
        reason: opts.reason || "resolved",
      });

      this.emitter.emit(EVENTS.SCORE_UPDATED, {
        score: this.runState.score,
        runState: eventPayload(this.runState),
      });

      this.currentItemStatus = ItemStatus.RESOLVED;
      this.currentResult = null;
      this.currentHintState = null;
      this.currentItemStartedAt = null;
      this.disabledOrbs.clear();

      this.runState.index += 1;

      if (opts.advance === false) {
        return;
      }

      if (this.runState.index >= this.runState.items.length) {
        this.endRun({ reason: "completed" });
        return;
      }

      if (this.isFeatureEnabled("timer") && this.runState.runTimeRemaining <= 0) {
        this.endRun({ reason: "timeout" });
        return;
      }

      this.activateCurrentItem();
    }

    activateCurrentItem() {
      console.log("[DEBUG] activateCurrentItem: Starting");
      const item = this.getCurrentItem();
      console.log("[DEBUG] activateCurrentItem: getCurrentItem result:", item);
      if (!item) {
        console.log("[DEBUG] activateCurrentItem: No item, ending run");
        this.endRun({ reason: "no-more-items" });
        return;
      }
      console.log("[DEBUG] activateCurrentItem: Creating item result and hint state");
      this.currentResult = createItemResult(item);
      this.currentHintState = createHintState();
      this.currentItemStartedAt = this.clock.now();
      this.currentItemStatus = ItemStatus.ACTIVE;
      this.disabledOrbs.clear();

      console.log("[DEBUG] activateCurrentItem: About to emit ITEM_ACTIVE event");
      this.emitter.emit(EVENTS.ITEM_ACTIVE, {
        item,
        index: this.runState.index,
        runState: eventPayload(this.runState),
      });
      console.log("[DEBUG] activateCurrentItem: ITEM_ACTIVE event emitted");
    }

    handleRunTimeout() {
      if (!this.runState || this.runState.status !== GamePhase.RUNNING) return;
      if (this.currentResult && this.currentItemStatus === ItemStatus.ACTIVE) {
        this.resolveCurrentItem({
          assisted: true,
          reason: "timeout-item",
          advance: false,
        });
      }
      this.endRun({ reason: "timeout" });
    }

    buildRunSummary(reason) {
      const stats = this.runState ? this.runState.stats.map(res => cloneResult(res)) : [];
      const attempted = stats.length;
      const correctCount = stats.filter(res => res.points > 0 && !res.assisted && normalizeOrbifold(res.truth) === normalizeOrbifold(res.picked)).length;
      const accuracy = attempted ? correctCount / attempted : 0;
      const nonAssisted = filterNonAssisted(stats);
      const medianItemSeconds = nonAssisted.length ? median(nonAssisted.map(res => toSeconds(res.itemTimeMs || 0))) : 0;
      return {
        userId: this.userId,
        levelId: this.currentLevel ? this.currentLevel.id : "",
        timestamp: new Date().toISOString(),
        totalScore: this.runState ? this.runState.score : 0,
        accuracy,
        medianItemSeconds,
        items: stats,
        longestStreak: this.runState ? this.runState.longestStreak : 0,
        reason,
      };
    }

    evaluateGate(summary) {
      if (!this.isFeatureEnabled("gating")) return true;
      const level = this.currentLevel;
      if (!level) return false;
      const gate = level.gate;
      if (!gate) return true;
      return summary.accuracy >= gate.minAccuracy && summary.medianItemSeconds < gate.maxMedianItemSeconds;
    }

    updateProgressAfterRun(summary, gatePassed) {
      if (!this.progress) return;
      const stats = summary.items || [];
      stats.forEach(res => {
        updateConfusion(this.progress, res);
        updateFeatureWeakness(this.progress, res);
      });

      if (gatePassed) {
        if (Array.isArray(this.progress.completedLevels)) {
          if (!this.progress.completedLevels.includes(summary.levelId)) {
            this.progress.completedLevels.push(summary.levelId);
          }
        } else {
          this.progress.completedLevels = [summary.levelId];
        }

        const nextLevel = getNextLevel(summary.levelId);
        if (nextLevel) {
          if (!this.progress.unlockedLevels.includes(nextLevel.id)) {
            this.progress.unlockedLevels.push(nextLevel.id);
          }
          this.progress.lastLevelId = nextLevel.id;
        } else {
          this.progress.lastLevelId = summary.levelId;
        }
      } else {
        this.progress.lastLevelId = summary.levelId;
      }
    }

    emitTelemetry(eventName, data) {
      if (!this.isFeatureEnabled("telemetry") || !eventName) return;
      const payload = {
        event: eventName,
        timestamp: new Date().toISOString(),
        data,
      };
      if (this.telemetrySink && typeof this.telemetrySink === "function") {
        try {
          this.telemetrySink(payload);
        } catch (err) {
          console.warn("Telemetry sink error", err);
        }
      } else {
        this.telemetryBuffer.push(payload);
      }
    }
  }

  GameService.EVENTS = EVENTS;
  GameService.computeItemPoints = computeItemPoints;
  GameService.prototype.isFeatureEnabled = function feature(name) {
    return Boolean(this.features && Object.prototype.hasOwnProperty.call(this.features, name)
      ? this.features[name]
      : GameConfig.isFeatureEnabled(name));
  };

  GameService.prototype.applyFeatureOverrides = function applyFeatureOverrides(overrides) {
    const merged = Object.assign({}, this.baseFeatures);
    if (overrides && typeof overrides === "object") {
      Object.keys(overrides).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(merged, key)) {
          merged[key] = Boolean(overrides[key]);
        }
      });
    }
    this.features = merged;
  };

  GameService.prototype.configureRunConfig = function configureRunConfig(overrides) {
    this.runConfig = Object.assign({}, this.baseRunConfig, overrides || {});
  };

  global.GameService = GameService;
})(typeof window !== "undefined" ? window : this);
