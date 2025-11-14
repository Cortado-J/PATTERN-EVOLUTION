Use OKLCH for picking and spacing. Use OKLab for math and distance. Here is a precise, generator-ready color module.

# Color schema

```json
{
  "palette": {
    "space": "OKLCH",              // or "OKLAB"
    "source": "named|procedural|image_sampled",
    "count": 5,
    "seed": 1234,
    "constraints": {
      "min_delta_oklab": 0.06,     // perceptual spacing threshold
      "min_delta_L": 0.06,         // OKLCH lightness spacing
      "min_delta_C": 0.04,         // OKLCH chroma spacing
      "min_delta_h_deg": 18,       // hue spacing in degrees
      "L_range": [0.35, 0.92],
      "C_range": [0.02, 0.32],
      "h_range": [0, 360]
    },
    "gamut_clip": "perceptual",    // perceptual | relative
    "quantize": null               // or an integer k for palette reduction
  },
  "color_symmetry": "none|perfect_k_color|anti_symmetry|coset_coloring",
  "assignment_rule": "by_orbit|by_wyckoff|by_cell_parity|distance_field|noise_band|random_seeded",
  "background": { "mode": "solid|gradient|texture_ref", "color": [L,C,h] },
  "contrast": { "min_wcag": 3.0 } // optional check against background
}
```

# Spaces

* **OKLab**: Cartesian. Components `(L, a, b)`. Good for distances and clustering.
* **OKLCH**: Polar. Components `(L, C, h)` with `h` in degrees. Good for palette design and constraints.

Typical safe working ranges in sRGB:

* `L`: 0.35 to 0.92 for UIs and prints.
* `C`: 0.02 to 0.32. True limit depends on `L` and `h`. See gamut clipping.
* `h`: 0 to 360. Wrap at 360.

# Algorithms

## 1) Gamut-safe OKLCH sample

1. Sample `(L, C, h)` from your ranges.
2. Convert to OKLab: `a = C cos h`, `b = C sin h`.
3. Convert to linear sRGB. If any channel is outside `[0,1]`, reduce `C` by bisection until valid.
4. Gamma-encode to sRGB.

This preserves hue and lightness while backing off saturation. Works well with OKLCH.

## 2) Even hue ring

* Fix `L0`, `C0`.
* Set hues using the golden angle: `h_i = (h0 + i*137.508) mod 360`.
* Clip with the sampler above.
* Enforce `min_delta_oklab` by farthest-point filtering.

Produces balanced categorical palettes.

## 3) Lightness ramp

* Fix `h0`, `C0`.
* Choose `L_i` as a monotone sequence within `L_range`.
* Good for ordered fills and backgrounds. Check WCAG contrast against background.

## 4) Farthest-point in OKLab

* Start with one seed color.
* Iteratively add the color that maximizes the minimum OKLab distance to existing colors.
* Enforce `min_delta_L` and `min_delta_C` as hard constraints.

Maximizes perceptual separation.

## 5) Image-sampled

* Sample many pixels. Convert to OKLab.
* K-means in OKLab.
* Sort by `L` or by angle `h`.
* Drop clusters with `C < 0.02` unless you want neutrals.

## 6) Procedural ramps

* Two anchors `(L1,C1,h1)` and `(L2,C2,h2)`.
* Interpolate in OKLab for smoothness.
* If you need constant chroma, interpolate in OKLCH and clip chroma with bisection.

# Color symmetry with wallpaper groups

## perfect_k_color

* Assign each orbit a palette index.
* All copies of the same orbit share the color.

## anti_symmetry

* Define an involution that swaps colors across a symmetry, e.g. mirrors swap palette pairs.
* Enforce `palette[i] ↔ palette[j]` on the chosen generators.

## coset_coloring

* Pick a subgroup `H` of the plane group `G`.
* Color each coset `gH` with a distinct color.
* Number of colors equals the index `[G:H]`.

These rules yield high-level structure consistent with symmetry.

# Assignment rules

