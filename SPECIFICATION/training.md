# Wallpaper Group Training Program

## Goals
- Take a learner from zero knowledge to confident recognition of all wallpaper groups available in the app.
- Introduce symmetry concepts gradually: rotations → mirrors → glides → combined operations.
- Reinforce learning through interactive quizzes of 10 patterns with adaptive progression.
- Provide structured hints (rotational centres, mirror lines, glide axes) to build intuition instead of rote memorisation.

## Session Structure
Learners choose an entry lane on first launch:

1. **Guided Train Mode** (default): full curriculum described below.
2. **Practice Mode**: drills without walkthroughs; jumps straight to Stage 2 content with hints off by default, but unlockable per pattern.
3. **Challenge Mode**: expert-ready path; all 17 groups unlocked, strict timing, hints disabled unless the player burns a limited “lifeline”. Recommended for returning users.

Within Guided Train Mode, each session (~15–20 minutes) consists of:
1. **Concept primer** (1–2 minutes): short explanation and animated example of the focus symmetry.
2. **Guided spotting** (3–5 minutes): interactive patterns with live hints toggled on.
3. **Drill set** (10 patterns): user identifies groups without hints; hints available on demand.
4. **Review**: show score, highlight mistakes, surface targeted tips before moving on.

- **Scoring**: 10 patterns per drill. ≥8 correct advances to the next level, 6–7 repeats with reinforced hints, ≤5 triggers a remedial micro-lesson and a fresh draw.
- **Hints**: rotation markers (orange), mirror lines (cyan), glide axes (magenta). Unlock progressively; users can tap “Explain” after a miss to see how the symmetry manifests.

## Progression Overview
| Lane | Focus | Groups Introduced | Notes |
|------|-------|------------------|-------|
| Guided Train Mode | Structured onboarding | Introduced stage-by-stage (below) | Best for newcomers |
| Practice Mode | Rapid refresh | Stages 1–4 unlocked from start; Stage 5 after first clear | Hints off by default |
| Challenge Mode | Mastery gauntlet | All groups available immediately | Timed, adaptive, minimal scaffolding |

### Guided Train Mode Progression
| Stage | Focus | Groups Introduced | Levels |
|-------|-------|------------------|--------|
| Stage 0 | Orientation & controls | none (tutorial motifs only) | T0.1–T0.3 |
| Stage 1 | Introduction to Wallpaper groups | 333, *2222, o | I1.1-I1.3 |
| Stage 2 | Pure rotations | 632, 442, 333, 2222 | R2.1–R2.3 |
| Stage 3 | Mirrors aligned with lattice | **, *632, *442, *333, *2222 | M3.1–M3.4 |
| Stage 4 | Mirrors + 2-fold placements | 2*22, 4*2, 3*3, 22* | M4.1–M4.4 |
| Stage 5 | Glide reflections | o (baseline), *×, ××, 22× | G5.1–G5.4 |
| Stage 6 | Mixed mastery | all prior groups shuffled | X6.1–X6.3 |

## Stage Details

### Stage 0 — Orientation (T0.x)
- **Objective**: comfort with interface, understanding motifs vs. symmetry guides.
- **Activities**: walkthrough of enabling hints, interpreting rotation markers, recognising mirror lines.
- **Assessment**: n/a (advance automatically after tutorials).

### Stage 1 — INTRODUCTION TO WALLPAPER GROUPS (T1.x)
- **Objective**: familiarity with the idea of wallpaper groups.
- **Activities**: recognising simple patterns, spotting rotations or mirrors.
- **Assessment**: check simple recognition of simple symmetry features.

### Stage 2 — Rotational Symmetry (R2.x)
- **Groups**: 632, 442, 333, 2222.
- **Levels**:
  - *R2.1*: identify order by counting repeated petals with rotation hints enabled.
  - *R2.2*: mixed drill without hints; optional hint button reveals centres.
  - *R2.3*: timed challenge (60s) sampling all four groups.
- **Advancement**: ≥8/10, else repeat with extra guidance about rotation orders.

### Stage 3 — Mirror Families (M3.x)
- **Groups**: **, *632, *442, *333, *2222.
- **Concepts**: mirror lines perpendicular/parallel to lattice axes; interplay with rotation orders.
- **Levels**:
  - *M3.1*: practise spotting straight mirror lines using hints.
  - *M3.2*: mixed drill emphasising difference between pure mirror (**) and mirrors with rotations.
  - *M3.3*: timed drill (75s) with reduced hints.
  - *M3.4*: mastery quiz (10 patterns) without hints.
- **Remediation**: If failed twice, unlock side lesson illustrating mirror placement on simple tiled motifs.

### Stage 4 — Mirrors with Offset Rotations (M4.x)
- **Groups**: 2*22, 4*2, 3*3, 22*.
- **Concepts**: diagonal mirrors, multiple mirror sets, two-fold rotations on mirror lines, interplay with glides emerging from mirrors.
- **Levels**: similar structure to Stage 3 but emphasising comparison tasks (e.g., choose which of two patterns matches 22*).

### Stage 5 — Glide Reflection Families (G5.x)
- **Groups**: o (baseline translation), *×, ××, 22×.
- **Concepts**: recognising glide axes, differentiating glide-only vs mirror+glide systems, spotting brick offsets.
- **Levels**:
  - *G5.1*: start with o to reinforce translation-only baseline.
  - *G5.2*: introduce *× (cm) with glide hints shown.
  - *G5.3*: compare ×× (pg) vs. 22× (pgg) emphasising double glide intersections.
  - *G5.4*: cumulative quiz with hints disabled by default.

### Stage 6 — Mastery Circuits (X6.x)
- **Groups**: all previously introduced groups mixed.
- **Format**: three escalating circuits of 15 patterns each.
  - *X6.1*: hints available but cost time; scoreboard emphasises accuracy.
  - *X6.2*: no hints; includes timed streak bonuses.
  - *X6.3*: adaptive difficulty—incorrect answers reappear later until resolved.
- **Completion**: award “Wallpaper Adept” badge when a learner scores ≥85% across two consecutive circuits.

## Adaptive Progression Rules
- If a learner fails a level twice consecutively, auto-insert a micro-lesson:<br>
  *Explain mode → highlight key features → practise with 3 guided patterns → retry quiz.*
- If a learner aces with 10/10 twice in a row, unlock a “Challenge Mode” variant (faster timer, more similar distractors).
- Track median response time per group; surface personalised tips (e.g., “Glide axes appear halfway between mirrored rows”).
- Practice Mode uses the same remediation rules but skips concept primers.
- Challenge Mode tracks streak length and accuracy; poor performance suggests dropping back into Practice Mode or Guided Train Mode.

## Next Steps
1. Convert this outline into config (modes, stages, levels, allowed groups).
2. Build onboarding flow that gives a user the choice of the three modes.
3. Implement Practice Mode first
