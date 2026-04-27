import { Shogi, IMove, Color } from 'shogi.js';
import type { AIResult } from '../../../shared/types';

// --- Helper function to get all legal moves ---

function getAllLegalMoves(shogi: Shogi): IMove[] {
    const pseudoLegalMoves: IMove[] = [];
    // Board moves
    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                pseudoLegalMoves.push(...shogi.getMovesFrom(x, y));
            }
        }
    }
    // Drop moves
    pseudoLegalMoves.push(...shogi.getDropsBy(shogi.turn));

    const legalMoves: IMove[] = [];
    for (const move of pseudoLegalMoves) {
        // Create a deep copy of the shogi object
        const tempShogi = new Shogi({ preset: 'HIRATE' }); // Use HIRATE as the base
        tempShogi.initializeFromSFENString(shogi.toSFENString());

        try {
            if (move.from) {
                tempShogi.move(move.from.x, move.from.y, move.to.x, move.to.y);
            } else {
                if (!move.kind) {
                    throw new Error("Drop move is missing 'kind' property from AI.");
                }
                tempShogi.drop(move.to.x, move.to.y, move.kind);
            }

            // After applying the move, check if the current player's king is in check
            if (!tempShogi.isCheck(shogi.turn)) {
                legalMoves.push(move);
            }
        } catch (e) {
            // If the move itself is illegal (e.g., moving from an empty square),
            // shogi.move or shogi.drop will throw an error. We just ignore such moves.
        }
    }
    return legalMoves;
}


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
