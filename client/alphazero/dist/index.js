"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBestMove = findBestMove;
// --- Helper function to get all legal moves ---
function getAllLegalMoves(shogi) {
    const moves = [];
    // Board moves
    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                // Note: This gets pseudo-legal moves. It doesn't check for checks.
                moves.push(...shogi.getMovesFrom(x, y));
            }
        }
    }
    // Drop moves
    // Note: This gets pseudo-legal moves. It doesn't check for nifu (two pawns in a file).
    moves.push(...shogi.getDropsBy(shogi.turn));
    return moves;
}
/**
 * AI a-la AlphaZero (placeholder).
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available.
 */
function findBestMove(shogi) {
    // console.log("AlphaZero logic not implemented. Picking a random move.");
    const legalMoves = getAllLegalMoves(shogi);
    if (legalMoves.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[randomIndex];
}