* `by_orbit`: stable categorical coloring.
* `by_wyckoff`: color by site class.
* `by_cell_parity`: checkerboard or stripe via `(ix + iy) mod k`.
* `distance_field`: quantize SDF to a seed curve or boundary.
* `noise_band`: quantized fBm over the plane with a fixed seed.
* `random_seeded`: reproducible shuffle.

# Contrast and readability

* Compute WCAG contrast using sRGB relative luminance of the final clipped colors.
* Enforce `contrast.min_wcag` between fills and background and also between stroke and adjacent fill.
* If contrast fails, adjust `L` first, then reduce `C` if needed.

# Implementation details

## OKLab ⇄ sRGB math

OKLCH to OKLab:

```
a = C * cos(h_rad)
b = C * sin(h_rad)
```

OKLab to LMS’:

```
l_ =  L + 0.3963377774*a + 0.2158037573*b
m_ =  L - 0.1055613458*a - 0.0638541728*b
s_ =  L - 0.0894841775*a - 1.2914855480*b
LMS = (l_^3, m_^3, s_^3)
```

LMS to linear sRGB:

```
r =  4.0767416621*L -3.3077115913*M +0.2309699292*S
g = -1.2684380046*L +2.6097574011*M -0.3413193965*S
b = -0.0041960863*L -0.7034186147*M +1.7076147010*S
```

Gamma encode sRGB:

```
srgb(c) = 12.92*c     if c <= 0.0031308
srgb(c) = 1.055*c^(1/2.4) - 0.055 otherwise
```

Use the inverse matrices if you need sRGB to OKLab.

## Gamut clipping

* **perceptual**: reduce `C` by bisection with `L,h` fixed.
* **relative**: scale `(a,b)` by `k` so that the most out-of-range channel hits the boundary exactly.
  Perceptual looks better for large sets.

## Spacing checks

* OKLab distance `Δ = √((ΔL)^2 + (Δa)^2 + (Δb)^2)`.
* Start with `min_delta_oklab ≈ 0.06` for categorical sets.
* Increase to `0.10+` for small palettes that must be unmistakable.

## Hue wrap

* When enforcing `min_delta_h_deg`, use circular distance `min(|Δh|, 360−|Δh|)`.

## Color-blind safety

Optional. Penalize pairs whose simulated Deutan or Protan distance in OKLab drops below 0.04. If you skip simulation, avoid pairing low-C greens with reds near `h≈20–60°`.

# Recommended defaults

* `space`: OKLCH
* `count`: 6
* `L_range`: [0.45, 0.9]
* `C_range`: [0.06, 0.28]
* `min_delta_oklab`: 0.07
* `gamut_clip`: perceptual
* `assignment_rule`: by_orbit for categorical, noise_band for continuous shading
* `background`: L 0.98 C 0.01 h any, or L 0.08 C 0.02 for dark mode

# Example config

```json
{
  "palette": {
    "space": "OKLCH",
    "source": "procedural",
    "count": 6,
    "seed": 2025,
    "constraints": {
      "min_delta_oklab": 0.07,
      "min_delta_L": 0.05,
      "min_delta_C": 0.05,
      "min_delta_h_deg": 20,
      "L_range": [0.45, 0.9],
      "C_range": [0.06, 0.28]
    },
    "gamut_clip": "perceptual"
  },
  "color_symmetry": "perfect_k_color",
  "assignment_rule": "by_orbit",
  "background": { "mode": "solid", "color": [0.98, 0.01, 250] },
  "contrast": { "min_wcag": 3.0 }
}
```

If you want, I can supply a compact reference implementation for OKLCH sampling, clipping, and farthest-point palette generation.

My code will use a genome which is a shortish sequence of characters to represent the colours of the pattern. I need thorough control of the palette while being able to make it reproducible

Use a compact, versioned, URL-safe genome that deterministically expands to an OKLCH/OKLab palette. Encode only what you must: generation mode, a seed, a few fixed-point parameters, and optional explicit colors. Everything else is derived.

# Palette Genome v1 (PG1)

