# Server GEMINI.md - 将棋サーバー仕様書（絶対遵守）

## 座標系（最重要・必ず読め）

shogi.jsの座標系はCSA表記と**一致している**。

| CSA表記 | shogi.js | 備考 |
|---------|----------|------|
| 1一 | x=1, y=1 | |
| 9九 | x=9, y=9 | |
| 2八(飛車) | x=2, y=8 | 確認済み |

**SFENの列はCSAと逆になる。**

| SFEN | CSA | shogi.js |
|------|-----|----------|
| 左端 | 9列 | x=9 |
| 右端 | 1列 | x=1 |

### 具体例

```
SFEN: 8k/7GG/...
k(後手玉) → CSA9一 → x=1, y=1
G(先手金) → CSA9二 → x=1, y=2
G(先手金) → CSA8二 → x=2, y=2
```

---

## CSA形式の手

```
+7776FU
↑      先手(+) or 後手(-)
 ↑↑    from列・行 (00=打ち手)
   ↑↑  to列・行
     ↑↑ 駒種
```

### 駒種一覧

| CSA | 駒 | 成り後CSA |
|-----|----|-----------|
| FU | 歩 | TO |
| KY | 香 | NY |
| KE | 桂 | NK |
| GI | 銀 | NG |
| KI | 金 | - |
| KA | 角 | UM |
| HI | 飛 | RY |
| OU | 玉 | - |

### 手の例

```
+7776FU  先手: 7七→7六 歩
-3334FU  後手: 3三→3四 歩
+0077KI  先手: 7七に金打ち
+2728TO  先手: 2七→2八 歩成
```

---

## getAllLegalMoves の仕様

shogi.jsの `getMovesFrom` は**擬似合法手**を返す。王手放置をチェックしない。

そのため `getAllLegalMoves` では以下のフィルタをかけている。

```typescript
// moveを試した後にisCheck(自分の色)でフィルタ
// moveの前に取られる駒のkindを保存してunmoveに渡す
const captured = shogi.get(move.to.x, move.to.y);
capturedKind = captured?.kind;
shogi.move(...);
const inCheck = shogi.isCheck(myColor);
shogi.unmove(..., capturedKind); // capturedKindを渡さないと駒が戻らない
```

**unmoveにcapturedKindを渡さないとバグる。絶対渡せ。**

---

## SFEN局面の作り方

詰み局面テスト用のSFEN確認済みリスト。

```
# 後手玉が詰んでいる局面(後手番)
8k/7GG/7G1/9/9/9/9/9/8K w - 1

# 詰み1手前(先手番)、+0083KIで詰み
8k/7GG/9/9/9/9/9/9/8K b G 1
```

局面を作る時は必ずnodeスクリプトで目視確認すること。

```bash
node --input-type=commonjs << 'EOF'
const {Shogi} = require('./node_modules/shogi.js/cjs/shogi.js');
const s = new Shogi();
s.initializeFromSFENString('ここにSFEN');
console.log(s.toCSAString());
EOF
```

---

## APIエンドポイント

### POST /games

**Request**

```json
{ "client1Name": "string", "client2Name": "string" }
```

**Response**

```json
{ "gameId": "string" }
```

---

### POST /games/:id/move

**Request**

```json
{ "move": "CSA形式の手", "score": "number(optional)" }
```

**Response (通常)**

```json
{ "status": "ok", "board": "SFEN文字列" }
```

**Response (終局)**

```json
{ "status": "game_over", "winner": "b or w", "gameId": "string" }
```

**Response (エラー)**

```
404: { "error": "Game not found" }
400: { "error": "エラーメッセージ" }
```

---

## 禁止事項

- SFENを目視確認せずにテストに使うな
- unmoveにcapturedKindを渡し忘れるな
- 座標系を独自解釈するな、必ずCSAと一致している
- shogi.jsのgetMovesFromを合法手と思うな、擬似合法手である
