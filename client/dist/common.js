"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllLegalMoves = getAllLegalMoves;
const shogi_js_1 = require("shogi.js");
function hasNowhereToGo(move, color, pieceKind) {
    if (move.promote)
        return false;
    if (color === shogi_js_1.Color.Black) {
        if ((pieceKind === 'FU' || pieceKind === 'KY') && move.to.y === 1)
            return true;
        if (pieceKind === 'KE' && (move.to.y === 1 || move.to.y === 2))
            return true;
    }
    else { // Color.White
        if ((pieceKind === 'FU' || pieceKind === 'KY') && move.to.y === 9)
            return true;
        if (pieceKind === 'KE' && (move.to.y === 8 || move.to.y === 9))
            return true;
    }
    return false;
}
function getAllLegalMoves(shogi) {
    const pseudoLegal = [];
    // Board moves
    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                const movesFromPiece = shogi.getMovesFrom(x, y);
                pseudoLegal.push(...movesFromPiece.filter(move => !hasNowhereToGo(move, shogi.turn, piece.kind)));
            }
        }
    }
    // Drop moves
    const dropMoves = shogi.getDropsBy(shogi.turn);
    pseudoLegal.push(...dropMoves.filter(move => !hasNowhereToGo(move, shogi.turn, move.kind)));
    // 王手放置フィルタ: 動かした後に自玉が王手されてる手を除外
    return pseudoLegal.filter(move => {
        let capturedKind = undefined;
        if (move.from) {
            // 移動先に駒があれば記録しておく（unmoveで戻すため）
            const captured = shogi.get(move.to.x, move.to.y);
            capturedKind = captured === null || captured === void 0 ? void 0 : captured.kind;
            shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
        }
        else {
            shogi.drop(move.to.x, move.to.y, move.kind);
        }
        // 動かした後は手番が変わっているので、前の手番(=自分)で王手チェック
        const currentTurn = shogi.turn;
        const myColor = currentTurn === shogi_js_1.Color.Black ? shogi_js_1.Color.White : shogi_js_1.Color.Black;
        const inCheck = shogi.isCheck(myColor);
        // 手を戻す
        if (move.from) {
            shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, move.promote, capturedKind);
        }
        else {
            shogi.undrop(move.to.x, move.to.y);
        }
        return !inCheck;
    });
}
