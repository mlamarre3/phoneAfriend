import { getAllPeople, upsertPerson, deletePerson, replaceAllPeople } from "./db.js";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("emptyState");
const addBtn = document.getElementById("addBtn");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput"); // FIX: consistent naming
const searchInput = document.getElementById("searchInput");

const modal = document.getElementById("modal");
const form = document.getElementById("form");
const modalTitle = document.getElementById("modalTitle");
const nameInput = document.getElementById("nameInput");
const dateInput = document.getElementById("dateInput");
const idInput = document.getElementById("idInput");
const cancelBtn = document.getElementById("cancelBtn"); // FIX: cancel should close modal without saving

let people = [];

function daysSince(dateISO) {
  const from = new Date(dateISO);
  const now = new Date();

  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = end - start;
  return Math.max(0, Math.round(diffMs / 86400000));
}

function statusForDays(d) {
  if (d >= 90) return { label: "Been awhile", dot: "var(--danger)" };
  if (d >= 21) return { label: "Check In", dot: "var(--warn)" };
  return { label: "Connected", dot: "var(--ok)" };
}

function sortedFilteredPeople() {
  const q = (searchInput.value || "").trim().toLowerCase();

  const filtered = q
  ? people.filter(p =>
      (p.name || "").toLowerCase().includes(q)
    )
  : people;

  // Most overdue first: oldest lastCalledAt at top
  return filtered
    .slice()
    .sort((a, b) => new Date(a.lastCalledAt) - new Date(b.lastCalledAt));
}

function render() {
  const rows = sortedFilteredPeople();

  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", rows.length !== 0);

  for (const p of rows) {
    const d = daysSince(p.lastCalledAt);
    const st = statusForDays(d);

    const li = document.createElement("li");
    li.className = "item";

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.background = st.dot;

    const meta = document.createElement("div");
    meta.className = "meta"; // FIX: you were accidentally setting dot twice

    const nameRow = document.createElement("div");
    nameRow.className = "nameRow";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = p.name;

    const days = document.createElement("div");
    days.className = "days";
    days.textContent = `${d} day${d === 1 ? "" : "s"} since`;

    nameRow.appendChild(name);
    nameRow.appendChild(days);

    meta.appendChild(nameRow);

    const actions = document.createElement("div");
    actions.className = "actions";

    const calledBtn = document.createElement("button");
    calledBtn.className = "btn primary small";
    calledBtn.textContent = "Called";
    calledBtn.addEventListener("click", async () => {
      const updated = { ...p, lastCalledAt: new Date().toISOString() };
      await upsertPerson(updated);
      people = people.map((x) => (x.id === p.id ? updated : x));
      render();
      if (navigator.vibrate) navigator.vibrate(20); // FIX: vibrate
    });

    const editBtn = document.createElement("button");
    editBtn.className = "btn small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEdit(p));

    const delBtn = document.createElement("button");
    delBtn.className = "btn small";
    delBtn.textContent = "Del";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete ${p.name}?`)) return;
      await deletePerson(p.id);
      people = people.filter((x) => x.id !== p.id);
      render();
    });

    actions.appendChild(calledBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(dot);
    li.appendChild(meta);
    li.appendChild(actions);

    listEl.appendChild(li);
  }
}

function openAdd() {
  modalTitle.textContent = "Add Person";
  idInput.value = "";
  nameInput.value = "";
  dateInput.value = "";
  modal.showModal();
  nameInput.focus();
}

function openEdit(p) {
  modalTitle.textContent = "Edit person";
  idInput.value = p.id;
  nameInput.value = p.name;

  const dt = new Date(p.lastCalledAt);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  dateInput.value = `${y}-${m}-${d}`;

  modal.showModal();
  nameInput.focus();
}

// FIX: Cancel should close and not submit
cancelBtn.addEventListener("click", () => {
  modal.close();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  if (!name) return;

  const id = idInput.value || crypto.randomUUID();

  let lastCalledAt = new Date().toISOString();
  if (dateInput.value) {
    const [yy, mm, dd] = dateInput.value.split("-").map(Number);
    const localMidnight = new Date(yy, mm - 1, dd, 0, 0, 0);
    lastCalledAt = localMidnight.toISOString();
  }

  const existing = people.find((p) => p.id === id);
  const person = {
    id,
    name,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    lastCalledAt,
  };

  await upsertPerson(person);

  const idx = people.findIndex((p) => p.id === id);
  if (idx >= 0) people[idx] = person;
  else people.push(person);

  modal.close(); // FIX: close after saving
  render();
});

addBtn.addEventListener("click", openAdd);
searchInput.addEventListener("input", render);

exportBtn.addEventListener("click", async () => { // FIX: click not clock
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    people,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "phone-a-friend-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || !Array.isArray(parsed.people)) { // FIX: parsed not parse
      alert("Invalid backup file.");
      return;
    }

    const incoming = parsed.people
      .filter((p) => p && typeof p.name === "string" && p.name.trim())
      .map((p) => ({
        id: String(p.id || crypto.randomUUID()),
        name: String(p.name).trim(),
        createdAt: p.createdAt ? String(p.createdAt) : new Date().toISOString(),
        lastCalledAt: p.lastCalledAt
          ? String(p.lastCalledAt)
          : new Date().toISOString(),
      }));

    await replaceAllPeople(incoming);
    people = incoming;
    render();
    alert("Import complete.");
  } catch (err) {
    console.error(err);
    alert("Import failed. File may be corrupted.");
  } finally {
    importInput.value = "";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (e) {
      console.warn("Service worker registration failed:", e);
    }
  });
}

async function init() {
  people = await getAllPeople();
  render();
}


init();
