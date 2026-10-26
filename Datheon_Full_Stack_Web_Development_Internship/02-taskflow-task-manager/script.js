// ---------- 1. State ----------
// All tasks live in this one array. The screen is always drawn from it.
const STORAGE_KEY = "taskflow.tasks";
let tasks = [];            // [{ id, title, category, due, completed }]
let currentFilter = "all"; // all | active | completed
let searchText = "";
let editingId = null;      // id of the task being edited, or null
let draggedId = null;

// ---------- 2. localStorage helpers ----------
function saveToLocalStorage() {
  // localStorage only stores text, so the array is converted to a JSON string
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  tasks = saved ? JSON.parse(saved) : [];
}

// ---------- 3. Grab the page elements ----------
const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const categoryInput = document.getElementById("task-category");
const dueInput = document.getElementById("task-due");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const searchInput = document.getElementById("search");
const list = document.getElementById("task-list");

// ---------- 4. Render (draws the list on screen) ----------
function render(newId) {
  const today = new Date().toISOString().slice(0, 10);

  // Keep only tasks that match the status filter AND the search text
  const visible = tasks.filter(t => {
    const statusOk =
      currentFilter === "all" ||
      (currentFilter === "active" && !t.completed) ||
      (currentFilter === "completed" && t.completed);
    return statusOk && t.title.toLowerCase().includes(searchText);
  });

  list.innerHTML = "";

  if (visible.length === 0) {
    list.innerHTML = `<li class="empty">${
      tasks.length ? "No tasks match this view." : "No tasks yet. Add your first task above."
    }</li>`;
  }

  visible.forEach(t => {
    const li = document.createElement("li");
    li.className = "task" + (t.completed ? " completed" : "") + (t.id === newId ? " added" : "");
    li.dataset.id = t.id;
    li.draggable = true;
    li.style.setProperty("--cat", `var(--${t.category.toLowerCase()})`);

    const overdue = t.due && !t.completed && t.due < today;

    // textContent (not innerHTML) is used for the title so typed text can't inject HTML
    li.innerHTML = `
      <input type="checkbox" ${t.completed ? "checked" : ""} aria-label="Mark as complete">
      <div class="task-body">
        <div class="task-title"></div>
        <div class="task-meta">
          <span class="tag">${t.category}</span>
          ${t.due ? `<span class="${overdue ? "overdue" : ""}">${overdue ? "Overdue" : "Due"} ${t.due}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button class="edit">Edit</button>
        <button class="delete">Delete</button>
      </div>`;
    li.querySelector(".task-title").textContent = t.title;
    list.appendChild(li);
  });

  updateCounts();
}

function updateCounts() {
  const done = tasks.filter(t => t.completed).length;
  document.getElementById("n-all").textContent = tasks.length;
  document.getElementById("n-active").textContent = tasks.length - done;
  document.getElementById("n-completed").textContent = done;
}

// ---------- 5. Create and Update ----------
form.addEventListener("submit", e => {
  e.preventDefault(); // stop the page from reloading
  const title = titleInput.value.trim();
  if (!title) return;

  if (editingId) {
    // UPDATE: find the task and change its fields
    const task = tasks.find(t => t.id === editingId);
    task.title = title;
    task.category = categoryInput.value;
    task.due = dueInput.value;
    stopEditing();
    saveToLocalStorage();
    render();
  } else {
    // CREATE: add a new task object at the top
    const task = {
      id: Date.now().toString(36),
      title,
      category: categoryInput.value,
      due: dueInput.value,
      completed: false
    };
    tasks.unshift(task);
    saveToLocalStorage();
    render(task.id);
  }
  form.reset();
  titleInput.focus();
});

function stopEditing() {
  editingId = null;
  submitBtn.textContent = "Add task";
  cancelBtn.hidden = true;
}

cancelBtn.addEventListener("click", () => { stopEditing(); form.reset(); });

// ---------- 6. Complete, Edit, Delete (one listener for the whole list) ----------
list.addEventListener("click", e => {
  const li = e.target.closest(".task");
  if (!li) return;
  const task = tasks.find(t => t.id === li.dataset.id);

  if (e.target.type === "checkbox") {
    task.completed = e.target.checked;
    saveToLocalStorage();
    render();
  } else if (e.target.classList.contains("edit")) {
    editingId = task.id;
    titleInput.value = task.title;
    categoryInput.value = task.category;
    dueInput.value = task.due;
    submitBtn.textContent = "Save changes";
    cancelBtn.hidden = false;
    titleInput.focus();
  } else if (e.target.classList.contains("delete")) {
    // DELETE: play the fade-out, then remove it from the array
    li.classList.add("removing");
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== task.id);
      saveToLocalStorage();
      render();
    }, 280);
  }
});

// ---------- 7. Filter and search ----------
document.getElementById("filters").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  document.querySelectorAll("#filters button").forEach(b => b.classList.toggle("active", b === btn));
  render();
});

searchInput.addEventListener("input", () => {
  searchText = searchInput.value.toLowerCase();
  render();
});

// ---------- 8. Drag-and-drop reordering ----------
list.addEventListener("dragstart", e => {
  const li = e.target.closest(".task");
  if (!li) return;
  draggedId = li.dataset.id;
  li.classList.add("dragging");
});

list.addEventListener("dragover", e => {
  e.preventDefault(); // required, otherwise the browser blocks dropping
  const li = e.target.closest(".task");
  document.querySelectorAll(".drop-target").forEach(x => x.classList.remove("drop-target"));
  if (li) li.classList.add("drop-target");
});

list.addEventListener("drop", e => {
  e.preventDefault();
  const target = e.target.closest(".task");
  if (!target || !draggedId || target.dataset.id === draggedId) return;
  const from = tasks.findIndex(t => t.id === draggedId);
  const [moved] = tasks.splice(from, 1);                      // take it out
  const to = tasks.findIndex(t => t.id === target.dataset.id);
  tasks.splice(to, 0, moved);                                 // put it in the new spot
  saveToLocalStorage();
});

list.addEventListener("dragend", () => { draggedId = null; render(); });

// ---------- 9. Start ----------
loadFromLocalStorage(); // runs once when the page opens
render();
