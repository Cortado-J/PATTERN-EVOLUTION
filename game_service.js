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

  function isFeatureEnabled(name) {
    return GameConfig.isFeatureEnabled(name);
  }

  function getLevels() {
    return GameConfig.LEVELS;
  }

  function findLevel(levelId) {
    return getLevels().find(lvl => lvl.id === levelId) || null;
  }

  function getNextLevel(currentLevelId) {
    const levels = getLevels();
    const idx = levels.findIndex(l => l.id === currentLevelId);
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
      this.renderers = Object.assign({}, DEFAULT_RENDERERS, opts.renderers || {});
      this.persistence = opts.persistence || GamePersistence;
      this.userId = opts.userId || "local";
      this.telemetrySink = opts.telemetrySink || null;

      this.runConfig = GameConfig.cloneRunConfig(opts.runConfig || {});
      deepFreeze(this.runConfig);

      this.progress = this.loadProgress();

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
      if (!isFeatureEnabled("persistence") || !this.persistence || !this.persistence.loadProgress) {
        return copyProgress(GamePersistence ? GamePersistence.DEFAULT_PROGRESS : { unlockedLevels: [], confusionMatrix: {}, featureWeakness: { rotations: 0, mirrors: 0, glides: 0 } });
      }
      return copyProgress(this.persistence.loadProgress());
    }

    saveProgress() {
      if (!isFeatureEnabled("persistence") || !this.persistence || !this.persistence.saveProgress) {
        return Promise.resolve();
      }
      const snapshot = copyProgress(this.progress);
      return this.persistence.saveProgress(snapshot);
    }

    saveRunSummary(summary) {
      if (!isFeatureEnabled("persistence") || !this.persistence || !this.persistence.saveRunSummary) {
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
      const level = findLevel(levelId);
      if (!level) {
        throw new Error(`Unknown level: ${levelId}`);
      }

      const runOptions = options || {};
      const items = runOptions.items || this.selectItemsForLevel(level, runOptions);
      if (!items || items.length === 0) {
        throw new Error(`No pattern items available for level ${levelId}`);
      }
      if (items.length < level.poolSize) {
        console.warn(`Provided item pool smaller than expected poolSize (${items.length} < ${level.poolSize})`);
      }

      const sampled = items.slice(0, level.poolSize);
      this.runState = createRunState(sampled, level.id, level.runSeconds);
      this.runState.status = GamePhase.RUNNING;
      this.currentLevel = level;
      this.currentResult = null;
      this.currentHintState = null;
      this.currentItemStartedAt = null;
      this.currentItemStatus = ItemStatus.PENDING;
      this.disabledOrbs = new Set();
      this.telemetryBuffer = [];

      this.emitTelemetry("runStart", { levelId: level.id, runSeconds: level.runSeconds });
      this.emitter.emit(EVENTS.RUN_STARTED, {
        runState: eventPayload(this.runState),
        level: eventPayload(level),
      });

      this.activateCurrentItem();
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

      if (isFeatureEnabled("persistence")) {
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
      if (!isFeatureEnabled("hints")) return;
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

      if (isFeatureEnabled("timer")) {
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

      if (isFeatureEnabled("penalties") && isFeatureEnabled("timer")) {
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
      if (!isFeatureEnabled("overlays")) return;
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
      if (!isFeatureEnabled("streaks")) return;
      if (!this.runState) return;
      this.runState.currentStreak = 0;
    }

    resetStreakDueToHint() {
      if (!isFeatureEnabled("streaks")) return;
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

      if (isFeatureEnabled("streaks")) {
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

      if (isFeatureEnabled("timer") && this.runState.runTimeRemaining <= 0) {
        this.endRun({ reason: "timeout" });
        return;
      }

      this.activateCurrentItem();
    }

    activateCurrentItem() {
      const item = this.getCurrentItem();
      if (!item) {
        this.endRun({ reason: "no-more-items" });
        return;
      }
      this.currentResult = createItemResult(item);
      this.currentHintState = createHintState();
      this.currentItemStartedAt = this.clock.now();
      this.currentItemStatus = ItemStatus.ACTIVE;
      this.disabledOrbs.clear();

      this.emitter.emit(EVENTS.ITEM_ACTIVE, {
        item,
        index: this.runState.index,
        runState: eventPayload(this.runState),
      });
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
      if (!isFeatureEnabled("gating")) return true;
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
        const nextLevel = getNextLevel(summary.levelId);
        if (nextLevel) {
          if (!this.progress.unlockedLevels.includes(nextLevel.id)) {
            this.progress.unlockedLevels.push(nextLevel.id);
          }
        }
      }
    }

    emitTelemetry(eventName, data) {
      if (!isFeatureEnabled("telemetry") || !eventName) return;
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

  global.GameService = GameService;
})(typeof window !== "undefined" ? window : this);
