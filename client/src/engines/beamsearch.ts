import { Shogi, IMove, Color, Kind, Piece } from 'shogi.js';
import type { AIResult, AIMove } from '../types';
import { getAllLegalMoves } from '../common';
import type { LearningState } from '../learning/types';
import { calcPenalty } from '../learning/positionPenalty';
import { getHistoryScore } from '../learning/historyTable';

// --- AI Logic (Beam Search) ---

const BEAM_WIDTH = 5;
const BEAM_DEPTH = 4;

interface BeamNode {
    sfen: string;
    firstMove: AIMove;
    score: number;
}

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
      let value = getPieceValue(piece.kind);

      const promotedPieces: Kind[] = ['TO', 'NY', 'NK', 'NG', 'UM', 'RY'];
      if (promotedPieces.includes(piece.kind)) {
        value += 2;
      }

      if ((piece.kind === 'HI' || piece.kind === 'KA') &&
          x >= 4 && x <= 6 && y >= 4 && y <= 6) {
        value += 2;
      }

      if (piece.kind === 'FU') {
        if (piece.color === Color.Black) {
          value += (10 - y) * 0.1;
        } else {
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

  if (shogi.isCheck(Color.White)) score += 50;
  if (shogi.isCheck(Color.Black)) score -= 50;

  if (state?.options.usePositionPenalty) {
    const sfen = shogi.toSFENString();
    const isBlackTurn = shogi.turn === Color.Black;
    score += calcPenalty(state.visitedPositions, sfen, isBlackTurn, state.options.penaltyWeight);
  }

  return score;
}

export function findBestMove(shogi: Shogi, learningState: LearningState | null = null): AIResult {
    const initialTurn = shogi.turn;
    const legalMoves = getAllLegalMoves(shogi);

    if (legalMoves.length === 0) {
        return { move: null, score: 0 };
    }

    let currentBeam: BeamNode[] = [];

    for (const move of legalMoves) {
        const tempShogi = new Shogi();
        tempShogi.initializeFromSFENString(shogi.toSFENString());

        let shouldPromote = false;
        if (move.from) {
            const canPromote = (Shogi["getIllegalUnpromotedRow"](tempShogi.get(move.from.x, move.from.y).kind, tempShogi.turn, move.to.y) || Shogi["getIllegalUnpromotedRow"](tempShogi.get(move.from.x, move.from.y).kind, tempShogi.turn, move.from.y));
            if (tempShogi.turn === Color.Black) {
                shouldPromote = canPromote && (move.to.y <= 3 || move.from.y <= 3);
            } else {
                shouldPromote = canPromote && (move.to.y >= 7 || move.from.y >= 7);
            }
            tempShogi.move(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote);
        } else {
            tempShogi.drop(move.to.x, move.to.y, move.kind!);
        }

        const score = evaluate(tempShogi, learningState);
        currentBeam.push({
            sfen: tempShogi.toSFENString(),
            firstMove: { ...move, promote: shouldPromote },
            score: initialTurn === Color.Black ? score : -score,
        });
    }

    currentBeam.sort((a, b) => {
        const historyBonus = learningState?.options.useHistory
            ? getHistoryScore(learningState.historyTable, a.firstMove) - getHistoryScore(learningState.historyTable, b.firstMove)
            : 0;
        return (b.score - a.score) + historyBonus * 0.01;
    });
    currentBeam = currentBeam.slice(0, BEAM_WIDTH);

    for (let depth = 1; depth < BEAM_DEPTH; depth++) {
        const nextBeam: BeamNode[] = [];

        for (const node of currentBeam) {
            const tempShogi = new Shogi();
            tempShogi.initializeFromSFENString(node.sfen);

            const moves = getAllLegalMoves(tempShogi);
            if (moves.length === 0) {
                nextBeam.push(node);
                continue;
            }

            for (const move of moves) {
                const nextShogi = new Shogi();
                nextShogi.initializeFromSFENString(node.sfen);

                let shouldPromote = false;
                if (move.from) {
                    const canPromote = (Shogi["getIllegalUnpromotedRow"](nextShogi.get(move.from.x, move.from.y).kind, nextShogi.turn, move.to.y) || Shogi["getIllegalUnpromotedRow"](nextShogi.get(move.from.x, move.from.y).kind, nextShogi.turn, move.from.y));
                    if (nextShogi.turn === Color.Black) {
                        shouldPromote = canPromote && (move.to.y <= 3 || move.from.y <= 3);
                    } else {
                        shouldPromote = canPromote && (move.to.y >= 7 || move.from.y >= 7);
                    }
                    nextShogi.move(move.from.x, move.from.y, move.to.x, move.to.y, shouldPromote);
                } else {
                    nextShogi.drop(move.to.x, move.to.y, move.kind!);
                }

                const score = evaluate(nextShogi, learningState);
                nextBeam.push({
                    sfen: nextShogi.toSFENString(),
                    firstMove: node.firstMove,
                    score: initialTurn === Color.Black ? score : -score,
                });
            }
        }

        nextBeam.sort((a, b) => {
            const historyBonus = learningState?.options.useHistory
                ? getHistoryScore(learningState.historyTable, a.firstMove) - getHistoryScore(learningState.historyTable, b.firstMove)
                : 0;
            return (b.score - a.score) + historyBonus * 0.01;
        });
        currentBeam = nextBeam.slice(0, BEAM_WIDTH);
    }

    if (currentBeam.length === 0) {
        return { move: null, score: 0 };
    }

    const bestNode = currentBeam[0];
    return { move: bestNode.firstMove, score: bestNode.score };
}
