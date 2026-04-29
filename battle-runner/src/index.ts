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
    const validClients = ['alphazero', 'mcts', 'minimax', 'minimax_v2', 'negamax', 'beamsearch'];
    if (!validClients.includes(aiName)) {
        throw new Error(`Invalid AI client name: ${aiName}. Valid options are: ${validClients.join(', ')}`);
    }

    // Navigate from battle-runner/src/index.js to client/...
    const modulePath = path.join(process.cwd(), '..', 'client', 'src', `${aiName}.ts`);
    
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
    timeout: 60000,
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
    timeout: 60000,
  });
  if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to make move: ${errorData.error || response.statusText}`);
  }
  return response.json();
}

async function deleteGame(gameId: string): Promise<void> {
  const response = await fetch(`${SERVER_URL}/games/${gameId}`, {
    method: 'DELETE',
    timeout: 10000,
  });
  if (!response.ok) {
    // 404はすでにない場合なので無視して良い
    if (response.status !== 404) {
      console.warn(`Failed to delete game ${gameId}: ${response.statusText}`);
    }
  }
  console.log(`Game ${gameId} successfully deleted from server.`);
}

// --- Game Logic ---

// This is a copy of the server's getAllLegalMoves function for validation.
export function getAllLegalMoves(shogi: Shogi): AIMove[] {
    const pseudoLegal: AIMove[] = [];

    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                pseudoLegal.push(...shogi.getMovesFrom(x, y));
            }
        }
    }
    pseudoLegal.push(...shogi.getDropsBy(shogi.turn));

    // Filter out moves that leave the king in check.
    return pseudoLegal.filter(move => {
        let capturedKind: Kind | undefined = undefined;
        try {
            if (move.from) {
                const captured = shogi.get(move.to.x, move.to.y);
                capturedKind = captured?.kind;
                shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
            } else {
                shogi.drop(move.to.x, move.to.y, move.kind!);
            }

            const inCheck = shogi.isCheck(shogi.turn === Color.Black ? Color.White : Color.Black);

            if (move.from) {
                shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, move.promote, capturedKind);
            } else {
                shogi.undrop(move.to.x, move.to.y);
            }

            return !inCheck;
        } catch (e) {
            // This can happen if the move is illegal (e.g. jumping piece), shogi.js throws an error.
            // We should restore the board state if something went wrong.
            // The unmove logic should handle this, but it's better to be safe.
            // In this filter, we just return false for such moves.
            return false;
        }
    });
}


export function toCSA(player: Color, move: AIMove, movedPieceKind: Kind | undefined): string {
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

export async function runGame(gameId: string, player1: AIPlayer, player2: AIPlayer): Promise<string> {
    const shogi = new Shogi({ preset: 'HIRATE' });
    shogi.initializeFromSFENString('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
    const players = { 'b': player1, 'w': player2 };

    console.log(`New game started: ${gameId}. ${player1.name} (black) vs ${player2.name} (white)`);

    let currentTurn = Color.Black;
    let winnerName: string | null = null;
    let moveCount = 0;
    const sfenCount = new Map<string, number>();
    // 初期の局面を記録
    sfenCount.set(shogi.toSFENString(), 1);

    while (winnerName === null) {
        const currentPlayer = currentTurn === Color.Black ? players['b'] : players['w'];
        console.log(`DEBUG: Before AI move. Current SFEN: ${shogi.toSFENString()}`);
        
        const tempShogi = new Shogi();
        tempShogi.initializeFromSFENString(shogi.toSFENString());
        console.log(`DEBUG: Passing turn ${tempShogi.turn === Color.Black ? 'b' : 'w'} to AI ${currentPlayer.name}`);
        const { move, score } = currentPlayer.findBestMove(tempShogi);
        console.log(`DEBUG: AI returned move: ${JSON.stringify(move)}`);

        if (!move) {
            winnerName = currentTurn === Color.Black ? player2.name : player1.name;
            console.log(`AI (${currentPlayer.name}) returned no move. Winner: ${winnerName}`);
            break;
        }

        // Validate the move returned by the AI
        const legalMoves = getAllLegalMoves(shogi);
        const isLegitMove = legalMoves.some(legalMove => isMoveEqual(legalMove, move));

        if (!isLegitMove) {
            winnerName = currentTurn === Color.Black ? player2.name : player1.name;
            console.error(`Illegal move returned by ${currentPlayer.name}. Move: ${JSON.stringify(move)}. Winner: ${winnerName}`);
            await deleteGame(gameId);
            break;
        }

        let movedPieceKind: Kind | undefined;
        if (move.from) {
            const piece = shogi.get(move.from.x, move.from.y);
            if (!piece) {
                throw new Error(`Piece not found at ${move.from.x}, ${move.from.y} after validation.`);
            }
            movedPieceKind = piece.kind;
        } else {
            movedPieceKind = move.kind;
        }
        
        try {
            if (move.from) {
                shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
            } else {
                shogi.drop(move.to.x, move.to.y, move.kind!);
            }
        } catch (e: any) {
             winnerName = currentTurn === Color.Black ? player2.name : player1.name;
            console.error(`Illegal move was somehow not caught by validation. Move: ${JSON.stringify(move)}. Error: ${e.message}. Winner: ${winnerName}`);
            await deleteGame(gameId);
            break;
        }
        console.log(`DEBUG: After applying move. New SFEN: ${shogi.toSFENString()}`);
        
        const moveStr = toCSA(currentTurn, move, movedPieceKind);
        const result = await makeMove(gameId, moveStr, score);

        if (result.status === 'game_over') {
            winnerName = result.winner === 'b' ? player1.name : player2.name;
            console.log(`Game over. Winner: ${winnerName}`);
            break;
        }

        // 手数と局面のチェック
        moveCount++;
        if (moveCount >= 300) {
            console.log(`Max moves (300) reached. Game is a draw.`);
            await deleteGame(gameId);
            return 'draw';
        }

        const sfen = shogi.toSFENString();
        const count = (sfenCount.get(sfen) ?? 0) + 1;
        sfenCount.set(sfen, count);
        if (count >= 3) {
            console.log(`Sennichite (repetition) detected. Game is a draw. SFEN: ${sfen}`);
            await deleteGame(gameId);
            return 'draw';
        }

        currentTurn = currentTurn === Color.Black ? Color.White : Color.Black;
    }
    
    return winnerName || "draw";
}

function isMoveEqual(legalMove: AIMove, aiMove: AIMove): boolean {
    if (aiMove.to.x !== legalMove.to.x || aiMove.to.y !== legalMove.to.y) {
        return false;
    }
    if (aiMove.from) { // It's a move
        if (!legalMove.from || aiMove.from.x !== legalMove.from.x || aiMove.from.y !== legalMove.from.y) {
            return false;
        }
        // If legalMove.promote is undefined, the AI can choose to promote or not.
        // If legalMove.promote is a boolean, the AI's choice must match.
        if (legalMove.promote !== undefined && aiMove.promote !== legalMove.promote) {
            return false;
        }
    } else { // It's a drop
        if (legalMove.from || aiMove.kind !== legalMove.kind) {
            return false;
        }
    }
    return true;
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

if (require.main === module) {
    main().catch(error => {
        console.error("A critical error occurred in the battle runner:", error);
        process.exit(1);
    });
}
