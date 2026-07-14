const SUPABASE_URL = "https://vfzntwsmpwyhfwxvjqew.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmem50d3NtcHd5aGZ3eHZqcWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjQyMzYsImV4cCI6MjA5OTUwMDIzNn0.K_H4MYLH66vufssnhB0nspOiy5-_1OiR45KLzktG3Ik";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUSES = [
  { key: "todo", label: "ต้องทำ" },
  { key: "doing", label: "กำลังทำ" },
  { key: "done", label: "เสร็จแล้ว" },
];

let tasks = [];
let comments = [];
let currentUser = null;
let currentView = "board";
let openComments = new Set();

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;
  renderAuthBar();
  renderAddTaskPanel();

  await Promise.all([loadTasks(), loadComments()]);
  render();

  document.getElementById("view-board-btn").onclick = () => switchView("board");
  document.getElementById("view-timeline-btn").onclick = () => switchView("timeline");

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
    .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, () => {
      loadComments().then(render);
    })
    .subscribe();
}

function switchView(view) {
  currentView = view;
  document.getElementById("view-board-btn").classList.toggle("active", view === "board");
  document.getElementById("view-timeline-btn").classList.toggle("active", view === "timeline");
  document.getElementById("board").style.display = view === "board" ? "grid" : "none";
  document.getElementById("timeline").style.display = view === "timeline" ? "block" : "none";
  render();
}

async function loadTasks() {
  const { data, error } = await supabaseClient.from("tasks").select("*").order("week");
  if (error) {
    console.error(error);
    return;
  }
  tasks = data;
}

async function loadComments() {
  const { data, error } = await supabaseClient.from("task_comments").select("*").order("created_at");
  if (error) {
    console.error(error);
    return;
  }
  comments = data;
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

function formatDate(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("th-TH");
}

function isOverdue(task) {
  if (!task.due_date || task.status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.due_date + "T00:00:00") < today;
}

function findTask(id) {
  return tasks.find(t => t.id === id);
}

function dependencyBlocked(task) {
  return (task.depends_on || []).some(depId => {
    const dep = findTask(depId);
    return dep && dep.status !== "done";
  });
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
      <input type="date" id="new-task-due" title="วันกำหนดส่ง (ไม่บังคับ)" />
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
  const dueDate = document.getElementById("new-task-due").value || null;

  const { error } = await supabaseClient.from("tasks").insert({
    id: crypto.randomUUID(),
    title,
    owner,
    deliverable,
    due_date: dueDate,
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
  const task = findTask(id);
  const idx = STATUSES.findIndex(s => s.key === task.status);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= STATUSES.length) return;

  if (dir > 0 && dependencyBlocked(task)) {
    const blockedBy = (task.depends_on || [])
      .map(findTask)
      .filter(d => d && d.status !== "done")
      .map(d => d.title)
      .join(", ");
    alert("งานนี้ยังเริ่มไม่ได้ เพราะรอ: " + blockedBy);
    return;
  }

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

function toggleComments(id) {
  if (openComments.has(id)) {
    openComments.delete(id);
  } else {
    openComments.add(id);
  }
  render();
}

async function addCommentUI(id) {
  if (!currentUser) return;
  const input = document.getElementById("comment-input-" + id);
  const text = input.value.trim();
  if (!text) return;
  const author = currentUser.user_metadata?.user_name || currentUser.email;

  const { error } = await supabaseClient.from("task_comments").insert({
    task_id: id,
    author,
    body: text,
  });
  if (error) {
    console.error(error);
    alert("ส่ง comment ไม่สำเร็จ: " + error.message);
    return;
  }
  await loadComments();
  render();
}

function cardHtml(t) {
  const idx = STATUSES.findIndex(s => s.key === t.status);
  const blocked = dependencyBlocked(t);

  let btns = "";
  if (currentUser) {
    if (idx > 0) {
      btns += `<button onclick="moveTask('${t.id}', -1)">&larr; ย้อนกลับ</button>`;
    }
    if (idx < STATUSES.length - 1) {
      btns += `<button onclick="moveTask('${t.id}', 1)" ${blocked ? `disabled title="รอ dependency ให้เสร็จก่อน"` : ""}>ถัดไป &rarr;</button>`;
    }
    btns += `<button class="delete-btn" onclick="deleteTask('${t.id}')">ลบ</button>`;
  }

  const meta = t.week
    ? `สัปดาห์ ${t.week}${t.phase ? " · " + escapeHtml(t.phase) : ""}`
    : escapeHtml(t.phase || "งานเพิ่มเติม");

  const overdue = isOverdue(t);
  const dueHtml = t.due_date
    ? `<div class="due-date ${overdue ? "overdue" : ""}">กำหนดส่ง: ${formatDate(t.due_date)}${overdue ? " (เลยกำหนด)" : ""}</div>`
    : "";

  const depLabels = (t.depends_on || [])
    .map(findTask)
    .filter(Boolean)
    .map(d => d.title + (d.status === "done" ? " ✓" : ""));
  const depHtml = depLabels.length
    ? `<div class="dep-badge ${blocked ? "blocked" : ""}">รออยู่บน: ${depLabels.join(", ")}</div>`
    : "";

  const taskComments = comments.filter(c => c.task_id === t.id);
  const commentsHtml = taskComments
    .map(c => `<div class="comment"><span class="comment-date">${escapeHtml(c.author)} · ${formatDateTime(c.created_at)}</span> ${escapeHtml(c.body)}</div>`)
    .join("");
  const commentAddHtml = currentUser
    ? `<div class="comment-add">
         <input type="text" id="comment-input-${t.id}" placeholder="เพิ่ม comment..." />
         <button onclick="addCommentUI('${t.id}')">ส่ง</button>
       </div>`
    : "";
  const isOpen = openComments.has(t.id);

  return `
    <div class="card">
      <div class="week">${meta}</div>
      <div class="title">${escapeHtml(t.title)}</div>
      ${t.owner ? `<div class="owner">${escapeHtml(t.owner)}</div>` : ""}
      ${t.deliverable ? `<div class="deliverable">${escapeHtml(t.deliverable)}</div>` : ""}
      ${dueHtml}
      ${depHtml}
      <div class="actions">
        ${btns}
        <button onclick="toggleComments('${t.id}')">💬 ${taskComments.length}</button>
      </div>
      <div class="comments-box" id="comments-${t.id}" style="display:${isOpen ? "block" : "none"}">
        ${commentsHtml || `<div class="no-comments">ยังไม่มี comment</div>`}
        ${commentAddHtml}
      </div>
    </div>
  `;
}

function renderBoard() {
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
        colDiv.insertAdjacentHTML("beforeend", cardHtml(t));
      });

    board.appendChild(colDiv);
  });
}

