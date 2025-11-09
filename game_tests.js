(function (global) {
  "use strict";

  const GameService = global.GameService;
  const GameConfig = global.GameConfig;

  function assertAlmostEqual(actual, expected, tolerance, label) {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
      console.warn(`Assertion failed: ${label} expected ${expected} got ${actual}`);
    }
  }

  function runScoringTests() {
    const cfg = GameConfig.cloneRunConfig({});
    const base = {
      itemId: "test",
      truth: "442",
      wrongs: 0,
      hintsUsed: 0,
      itemTimeMs: 2500,
      effectiveTimeMs: 2500,
      points: 0,
      assisted: false,
    };

    const res1 = GameService.computeItemPoints({ ...base }, cfg);
    assertAlmostEqual(res1, 65, 1, "First try, no hints, 2.5s");

    const res2 = GameService.computeItemPoints({ ...base, wrongs: 2, itemTimeMs: 3000 }, cfg);
    assertAlmostEqual(res2, 5, 1, "Two wrongs, 3s");

    const res3 = GameService.computeItemPoints({ ...base, wrongs: 1, hintsUsed: 2, itemTimeMs: 4200 }, cfg);
    assertAlmostEqual(res3, 0, 1, "One wrong, two hints, 4.2s");

    const res4 = GameService.computeItemPoints({ ...base, hintsUsed: 4 }, cfg);
    assertAlmostEqual(res4, 0, 1, "Hint 4 means assisted");
  }

  function runGateTests(service) {
    const level = GameConfig.LEVELS[0];
    const summaryPass = {
      userId: "local",
      levelId: level.id,
      timestamp: new Date().toISOString(),
      totalScore: 100,
      accuracy: 0.9,
      medianItemSeconds: 2.8,
      items: [],
      longestStreak: 3,
    };
    const summaryFail = {
      userId: "local",
      levelId: level.id,
      timestamp: new Date().toISOString(),
      totalScore: 100,
      accuracy: 1,
      medianItemSeconds: 3.2,
      items: [],
      longestStreak: 10,
    };
    if (!service.evaluateGate(summaryPass)) {
      console.warn("Gate should pass for summaryPass");
    }
    if (service.evaluateGate(summaryFail)) {
      console.warn("Gate should fail for summaryFail");
    }
  }

  function runTimerTests(service) {
    const state = {
      runTimeRemaining: 30,
    };
    service.runState = state;
    service.onTick(5000);
    if (service.runState.runTimeRemaining > 25.01 || service.runState.runTimeRemaining < 24.99) {
      console.warn("Timer did not decrement correctly");
    }
  }

  function runGameTests() {
    if (!GameService || !GameConfig) return;
    runScoringTests();
    const service = new GameService({
      itemBank: [],
      persistence: null,
      runConfig: GameConfig.cloneRunConfig(),
    });
    runGateTests(service);
    runTimerTests(service);
    console.info("Game tests executed");
  }

  global.GameTests = {
    runGameTests,
  };
})(typeof window !== "undefined" ? window : this);
