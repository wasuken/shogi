# 環境構築ガイド

このドキュメントは、将棋AIプロジェクトのローカル開発環境をセットアップし、管理するための手順を説明します。

## 概要

プロジェクトはDockerを使用してコンテナ化されており、`docker-compose`によって各サービスが管理されます。主要な技術スタックは以下の通りです。

- **バックエンド:** Node.js, TypeScript, Express
- **フロントエンド:** React, TypeScript, Vite
- **データベース:** MySQL 8.4
- **その他:** Docker, Makefile

## Docker Composeによるサービス管理

`compose.yml`には、以下の4つのサービスが定義されています。

- `server`: 将棋の対局管理や棋譜の保存を行うAPIサーバーです。ホストのポート`3000`にマッピングされます。
- `dashboard`: 対局の可視化、統計情報などを表示するフロントエンドアプリケーションです。ホストのポート`8080`にマッピングされます。
- `db`: 対局結果などを保存するMySQLデータベースです。
- `phpmyadmin`: `db`サービスを管理するためのWebインターフェースです。ホストのポート`8081`にマッピングされます。

### サービスの起動と停止

プロジェクトのルートディレクトリで以下のコマンドを実行します。

```bash
# 全てのサービスをバックグラウンドで起動
make up

# 全てのサービスを停止
make down

# サービスのログを確認
make logs
```

## Makefileによるプロジェクト管理

`Makefile`には、開発を効率化するためのコマンドが定義されています。

- `make install`: `server`, `client/*`, `battle-runner`など、すべてのNode.jsプロジェクトのnpm依存関係をインストールします。
- `make build`: すべてのTypeScriptプロジェクトをJavaScriptにコンパイルします。
- `make battle`: 2つのAIクライアントを指定して対局シミュレーションを実行します。
  ```bash
  # 例: minimax vs alphazeroで10回対局
  make battle C1=minimax C2=alphazero ROUNDS=10
  ```
- `make clean`: ビルド成果物（`dist`ディレクトリ）を削除します。

## セットアップ手順

1.  **前提条件:**
    - Docker
    - Docker Compose
    - `make`コマンド

2.  **依存関係のインストール:**
    リポジトリをクローンした後、以下のコマンドを実行して、すべてのサブプロジェクトに必要なNode.jsモジュールをインストールします。
    ```bash
    make install
    ```

3.  **プロジェクトのビルド:**
    次に、すべてのTypeScriptコードをビルドします。
    ```bash
    make build
    ```

4.  **サービスの起動:**
    最後に、Dockerコンテナを起動します。
    ```bash
    make up
    ```

5.  **アクセス:**
    サービスが正常に起動すると、以下のアドレスにアクセスできます。
    - **ダッシュボード:** `http://localhost:8080`
    - **phpMyAdmin:** `http://localhost:8081`
      - サーバー: `db`
      - ユーザー名: `root`
      - パスワード: `rootpassword`

これで、開発環境のセットアップは完了です。
