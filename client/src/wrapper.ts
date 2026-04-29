import type { Shogi } from 'shogi.js';
import type { AIResult, AIFunction } from './types';
import type { LearningOptions, LearningState, PureEngineFunction } from './learning/types';
import { createHistoryTable } from './learning/historyTable';
import { createKillerTable } from './learning/killerMove';
import { recordVisit } from './learning/positionPenalty';

export const DEFAULT_LEARNING_OPTIONS: LearningOptions = {
    useHistory: true,
    usePositionPenalty: true,
    useKillerMove: true,
    penaltyWeight: 300,
    historyMaxScore: 100000,
    maxKillerDepth: 10,
};

export interface LearnedAIFunction extends AIFunction {
    resetState: () => void;
}

export function withLearning(
    engine: PureEngineFunction,
    options: Partial<LearningOptions> = {}
): LearnedAIFunction {
    const mergedOptions: LearningOptions = { ...DEFAULT_LEARNING_OPTIONS, ...options };

    let state: LearningState = createState(mergedOptions);

    function createState(opts: LearningOptions): LearningState {
        return {
            visitedPositions: new Map(),
            historyTable: createHistoryTable(),
            killerTable: createKillerTable(opts.maxKillerDepth),
            options: opts,
        };
    }

    const ai = Object.assign(
        (shogi: Shogi): AIResult => {
            const sfen = shogi.toSFENString();
            recordVisit(state.visitedPositions, sfen);
            state.killerTable = createKillerTable(mergedOptions.maxKillerDepth);
            return engine(shogi, state);
        },
        {
            resetState: () => {
                state = createState(mergedOptions);
            },
        }
    ) as LearnedAIFunction;

    return ai;
}
