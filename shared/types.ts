import type { Shogi, Kind } from 'shogi.js';

export interface Coordinate {
  x: number;
  y: number;
}

export interface AIMove {
  from?: Coordinate;
  to: Coordinate;
  promote?: boolean;
  kind?: Kind;
}

export interface AIResult {
  move: AIMove | null;
  score: number;
}

export type AIFunction = (shogi: Shogi) => AIResult;
