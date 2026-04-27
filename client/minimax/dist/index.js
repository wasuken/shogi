"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBestMove = findBestMove;
const shogi_js_1 = require("shogi.js");
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
// --- AI Logic (Minimax with Alpha-Beta Pruning) ---
function getPieceValue(kind) {
    // Simplified piece values
    switch (kind) {
        case 'FU': return 1;
        case 'KY': return 3;
        case 'KE': return 3;
        case 'GI': return 5;
        case 'KI': return 6;
        case 'KA': return 8;
        case 'HI': return 9;
        case 'OU': return 1000;
        default: return 0;
    }
}
function evaluate(shogi) {
    // Simple evaluation: count pieces in hand.
    let score = 0;
    for (const piece of shogi.hands[shogi_js_1.Color.Black]) {
        score += getPieceValue(piece.kind);
    }
    for (const piece of shogi.hands[shogi_js_1.Color.White]) {
        score -= getPieceValue(piece.kind);
    }
    return score;
}
function minimax(shogi, depth, alpha, beta, maximizingPlayer) {
    var _a, _b;
    const legalMoves = getAllLegalMoves(shogi);
    if (depth === 0 || legalMoves.length === 0) {
        return { score: evaluate(shogi), move: null };
    }
    let bestMove = legalMoves[0] || null;
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of legalMoves) {
            const capturedPiece = move.from ? (_a = shogi.get(move.to.x, move.to.y)) === null || _a === void 0 ? void 0 : _a.kind : undefined;
            let shouldPromote = false;
            if (move.from) {
                const canPromote = (shogi_js_1.Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.to.y) || shogi_js_1.Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.from.y));
                shouldPromote = canPromote && (move.to.y <= 3 || move.from.y <= 3);
                shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote);
            }
            else {
                shogi.drop(move.to.x, move.to.y, move.kind);
            }
            const { score } = minimax(shogi, depth - 1, alpha, beta, false);
            if (move.from) {
                shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote, capturedPiece);
            }
            else {
                shogi.undrop(move.to.x, move.to.y);
            }
            if (score > maxEval) {
                maxEval = score;
                bestMove = move;
            }
            alpha = Math.max(alpha, score);
            if (beta <= alpha) {
                break; // Beta cutoff
            }
        }
        return { score: maxEval, move: bestMove };
    }
    else { // Minimizing player
        let minEval = Infinity;
        for (const move of legalMoves) {
            const capturedPiece = move.from ? (_b = shogi.get(move.to.x, move.to.y)) === null || _b === void 0 ? void 0 : _b.kind : undefined;
            let shouldPromote = false;
            if (move.from) {
                const canPromote = (shogi_js_1.Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.to.y) || shogi_js_1.Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.from.y));
                shouldPromote = canPromote && (move.to.y >= 7 || move.from.y >= 7);
                shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote);
            }
            else {
                shogi.drop(move.to.x, move.to.y, move.kind);
            }
            const { score } = minimax(shogi, depth - 1, alpha, beta, true);
            if (move.from) {
                shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote, capturedPiece);
            }
            else {
                shogi.undrop(move.to.x, move.to.y);
            }
            if (score < minEval) {
                minEval = score;
                bestMove = move;
            }
            beta = Math.min(beta, score);
            if (beta <= alpha) {
                break; // Alpha cutoff
            }
        }
        return { score: minEval, move: bestMove };
    }
}
/**
 * AI a-la Minimax.
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available.
 */
function findBestMove(shogi) {
    const depth = 2; // Search depth
    const isMaximizing = shogi.turn === shogi_js_1.Color.Black;
    // Create a new Shogi instance to not modify the original
    const shogiCopy = new shogi_js_1.Shogi();
    shogiCopy.initializeFromSFENString(shogi.toSFENString());
    shogiCopy.turn = shogi.turn;
    const { move, score } = minimax(shogiCopy, depth, -Infinity, Infinity, isMaximizing);
    return { move, score };
}
