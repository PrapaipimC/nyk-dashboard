const STORAGE_KEY = "nyk-dashboard-state-v1";
const STATUSES = [
  { key: "todo", label: "ต้องทำ" },
  { key: "doing", label: "กำลังทำ" },
  { key: "done", label: "เสร็จแล้ว" },
];

let tasks = [];

async function init() {
  const res = await fetch("data.json");
  const data = await res.json();
  document.getElementById("project-name").textContent = data.projectName;
  document.getElementById("last-updated").textContent = "อัปเดตข้อมูลล่าสุด: " + data.lastUpdated;

  const saved = localStorage.getItem(STORAGE_KEY);
  const savedState = saved ? JSON.parse(saved) : {};

  tasks = data.tasks.map(t => ({
    ...t,
    status: savedState[t.id] || t.status || "todo",
  }));

  render();
}

function saveState() {
  const state = {};
  tasks.forEach(t => { state[t.id] = t.status; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function moveTask(id, dir) {
  const task = tasks.find(t => t.id === id);
  const idx = STATUSES.findIndex(s => s.key === task.status);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= STATUSES.length) return;
  task.status = STATUSES[newIdx].key;
  saveState();
  render();
}

function render() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  STATUSES.forEach(col => {
    const colDiv = document.createElement("div");
    colDiv.className = "column " + col.key;

    const header = document.createElement("div");
    const count = tasks.filter(t => t.status === col.key).length;
    header.className = "column-header";
    header.textContent = col.label + " (" + count + ")";
    colDiv.appendChild(header);

    tasks
      .filter(t => t.status === col.key)
      .sort((a, b) => a.week - b.week)
      .forEach(t => {
        const card = document.createElement("div");
        card.className = "card";
        const idx = STATUSES.findIndex(s => s.key === col.key);
        let btns = "";
        if (idx > 0) {
          btns += `<button onclick="moveTask('${t.id}', -1)">&larr; ย้อนกลับ</button>`;
        }
        if (idx < STATUSES.length - 1) {
          btns += `<button onclick="moveTask('${t.id}', 1)">ถัดไป &rarr;</button>`;
        }
        card.innerHTML = `
          <div class="week">สัปดาห์ ${t.week} · ${t.phase}</div>
          <div class="title">${t.title}</div>
          <div class="owner">${t.owner}</div>
          <div class="deliverable">${t.deliverable}</div>
          <div class="actions">${btns}</div>
        `;
        colDiv.appendChild(card);
      });

    board.appendChild(colDiv);
  });

  const done = tasks.filter(t => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  document.getElementById("progress-count").textContent = done + " / " + tasks.length + " งาน (" + pct + "%)";
  document.getElementById("progress-fill").style.width = pct + "%";
}

document.addEventListener("DOMContentLoaded", init);
