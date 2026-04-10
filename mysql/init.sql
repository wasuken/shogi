CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(36) PRIMARY KEY,
  winner VARCHAR(255),
  moves INT,
  ai_type VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  -- game_record JSON は消す
);

CREATE TABLE IF NOT EXISTS battle_results (
  id VARCHAR(36) PRIMARY KEY,
  client1_name VARCHAR(255) NOT NULL,
  client2_name VARCHAR(255) NOT NULL,
  winner_name VARCHAR(255) NULL,
  total_moves INT NOT NULL,
  game_duration_ms INT NOT NULL,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME NULL
  -- CSAもevaluationsも別テーブルへ
);

-- 棋譜（1試合に1レコード or 1手1レコード）
CREATE TABLE IF NOT EXISTS game_records (
  id VARCHAR(36) PRIMARY KEY,
  battle_result_id VARCHAR(36) NOT NULL,
  format VARCHAR(16) NOT NULL DEFAULT 'CSA', -- 将来KIF等も
  record_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (battle_result_id) REFERENCES battle_results(id)
);

-- 評価値（1手ごと or バッチごと）
CREATE TABLE IF NOT EXISTS move_evaluations (
  id VARCHAR(36) PRIMARY KEY,
  battle_result_id VARCHAR(36) NOT NULL,
  move_number INT NOT NULL,       -- 何手目か
  player VARCHAR(8) NOT NULL,     -- 'sente' | 'gote'
  score INT NOT NULL,             -- 評価値（先手視点の絶対値）
  evaluated_by VARCHAR(255),      -- どのAIが評価したか
  evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (battle_result_id) REFERENCES battle_results(id)
);
