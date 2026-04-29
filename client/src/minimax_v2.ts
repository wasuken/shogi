import { Shogi, IMove, Color, Kind, Piece } from 'shogi.js';
import type { AIResult, AIMove } from './types';
import { getAllLegalMoves } from './common';

// --- AI Logic (Minimax with Enhanced Evaluation) ---

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
        case 'TO': return 7;  // 成歩（金と同じ）
        case 'NY': return 6;  // 成香
        case 'NK': return 6;  // 成桂
        case 'NG': return 6;  // 成銀
        case 'UM': return 10; // 馬（角より強い）
        case 'RY': return 12; // 龍（飛より強い）
        default: return 0;
    }
}

function evaluate(shogi: Shogi): number {
  let score = 0;

  // 持ち駒
  for (const piece of shogi.hands[Color.Black]) {
    score += getPieceValue(piece.kind);
  }
  for (const piece of shogi.hands[Color.White]) {
    score -= getPieceValue(piece.kind);
  }

  // 盤上の駒
  for (let x = 1; x <= 9; x++) {
    for (let y = 1; y <= 9; y++) {
      const piece = shogi.get(x, y);
      if (!piece) continue;
      let value = getPieceValue(piece.kind);

      // 成り駒ボーナス
      const promotedPieces: Kind[] = ['TO', 'NY', 'NK', 'NG', 'UM', 'RY'];
      if (promotedPieces.includes(piece.kind)) {
        value += 2;
      }

      // 駒の位置ボーナス
      // 飛車・角は中央（4〜6列、4〜6段）にいると +2
      if ((piece.kind === 'HI' || piece.kind === 'KA') &&
          x >= 4 && x <= 6 && y >= 4 && y <= 6) {
        value += 2;
      }

      // 歩は前進するほど +0.1
      if (piece.kind === 'FU') {
        if (piece.color === Color.Black) {
          // 先手の歩は y が小さいほど前進している（1が敵陣、9が自陣）
          value += (10 - y) * 0.1;
        } else {
          // 後手の歩は y が大きいほど前進している
          value += (y - 1) * 0.1;
        }
      }

      if (piece.color === Color.Black) {
        score += value;
      } else {
        score -= value;
      }
    }
  }

  // 王手ボーナス
  if (shogi.isCheck(Color.White)) score += 50;  // 後手玉に王手
  if (shogi.isCheck(Color.Black)) score -= 50;  // 先手玉に王手

  return score;
}

function minimax(shogi: Shogi, depth: number, alpha: number, beta: number, maximizingPlayer: boolean): { score: number, move: AIMove | null } {
  const legalMoves = getAllLegalMoves(shogi);
  if (depth === 0 || legalMoves.length === 0) {
    return { score: evaluate(shogi), move: null };
  }

  let bestMove: AIMove | null = legalMoves[0] || null;

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      const capturedPiece = move.from ? shogi.get(move.to.x, move.to.y)?.kind : undefined;
      let shouldPromote = false;
      if (move.from) {
        const canPromote = (Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.to.y) || Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.from.y));
        shouldPromote = canPromote && (move.to.y <= 3 || move.from.y <= 3);
        shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote);
      } else {
        shogi.drop(move.to.x, move.to.y, move.kind!);
      }

      const { score } = minimax(shogi, depth - 1, alpha, beta, false);

      if (move.from) {
        shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote, capturedPiece);
      } else {
        shogi.undrop(move.to.x, move.to.y);
      }

      if (score > maxEval) {
        maxEval = score;
        bestMove = { ...move, promote: shouldPromote };
      }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) {
        break; // Beta cutoff
      }
    }
    return { score: maxEval, move: bestMove };
  } else { // Minimizing player
    let minEval = Infinity;
    for (const move of legalMoves) {
        const capturedPiece = move.from ? shogi.get(move.to.x, move.to.y)?.kind : undefined;
        let shouldPromote = false;
        if (move.from) {
            const canPromote = (Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.to.y) || Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.from.y));
            shouldPromote = canPromote && (move.to.y >= 7 || move.from.y >= 7);
            shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote);
        } else {
            shogi.drop(move.to.x, move.to.y, move.kind!);
        }

        const { score } = minimax(shogi, depth - 1, alpha, beta, true);

        if (move.from) {
            shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote, capturedPiece);
        } else {
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
 * AI a-la Minimax with Enhanced Evaluation.
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available.
 */
export function findBestMove(shogi: Shogi): AIResult {
    const depth = 2; // Search depth
    const isMaximizing = shogi.turn === Color.Black;

    const { move, score } = minimax(shogi, depth, -Infinity, Infinity, isMaximizing);
    return { move, score };
}
