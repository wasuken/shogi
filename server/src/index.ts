import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Shogi, type IMove, Color, type Kind } from 'shogi.js';
import mysql from 'mysql2/promise'
// import { upgradeWebSocket } from 'hono/ws'

const app = new Hono()

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
}
const games = new Map<string, GameState>();

// --- Helper function to get all legal moves (from client/minimax) ---
function getAllLegalMoves(shogi: Shogi): IMove[] {
    const moves: IMove[] = [];
    // Board moves
    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                // Note: This gets pseudo-legal moves. It doesn't check for checks.
                moves.push(...shogi.getMovesFrom(x, y));
            }
        }
    }
    // Drop moves
    // Note: This gets pseudo-legal moves. It doesn't check for nifu (two pawns in a file).
    moves.push(...shogi.getDropsBy(shogi.turn));
    return moves;
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

// 1. Start a new game
app.post('/games', (c) => {
  const gameId = crypto.randomUUID();
  const shogi = new Shogi();
  games.set(gameId, { shogi, moves: [] });
  console.log(`Game started: ${gameId}`);
  return c.json({ gameId });
});

// 2. Make a move
const moveSchema = z.object({
  move: z.string(), // Expected format: e.g., '7g7f' or 'P*5e'
});

app.post('/games/:id/move', zValidator('json', moveSchema), async (c) => {
  const { id } = c.req.param();
  const { move } = c.req.valid('json');

  try {
    const gameState = getGame(id);
    const { shogi, moves } = gameState;
    const player = shogi.turn;

    // Parse and execute move
    if (move.includes('*')) { // Drop move e.g. P*5e
      const [piece, pos] = move.split('*');
      const toX = parseInt(pos[0], 10);
      const toY = pos[1].charCodeAt(0) - 'a'.charCodeAt(0) + 1;
      const pieceMap: { [key: string]: Kind } = {
        'P': 'FU', 'L': 'KY', 'N': 'KE', 'S': 'GI', 'G': 'KI', 'B': 'KA', 'R': 'HI'
      };
      const kind = pieceMap[piece.toUpperCase() as keyof typeof pieceMap];
      if (!kind) throw new Error(`Invalid piece to drop: ${piece}`);
      shogi.drop(toX, toY, kind);
    } else { // Board move e.g. 7g7f or 2h7h+
      const fromX = parseInt(move[0], 10);
      const fromY = move[1].charCodeAt(0) - 'a'.charCodeAt(0) + 1;
      const toX = parseInt(move[2], 10);
      const toY = move[3].charCodeAt(0) - 'a'.charCodeAt(0) + 1;
      const promote = move.length === 5 && move[4] === '+';
      shogi.move(fromX, fromY, toX, toY, promote);
    }

    moves.push(move);

    // Check for game over by seeing if the opponent has any legal moves
    const legalMoves = getAllLegalMoves(shogi);
    if (legalMoves.length === 0) {
      const winner = player === Color.Black ? 'b' : 'w';
      const gameRecord = {
        moves: moves,
        winner: winner,
        finalSfen: shogi.toSFENString(),
      };

      await pool.execute(
        'INSERT INTO games (id, winner, moves, ai_type, game_record) VALUES (?, ?, ?, ?, ?)',
        [id, winner, moves.length, 'unknown', JSON.stringify(gameRecord)]
      );
      
      console.log(`Game over: ${id}. Winner: ${winner}. Saved to DB.`);
      games.delete(id); // Clean up from memory
      return c.json({ status: 'game_over', winner, gameId: id });
    }

    return c.json({ status: 'ok', board: shogi.toSFENString() });
  } catch (error: any) {
    if (error.message === 'Game not found') {
      return c.json({ error: 'Game not found' }, 404);
    }
    // shogi.js might throw an error for illegal moves
    console.error(`Error on move "${move}" for game ${id}: `, error);
    return c.json({ error: error.message }, 400);
  }
});

// 3. Get game stats (or final record)
app.get('/games/:id/stats', async (c) => {
    const { id } = c.req.param();
    try {
        const [rows] = await pool.query('SELECT * FROM games WHERE id = ?', [id]);
        if ((rows as any[]).length === 0) {
            return c.json({ error: 'Game not found in database' }, 404);
        }
        return c.json((rows as any)[0]);
    } catch (error: any) {
        return c.json({ error: 'Failed to fetch game stats' }, 500);
    }
});

// --- WebSocket (for potential real-time updates) ---
/*
app.get('/ws/:gameId', upgradeWebSocket((c: Context) => {
    const gameId = c.req.param('gameId');
    console.log(`WebSocket connection opened for game: ${gameId}`);
    
    return {
        onMessage: (evt: MessageEvent, ws: WebSocket) => {
            console.log(`[ws:${gameId}] Message: ${evt.data}`);
            // Here you could broadcast moves to other clients, etc.
            ws.send(`Message received: ${evt.data}`);
        },
        onClose: () => {
            console.log(`WebSocket connection closed for game: ${gameId}`);
        },
    };
}));
*/


// --- Server ---
app.get('/', (c) => c.text('Shogi Server is running!'));

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})


// --- Graceful Shutdown ---
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await pool.end();
  console.log('Database pool closed.');
  process.exit(0);
});