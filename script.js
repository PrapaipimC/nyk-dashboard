const SUPABASE_URL = "https://vfzntwsmpwyhfwxvjqew.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmem50d3NtcHd5aGZ3eHZqcWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjQyMzYsImV4cCI6MjA5OTUwMDIzNn0.K_H4MYLH66vufssnhB0nspOiy5-_1OiR45KLzktG3Ik";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUSES = [
  { key: "todo", label: "ต้องทำ" },
  { key: "doing", label: "กำลังทำ" },
  { key: "done", label: "เสร็จแล้ว" },
];

let tasks = [];
let currentUser = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;
  renderAuthBar();
  renderAddTaskPanel();

  await loadTasks();
  render();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    renderAuthBar();
    renderAddTaskPanel();
    render();
  });

  supabaseClient
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
      loadTasks().then(render);
    })
    .subscribe();
}

async function loadTasks() {
  const { data, error } = await supabaseClient.from("tasks").select("*").order("week");
  if (error) {
    console.error(error);
    return;
  }
  tasks = data;
}

function renderAuthBar() {
  const bar = document.getElementById("auth-bar");
  if (currentUser) {
    const name = currentUser.user_metadata?.user_name || currentUser.email;
    const avatar = currentUser.user_metadata?.avatar_url;
    bar.innerHTML = `
      <div class="auth-user">
        ${avatar ? `<img src="${avatar}" alt="${name}" />` : ""}
        <span>${name}</span>
        <button id="logout-btn">ออกจากระบบ</button>
      </div>
    `;
    document.getElementById("logout-btn").onclick = () => supabaseClient.auth.signOut();
  } else {
    bar.innerHTML = `<button id="login-btn">Login with GitHub</button>`;
    document.getElementById("login-btn").onclick = () =>
      supabaseClient.auth.signInWithOAuth({ provider: "github", options: { redirectTo: window.location.href } });
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderAddTaskPanel() {
  const panel = document.getElementById("add-task-panel");
  if (!currentUser) {
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML = `
    <form id="add-task-form" class="add-task-form">
      <input type="text" id="new-task-title" placeholder="ชื่องาน" required />
      <input type="text" id="new-task-owner" placeholder="ผู้รับผิดชอบ (ไม่บังคับ)" />
      <input type="text" id="new-task-deliverable" placeholder="สิ่งที่ต้องส่งมอบ (ไม่บังคับ)" />
      <button type="submit">+ เพิ่มงาน</button>
    </form>
  `;
  document.getElementById("add-task-form").addEventListener("submit", addTask);
}

async function addTask(e) {
  e.preventDefault();
  const title = document.getElementById("new-task-title").value.trim();
  if (!title) return;
  const owner = document.getElementById("new-task-owner").value.trim() || null;
  const deliverable = document.getElementById("new-task-deliverable").value.trim() || null;

  const { error } = await supabaseClient.from("tasks").insert({
    id: crypto.randomUUID(),
    title,
    owner,
    deliverable,
    status: "todo",
  });
  if (error) {
    console.error(error);
    alert("เพิ่มงานไม่สำเร็จ: " + error.message);
    return;
  }
  e.target.reset();
  await loadTasks();
  render();
}

async function deleteTask(id) {
  if (!currentUser) return;
  if (!confirm("ต้องการลบงานนี้ใช่ไหม?")) return;
  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);
  if (error) {
    console.error(error);
    alert("ลบไม่สำเร็จ: " + error.message);
    return;
  }
  await loadTasks();
  render();
}

async function moveTask(id, dir) {
  if (!currentUser) return;
  const task = tasks.find(t => t.id === id);
  const idx = STATUSES.findIndex(s => s.key === task.status);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= STATUSES.length) return;

  const newStatus = STATUSES[newIdx].key;
  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error(error);
    return;
  }
  await loadTasks();
  render();
}

function render() {
  const lastUpdated = tasks.reduce((max, t) => (t.updated_at > max ? t.updated_at : max), "");
  document.getElementById("last-updated").textContent = lastUpdated
    ? "อัปเดตข้อมูลล่าสุด: " + new Date(lastUpdated).toLocaleString("th-TH")
    : "";

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
      .sort((a, b) => (a.week ?? 9999) - (b.week ?? 9999))
      .forEach(t => {
        const card = document.createElement("div");
        card.className = "card";
        const idx = STATUSES.findIndex(s => s.key === col.key);
        let btns = "";
        if (currentUser) {
          if (idx > 0) {
            btns += `<button onclick="moveTask('${t.id}', -1)">&larr; ย้อนกลับ</button>`;
          }
          if (idx < STATUSES.length - 1) {
            btns += `<button onclick="moveTask('${t.id}', 1)">ถัดไป &rarr;</button>`;
          }
          btns += `<button class="delete-btn" onclick="deleteTask('${t.id}')">ลบ</button>`;
        }
        const meta = t.week
          ? `สัปดาห์ ${t.week}${t.phase ? " · " + escapeHtml(t.phase) : ""}`
          : escapeHtml(t.phase || "งานเพิ่มเติม");
        card.innerHTML = `
          <div class="week">${meta}</div>
          <div class="title">${escapeHtml(t.title)}</div>
          ${t.owner ? `<div class="owner">${escapeHtml(t.owner)}</div>` : ""}
          ${t.deliverable ? `<div class="deliverable">${escapeHtml(t.deliverable)}</div>` : ""}
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
