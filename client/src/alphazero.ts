import { Shogi } from 'shogi.js';
import type { AIResult } from './types';
import { getAllLegalMoves } from './common';

/**
 * AI a-la AlphaZero (placeholder).
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available, along with a score.
 */
export function findBestMove(shogi: Shogi): AIResult {
    console.log("AlphaZero: findBestMove called.");
    console.log("AlphaZero: Current SFEN:", shogi.toSFENString());
    const legalMoves = getAllLegalMoves(shogi);
    console.log("AlphaZero: Legal moves count:", legalMoves.length);
    console.log("AlphaZero: Legal moves:", legalMoves);

    if (legalMoves.length === 0) {
        console.log("AlphaZero: No legal moves found. Returning null move.");
        return { move: null, score: 0 };
    }
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    console.log("AlphaZero: Returning random move:", legalMoves[randomIndex]);
    return { move: legalMoves[randomIndex], score: 0 };
}