**Encoding:** pack bytes, add CRC-8, encode with Crockford Base32 (no O/I/L/U; case-insensitive; URL-safe).
**Determinism:** use SplitMix64 PRNG with the stored 64-bit seed.
**Spaces:** work in OKLab for math, expose/quantize in OKLCH.
**Gamut:** perceptual clipping by chroma bisection to sRGB.

## Byte layout (little-endian)

```
[0]   magic  = 0xB0        // “PG1”
[1]   version= 0x01
[2]   flags  = b0 space    // 0=OKLab, 1=OKLCH (recommended)
               b1 gamut    // 0=relative, 1=perceptual (recommended)
               b2..b3 rng  // 0=SplitMix64, 1=PCG32, else reserved
               b4..b7 mode // 0=RING, 1=RAMP, 2=FPS, 3=EXPL
[3]   k      = palette count (1..32)
[4..11] seed = uint64 (SplitMix64)
[12]  opt    = bitfield    // presence of optional blocks (bg, constraints, sort)
[13..] mode block          // variable length by mode
[..]  + optional blocks    // variable
[..]  crc8                  // polynomial 0x07 over all prior bytes
```

### Mode blocks

All color triples use fixed-point OKLCH with **24 bits per color**:

* L8: `round(L * 255)` for L∈[0,1]
* C7: `round((C / 0.36) * 127)` for C∈[0,0.36]  // safe upper bound for sRGB
* h9: `round((h / 360) * 511)` for h∈[0,360)

Pack as `[L8 | C7 | h9]` → exactly 3 bytes.

1. **RING** (even/cadenced hues around a ring)

```
[ L8 C7 h9 ]        // base (L0,C0,h0)
[ Δh_deg ]          // uint8, hue step; if 0 use golden angle 137.508°
[ jitter ]          // uint8, chroma jitter in “C ticks” (0..127), applied via PRNG
```

Decoding:

* If Δh_deg==0 → `h_i = (h0 + i*137.508) mod 360`.
* Else use Δh_deg.
* `L=L0, C=C0` for all i, then apply ±jitter/127 of C range with PRNG, clip gamut.

2. **RAMP** (two anchors, interpolate to k)

```
[ L8 C7 h9 ]  // anchor A
[ L8 C7 h9 ]  // anchor B
[ curve ]     // uint8: 0=linear in OKLab, 1=cosine ease, 2=cubic
```

Decoding:

* Convert A,B to OKLab. Interpolate t∈[0,1] at i/(k−1) using curve. Convert to OKLCH, clip.

3. **FPS** (farthest-point sampling in OKLab within a box)

```
[ Lmin8 Lmax8 Cmin7 Cmax7 hmin9 hmax9 ] // 6 bytes packed as fields
[ iters ]        // uint8: candidate multiplier (e.g., =4 means 4k candidates)
[ thr ]          // uint8: min Δ in OKLab scaled by 255 → Δ≈thr/255
```

Decoding:

* Generate candidates with PRNG uniform in ranges, clip to gamut.
* Start with one seed (first candidate), then add points that maximize min OKLab distance to selected, enforcing Δ≥thr until k colors.

4. **EXPL** (explicit colors; shortest but least flexible)

```
repeat k times: [ L8 C7 h9 ]   // k*3 bytes
```

### Optional blocks (gated by `opt` bits)

* **Background** (bit 0): `[ L8 C7 h9 ]`
* **Constraints** (bit 1): two bytes

  * `minΔ_oklab = b0` (≈ b0/255)
  * `minΔ_L     = b1` (≈ b1/255)
* **Sorting** (bit 2): one byte

  * 0=as generated, 1=sort by hue, 2=by L, 3=by C
* **Assignment hint** (bit 3): one byte

  * 0=none, 1=by_orbit, 2=by_wyckoff, 3=cell_parity, 4=noise_band

---

## Deterministic decode (pseudocode)

