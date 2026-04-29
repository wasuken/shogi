import { withLearning } from './wrapper';
import { findBestMove as engine } from './engines/negamax';

const learnedAI = withLearning(engine);

export const findBestMove = learnedAI;
export const resetState = learnedAI.resetState;
