import { Shogi, Move } from 'shogi.js';

/**
 * AI a-la AlphaZero (placeholder).
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available.
 */
export function findBestMove(shogi: Shogi): Move | null {
    // console.log("AlphaZero logic not implemented. Picking a random move.");
    const legalMoves = shogi.getMoves();
    if (legalMoves.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[randomIndex];
}