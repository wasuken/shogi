import { withLearning } from './wrapper';
import { findBestMove as engine } from './engines/minimax_v2';

const learnedAI = withLearning(engine);

export const findBestMove = learnedAI;
export const resetState = learnedAI.resetState;