```python
def decode_palette(genome_b32):
    data = b32decode_crockford(genome_b32); assert crc8(data[:-1])==data[-1]
    magic,ver = data[0], data[1]; assert magic==0xB0 and ver==0x01
    flags = data[2]; space = flags&1; gamut = (flags>>1)&1
    rng_id = (flags>>2)&0b11; mode = (flags>>4)&0b1111
    k = max(1, min(32, data[3]))
    seed = read_u64(data, 4); rng = SplitMix64(seed)  # specified algorithm
    opt  = data[12]; p = 13
    if mode==RING:  L0,C0,h0 = read_OkLCH24(data,p); p+=3; dH=data[p]; p+=1; jit=data[p]; p+=1
    elif mode==RAMP: A=read_OkLCH24(...); B=read_OkLCH24(...); curve=data[p]; p+=1
    elif mode==FPS:  ranges=read_ranges(...); iters=data[p]; p+=1; thr=data[p]/255; p+=1
    elif mode==EXPL: colors=[read_OkLCH24(...)*k]
    # optional blocks ...
    # generate colors per mode into OKLab, enforce minΔ if present, then clip to sRGB with chosen gamut policy
    # return sRGB and OKLCH arrays + metadata
```

---

## Why this gives “thorough control” and reproducibility

* **Control:** choose mode per use case.

  * RING → categorical sets with even hue spacing.
  * RAMP → ordered gradients.
  * FPS → maximal perceptual separation inside a constrained box.
  * EXPL → exact colors when art-directed.
* **Compactness:** RING is 10 bytes payload; RAMP 13; FPS 14; EXPL ≈ 3k. Base32 inflates ×~1.6. Typical strings:

  * RING k=6: ~22–26 chars.
  * RAMP k=7: ~28–32 chars.
  * FPS k=8: ~30–34 chars.
* **Determinism:** seed + specified PRNG + fixed math path. No platform drift.
* **OKLCH/OKLab native:** store as OKLCH, compute in OKLab, clip perceptually.

---

## Sensible defaults

* space=OKLCH, gamut=perceptual, rng=SplitMix64.
* `k` in 5..8 for categorical; 9..12 for rich.
* RING: `(L0,C0)=(0.72,0.12)`, `Δh=0` (golden), `jitter=8`.
* RAMP: A=(0.18,0.04,240), B=(0.92,0.06,240), curve=OKLab linear.
* FPS ranges: `L∈[0.45,0.90]`, `C∈[0.06,0.28]`, `h∈[0,360)`, `thr≈0.06`, `iters=4`.

---

## Mutation and crossover (safe operators)

* **Neutral reorder:** rotate palette indices or sort by hue; keeps colors.
* **Small hue nudge:** ±1 in h9 (≈±0.7°).
* **Chroma nudge:** ±1 in C7 (≈±0.003 in C).
* **Lightness nudge:** ±1 in L8 (≈±0.004 in L).
* **RING:** tweak Δh by ±1°, or toggle golden angle; adjust jitter.
* **RAMP:** perturb anchors by one quantization step; switch curve.
* **FPS:** adjust `thr` by ±1, or ranges by one tick.
* **EXPL:** nudge individual triplets.

All mutations preserve determinism because the genome is the single source of truth.

---

## Example genomes (illustrative, not real CRC)

* **RING, k=6, golden angle, light theme bg**

```
B0-01-F1-06-  9E 37 4C 12 9A 55 01 6B-  07-   9A 30 1F-  00-  06-  80-  3C
→ “8D4Q-J2H7-6XRW-9F1C-7G”
```

* **RAMP, k=7, blue-grey UI scale**

```
magic/ver/flags/k/seed/opt/A/B/curve/bg/constraints/crc → Base32
→ “8D6K-3Z9M-1T5W-R7H2-0P”
```

Generate these from your encoder; keep a human-readable debug print that shows:

```
mode=RING k=6 seed=… L0=0.70 C0=0.14 h0=210 Δh=golden jitter=8
bg L=0.98 C=0.01 h=250
```

---

## Implementation notes to avoid drift

