const socket = new WebSocket(
    window.location.protocol === "https:"
        ? "wss://" + window.location.host
        : "ws://" + window.location.host
);

let playerId = 0;
let currentDie = 0;

let myName = "";
let opponentName = "";

let myBoard = Array(9).fill(0);
let oppBoard = Array(9).fill(0);

let prevMyBoard = Array(9).fill(0);
let prevOppBoard = Array(9).fill(0);

const boardDiv = document.getElementById("board");
const oppDiv = document.getElementById("oppBoard");
const status = document.getElementById("status");
const dieText = document.getElementById("die");
const scoreText = document.getElementById("score");
const oppLabel = document.getElementById("oppLabel");
const playerLabel = document.getElementById("playerLabel");

const myScoresDiv = document.getElementById("myScores");
const oppScoresDiv = document.getElementById("oppScores");

function joinGame() {
    myName = document.getElementById("nameInput").value || "Player";
    socket.send("JOIN " + myName);
    document.getElementById("lobby").style.display = "none";
}

function requestRematch() {
    socket.send("REMATCH");
    status.textContent = "Waiting for opponent...";
}

function createBoard(div, isPlayer) {
    div.innerHTML = "";

    for (let i = 0; i < 9; i++) {
        let cell = document.createElement("div");
        cell.className = "cell";

        cell.onclick = () => {
            if (!isPlayer) return;
            if (status.textContent !== "Your turn") return;
            if (currentDie === 0) return;
            if (myBoard[i] !== 0) return;

            let row = Math.floor(i / 3);
            let col = i % 3;

            socket.send(`PLACE ${row} ${col}`);
        };

        div.appendChild(cell);
    }
}

createBoard(boardDiv, true);
createBoard(oppDiv, false);

/* COLUMN SCORES */
function calculateColumnScores(board) {
    let scores = [0, 0, 0];

    for (let col = 0; col < 3; col++) {
        let colVals = [];
        for (let row = 0; row < 3; row++) {
            colVals.push(board[row * 3 + col]);
        }

        let total = 0;
        for (let val of colVals) {
            if (val === 0) continue;
            let count = colVals.filter(v => v === val).length;
            total += val * count;
        }

        scores[col] = total;
    }

    return scores;
}

function renderColumnScores() {
    let myScores = calculateColumnScores(myBoard);
    let oppScores = calculateColumnScores(oppBoard);

    myScoresDiv.innerHTML = "";
    oppScoresDiv.innerHTML = "";

    myScores.forEach(s => {
        let div = document.createElement("div");
        div.className = "colScore";
        div.textContent = s;
        myScoresDiv.appendChild(div);
    });

    oppScores.forEach(s => {
        let div = document.createElement("div");
        div.className = "colScore";
        div.textContent = s;
        oppScoresDiv.appendChild(div);
    });
}

/* RENDER */
function render() {
    [...boardDiv.children].forEach((cell, i) => {
        let oldVal = prevMyBoard[i];
        let newVal = myBoard[i];

        if (oldVal !== 0 && newVal === 0) {
            cell.classList.add("destroy");
            setTimeout(() => cell.classList.remove("destroy"), 300);
        }

        if (oldVal === 0 && newVal !== 0) {
            cell.classList.add("place");
            setTimeout(() => cell.classList.remove("place"), 200);
        }

        cell.textContent = newVal || "";

        if (newVal === 0 && currentDie !== 0) {
            cell.style.outline = "2px solid #f6b042";
        } else {
            cell.style.outline = "none";
        }
    });

    [...oppDiv.children].forEach((cell, i) => {
        let oldVal = prevOppBoard[i];
        let newVal = oppBoard[i];

        if (oldVal !== 0 && newVal === 0) {
            cell.classList.add("destroy");
            setTimeout(() => cell.classList.remove("destroy"), 300);
        }

        if (oldVal === 0 && newVal !== 0) {
            cell.classList.add("place");
            setTimeout(() => cell.classList.remove("place"), 200);
        }

        cell.textContent = newVal || "";
    });

    prevMyBoard = [...myBoard];
    prevOppBoard = [...oppBoard];

    renderColumnScores();
}

/* NETWORK */
socket.onmessage = (event) => {
    let msg = event.data;

    if (msg === "WAITING") {
        status.textContent = "Waiting for opponent...";
    }

    else if (msg.startsWith("GAME_START")) {
        let parts = msg.split(" ");
        playerId = parts[1] === "P1" ? 1 : 2;

        opponentName = parts.slice(2).join(" ");

        oppLabel.textContent = opponentName;
        playerLabel.textContent = myName;

        status.textContent = "Game started!";
        document.getElementById("rematchBtn").style.display = "none";
    }

    else if (msg.startsWith("ROLL ")) {
        currentDie = parseInt(msg.split(" ")[1]);

        dieText.textContent = currentDie;
        dieText.classList.add("roll");
        setTimeout(() => dieText.classList.remove("roll"), 300);

        status.textContent = "Your turn";
    }

    else if (msg === "ROLL_WAIT") {
        currentDie = 0;
        dieText.textContent = "-";
        status.textContent = opponentName + "'s turn";
    }

    else if (msg.startsWith("BOARD_UPDATE")) {
        let p1 = msg.match(/p1:([^ ]+)/)[1].split(",").map(Number);
        let p2 = msg.match(/p2:([^ ]+)/)[1].split(",").map(Number);
        let score = msg.match(/score:([^ ]+)/)[1].split(",").map(Number);

        if (playerId === 1) {
            myBoard = p1;
            oppBoard = p2;
            scoreText.textContent = `${myName}: ${score[0]} | ${opponentName}: ${score[1]}`;
        } else {
            myBoard = p2;
            oppBoard = p1;
            scoreText.textContent = `${myName}: ${score[1]} | ${opponentName}: ${score[0]}`;
        }

        render();
    }

    else if (msg.startsWith("GAME_OVER")) {
        let parts = msg.split(" ");
        let winner = parts[1];

        let resultText = "Tie!";
        if ((winner === "P1" && playerId === 1) || (winner === "P2" && playerId === 2)) {
            resultText = "You Win!";
        } else if (winner !== "TIE") {
            resultText = opponentName + " Wins!";
        }

        status.textContent = resultText;
        currentDie = 0;

        document.getElementById("rematchBtn").style.display = "inline-block";
    }
};