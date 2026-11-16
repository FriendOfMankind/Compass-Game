// Constellation stick figures for the asterisms the game teaches (DESIGN §3).
// Pairs of Hipparcos IDs, resolved from HYG by Bayer designation. Every HIP here
// must exist in stars.json (mag ≤ 5); tests/astro.test.ts checks that.

export interface Constellation { id: string; name: string; lines: [number, number][]; }

export const CONSTELLATIONS: readonly Constellation[] = [
  {
    id: 'UMa', name: 'Big Dipper',
    // Alkaid–Mizar–Alioth–Megrez–Phecda–Merak–Dubhe–Megrez
    lines: [[67301, 65378], [65378, 62956], [62956, 59774], [59774, 58001], [58001, 53910], [53910, 54061], [54061, 59774]],
  },
  {
    id: 'UMi', name: 'Little Dipper',
    // Polaris–Yildun–ε–ζ–Kochab–Pherkad–η–ζ
    lines: [[11767, 85822], [85822, 82080], [82080, 77055], [77055, 72607], [72607, 75097], [75097, 79822], [79822, 77055]],
  },
  {
    id: 'Cas', name: 'Cassiopeia',
    // The W: Segin–Ruchbah–Cih–Schedar–Caph
    lines: [[8886, 6686], [6686, 4427], [4427, 3179], [3179, 746]],
  },
  {
    id: 'Cru', name: 'Southern Cross',
    // Long axis Gacrux–Acrux (points at the south pole), cross bar Mimosa–Imai
    lines: [[61084, 60718], [62434, 59747]],
  },
  {
    id: 'Cen', name: 'The Pointers',
    // Rigil Kentaurus–Hadar
    lines: [[71683, 68702]],
  },
  {
    id: 'Ori', name: 'Orion',
    lines: [
      [27989, 25336], [27989, 26727], [25336, 25930], // shoulders, shoulders → belt
      [25930, 26311], [26311, 26727],                 // belt
      [26727, 27366], [25930, 24436],                 // belt → feet
      [27989, 26207], [25336, 26207],                 // head
    ],
  },
  {
    id: 'Sco', name: 'Scorpius',
    lines: [
      [78820, 78401], [78401, 78265], [78401, 80112], // head
      [80112, 80763], [80763, 81266], [81266, 82396], [82396, 82514], [82514, 82729],
      [82729, 84143], [84143, 86228], [86228, 87073], [87073, 86670], [86670, 85927], [85927, 85696],
    ],
  },
];
