import { Shogi, Color, Kind } from 'shogi.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
const path = require('path');

const SERVER_URL = 'http://localhost:3000';

import type { AIFunction, AIMove } from '../../shared/types';

// --- Types ---

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

async function makeMove(gameId: string, move: string, score?: number): Promise<any> {
  const response = await fetch(`${SERVER_URL}/games/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ move, score }),
  });
  if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to make move: ${errorData.error || response.statusText}`);
  }
  return response.json();
}

// --- Game Logic ---

function toCSA(player: Color, move: AIMove, movedPieceKind: Kind | undefined): string {
    const playerChar = player === Color.Black ? '+' : '-';

    // Helper to get the CSA piece string based on Kind and promotion status
    const getCsaPieceString = (kind: Kind, promote: boolean | undefined): string => {
        if (promote) {
            switch (kind) {
                case 'FU': return 'TO';
                case 'KY': return 'NY';
                case 'KE': return 'NK';
                case 'GI': return 'NG';
                case 'KA': return 'UM';
                case 'HI': return 'RY';
                default: return kind; // KI, OU don't promote
            }
        }
        return kind;
    };

    let csaPiece: string;

    if (move.from === undefined) { // It's a drop move
        if (!move.kind) {
            throw new Error("Drop move is missing 'kind' property.");
        }
        csaPiece = getCsaPieceString(move.kind, false); // Drops are never promoted from hand
        return `${playerChar}00${move.to.x}${move.to.y}${csaPiece}`;
    } else { // Regular move
        if (!movedPieceKind) {
            throw new Error("Moved piece kind is missing for CSA conversion.");
        }
        csaPiece = getCsaPieceString(movedPieceKind, move.promote);
        return `${playerChar}${move.from.x}${move.from.y}${move.to.x}${move.to.y}${csaPiece}`;
    }
}

async function runGame(gameId: string, player1: AIPlayer, player2: AIPlayer): Promise<string> {
    const shogi = new Shogi({ preset: 'HIRATE' });
    shogi.initializeFromSFENString('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
    const players = { 'b': player1, 'w': player2 };

    console.log(`New game started: ${gameId}. ${player1.name} (black) vs ${player2.name} (white)`);

    let currentTurn = Color.Black;
    let winnerName: string | null = null;

    while (winnerName === null) {
        const currentPlayer = currentTurn === Color.Black ? players['b'] : players['w'];
        console.log(`DEBUG: Before AI move. Current SFEN: ${shogi.toSFENString()}`);
        const { move, score } = currentPlayer.findBestMove(shogi);
        console.log(`DEBUG: AI returned move: ${JSON.stringify(move)}`);

        if (!move) {
            winnerName = currentTurn === Color.Black ? player2.name : player1.name;
            console.log(`AI (${currentPlayer.name}) returned no move. Winner: ${winnerName}`);
            break;
        }

        let movedPieceKind: Kind | undefined;
        if (move.from) {
            const piece = shogi.get(move.from.x, move.from.y);
            if (!piece) {
                throw new Error(`Piece not found at ${move.from.x}, ${move.from.y} before move.`);
            }
            movedPieceKind = piece.kind;
        } else {
            movedPieceKind = move.kind; // For drop moves, kind is already in move object
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
            console.log(`DEBUG: After applying move. New SFEN: ${shogi.toSFENString()}`);
        } catch (e: any) {
            winnerName = currentTurn === Color.Black ? player2.name : player1.name;
            console.error(`Illegal move attempted by ${currentPlayer.name}. Move: ${JSON.stringify(move)}. Error: ${e.message}. Winner: ${winnerName}`);
            break;
        }

        const moveStr = toCSA(currentTurn, move, movedPieceKind);
        const result = await makeMove(gameId, moveStr, score);

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