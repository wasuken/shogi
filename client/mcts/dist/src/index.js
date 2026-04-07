"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBestMove = findBestMove;
/**
 * AI a-la MCTS (placeholder).
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available.
 */
function findBestMove(shogi) {
    // console.log("MCTS logic not implemented. Picking a random move.");
    const legalMoves = shogi.getMoves();
    if (legalMoves.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[randomIndex];
}
