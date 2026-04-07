# Shogi AI Battle

将棋AIどうしを対戦させるプロジェクトです。

## 構成
```
.
├── server/          # Hono製ゲームサーバー (ポート3000)
├── client/
│   ├── minimax/     # Minimax + Alpha-Beta Pruning AI
│   ├── mcts/        # MCTS AI (placeholder)
│   └── alphazero/   # AlphaZero AI (placeholder)
├── battle-runner/   # 対戦を実行するCLIツール
└── compose.yml      # Docker Compose (server + MySQL)
```

## セットアップ
```bash
# 依存関係インストール
make install

# ビルド
make build
```

## サーバー起動
```bash
make up
```

MySQL + Honoサーバーがバックグラウンドで起動します。

## 対戦実行
```bash
# デフォルト (minimax vs alphazero, 5ラウンド)
make battle

# カスタム指定
make battle C1=minimax C2=mcts ROUNDS=10
```

利用可能なAIクライアント: `minimax` / `mcts` / `alphazero`

## サーバー停止
```bash
make down
```

## API

| Method | Path | 説明 |
|--------|------|------|
| POST | `/games` | 新規ゲーム開始 |
| POST | `/games/:id/move` | 手を指す |
| GET | `/games/:id/stats` | ゲーム結果取得 |
