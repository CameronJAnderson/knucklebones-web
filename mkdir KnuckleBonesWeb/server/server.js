const express = require("express");
const path = require("path");
const WebSocket = require("ws");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "../client")));

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

let waitingPlayer = null;

wss.on("connection", (ws) => {
    console.log("Player connected");

    ws.playerName = "Player";

    ws.on("message", (msg) => {
        let text = msg.toString();

        if (text.startsWith("JOIN ")) {
            ws.playerName = text.substring(5).trim();

            if (waitingPlayer === null) {
                waitingPlayer = ws;
                ws.send("WAITING");
            } else {
                const p1 = waitingPlayer;
                const p2 = ws;
                waitingPlayer = null;

                startGame(p1, p2);
            }
        }
    });
});

function startGame(p1, p2) {
    let game = {
        boardP1: Array(9).fill(0),
        boardP2: Array(9).fill(0),
        turn: 1
    };

    let rematchVotes = 0;

    p1.send(`GAME_START P1 ${p2.playerName}`);
    p2.send(`GAME_START P2 ${p1.playerName}`);

    function sendBoth(msg) {
        p1.send(msg);
        p2.send(msg);
    }

    function rollDie() {
        return Math.floor(Math.random() * 6) + 1;
    }

    function calculateScore(board) {
        let total = 0;

        for (let col = 0; col < 3; col++) {
            let colVals = [];
            for (let row = 0; row < 3; row++) {
                colVals.push(board[row * 3 + col]);
            }

            for (let val of colVals) {
                if (val === 0) continue;
                let count = colVals.filter(v => v === val).length;
                total += val * count;
            }
        }

        return total;
    }

    function isFull(board) {
        return board.every(v => v !== 0);
    }

    let currentDie = 0;

    function nextTurn() {
        let die = rollDie();
        currentDie = die;

        if (game.turn === 1) {
            p1.send("ROLL " + die);
            p2.send("ROLL_WAIT");
        } else {
            p2.send("ROLL " + die);
            p1.send("ROLL_WAIT");
        }
    }

    function handleMove(player, msg) {
        if (!msg.startsWith("PLACE")) return;

        let parts = msg.split(" ");
        let row = parseInt(parts[1]);
        let col = parseInt(parts[2]);
        let idx = row * 3 + col;

        let board = player === 1 ? game.boardP1 : game.boardP2;
        if (board[idx] !== 0) return;

        board[idx] = currentDie;

        // destruction
        let opponent = player === 1 ? game.boardP2 : game.boardP1;
        for (let r = 0; r < 3; r++) {
            let i = r * 3 + col;
            if (opponent[i] === currentDie) {
                opponent[i] = 0;
            }
        }

        let score1 = calculateScore(game.boardP1);
        let score2 = calculateScore(game.boardP2);

        sendBoth(
            "BOARD_UPDATE " +
            "p1:" + game.boardP1.join(",") +
            " p2:" + game.boardP2.join(",") +
            " score:" + score1 + "," + score2
        );

        if (isFull(game.boardP1) || isFull(game.boardP2)) {
            let winner = "TIE";
            if (score1 > score2) winner = "P1";
            else if (score2 > score1) winner = "P2";

            p1.send(`GAME_OVER ${winner} ${score1} ${score2}`);
            p2.send(`GAME_OVER ${winner} ${score1} ${score2}`);
            return;
        }

        game.turn = game.turn === 1 ? 2 : 1;
        nextTurn();
    }

    p1.on("message", msg => {
        let text = msg.toString();

        if (text === "REMATCH") {
            rematchVotes++;
            if (rematchVotes === 2) startGame(p1, p2);
            return;
        }

        if (game.turn === 1) handleMove(1, text);
    });

    p2.on("message", msg => {
        let text = msg.toString();

        if (text === "REMATCH") {
            rematchVotes++;
            if (rematchVotes === 2) startGame(p1, p2);
            return;
        }

        if (game.turn === 2) handleMove(2, text);
    });

    nextTurn();
}