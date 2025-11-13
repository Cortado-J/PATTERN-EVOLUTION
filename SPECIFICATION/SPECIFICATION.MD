Product name: "Orbifold Studio"

Browser-based MVP, all local storage.

Works with two sorts of Entities:
* Patterns which are one of the 17 wallpaper groups.
* Palettes which provide a number of colours which can be used in patterns

There are 5 modes:

* Pattern mode
Provides the 17 group buttons and a random button.
Clicking a group button generates a pattern of that group.
Clicking the random button generates a pattern of a random group.
The palette is chosen at random.
A Save Pattern button is avalable to save the pattern named by the date/time stamp.

* Palette mode
This provides a way to generate random palettes (OKLCH internal).
A list of palettes builds up.
You can either click a button to generate a new random palette
Or click on one of the exist palettes and you are given a choice of how to derive a new palette form the old palettes.
A Save Palette button is avalable to save the palette named by the date/time stamp.
For now we just want a holding screen.

* Training mode
Submode 1: Direct recognition: show pattern → pick 1 of 17 orbifold groups.
This has been developed already quite a bit already - with the training steps
Submode 2: Branching recognition: 3–4 logical steps (max rotation → mirrors → supplements).
This has not been develop yet and should be put on hold for now.
Feedback overlay (centres/mirrors); local stats (totals, streaks, per-group).
For now we just want a holding screen for submode 2.

* Game mode
Timed rounds (60–90 s), mixed prompt types, difficulty ramps.
Scoring: correct + streak + time bonus; local high scores.
For now we just want a holding screen.

* Gallery mode
Single list of saved Patterns + Palettes (no tags/rename yet).
Open Pattern → swap palette, adjust density/zoom, export.
Open Palette → set active, export. Delete items.
Exports (MVP): tile.svg (1 seamless tile, with preset), tile-4096.png, preview-3×3.png, preset.json.
Exports: palette.json (OKLCH + sRGB hex), palette.css (CSS vars).
For now we just want a holding screen.