* Use the canonical OKLab matrices (Björn Ottosson, 2020).
* Clip by reducing **C** with bisection at fixed L,h; stop when linear sRGB ∈ [0,1].
* Distance: Euclidean in OKLab. Enforce `minΔ_oklab` after clipping.
* When sorting by hue, compute circular order from `atan2(b,a)`; tie-break by L then C.
* Always return both sRGB and OKLCH to the renderer for precise stroke/fill logic.

If you want, I can draft encode/decode reference code and a Base32 implementation that matches these bit widths exactly.

Your last reply uses loads of jargon and shorthand. Please explain for someone new to colour

You need three ideas and one simple “recipe” string.

# The three ideas

1. **OKLCH**

* L = lightness (0=black, 1=white).
* C = chroma (0=grey, higher=saturated).
* h = hue angle (0–360°, red→yellow→green→blue→red).
  Use OKLCH to *pick* colors.

2. **OKLab**
   A Cartesian version of the same space. Good for distance and mixing.
   Use OKLab to *measure* differences and to *interpolate*.

3. **Gamut**
   Some OKLCH colors can’t be shown in sRGB. If a color is out of range, reduce **C** until it fits. Keep L and h the same.

# What to store for reproducible palettes

Store a short text “recipe” with:

* a **mode** (how to build the palette),
* a **count** `k`,
* a few OKLCH numbers,
* a **seed** for randomness.
  Same recipe → same palette every time.

# Simple recipe format

Plain, URL-safe, easy to parse:

```
pg1;space=oklch;mode=<ring|ramp|maxsep|explicit>;k=<int>;
L=<0..1>;C=<0..0.36>;h=<0..360>;
seed=<base10>;
extras...
```

* `space=oklch` by default.
* Angles in degrees.
* If a field isn’t used by a mode, ignore it.

## Modes

**ring** – evenly spaced hues around a wheel. Good categorical palette.
Fields: `L,C,h` (start hue), `step=<deg|golden>`, optional `jitterC=<0..0.05>`.
Algorithm: hues = start then add `step` each time (or golden-angle 137.508°). Keep L and C fixed. Clip gamut by lowering C only.

**ramp** – gradient from A to B. Good ordered palette.
Fields: `A=(L,C,h)`, `B=(L,C,h)`, optional `curve=<linear|cosine>`.
Algorithm: convert A,B to OKLab, interpolate `k` samples, convert back to OKLCH, then clip.

**maxsep** – maximally separated colors within ranges. Good when you want “all distinct”.
Fields: `Lrange=[Lmin,Lmax]`, `Crange=[Cmin,Cmax]`, `hrange=[hmin,hmax]`, `mindist=<0.06..0.12>`.
Algorithm: sample many candidates with the seed, keep adding the color that maximizes the minimum OKLab distance to the set, enforcing `mindist`, clip as you go.

**explicit** – you provide the exact list.
Fields: `colors=[(L,C,h), ...]`.
Algorithm: just clip any out-of-gamut color by reducing C.

# Examples

**1) Six evenly spaced pastels**

```
pg1;mode=ring;k=6;L=0.72;C=0.12;h=210;step=golden;seed=42
```

* Lightness fixed at 0.72, medium chroma 0.12.
* Hues spread by golden-angle.
* Deterministic because of `seed`.

**2) Seven blue-grey ramp for shading**

```
pg1;mode=ramp;k=7;A=(0.18,0.04,240);B=(0.92,0.06,240);curve=linear;seed=7
```

* Same hue, low chroma, lightness from dark to light.
* Good for depth or backgrounds.

**3) Eight high-contrast distinct colors**

```
pg1;mode=maxsep;k=8;Lrange=[0.45,0.9];Crange=[0.06,0.28];hrange=[0,360];
mindist=0.07;seed=2025
```

* Spreads colors so no two are too similar perceptually.

# How to assign colors in the pattern

Pick one. Keep it simple.

* `by_orbit`: each symmetry orbit gets a color `palette[orbit_id % k]`.
* `by_cell_parity`: `palette[(ix+iy) % k]` for checkerboards/stripes.
* `noise_band`: feed plane coords into noise, quantize to k bands.

# Guardrails that matter

