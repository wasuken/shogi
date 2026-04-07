import { Shogi, Move } from 'shogi.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
import path from 'path';

const SERVER_URL = 'http://localhost:3000';

// --- Types ---

type AIFunction = (shogi: Shogi) => Move | null;

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

    // Navigate from battle-runner/dist/index.js to client/...
    const modulePath = path.join(__dirname, '..', '..', 'client', aiName, 'src', 'index.ts');
    
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

async function startGame(): Promise<string> {
  const response = await fetch(`${SERVER_URL}/games`, { method: 'POST' });
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

async function runGame(gameId: string, player1: AIPlayer, player2: AIPlayer): Promise<string> {
    const shogi = new Shogi();
    const players = { 'b': player1, 'w': player2 };
    
    console.log(`New game started: ${gameId}. ${player1.name} (black) vs ${player2.name} (white)`);

    while (!shogi.isGameOver()) {
        const currentPlayer = players[shogi.turn];
        const move = currentPlayer.findBestMove(shogi);

        if (!move) {
            const winner = shogi.turn === 'b' ? player2.name : player1.name;
            console.log(`No legal moves for ${currentPlayer.name}. Winner: ${winner}`);
            return winner;
        }

        try {
            shogi.move(move); // Apply move locally to check for errors and update state
        } catch (e) {
            const winner = shogi.turn === 'b' ? player2.name : player1.name;
            console.error(`Illegal move attempted by ${currentPlayer.name}. Move: ${move.toCSAString()}. Winner: ${winner}`);
            return winner;
        }

        const moveStr = move.toCSAString();
        const result = await makeMove(gameId, moveStr);

        if (result.status === 'game_over') {
            const winnerName = result.winner === 'b' ? player1.name : player2.name;
            console.log(`Game over. Winner: ${winnerName}`);
            return winnerName;
        }
    }
    
    // This part should ideally not be reached if the server correctly reports game over
    const finalWinner = shogi.turn === 'b' ? player2.name : player1.name;
    console.log(`Game ended by local check. Winner: ${finalWinner}`);
    return finalWinner;
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
            const gameId = await startGame();
            const winnerName = await runGame(gameId, blackPlayer, whitePlayer);
            if (scoreboard[winnerName]) {
                scoreboard[winnerName]++;
            } else {
                scoreboard.draws++;
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