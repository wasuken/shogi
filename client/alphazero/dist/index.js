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
 * @returns The best move found, or null if no moves are available, along with a score.
 */
function findBestMove(shogi) {
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
