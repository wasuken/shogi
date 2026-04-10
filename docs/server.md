# サーバー (server)

## 概要

`server`は、将棋の対局を管理し、結果をデータベースに保存するためのバックエンドAPIサーバーです。Node.jsで構築されており、Webフレームワークとして[Hono](https://hono.dev/)を使用しています。

AIクライアントからのリクエストを受け付け、ゲームの進行を管理し、対局が終了するとその結果をMySQLデータベースに記録します。

## 主な技術スタック

- **ランタイム:** Node.js 20
- **フレームワーク:** Hono
- **データベース:** mysql2 (MySQL 8.4)
- **将棋エンジン:** shogi.js
- **バリデーション:** Zod

## APIエンドポイント

サーバーは以下のRESTful APIを提供します。

### `POST /games`

新しい対局を開始します。

- **リクエストボディ:**
  ```json
  {
    "client1Name": "string",
    "client2Name": "string"
  }
  ```
- **レスポンス:**
  ```json
  {
    "gameId": "string" // 新しく作成されたゲームのUUID
  }
  ```

### `POST /games/:id/move`

指定されたゲームで手を指します。

- **URLパラメータ:**
  - `id`: ゲームID
- **リクエストボディ:**
  ```json
  {
    "move": "string", // CSA形式の指し手 (例: '7g7f', 'P*5e')
    "score": "number" // (任意) その手番での評価値
  }
  ```
- **レスポンス:**
  - **ゲーム続行中:**
    ```json
    {
      "status": "ok",
      "board": "string" // SFEN形式の現在の盤面
    }
    ```
  - **ゲーム終了時:**
    ```json
    {
      "status": "game_over",
      "winner": "b" | "w", // 勝者 (b: 先手, w: 後手)
      "gameId": "string"
    }
    ```

### `GET /api/battle-results`

すべての対局結果のリストを取得します。

- **レスポンス:** 対局結果の配列
  ```json
  [
    {
      "id": "string",
      "client1_name": "string",
      "client2_name": "string",
      "winner_name": "string",
      "total_moves": "number",
      "game_duration_ms": "number",
      "start_time": "string",
      "end_time": "string",
      // ...
    }
  ]
  ```

### `GET /api/stats/win-loss`

AIクライアントごとの勝敗統計を取得します。

- **レスポンス:** 統計情報の配列
  ```json
  [
    {
      "clientName": "string",
      "totalGamesPlayed": "number",
      "wins": "number",
      "losses": "number",
      "winRate": "number"
      // ...
    }
  ]
  ```

### `GET /api/battle-results/:id/csa`

指定されたIDの対局の棋譜をCSA形式で取得します。

### `GET /api/battle-results/:id/evaluations`

指定されたIDの対局の評価値の推移を取得します。

## データベース

`mysql`ディレクトリの`init.sql`で定義されたテーブル構造を使用します。主に`battle_results`テーブルに対局の詳細な記録が保存されます。

## ビルドと実行

### 開発環境

以下のコマンドで開発サーバーを起動します。ファイルの変更を監視し、自動的にリロードされます。

```bash
cd server
npm run dev
```

### 本番環境

`Dockerfile`を使用してコンテナイメージをビルドし、実行します。

1.  **ビルド:**
    ```bash
    # プロジェクトルートから
    docker-compose build server
    ```
2.  **実行:**
    `make up`コマンドで、`compose.yml`に基づいてサーバーが起動します。
    ```bash
    make up
    ```

サーバーはコンテナ内のポート`3000`で実行され、ホストのポート`3000`にマッピングされます。
