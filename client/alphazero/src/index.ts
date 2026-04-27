import { Shogi, IMove, Color, type Kind } from 'shogi.js';
import type { AIResult } from '../../../shared/types';

// --- Helper function to get all legal moves ---

function getAllLegalMoves(shogi: Shogi): IMove[] {
    const pseudoLegal: IMove[] = [];

    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                pseudoLegal.push(...shogi.getMovesFrom(x, y));
            }
        }
    }
    pseudoLegal.push(...shogi.getDropsBy(shogi.turn));

    return pseudoLegal.filter(move => {
        let capturedKind: Kind | undefined = undefined;

        if (move.from) {
            const captured = shogi.get(move.to.x, move.to.y);
            capturedKind = captured?.kind;
            shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
        } else {
            shogi.drop(move.to.x, move.to.y, move.kind!);
        }

        const currentTurn = shogi.turn;
        const myColor = currentTurn === Color.Black ? Color.White : Color.Black;
        const inCheck = shogi.isCheck(myColor);

        if (move.from) {
            shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, move.promote, capturedKind);
        } else {
            shogi.undrop(move.to.x, move.to.y);
        }

        return !inCheck;
    });
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
