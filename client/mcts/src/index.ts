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
