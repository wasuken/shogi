import { Shogi, IMove, Color, Kind } from 'shogi.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
const path = require('path');

const SERVER_URL = 'http://localhost:3000';

// --- Types ---

// AIFunction now expects an augmented IMove that can include 'promote' and 'kind' for drops.
type AIFunction = (shogi: Shogi) => (IMove & { promote?: boolean; kind?: Kind; }) | null;

interface AIPlayer {
    name: string;
    findBestMove: AIFunction;
}

// --- Dynamic AI Loader ---

async function loadAI(aiName: string): Promise<AIFunction> {
    const validClients = ['alphazero', 'mcts', 'minimax'];
    if (!validClients.includes(aiName)) {
        throw new Error(`Invalid AI client name: ${aiName}. Valid options are: ${validClients.join(', ')}`);
    }

    // Navigate from battle-runner/src/index.js to client/...
    const modulePath = path.join(process.cwd(), '..', 'client', aiName, 'src', 'index.ts');
    
    try {
        const aiModule = await import(modulePath);
        if (typeof aiModule.findBestMove !== 'function') {
            throw new Error(`'findBestMove' not found or not a function in ${aiName}`);
        }
        return aiModule.findBestMove;
    } catch (error) {
        console.error(`Failed to load AI module from path: ${modulePath}`);
        throw error;
    }
}


// --- API Client ---

async function startGame(client1Name: string, client2Name: string): Promise<string> {
  const response = await fetch(`${SERVER_URL}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client1Name, client2Name }),
  });
  if (!response.ok) {
      throw new Error(`Failed to start game: ${response.statusText}`);
  }
  const data: any = await response.json();
  return data.gameId;
}

async function makeMove(gameId: string, move: string): Promise<any> {
  const response = await fetch(`${SERVER_URL}/games/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ move }),
  });
  if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to make move: ${errorData.error || response.statusText}`);
  }
  return response.json();
}

// --- Game Logic ---

function toCSA(move: IMove & { promote?: boolean; kind?: Kind; }): string {
    const yToChar = (y: number): string => String.fromCharCode('a'.charCodeAt(0) + y - 1);

    const kindToCharMap: { [key in Kind]?: string } = {
        'FU': 'P', 'KY': 'L', 'KE': 'N', 'GI': 'S', 'KI': 'G', 'KA': 'B', 'HI': 'R'
    };

    if (move.from === undefined) { // It's a drop move
        if (!move.kind) {
            throw new Error("Drop move is missing 'kind' property.");
        }
        const pieceChar = kindToCharMap[move.kind];
        if (!pieceChar) {
            throw new Error(`Unknown piece kind for drop: ${move.kind}`);
        }
        // Drop moves are like 'P*5e'
        return `${pieceChar}*${move.to.x}${yToChar(move.to.y)}`;
    }
    const promote = move.promote ? '+' : '';
    // Board moves are like '7g7f' or '2h7h+'
    return `${move.from.x}${yToChar(move.from.y)}${move.to.x}${yToChar(move.to.y)}${promote}`;
}

async function runGame(gameId: string, player1: AIPlayer, player2: AIPlayer): Promise<string> {
    const shogi = new Shogi();
    const players = { 'b': player1, 'w': player2 };

    console.log(`New game started: ${gameId}. ${player1.name} (black) vs ${player2.name} (white)`);

    let currentTurn = Color.Black;
    let winnerName: string | null = null;

    while (winnerName === null) {
        const currentPlayer = currentTurn === Color.Black ? players['b'] : players['w'];
        const move = currentPlayer.findBestMove(shogi);

        if (!move) {
            winnerName = currentTurn === Color.Black ? player2.name : player1.name;
            console.log(`AI (${currentPlayer.name}) returned no move. Winner: ${winnerName}`);
            break;
        }

        try {
            if (move.from) {
                shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
            } else {
                if (!move.kind) {
                    throw new Error("Drop move is missing 'kind' property from AI.");
                }
                shogi.drop(move.to.x, move.to.y, move.kind);
            }
        } catch (e: any) {
            winnerName = currentTurn === Color.Black ? player2.name : player1.name;
            console.error(`Illegal move attempted by ${currentPlayer.name}. Move: ${JSON.stringify(move)}. Error: ${e.message}. Winner: ${winnerName}`);
            break;
        }

        const moveStr = toCSA(move);
        const result = await makeMove(gameId, moveStr);

        if (result.status === 'game_over') {
            winnerName = result.winner === 'b' ? player1.name : player2.name;
            console.log(`Game over. Winner: ${winnerName}`);
            break;
        }

        currentTurn = currentTurn === Color.Black ? Color.White : Color.Black;
    }
    
    return winnerName || "draw";
}


// --- Main Execution ---

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('client1', { type: 'string', demandOption: true, description: 'Name of the first AI client' })
        .option('client2', { type: 'string', demandOption: true, description: 'Name of the second AI client' })
        .option('rounds', { type: 'number', default: 1, description: 'Number of games to play' })
        .argv;

    console.log(`Starting battle: ${argv.client1} vs ${argv.client2} for ${argv.rounds} rounds.`);

    const ai1FindBestMove = await loadAI(argv.client1);
    const ai2FindBestMove = await loadAI(argv.client2);

    const scoreboard = { [argv.client1]: 0, [argv.client2]: 0, draws: 0 };

    for (let i = 0; i < argv.rounds; i++) {
        // Alternate who goes first
        const player1 = { name: argv.client1, findBestMove: ai1FindBestMove };
        const player2 = { name: argv.client2, findBestMove: ai2FindBestMove };
        const isRoundEven = i % 2 === 0;
        
        const blackPlayer = isRoundEven ? player1 : player2;
        const whitePlayer = isRoundEven ? player2 : player1;

        try {
            const gameId = await startGame(blackPlayer.name, whitePlayer.name);
            const winnerName = await runGame(gameId, blackPlayer, whitePlayer);
            if (winnerName === "draw") {
                scoreboard.draws++;
            } else {
                scoreboard[winnerName]++;
            }
            console.log(`Round ${i + 1} finished. Current Score: ${argv.client1}: ${scoreboard[argv.client1]}, ${argv.client2}: ${scoreboard[argv.client2]}`);
        } catch (error) {
            console.error(`\n--- ERROR IN ROUND ${i + 1} ---`);
            console.error(error);
            console.error("Skipping round.\n");
        }
    }

    console.log("\n--- FINAL SCORE ---");
    console.log(`${argv.client1}: ${scoreboard[argv.client1]}`);
    console.log(`${argv.client2}: ${scoreboard[argv.client2]}`);
    console.log(`Draws: ${scoreboard.draws}`);
}

main().catch(error => {
    console.error("A critical error occurred in the battle runner:", error);
    process.exit(1);
});
