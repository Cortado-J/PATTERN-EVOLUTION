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

  function patternRenderSmokeTest() {
    const report = {
      hasGameApp: Boolean(global.GameApp),
      initInvoked: false,
      hasP5Instance: false,
      hasRedrawPattern: typeof global.redrawPattern === "function",
      redrawInvoked: false,
      error: null,
    };

    if (!report.hasGameApp) {
      console.warn("Smoke test: GameApp is not available on the window.");
      return report;
    }

    const app = global.GameApp;

    if (!app._p5Instance && typeof app.init === "function") {
      try {
        app.init();
        report.initInvoked = true;
      } catch (err) {
        report.error = `init() threw: ${err?.message || err}`;
        return report;
      }
    }

    report.hasP5Instance = Boolean(app._p5Instance);
    if (!report.hasP5Instance) {
      console.warn("Smoke test: p5 instance is not available after init().");
      return report;
    }

    report.hasRedrawPattern = typeof global.redrawPattern === "function";
    if (!report.hasRedrawPattern) {
      console.warn("Smoke test: global.redrawPattern is not defined.");
      return report;
    }

    const instance = app._p5Instance;
    const originalRedraw = typeof instance.redraw === "function" ? instance.redraw.bind(instance) : null;

    if (!originalRedraw) {
      report.error = "p5 instance does not expose a redraw() function.";
      return report;
    }

    instance.redraw = (...args) => {
      report.redrawInvoked = true;
      return originalRedraw(...args);
    };

    try {
      global.redrawPattern();
    } catch (err) {
      report.error = err?.message || String(err);
    } finally {
      instance.redraw = originalRedraw;
    }

    if (!report.redrawInvoked) {
      console.warn("Smoke test: calling global.redrawPattern() did not hit p5.redraw().");
    }

    return report;
  }

  global.GameTests = {
    runGameTests,
    patternRenderSmokeTest,
  };
})(typeof window !== "undefined" ? window : this);
