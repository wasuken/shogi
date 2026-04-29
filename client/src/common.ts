import { Shogi, IMove, Color, Piece, Kind } from 'shogi.js';
import type { AIResult, AIFunction, AIMove } from './types';

function hasNowhereToGo(move: AIMove, color: Color, pieceKind: Kind): boolean {
    if (move.promote) return false;
    if (color === Color.Black) {
        if ((pieceKind === 'FU' || pieceKind === 'KY') && move.to.y === 1) return true;
        if (pieceKind === 'KE' && (move.to.y === 1 || move.to.y === 2)) return true;
    } else { // Color.White
        if ((pieceKind === 'FU' || pieceKind === 'KY') && move.to.y === 9) return true;
        if (pieceKind === 'KE' && (move.to.y === 8 || move.to.y === 9)) return true;
    }
    return false;
}

function isInvalidDirection(move: AIMove, color: Color, pieceKind: Kind): boolean {
    if (!move.from) return false;  // 打ち手はチェック不要
    if (move.promote) return false; // 成り後はチェック不要

    const { from, to } = move;

    if (color === Color.Black) {
        if (pieceKind === 'FU' || pieceKind === 'KY') {
            return to.y >= from.y; // 上方向以外は不正
        }
        if (pieceKind === 'KE') {
            return !(to.y === from.y - 2 && Math.abs(to.x - from.x) === 1);
        }
    } else { // Color.White
        if (pieceKind === 'FU' || pieceKind === 'KY') {
            return to.y <= from.y; // 下方向以外は不正
        }
        if (pieceKind === 'KE') {
            return !(to.y === from.y + 2 && Math.abs(to.x - from.x) === 1);
        }
    }

    return false;
}

export function getAllLegalMoves(shogi: Shogi): AIMove[] {
    const pseudoLegal: AIMove[] = [];

    // Board moves
    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                const movesFromPiece = shogi.getMovesFrom(x, y) as AIMove[];
                pseudoLegal.push(...movesFromPiece.filter(move =>
                    !hasNowhereToGo(move, shogi.turn, piece.kind) &&
                    !isInvalidDirection(move, shogi.turn, piece.kind)
                ));
            }
        }
    }
    // Drop moves
    const dropMoves = shogi.getDropsBy(shogi.turn) as AIMove[];
    pseudoLegal.push(...dropMoves.filter(move => !hasNowhereToGo(move, shogi.turn, move.kind!)));

    // 王手放置フィルタ: 動かした後に自玉が王手されてる手を除外
    return pseudoLegal.filter(move => {
        let capturedKind: Kind | undefined = undefined;

        if (move.from) {
            // 移動先に駒があれば記録しておく（unmoveで戻すため）
            const captured = shogi.get(move.to.x, move.to.y);
            capturedKind = captured?.kind;
            shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
        } else {
            shogi.drop(move.to.x, move.to.y, move.kind!);
        }

        // 動かした後は手番が変わっているので、前の手番(=自分)で王手チェック
        const currentTurn = shogi.turn;
        const myColor = currentTurn === Color.Black ? Color.White : Color.Black;
        const inCheck = shogi.isCheck(myColor);

        // 手を戻す
        if (move.from) {
            shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, move.promote, capturedKind);
        } else {
            shogi.undrop(move.to.x, move.to.y);
        }

        return !inCheck;
    });
}
