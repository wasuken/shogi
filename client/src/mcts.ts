import { Shogi } from 'shogi.js';
import type { AIResult } from './types';
import { getAllLegalMoves } from './common';

/**
 * AI a-la MCTS (placeholder).
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available, along with a score.
 */
export function findBestMove(shogi: Shogi): AIResult {
    // console.log("MCTS logic not implemented. Picking a random move.");
    const legalMoves = getAllLegalMoves(shogi);
    if (legalMoves.length === 0) {
        return { move: null, score: 0 };
    }
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    return { move: legalMoves[randomIndex], score: 0 };
}
