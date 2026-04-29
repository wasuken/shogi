import { Shogi, IMove, Color, Kind, Piece } from 'shogi.js';
import type { AIResult, AIMove } from '../types';
import { getAllLegalMoves } from '../common';
import type { LearningState } from '../learning/types';
import { calcPenalty } from '../learning/positionPenalty';
import { addHistoryScore, getHistoryScore, orderByHistory } from '../learning/historyTable';
import { updateKiller, isKillerMove } from '../learning/killerMove';

// --- AI Logic (Negamax with Alpha-Beta Pruning) ---

function getPieceValue(kind: Kind): number {
    switch (kind) {
        case 'FU': return 1;
        case 'KY': return 3;
        case 'KE': return 3;
        case 'GI': return 5;
        case 'KI': return 6;
        case 'KA': return 8;
        case 'HI': return 9;
        case 'OU': return 1000;
        case 'TO': return 7;
        case 'NY': return 6;
        case 'NK': return 6;
        case 'NG': return 6;
        case 'UM': return 10;
        case 'RY': return 12;
        default: return 0;
    }
}

function evaluate(shogi: Shogi, state: LearningState | null): number {
  let score = 0;

  for (const piece of shogi.hands[Color.Black]) {
    score += getPieceValue(piece.kind);
  }
  for (const piece of shogi.hands[Color.White]) {
    score -= getPieceValue(piece.kind);
  }

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

  if (state?.options.usePositionPenalty) {
    const sfen = shogi.toSFENString();
    const isBlackTurn = shogi.turn === Color.Black;
    score += calcPenalty(state.visitedPositions, sfen, isBlackTurn, state.options.penaltyWeight);
  }

  return score;
}

function negamax(shogi: Shogi, depth: number, alpha: number, beta: number, state: LearningState | null): { score: number, move: AIMove | null } {
    const legalMoves = getAllLegalMoves(shogi);
    if (depth === 0 || legalMoves.length === 0) {
        const rawScore = evaluate(shogi, state);
        return { score: shogi.turn === Color.Black ? rawScore : -rawScore, move: null };
    }

    let bestMove: AIMove | null = legalMoves[0];
    let bestScore = -Infinity;

    let orderedMoves = [...legalMoves];
    if (state?.options.useHistory) {
        orderedMoves = orderByHistory(orderedMoves, state.historyTable);
    }
    if (state?.options.useKillerMove) {
        orderedMoves.sort((a, b) => {
            const aIsKiller = isKillerMove(state.killerTable, depth, a) ? 1 : 0;
            const bIsKiller = isKillerMove(state.killerTable, depth, b) ? 1 : 0;
            return bIsKiller - aIsKiller;
        });
    }

    for (const move of orderedMoves) {
        const captured = move.from ? shogi.get(move.to.x, move.to.y)?.kind : undefined;
        let shouldPromote = false;

        if (move.from) {
            const canPromote = (Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.to.y) || Shogi["getIllegalUnpromotedRow"](shogi.get(move.from.x, move.from.y).kind, shogi.turn, move.from.y));
            if (shogi.turn === Color.Black) {
                shouldPromote = canPromote && (move.to.y <= 3 || move.from.y <= 3);
            } else {
                shouldPromote = canPromote && (move.to.y >= 7 || move.from.y >= 7);
            }
            shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote);
        } else {
            shogi.drop(move.to.x, move.to.y, move.kind!);
        }

        const { score } = negamax(shogi, depth - 1, -beta, -alpha, state);
        const currentScore = -score;

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
        if (alpha >= beta) {
            if (state?.options.useHistory) {
                addHistoryScore(state.historyTable, move, depth, state.options.historyMaxScore);
            }
            if (state?.options.useKillerMove) {
                updateKiller(state.killerTable, depth, move);
            }
            break; // α-β枝刈り
        }
    }

    return { score: bestScore, move: bestMove };
}

export function findBestMove(shogi: Shogi, learningState: LearningState | null = null): AIResult {
    const depth = 2;
    const { move, score } = negamax(shogi, depth, -Infinity, Infinity, learningState);
    return { move, score };
}