* **Contrast:** if you need readability, set a minimum OKLab distance, or ensure WCAG contrast ≥ 3.0 against the background by adjusting **L** first.
* **Safe ranges:** start with `L∈[0.45,0.90]`, `C∈[0.06,0.28]`.
* **Hue wrap:** distance in hue is circular. Use `min(|Δh|, 360−|Δh|)`.
* **Color-blind risk:** avoid pairing low-chroma reds with greens; prefer separating by **L** as well as **h**.

# Minimal decode steps (one pass)

1. Parse the recipe.
2. Generate k colors per the mode using the PRNG seeded with `seed`.
3. For each color: if sRGB is out of range, reduce **C** until valid.
4. If `maxsep`: enforce the OKLab `mindist`.
5. Output both OKLCH and sRGB; render with sRGB.

# Defaults that work

* `space=oklch`
* `mode=ring`
* `k=6`
* `L=0.70` `C=0.12` `h=200` `step=golden` `seed=1`

If you want, give me one of your target looks (“soft pastels”, “bold primaries”, “moody dark”) and k. I will return a single recipe line you can drop in.

Yes. Do both. Define a **palette contract** you always satisfy, then build:

1. an **internal generator** that meets the contract, and
2. an **adapter** that pulls palettes from the web and reshapes them to the same contract.

# 1) Palette contract (what “harmonious” means for you)

Set these once, then enforce.

```json
{
  "k": 6,
  "space": "OKLCH",
  "L_range": [0.45, 0.90],
  "C_range": [0.06, 0.28],
  "min_delta_oklab": 0.07,              // perceptual separation
  "bg": { "L": 0.98, "C": 0.01, "h": 250 },
  "wcag_min": 3.0,                      // against bg for any stroke/fill you mark as “UI-critical”
  "order": "by_hue",                    // or by L
  "roles": ["bg","stroke","fill0","fill1","fill2","fill3","fill4","fill5"],
  "mapping": "by_orbit"                 // or cell_parity, noise_band
}
```

All generators and imports must pass: ranges, spacing, contrast, gamut clip.

# 2) Built-in harmony rules (deterministic, OKLCH)

Use one PRNG with a seed. Keep L/C in safe bands. Always clip by reducing C, not L.

* **Neutral ramp:** pick hue `h0`, small `C≈0.04–0.08`, set monotone `L` across range. Clean backgrounds.
* **Analogous ring:** center hue `h0`, step `±20–30°`, fixed `L≈0.70`, `C≈0.10–0.16`. Soft, cohesive.
* **Complementary split:** `{h0−30°, h0+30°, h0+180°}`; vary `L` high/low to separate. Bold accents.
* **Triadic:** `{h0, h0+120°, h0+240°}`; stagger `L` (e.g., 0.6, 0.75, 0.85). Vivid, balanced.
* **Tetradic:** rectangle on hue wheel; lower `C` to avoid clash; ensure `min_delta_L` between neighbors.
* **Accent + neutrals:** one higher-C accent (`C≈0.22`), rest low-C ramps for structure. Good default.

Implementation detail:

* Work in OKLab for interpolation and distance checks.
* Use farthest-point selection in OKLab to pick k from an oversampled candidate set while enforcing `min_delta_oklab`.

# 3) External palette adapter (safe substitution from any website)

Pipeline for `hex[]` → contract-compliant OKLCH:

1. **Parse and convert:** hex → OKLab/OKLCH.
2. **Deduplicate:** merge colors with OKLab distance `< 0.02`.
3. **Resize to k:**

   * If `n > k`: farthest-point downselect in OKLab.
   * If `n < k`: interpolate in OKLab along the palette’s principal curve or add lightness steps.
4. **Enforce ranges:** clamp `L` to `L_range`. Reduce `C` into `C_range` and sRGB gamut. Keep hue.
5. **Spacing:** run a pass to push pairs under `min_delta_oklab` apart by nudging `L` first, then `C`.
6. **Contrast:** if any role marked “stroke/UI” fails WCAG vs bg, raise `L` delta until it passes or mark “cannot adapt”.
7. **Order:** sort by hue or `L`, then map to `roles`.
8. **Report:** return adapted palette + a diff report: which colors clipped, merged, or inserted.

