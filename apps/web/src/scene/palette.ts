/** Colours of the seasons and regions. */
import type { RegionKey } from '@power-tycoon/engine';

export interface Season {
  sky: [string, string];
  fields: string[];
  tree: string;
  snow?: boolean;
  cloud: number;
}

/** Q1 winter … Q4 autumn. */
export const SEASONS: Season[] = [
  { sky: ['#8fa6bd', '#dde5ec'], fields: ['#e6ecee', '#dce4e4', '#cfdad6'], tree: '#4e6358', snow: true, cloud: 6 },
  { sky: ['#4f9ede', '#d7eefb'], fields: ['#79b94c', '#93c955', '#e3cf37'], tree: '#2f7a34', cloud: 4 },
  { sky: ['#2f8bd8', '#cde9fa'], fields: ['#c9b54c', '#9dbb4a', '#d9a943'], tree: '#3f7428', cloud: 2 },
  { sky: ['#7f98b3', '#efd7b8'], fields: ['#9b7a4c', '#7f8a44', '#b58b52'], tree: '#b9652a', cloud: 5 },
];

/** Regions with their own field colours per season (otherwise the season's). */
export const FIELDS: Partial<Record<RegionKey, string[][]>> = {
  ib: [
    ['#a9ad63', '#bfae70', '#9c9f5a'],
    ['#bda95c', '#cdb56d', '#9fa257'],
    ['#d4a25b', '#dcb06c', '#c08e4c'],
    ['#bd955a', '#ae8c55', '#a39858'],
  ],
  al: [
    ['#eef3f5', '#e3eaec', '#d9e2e3'],
    ['#6fb34d', '#86c253', '#5fa446'],
    ['#78ad45', '#8fbb4c', '#6a9e3f'],
    ['#8f8a4a', '#a0833f', '#7d8747'],
  ],
};

/** Farm track colour [summer, winter] per land region. */
export const ROAD: Partial<Record<RegionKey, [string, string]>> = {
  nd: ['#c9b387', '#e9eef0'],
  ib: ['#dcc294', '#d2bf97'],
  al: ['#b9ac8b', '#f1f4f6'],
};

/** Player colours (CSS variables --c0 … --c3, read at runtime). */
export const DEFAULT_PLAYER_COLORS = ['#2F62D9', '#C2410C', '#008C85', '#B8860B'];
