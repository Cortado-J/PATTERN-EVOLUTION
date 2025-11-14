;(function attachPatternStorage(global) {
  const PATTERN_STORAGE_KEY = "orbifold.patterns";

  const safeJsonParse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("[PatternStorage] JSON parse failed", error);
      return null;
    }
  };

  const ensureId = () => {
    const rand = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `pattern-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    return rand;
  };

  function normalizeRecord(item) {
    if (!item || typeof item !== "object") return null;
    const timestamp = item.timestamp || item.savedAt || new Date().toISOString();
    const id = item.id || ensureId();
    const name = item.name || `Pattern_${timestamp.replace(/[:T]/g, "-").slice(0, 19)}`;
    const genome = item.genome && typeof item.genome === "object" ? item.genome : {};
    const preview = typeof item.preview === "string" ? item.preview : null;
    const meta = item.meta && typeof item.meta === "object" ? item.meta : {};

    return { id, name, timestamp, genome, preview, meta };
  }

  function loadStoredPatterns() {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(PATTERN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeRecord)
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  function saveStoredPatterns(patterns) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(patterns));
    } catch (error) {
      console.warn("[PatternStorage] Failed to save patterns", error);
    }
  }

  function persistPattern(record) {
    const normalized = normalizeRecord(record);
    if (!normalized) return loadStoredPatterns();
    const existing = loadStoredPatterns();
    const idx = existing.findIndex((item) => item.id === normalized.id);
    if (idx >= 0) {
      existing[idx] = normalized;
    } else {
      existing.unshift(normalized);
    }
    saveStoredPatterns(existing);
    return existing;
  }

  function deletePattern(id) {
    const existing = loadStoredPatterns();
    const next = existing.filter((item) => item.id !== id);
    saveStoredPatterns(next);
    return next;
  }

  function formatTimestamp(date = new Date()) {
    const pad = (val) => String(val).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  global.PatternStorage = Object.freeze({
    loadStoredPatterns,
    persistPattern,
    deletePattern,
    formatTimestamp,
  });
})(typeof window !== "undefined" ? window : globalThis);