function renderTimeline() {
  const container = document.getElementById("timeline");
  const dated = tasks.filter(t => t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const undated = tasks.filter(t => !t.due_date);

  if (!dated.length) {
    container.innerHTML = `<div class="no-comments">ยังไม่มี task ที่กำหนดวันส่ง</div>`;
    return;
  }

  const minDate = new Date(dated[0].due_date + "T00:00:00");
  minDate.setDate(minDate.getDate() - 3);
  const maxDate = new Date(dated[dated.length - 1].due_date + "T00:00:00");
  maxDate.setDate(maxDate.getDate() + 3);
  const totalDays = Math.max(1, (maxDate - minDate) / 86400000);
  const barDays = 5;

  const rows = dated.map(t => {
    const due = new Date(t.due_date + "T00:00:00");
    const startOffset = Math.max(0, (due - minDate) / 86400000 - barDays);
    const leftPct = (startOffset / totalDays) * 100;
    const widthPct = (barDays / totalDays) * 100;
    const overdue = isOverdue(t);
    return `
      <div class="timeline-row">
        <div class="timeline-label">${escapeHtml(t.title)}</div>
        <div class="timeline-track">
          <div class="timeline-bar ${t.status} ${overdue ? "overdue" : ""}" style="left:${leftPct}%; width:${widthPct}%"></div>
        </div>
        <div class="timeline-date ${overdue ? "overdue" : ""}">${formatDate(t.due_date)}</div>
      </div>
    `;
  }).join("");

  const undatedHtml = undated.length
    ? `<div class="timeline-undated">ไม่ได้กำหนดวันส่ง: ${undated.map(t => escapeHtml(t.title)).join(", ")}</div>`
    : "";

  container.innerHTML = rows + undatedHtml;
}

function render() {
  const lastUpdated = tasks.reduce((max, t) => (t.updated_at > max ? t.updated_at : max), "");
  document.getElementById("last-updated").textContent = lastUpdated
    ? "อัปเดตข้อมูลล่าสุด: " + new Date(lastUpdated).toLocaleString("th-TH")
    : "";

  if (currentView === "board") {
    renderBoard();
  } else {
    renderTimeline();
  }

  const done = tasks.filter(t => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  document.getElementById("progress-count").textContent = done + " / " + tasks.length + " งาน (" + pct + "%)";
  document.getElementById("progress-fill").style.width = pct + "%";
}

document.addEventListener("DOMContentLoaded", init);
