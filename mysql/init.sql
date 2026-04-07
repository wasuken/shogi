CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(36) PRIMARY KEY,
  winner VARCHAR(255),
  moves INT,
  ai_type VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  game_record JSON
);

CREATE TABLE IF NOT EXISTS battle_results (
  id VARCHAR(36) PRIMARY KEY,
  client1_name VARCHAR(255) NOT NULL,
  client2_name VARCHAR(255) NOT NULL,
  winner_name VARCHAR(255) NULL,
  total_moves INT NOT NULL,
  game_duration_ms INT NOT NULL,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME NULL,
  game_record_csa TEXT NULL
);
