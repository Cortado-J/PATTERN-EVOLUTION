// === wallpaper group specifications ===
// Defines lattice bases and symmetry generators for each wallpaper group.
const GROUP_SPECS = {
  // Hexagonal / triangular lattices
  "632": {                        // p6
    basis: [ {x: Math.sqrt(3), y: 0}, {x: Math.sqrt(3)/2, y: 1.5} ],
    compositionDepth: 2,
    generators: [
      { type: "rotation", order: 6, centers: [{u:0, v:0}] }
    ]
  },
  "*632": {                       // p6m
    basis: [ {x: Math.sqrt(3), y: 0}, {x: Math.sqrt(3)/2, y: 1.5} ],
    compositionDepth: 2,
    generators: [
      { type: "rotation", order: 6, centers: [{u:0, v:0}] },
      { type: "reflection", angle: 0,          offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/6,  offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/3,  offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/2,  offsets: [{u:0, v:0}] },
      { type: "reflection", angle: 2*Math.PI/3, offsets: [{u:0, v:0}] },
      { type: "reflection", angle: 5*Math.PI/6, offsets: [{u:0, v:0}] }
    ]
  },

  "333": {                        // p3
    basis: [ {x: 1, y: 0}, {x: 0.5, y: Math.sqrt(3)/2} ],
    generators: [
      { type: "rotation", order: 3, centers: [{u:0, v:0}] }
    ]
  },
  "*333": {                       // p3m1
    basis: [ {x: 1, y: 0}, {x: 0.5, y: Math.sqrt(3)/2} ],
    generators: [
      { type: "rotation", order: 3, centers: [{u:0, v:0}] },
      { type: "reflection", angle: 0,            offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/3,    offsets: [{u:0, v:0}] },
      { type: "reflection", angle: (2*Math.PI)/3, offsets: [{u:0, v:0}] }
    ]
  },
  "3*3": {                        // p31m
    basis: [ {x: 1, y: 0}, {x: 0.5, y: Math.sqrt(3)/2} ],
    generators: [
      { type: "rotation", order: 3, centers: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/6,      offsets: [{u: 1/3, v: 1/3}] },
      { type: "reflection", angle: Math.PI/2,      offsets: [{u: 1/3, v: 1/3}] },
      { type: "reflection", angle: 5*Math.PI/6,    offsets: [{u: 1/3, v: 1/3}] }
    ]
  },

  // Square lattices
  "442": {                        // p4
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "rotation", order: 4, centers: [{u:0, v:0}] }
    ]
  },
  "*442": {                       // p4m
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "rotation", order: 4, centers: [{u:0, v:0}] },
      { type: "reflection", angle: 0,           offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/4,   offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/2,   offsets: [{u:0, v:0}] },
      { type: "reflection", angle: 3*Math.PI/4, offsets: [{u:0, v:0}] }
    ]
  },
  "4*2": {                        // p4g
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    compositionDepth: 2,
    generators: [
      { type: "rotation", order: 4, centers: [{u:0, v:0}] },
      { type: "glide", angle: Math.PI/4,   offsets: [{u:0, v:0}, {u:0.5, v:0.5}], by: {u:0.5, v:0.5} },
      { type: "glide", angle: (3*Math.PI)/4, offsets: [{u:0, v:0}, {u:0.5, v:0.5}], by: {u:0.5, v:0.5} }
    ]
  },

  // Rectangular / centered-rectangular
  "2222": {                       // p2
    basis: [ {x:1, y:0}, {x:0.5, y:0.6} ],  // keep your oblique choice
    generators: [
      { type: "rotation", order: 2, centers: [{u:0, v:0}] }
    ]
  },
  "*2222": {                      // pmm
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "reflection", angle: 0,            offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/2,    offsets: [{u:0, v:0}] },
      { type: "rotation",  order: 2,             centers: [{u:0.5, v:0.5}] }
    ]
  },
  "2*22": {                       // cmm (diagonal mirrors)
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "reflection", angle: Math.PI/4,        offsets: [{u:0, v:0}] },
      { type: "reflection", angle: (3*Math.PI)/4,    offsets: [{u:0, v:0}] },
      { type: "rotation",  order: 2,                 centers: [{u:0.5, v:0}, {u:0, v:0.5}] }
    ]
  },
  "22*": {                        // pmg
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    compositionDepth: 2,
    generators: [
      { type: "reflection", angle: Math.PI/2, offsets: [{u:0, v:0}, {u:0.5, v:0.5}] },  // vertical mirrors at two parities
      { type: "glide",      angle: 0,         offsets: [{u:0, v:0}, {u:0, v:0.5}], by: {u:0.5, v:0} }, // horizontal glides at y=0 and y=b/2
      // 2-fold rotations will appear as compositions of vertical mirrors and horizontal glides
    ]
  },

  // Glide-only families and trivial
  "xx": {                         // pg
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "glide", angle: 0, offsets: [{u:0, v:0}, {u:0, v:0.5}], by: {u:0.5, v:0} }
    ]
  },
  "*x": {                         // cm
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    compositionDepth: 2,
    generators: [
      { type: "reflection", angle: Math.PI/2, offsets: [{u:0, v:0}] },       // vertical mirrors
      { type: "glide",      angle: 0,         offsets: [{u:0, v:0.5}], by: {u:0.5, v:0} } // horizontal glide mid-row
    ]
  },
  "**": {                         // pm
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "reflection", angle: Math.PI/2, offsets: [{u:0, v:0}] }
    ]
  },
  "22x": {                        // pgg
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    // Two perpendicular glides; their composition gives the 180° rotations.
    compositionDepth: 2,  // allow generator compositions up to length 2 to realize double-glide copies
    generators: [
      { type: "glide", angle: 0,           offsets: [{u:0, v:0}], by: {u:0.5, v:0} },     // horizontal
      { type: "glide", angle: Math.PI/2,   offsets: [{u:0, v:0}], by: {u:0, v:0.5} }      // vertical
    ]
  },
  "o": {                          // p1
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: []
  }
};

function getAvailableGroups() {
  return Object.keys(GROUP_SPECS);
}

function getGroupSpec(key) {
  if (GROUP_SPECS[key]) return GROUP_SPECS[key];
  return GROUP_SPECS["442"]; // fallback to square lattice
}
