import { Shogi, Move } from 'shogi.js';

// --- AI Logic (Minimax with Alpha-Beta Pruning) ---

function getPieceValue(kind: string): number {
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
  // Simple evaluation: count pieces in hand. More sophisticated evaluation is needed for a real AI.
  let score = 0;
  for (const piece of shogi.getPiecesInHand('b')) {
    score += getPieceValue(piece.kind);
  }
  for (const piece of shogi.getPiecesInHand('w')) {
    score -= getPieceValue(piece.kind);
  }
  return score;
}

function minimax(shogi: Shogi, depth: number, alpha: number, beta: number, maximizingPlayer: boolean): { score: number, move: Move | null } {
  if (depth === 0 || shogi.isGameOver()) {
    return { score: evaluate(shogi), move: null };
  }

  const legalMoves = shogi.getMoves();
  let bestMove: Move | null = null;

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      const newShogi = shogi.clone();
      newShogi.move(move);
      const { score } = minimax(newShogi, depth - 1, alpha, beta, false);
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
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      const newShogi = shogi.clone();
      newShogi.move(move);
      const { score } = minimax(newShogi, depth - 1, alpha, beta, true);
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
export function findBestMove(shogi: Shogi): Move | null {
    const depth = 2; // Search depth
    const isMaximizing = shogi.turn === 'b';
    const { move } = minimax(shogi, depth, -Infinity, Infinity, isMaximizing);
    return move;
}
