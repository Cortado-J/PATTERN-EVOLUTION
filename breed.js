function buildOffspringPreview() {
  let children = [];
  if (selectedParents.length === 0) {
    for (let i = 0; i < 4; i++) children.push(randomGenome());
  } else if (selectedParents.length === 1) {
    for (let i = 0; i < 4; i++) children.push(mutateGenome(selectedParents[0], mutationRate));
  } else {
    for (let i = 0; i < 4; i++) {
      children.push(
        mixGenomes(selectedParents, {
          method: combineMethod,
          mutationRate: mutationRate * 0.5,
          paletteOverride: paletteOverride,
        })
      );
    }
  }
  return children;
}

function sendLiveOffspringToPool() {
  let added = 0;
  for (let i = 0; i < 4; i++) {
    if (liveOffspringSelected[i] && liveOffspring && liveOffspring[i]) {
      pool.push(withMeta(liveOffspring[i]));
      added++;
    }
  }
  if (added > 0) {
    for (const p of selectedParents) p.selectCount = (p.selectCount || 0) + 1;
    enforceCapacity(GRID_COLS * GRID_ROWS, selectedParents);
    gen++;
    console.log(`Added ${added} patterns to the pool`);
    liveOffspring = buildOffspringPreview();
    liveOffspringSelected = [false, false, false, false];
  } else {
    liveOffspring = buildOffspringPreview();
    liveOffspringSelected = [false, false, false, false];
  }
}

function enforceCapacity(capacity, preserveList = []) {
  if (pool.length <= capacity) return;
  const toRemove = pool.length - capacity;
  const preserve = new Set(preserveList);
  const candidates = pool.filter(g => !preserve.has(g));
  candidates.sort((a, b) => {
    const ca = (a.selectCount || 0) - (b.selectCount || 0);
    if (ca !== 0) return ca;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  let removed = 0;
  for (let i = 0; i < candidates.length && removed < toRemove; i++) {
    const g = candidates[i];
    const idx = pool.indexOf(g);
    if (idx >= 0) { pool.splice(idx, 1); removed++; }
  }
  if (removed < toRemove) {
    pool.sort((a, b) => {
      const ca = (a.selectCount || 0) - (b.selectCount || 0);
      if (ca !== 0) return ca;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    pool.splice(0, toRemove - removed);
  }
}
