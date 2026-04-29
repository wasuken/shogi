import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Shogi, type IMove, Color, type Kind } from 'shogi.js';
import mysql from 'mysql2/promise'

export const app = new Hono()

// --- Database Connection ---
const pool = mysql.createPool({
  host: 'db',
  user: 'user',
  password: 'password',
  database: 'shogi',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- In-memory storage for ongoing games ---
interface GameState {
  shogi: Shogi;
  moves: string[];
  evaluations: (number | null)[];
  client1Name: string;
  client2Name: string;
  startTime: Date;
  endTime?: Date;
}
export const games = new Map<string, GameState>();

// --- Helper function to get all legal moves ---
export function getAllLegalMoves(shogi: Shogi): IMove[] {
    const pseudoLegal: IMove[] = [];

    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                pseudoLegal.push(...shogi.getMovesFrom(x, y));
            }
        }
    }
    pseudoLegal.push(...shogi.getDropsBy(shogi.turn));

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

// --- Shogi Logic ---
const getGame = (gameId: string) => {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }
  return game;
}

// --- Endpoints ---

const startGameSchema = z.object({
  client1Name: z.string(),
  client2Name: z.string(),
});

app.post('/games', zValidator('json', startGameSchema), (c) => {
  const { client1Name, client2Name } = c.req.valid('json');
  const gameId = crypto.randomUUID();
  const shogi = new Shogi();
  const startTime = new Date();
  games.set(gameId, { shogi, moves: [], evaluations: [], client1Name, client2Name, startTime });
  console.log(`Game started: ${gameId} (${client1Name} vs ${client2Name})`);
  return c.json({ gameId });
});

export function parseCsaMoveToIMove(csaMove: string): IMove {
    const fromCol = parseInt(csaMove[1]);
    const fromRow = parseInt(csaMove[2]);
    const toCol = parseInt(csaMove[3]);
    const toRow = parseInt(csaMove[4]);
    const pieceStr = csaMove.substring(5);

    const csaPieceToKindMap: { [key: string]: Kind } = {
        'FU': 'FU', 'KY': 'KY', 'KE': 'KE', 'GI': 'GI', 'KI': 'KI',
        'KA': 'KA', 'HI': 'HI', 'OU': 'OU', 'TO': 'TO', 'NY': 'NY',
        'NK': 'NK', 'NG': 'NG', 'UM': 'UM', 'RY': 'RY'
    };

    let kind: Kind;
    let promote = false;

    switch (pieceStr) {
        case 'TO': kind = 'FU'; promote = true; break;
        case 'NY': kind = 'KY'; promote = true; break;
        case 'NK': kind = 'KE'; promote = true; break;
        case 'NG': kind = 'GI'; promote = true; break;
        case 'UM': kind = 'KA'; promote = true; break;
        case 'RY': kind = 'HI'; promote = true; break;
        default:
            kind = csaPieceToKindMap[pieceStr];
            if (!kind) throw new Error(`Unknown piece kind in CSA move: ${pieceStr}`);
            break;
    }

    if (fromCol === 0 && fromRow === 0) {
        return { to: { x: toCol, y: toRow }, kind };
    } else {
        return { from: { x: fromCol, y: fromRow }, to: { x: toCol, y: toRow }, promote };
    }
}

const moveSchema = z.object({
  move: z.string(),
  score: z.number().optional(),
});

app.post('/games/:id/move', zValidator('json', moveSchema), async (c) => {
  const { id } = c.req.param();
  const { move: csaMoveString, score } = c.req.valid('json');

  try {
    const gameState = getGame(id);
    const { shogi, moves, evaluations } = gameState;
    const player = shogi.turn;

    const parsedMove = parseCsaMoveToIMove(csaMoveString);

    if (parsedMove.from) {
        shogi.move(parsedMove.from.x, parsedMove.from.y, parsedMove.to.x, parsedMove.to.y, parsedMove.promote);
    } else {
        if (!parsedMove.kind) {
            throw new Error("Drop move is missing 'kind' property after parsing CSA.");
        }
        shogi.drop(parsedMove.to.x, parsedMove.to.y, parsedMove.kind);
    }

    moves.push(csaMoveString);
    evaluations.push(score ?? null);

    const legalMoves = getAllLegalMoves(shogi);
    if (legalMoves.length === 0) {
      const winner = player === Color.Black ? 'b' : 'w';
      const winnerName = winner === 'b' ? gameState.client1Name : gameState.client2Name;

      gameState.endTime = new Date();
      const gameDurationMs = gameState.endTime.getTime() - gameState.startTime.getTime();
      const gameRecordCsa = moves.join('\n');

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          'INSERT INTO games (id, winner, moves, ai_type) VALUES (?, ?, ?, ?)',
          [id, winner, moves.length, 'unknown']
        );
        await connection.execute(
          'INSERT INTO battle_results (id, client1_name, client2_name, winner_name, total_moves, game_duration_ms, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, gameState.client1Name, gameState.client2Name, winnerName, moves.length, gameDurationMs, gameState.startTime, gameState.endTime]
        );
        await connection.execute(
          'INSERT INTO game_records (id, battle_result_id, record_text) VALUES (?, ?, ?)',
          [crypto.randomUUID(), id, gameRecordCsa]
        );
        for (let i = 0; i < evaluations.length; i++) {
          const currentScore = evaluations[i];
          if (currentScore !== null) {
            const moveNumber = i + 1;
            const turnPlayer = i % 2 === 0 ? 'sente' : 'gote';
            const evaluatedBy = turnPlayer === 'sente' ? gameState.client1Name : gameState.client2Name;
            await connection.execute(
              'INSERT INTO move_evaluations (id, battle_result_id, move_number, player, score, evaluated_by) VALUES (?, ?, ?, ?, ?, ?)',
              [crypto.randomUUID(), id, moveNumber, turnPlayer, currentScore, evaluatedBy]
            );
          }
        }
        await connection.commit();
      } catch (dbError) {
        await connection.rollback();
        console.error('Database transaction failed:', dbError);
        throw dbError;
      } finally {
        connection.release();
      }

      console.log(`Game over: ${id}. Winner: ${winnerName}. Saved to DB.`);
      games.delete(id);
      return c.json({ status: 'game_over', winner, gameId: id });
    }

    return c.json({ status: 'ok', board: shogi.toSFENString() });
  } catch (error: any) {
    if (error.message === 'Game not found') {
      return c.json({ error: 'Game not found' }, 404);
    }
    console.error(`Error on move "${csaMoveString}" for game ${id}: `, error);
    return c.json({ error: error.message }, 400);
  }
});

