function saveData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function getData(key) {
  return JSON.parse(localStorage.getItem(key));
}

function updateLeaderboard(ps) {
  let role = localStorage.getItem("role");

  let board = getData("leaderboard") || [];
  board.push({ score: ps, role: role, time: new Date() });

  board.sort((a, b) => b.score - a.score);
  board = board.slice(0, 5);

  saveData("leaderboard", board);
  renderLeaderboard();
}

function renderLeaderboard() {
  let board = getData("leaderboard") || [];
  let list = document.getElementById("leaderboard");
  list.innerHTML = "";

  board.forEach((b) => {
    let li = document.createElement("li");
    li.innerText = `${b.role.toUpperCase()} - ${b.score.toFixed(2)}`;
    list.appendChild(li);
  });
}
