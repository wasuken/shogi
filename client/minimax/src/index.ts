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


// --- AI Logic (Minimax with Alpha-Beta Pruning) ---

function getPieceValue(kind: Kind): number {
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

function evaluate(shogi: Shogi): number {
  // Simple evaluation: count pieces in hand.
  let score = 0;
  for (const piece of shogi.hands[Color.Black]) {
    score += getPieceValue(piece.kind);
  }
  for (const piece of shogi.hands[Color.White]) {
    score -= getPieceValue(piece.kind);
  }
  return score;
}

function minimax(shogi: Shogi, depth: number, alpha: number, beta: number, maximizingPlayer: boolean): { score: number, move: IMove | null } {
  const legalMoves = getAllLegalMoves(shogi);
  if (depth === 0 || legalMoves.length === 0) {
    return { score: evaluate(shogi), move: null };
  }

  let bestMove: IMove | null = legalMoves[0] || null;

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      const capturedPiece = move.from ? shogi.get(move.to.x, move.to.y)?.kind : undefined;
      if (move.from) {
        shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
      } else {
        shogi.drop(move.to.x, move.to.y, move.kind!);
      }

      const { score } = minimax(shogi, depth - 1, alpha, beta, false);

      if (move.from) {
        shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, move.promote, capturedPiece);
      } else {
        shogi.undrop(move.to.x, move.to.y);
      }

      if (score > maxEval) {
        maxEval = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) {
        break;
      }
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
        const capturedPiece = move.from ? shogi.get(move.to.x, move.to.y)?.kind : undefined;
        if (move.from) {
            shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
        } else {
            shogi.drop(move.to.x, move.to.y, move.kind!);
        }

        const { score } = minimax(shogi, depth - 1, alpha, beta, true);

        if (move.from) {
            shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, move.promote, capturedPiece);
        } else {
            shogi.undrop(move.to.x, move.to.y);
        }

        if (score < minEval) {
            minEval = score;
            bestMove = move;
        }
        beta = Math.min(beta, score);
        if (beta <= alpha) {
            break;
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
export function findBestMove(shogi: Shogi): AIResult {
    const depth = 2; // Search depth
    const isMaximizing = shogi.turn === Color.Black;
    // Create a new Shogi instance to not modify the original
    const shogiCopy = new Shogi();
    shogiCopy.initializeFromSFENString(shogi.toSFENString());
    shogiCopy.turn = shogi.turn;


    const { move, score } = minimax(shogiCopy, depth, -Infinity, Infinity, isMaximizing);
    return { move, score };
}