app.get('/games/:id/stats', async (c) => {
    const { id } = c.req.param();
    try {
        const [rows] = await pool.query('SELECT id, winner, moves, ai_type, created_at FROM games WHERE id = ?', [id]);
        if ((rows as any[]).length === 0) {
            return c.json({ error: 'Game not found in database' }, 404);
        }
        return c.json((rows as any)[0]);
    } catch (error: any) {
        return c.json({ error: 'Failed to fetch game stats' }, 500);
    }
});

app.get('/api/battle-results', async (c) => {
    try {
        const [rows] = await pool.query('SELECT * FROM battle_results ORDER BY start_time DESC');
        return c.json(rows);
    } catch (error: any) {
        return c.json({ error: 'Failed to fetch battle results' }, 500);
    }
});

app.get('/api/battle-results-pretty', async (c) => {
    try {
        const [rows] = await pool.query('SELECT * FROM battle_results ORDER BY start_time DESC');
        const results = rows as any[];
        if (results.length === 0) return c.text("No battle results found.");
        let output = "Shogi Battle Results:\n\n";
        results.forEach((result, index) => {
            output += `--- Game ${index + 1} ---\n`;
            output += `ID: ${result.id}\n`;
            output += `Client 1: ${result.client1_name}\n`;
            output += `Client 2: ${result.client2_name}\n`;
            output += `Winner: ${result.winner_name || 'Draw'}\n`;
            output += `Total Moves: ${result.total_moves}\n`;
            output += `Duration: ${result.game_duration_ms} ms\n`;
            output += `Start Time: ${new Date(result.start_time).toLocaleString()}\n`;
            output += `End Time: ${result.end_time ? new Date(result.end_time).toLocaleString() : 'N/A'}\n\n`;
        });
        return c.text(output);
    } catch (error: any) {
        return c.text('Failed to fetch pretty battle results', 500);
    }
});

app.get('/api/battle-results/:id/csa', async (c) => {
    const { id } = c.req.param();
    try {
        const [rows] = await pool.query('SELECT record_text FROM game_records WHERE battle_result_id = ?', [id]);
        if ((rows as any[]).length === 0) return c.json({ error: 'Game record not found' }, 404);
        return c.text((rows as any[])[0].record_text);
    } catch (error: any) {
        return c.json({ error: 'Failed to fetch CSA game record' }, 500);
    }
});

app.get('/api/stats/win-loss', async (c) => {
    try {
        const query = `
            SELECT
                client_name,
                COUNT(*) AS total_games_played,
                SUM(CASE WHEN winner_name = client_name THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN winner_name != client_name AND winner_name IS NOT NULL THEN 1 ELSE 0 END) AS losses,
                SUM(CASE WHEN winner_name IS NULL THEN 1 ELSE 0 END) AS draws,
                AVG(CASE WHEN winner_name != client_name THEN total_moves ELSE NULL END) AS avg_moves_to_loss
            FROM (
                SELECT client1_name AS client_name, winner_name, total_moves FROM battle_results
                UNION ALL
                SELECT client2_name AS client_name, winner_name, total_moves FROM battle_results
            ) AS combined_results
            GROUP BY client_name
            ORDER BY wins DESC;
        `;
        const [rows] = await pool.query(query);
        const stats = (rows as any[]).map(row => ({
            clientName: row.client_name,
            totalGamesPlayed: parseInt(row.total_games_played),
            wins: parseInt(row.wins),
            losses: parseInt(row.losses),
            draws: parseInt(row.draws),
            winRate: row.total_games_played > 0 ? (row.wins / row.total_games_played) * 100 : 0,
            avgMovesToLoss: parseFloat(row.avg_moves_to_loss)
        }));
        return c.json(stats);
    } catch (error: any) {
        return c.json({ error: 'Failed to fetch win/loss statistics' }, 500);
    }
});

app.get('/api/battle-results/:id/evaluations', async (c) => {
    const { id } = c.req.param();
    try {
        const [rows] = await pool.query(
            'SELECT move_number, player, score, evaluated_by FROM move_evaluations WHERE battle_result_id = ? ORDER BY move_number ASC',
            [id]
        );
        return c.json(rows);
    } catch (error: any) {
        return c.json({ error: 'Failed to fetch evaluations' }, 500);
    }
});

app.delete('/games/:id', (c) => {
  const { id } = c.req.param();
  if (games.has(id)) {
    games.delete(id);
    console.log(`Game ${id} deleted due to draw/timeout.`);
    return c.json({ status: 'ok', message: 'Game deleted' });
  } else {
    return c.json({ error: 'Game not found' }, 404);
  }
});

app.get('/', (c) => c.text('Shogi Server is running!'));

// テスト時はserveしない
if (process.env.NODE_ENV !== 'test') {
  serve({
    fetch: app.fetch,
    port: 3000
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  })
}

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await pool.end();
  process.exit(0);
});