If a source is license-restricted, fetch by URL at runtime (user action) and store only your **adapted output** plus provenance metadata.

# 4) Minimal JS API (sketch)

Uses Color.js for conversions. Deterministic with a seed.

```js
import Color from "colorjs.io";

// PRNG
function splitmix64(seed) { let x = BigInt.asUintN(64, BigInt(seed));
  return () => { x += 0x9E3779B97F4A7C15n; let z = x; z = (z^(z>>30n))*0xBF58476D1CE4E5B9n;
    z = (z^(z>>27n))*0x94D049BB133111EBn; z ^= z>>31n;
    return Number(z & 0xFFFFFFFFFFFFFn) / 2**52; };
}

// Helpers
const hex2ok = hex => new Color(hex).to("oklch").coords;   // [L,C,h]
const ok2hex = oklch => new Color("oklch", oklch).to("srgb").toString({ format:"hex" });

// Generator: triadic example
export function genTriadic({k=6, L=0.7, C=0.12, h0=200, seed=1, contract}) {
  const rand = splitmix64(seed);
  const hues = [h0, h0+120, h0+240].map(h => (h+360)%360);
  const Ls = Array.from({length:k}, (_,i)=> contract.L_range[0] + i*(contract.L_range[1]-contract.L_range[0])/(k-1));
  // build candidates by cycling hues, pairing with Ls, fixed C
  let pal = Array.from({length:k}, (_,i)=> [Ls[i], C, hues[i % hues.length]]);
  pal = pal.map(ok => clipToSRGB(ok, contract));           // reduce C until in gamut
  pal = enforceSpacingOKLab(pal, contract.min_delta_oklab);
  return finalize(pal, contract);
}

// Adapter: external hex[]
export function adaptPalette(hexList, contract) {
  let pal = hexList.map(hex2ok);
  pal = dedupeOKLab(pal, 0.02);
  pal = resizeToK(pal, contract.k);                        // farthest-point or interpolate
  pal = pal.map(([L,C,h]) => [clamp(L, ...contract.L_range), C, h]);
  pal = pal.map(ok => clipToRangeAndSRGB(ok, contract));
  pal = enforceSpacingOKLab(pal, contract.min_delta_oklab);
  pal = ensureContrast(pal, contract);                     // adjust L vs bg if needed
  return finalize(pal, contract);
}
```

Implement `clipToSRGB`, `enforceSpacingOKLab`, `resizeToK`, `ensureContrast` as small, pure functions. Always reduce **C** first when clipping.

# 5) Slot-based mapping (stable substitution)

Define semantic slots so swaps don’t scramble intent:

```
slots: [ "anchor", "accent", "accent2", "neutralHi", "neutral", "neutralLo" ]
assignment:
  by_orbit: color = slots[ orbit_id % slots.length ]
  by_lod:   larger shapes → anchors/neutrals, small highlights → accents
```

External palettes fill slots after ordering by hue or lightness. If k differs, repeat or split slots deterministically.

# 6) Guardrails

* sRGB gamut: always clip by lowering C with L,h fixed.
* Color-blind safety: prefer differences in **L** as well as hue; avoid low-C red vs green pairs.
* Reproducibility: store `{contract_version, mode, seed, params, adapted_from:{source,url,hash}}`.
* Licensing: bundle open sets; for restricted sites, let users import on demand and keep only your adapted results.

# 7) Quick start presets

* **Default categorical:** triadic or analogous ring, `k=6`, `L≈0.70`, `C≈0.12`.
* **Data-density:** accent + neutrals (one high-C, five low-C ramps).
* **Dark theme:** same rules with `bg.L≈0.08`, ensure `min L` gaps ≥ 0.20 for strokes.

If you want, I can hand you ready-to-paste functions for `clipToSRGB`, `farthestPointOKLab`, and `ensureContrast` next.
