# PATTERN-EVOLUTION Copilot Instructions

## Project Overview
This is an interactive p5.js application for evolving mathematical wallpaper patterns through genetic algorithms. Users evolve patterns by mutation, combination, and selection across four wallpaper symmetry groups.

## Architecture & Key Components

### Core Pattern System
- **Genome Structure**: Each pattern is defined by a genome containing `group` (symmetry), `palette`, `motifScale`, `rotation`, `hueShift`, `numShapes`, and `shapes` array
- **Wallpaper Groups**: Four mathematical symmetry groups implemented: `632`, `442`, `333`, `2222` with distinct lattice functions
- **Shape Variants**: Five organic shape types (`petal`, `leaf`, `blade`, `drop`, `arc`) with parametric `curveBias` and `fatness`

### Evolution Engine
- **Mutation**: Small random adjustments to genome properties (hue shift ±10, scale 0.8-1.3x, 30% chance palette/group change)
- **Combination**: Crossover between two parent genomes, blending properties and randomly selecting shapes
- **Population**: Always maintains exactly 4 specimens displayed in quadrants

### UI State Management
- **Mode System**: Three interaction modes (`mutate`, `combine`, `random`) affect click behavior
- **Preview Flow**: Selection → preview → accept/reject → new generation (4 mutations of accepted pattern)
- **History**: Rolling 10-pattern history displayed as thumbnails below main quadrants

## Development Patterns

### p5.js Structure
- Single `sketch.js` file with global state variables
- `noLoop()` mode with explicit `redraw()` calls for performance
- Extensive use of `createGraphics()` for off-screen rendering and thumbnails

### Color Management
- Named palette system (`warm`, `cool`, `earth`, `vivid`) with 5-color arrays
- HSB color mode for hue shifting, RGB for final rendering
- Dynamic color variation: base palette + hue shift + random perturbation

### Mathematical Rendering
- Lattice functions return `createVector(x, y)` positions for pattern tiling
- Motif scaling factor (`motifScale`) determines pattern density
- Bézier curves define all organic shapes with parametric control points

## Key Implementation Details

### Wallpaper Lattice Calculations
```javascript
// Each group has distinct spacing and offset patterns
if (g.group === "632") lattice = (i, j) => createVector(i * a * sqrt(3) + (j % 2) * a * sqrt(3) / 2, j * a * 1.5);
```

### Genome Deep Cloning
Always use `structuredClone(genome)` for mutations to avoid reference sharing between population members.

### Canvas Layout
- Main canvas: 1000x1000px
- Quadrants: 500x350px each (top 70% of canvas)
- History: 100px height thumbnails (70-80% canvas height)
- Mode buttons: Bottom 10% of canvas

## Development Workflow
- **No build process**: Direct HTML file opening in browser
- **CDN dependency**: p5.js 1.7.0 loaded via CDN
- **Live development**: Refresh browser after editing `sketch.js`
- **Debugging**: Use browser dev tools; `console.log()` for genome inspection

## Testing Interactive Features
- Click quadrants to select patterns based on current mode
- Test all three evolution modes with different selection patterns
- Verify preview accept/reject flow generates proper new populations
- Check history thumbnail interaction and 10-item rolling limit