import { Shogi, IMove, Color, Kind, Piece } from 'shogi.js';
import type { AIResult, AIMove } from './types';
import { getAllLegalMoves } from './common';

// --- AI Logic (Beam Search) ---

const BEAM_WIDTH = 5;   // 各深さで残す手の数
const BEAM_DEPTH = 4;   // 探索深さ

interface BeamNode {
    sfen: string;       // この局面のSFEN
    firstMove: AIMove;  // この局面に至った最初の手（ルートからの手）
    score: number;      // 評価値
}

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

/**
 * AI a-la Beam Search.
 * @param shogi The current game state.
 * @returns The best move found, or null if no moves are available.
 */
export function findBestMove(shogi: Shogi): AIResult {
    const initialTurn = shogi.turn;
    const legalMoves = getAllLegalMoves(shogi);

    if (legalMoves.length === 0) {
        return { move: null, score: 0 };
    }

    // 初期局面から全合法手を生成して評価
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

        const score = evaluate(tempShogi);
        currentBeam.push({
            sfen: tempShogi.toSFENString(),
            firstMove: { ...move, promote: shouldPromote },
            score: initialTurn === Color.Black ? score : -score,
        });
    }

    // 評価値でソートして上位 BEAM_WIDTH 手を残す
    currentBeam.sort((a, b) => b.score - a.score);
    currentBeam = currentBeam.slice(0, BEAM_WIDTH);

    // BEAM_DEPTH まで探索を繰り返す
    for (let depth = 1; depth < BEAM_DEPTH; depth++) {
        const nextBeam: BeamNode[] = [];

        for (const node of currentBeam) {
            const tempShogi = new Shogi();
            tempShogi.initializeFromSFENString(node.sfen);

            const moves = getAllLegalMoves(tempShogi);
            if (moves.length === 0) {
                // 合法手がない場合はこのノードをそのまま残す
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

                const score = evaluate(nextShogi);
                nextBeam.push({
                    sfen: nextShogi.toSFENString(),
                    firstMove: node.firstMove, // 最初の手を保持
                    score: initialTurn === Color.Black ? score : -score,
                });
            }
        }

        // 評価値でソートして上位 BEAM_WIDTH 手を残す
        nextBeam.sort((a, b) => b.score - a.score);
        currentBeam = nextBeam.slice(0, BEAM_WIDTH);
    }

    // 最終的に評価値が最高のノードの「最初の手」を返す
    if (currentBeam.length === 0) {
        return { move: null, score: 0 };
    }

    const bestNode = currentBeam[0];
    return { move: bestNode.firstMove, score: bestNode.score };
}
