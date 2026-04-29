import { Shogi, IMove, Color, Kind, Piece } from 'shogi.js';
import type { AIResult, AIMove } from './types';
import { getAllLegalMoves } from './common';

// --- AI Logic (Negamax with Alpha-Beta Pruning) ---

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
      const value = getPieceValue(piece.kind);
      if (piece.color === Color.Black) {
        score += value;
      } else {
        score -= value;
      }
    }
  }

  return score;
}

function negamax(shogi: Shogi, depth: number, alpha: number, beta: number): { score: number, move: AIMove | null } {
    const legalMoves = getAllLegalMoves(shogi);
    if (depth === 0 || legalMoves.length === 0) {
        // 現在の手番から見た評価値を返す
        const rawScore = evaluate(shogi);
        return { score: shogi.turn === Color.Black ? rawScore : -rawScore, move: null };
    }

    let bestMove: AIMove | null = legalMoves[0];
    let bestScore = -Infinity;

    for (const move of legalMoves) {
        const captured = move.from ? shogi.get(move.to.x, move.to.y)?.kind : undefined;
        let shouldPromote = false;

        // move を適用
        if (move.from) {
            const canPromote = (Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.to.y) || Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.from.y));
            // 先手（Black）は y <= 3 で成れる、後手（White）は y >= 7 で成れる
            if (shogi.turn === Color.Black) {
                shouldPromote = canPromote && (move.to.y <= 3 || move.from.y <= 3);
            } else {
                shouldPromote = canPromote && (move.to.y >= 7 || move.from.y >= 7);
            }
            shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote);
        } else {
            shogi.drop(move.to.x, move.to.y, move.kind!);
        }

        // 再帰（符号反転）
        const { score } = negamax(shogi, depth - 1, -beta, -alpha);
        const currentScore = -score;

        // unmove
        if (move.from) {
            shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote, captured);
        } else {
            shogi.undrop(move.to.x, move.to.y);
        }

        if (currentScore > bestScore) {
            bestScore = currentScore;
            bestMove = { ...move, promote: shouldPromote };
        }
        alpha = Math.max(alpha, currentScore);
        if (alpha >= beta) break; // α-β枝刈り
    }

    return { score: bestScore, move: bestMove };
}

/**
 * AI a-la Negamax.
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available.
 */
export function findBestMove(shogi: Shogi): AIResult {
    const depth = 2;
    const { move, score } = negamax(shogi, depth, -Infinity, Infinity);
    return { move, score };
}
