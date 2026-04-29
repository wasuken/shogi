import type { Shogi } from 'shogi.js';
import type { AIMove, AIResult } from '../types';

export interface LearningState {
    visitedPositions: Map<string, number>;
    historyTable: number[][][][];
    killerTable: ([AIMove, AIMove] | [null, null])[];
    options: LearningOptions;
}

export interface LearningOptions {
    useHistory: boolean;
    usePositionPenalty: boolean;
    useKillerMove: boolean;
    penaltyWeight: number;
    historyMaxScore: number;
    maxKillerDepth: number;
}

export type PureEngineFunction = (shogi: Shogi, state: LearningState | null) => AIResult;
