"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBestMove = findBestMove;
const common_1 = require("./common");
/**
 * AI a-la MCTS (placeholder).
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available, along with a score.
 */
function findBestMove(shogi) {
    // console.log("MCTS logic not implemented. Picking a random move.");
    const legalMoves = (0, common_1.getAllLegalMoves)(shogi);
    if (legalMoves.length === 0) {
        return { move: null, score: 0 };
    }
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    return { move: legalMoves[randomIndex], score: 0 };
}
