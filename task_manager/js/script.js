/**
 * ============================================================
 *  SCRIPT.JS — Task Manager + Protezione Accesso (Fase 3)
 * ============================================================
 *
 *  STRUTTURA:
 *   1. getCookie / deleteCookie  → leggere/cancellare cookie
 *   2. Guardia accesso           → blocca chi non è loggato
 *   3. Task Manager              → tutto il resto (solo se loggato)
 *      ├─ loadTasks / saveTasks  → localStorage per-utente
 *      ├─ render()               → lista o kanban
 *      ├─ addTask / removeTask / updateStatus
 *      ├─ filter + sort
 *      ├─ layout switcher
 *      ├─ session timer (PRO)
 *      └─ logout
 * ============================================================
 */

"use strict";

/* ══════════════════════════════════════════════════════════
   1 — COOKIE UTILITIES
   ══════════════════════════════════════════════════════════

   document.cookie è una stringa unica separata da "; "
   Es: "isLoggedIn=true; current_user=admin; auth_ticket=xyz"
   Per leggere un valore dobbiamo spezzarla e cercare per nome.
*/

/**
 * Legge il valore di un cookie per nome.
 * @param {string} name
 * @returns {string|null}
 */
function getCookie(name) {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf("=");
    if (eqIdx === -1) continue;
    const key = cookie.slice(0, eqIdx).trim();
    const val = cookie.slice(eqIdx + 1);
    if (key === name) return decodeURIComponent(val);
  }
  return null;
}

/**
 * Cancella un cookie impostandone la scadenza nel passato.
 * Non esiste un comando "elimina cookie" in JS — questo è
 * l'unico modo: il browser rimuove automaticamente i cookie
 * scaduti.
 * @param {string} name
 */
function deleteCookie(name) {
  document.cookie =
    name + "=; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Path=/";
}

/* ══════════════════════════════════════════════════════════
   2 — TUTTO IL CODICE ASPETTA IL DOM
   ══════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", function () {

  /* ── GUARDIA ACCESSO ────────────────────────────────────
     Primo controllo: il cookie isLoggedIn esiste e vale "true"?
     Se no → nascondi il body, mostra overlay, redirect dopo 2s.
  */
  if (getCookie("isLoggedIn") !== "true") {

    // Nascondi subito il contenuto (nessun "flash" dei task)
    document.body.style.display = "none";

    // Crea overlay "Accesso Negato" via createElement (no innerHTML)
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:fixed", "inset:0", "background:#0a0a0f",
      "display:flex", "flex-direction:column",
      "align-items:center", "justify-content:center",
      "font-family:monospace", "z-index:9999",
    ].join(";");

    const lockIcon = document.createElement("div");
    lockIcon.style.cssText = "font-size:3.5rem; margin-bottom:1.2rem;";
    lockIcon.textContent = "🔒";

    const titleEl = document.createElement("div");
    titleEl.style.cssText =
      "font-size:1.5rem; color:#ff2251; letter-spacing:.2em; font-weight:700;";
    titleEl.textContent = "ACCESSO NEGATO";

    const subEl = document.createElement("div");
    subEl.style.cssText =
      "font-size:.85rem; color:#7a6e8e; margin-top:.8rem; letter-spacing:.05em;";

    const counterSpan = document.createElement("span");
    counterSpan.style.color = "#8a2be2";
    counterSpan.textContent = "2";

    subEl.appendChild(document.createTextNode("Reindirizzamento tra "));
    subEl.appendChild(counterSpan);
    subEl.appendChild(document.createTextNode("s..."));

    overlay.appendChild(lockIcon);
    overlay.appendChild(titleEl);
    overlay.appendChild(subEl);
    document.body.appendChild(overlay);

    // Mostra solo l'overlay
    document.body.style.display = "block";

    // Countdown 2 secondi → redirect a login
    let count = 2;
    const tick = setInterval(function () {
      count--;
      counterSpan.textContent = count;
      if (count <= 0) {
        clearInterval(tick);
        window.location.href = "login.html";
      }
    }, 1000);

    return; // ferma tutta l'esecuzione successiva
  }

  /* ══════════════════════════════════════════════════════
     3 — TASK MANAGER (eseguito SOLO se autenticato)
     ══════════════════════════════════════════════════════ */

  /* ── USERNAME + CHIAVE LOCALSTORAGE PER-UTENTE (PRO) ──
     Ogni utente ha la sua chiave separata:
       admin  → "tasks_admin"
       grant  → "tasks_grant"
     Così due utenti diversi non vedono i task dell'altro.
  */
  const currentUser = getCookie("current_user") || "utente";
  const STORAGE_KEY = "tasks_" + currentUser;

  // Stato applicazione
  let tasks         = [];
  let currentLayout = "list";    // "list" | "kanban"
  let currentFilter = "all";     // "all" | "todo" | "doing" | "done"
  let currentSort   = "none";    // "none" | "date" | "status"

  /* ── RIFERIMENTI DOM ──────────────────────────────────── */
  const taskInput      = document.getElementById("taskInput");
  const dateInput      = document.getElementById("dateInput");
  const addBtn         = document.getElementById("addBtn");
  const errorContainer = document.getElementById("errorContainer");
  const mainContainer  = document.getElementById("mainContainer");
  const taskCountEl    = document.getElementById("taskCount");
  const controlsBar    = document.getElementById("controlsBar");
  const listControls   = document.getElementById("listControls");
  const filterSelect   = document.getElementById("filterSelect");
  const sortSelect     = document.getElementById("sortSelect");
  const btnList        = document.getElementById("btnList");
  const btnKanban      = document.getElementById("btnKanban");
  const logoutBtn      = document.getElementById("logout-btn");
  const sessionTimerEl = document.getElementById("session-timer");
  const greetingEl     = document.getElementById("user-greeting");

  /* ── LOCALSTORAGE ─────────────────────────────────────── */

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  /* ── RENDER ───────────────────────────────────────────── */

  function render() {
    // Svuota il contenitore principale
    mainContainer.innerHTML = "";

    // Aggiorna contatore
    taskCountEl.textContent = tasks.length + " task";

    // Mostra/nascondi barra controlli
    if (tasks.length > 0) {
      controlsBar.classList.remove("hidden");
    } else {
      controlsBar.classList.add("hidden");
    }

    // In modalità kanban, nascondi filtro/ordine (le colonne già mostrano lo stato)
    if (listControls) {
      if (currentLayout === "kanban") {
        listControls.classList.add("hidden");
      } else {
        listControls.classList.remove("hidden");
      }
    }

    // Applica filtro e ordinamento (solo per vista lista)
    let filtered = tasks.slice(); // copia

    if (currentFilter !== "all") {
      filtered = filtered.filter(function (t) {
        return t.status === currentFilter;
      });
    }

    if (currentSort === "date") {
      filtered.sort(function (a, b) {
        return (a.date || "").localeCompare(b.date || "");
      });
    } else if (currentSort === "status") {
      const order = { todo: 0, doing: 1, done: 2 };
      filtered.sort(function (a, b) {
        return (order[a.status] || 0) - (order[b.status] || 0);
      });
    }

    if (currentLayout === "list") {
      renderList(filtered);
    } else {
      renderKanban();
    }
  }

  /* ── VISTA LISTA ──────────────────────────────────────── */

  function renderList(filtered) {
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";

      const icon = document.createElement("span");
      icon.className = "empty-icon";
      icon.textContent = "✓";

      const msg = document.createElement("p");
      msg.textContent = tasks.length === 0
        ? "Nessun task ancora. Aggiungine uno!"
        : "Nessun task corrisponde al filtro selezionato.";

      empty.appendChild(icon);
      empty.appendChild(msg);
      mainContainer.appendChild(empty);
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "task-list";

    filtered.forEach(function (task) {
      ul.appendChild(createTaskItem(task, "list"));
    });

    mainContainer.appendChild(ul);
  }

  /* ── VISTA KANBAN ─────────────────────────────────────── */

  function renderKanban() {
    /*
     * Il kanban usa SEMPRE tutti i task (non il filtered)
     * e li divide in tre colonne per stato.
     * Il filtro e l'ordinamento non si applicano al kanban
     * perché le colonne già organizzano per stato.
     */
    const columns = [
      { status: "todo",  label: "Da fare",    icon: "○" },
      { status: "doing", label: "In corso",   icon: "◑" },
      { status: "done",  label: "Completato", icon: "●" },
    ];

    const board = document.createElement("div");
    board.className = "kanban-board";

    columns.forEach(function (col) {
      const colTasks = tasks.filter(function (t) {
        return t.status === col.status;
      });

      const colEl = document.createElement("div");
      colEl.className = "kanban-col";
      colEl.dataset.status = col.status;

      // Header
      const header = document.createElement("div");
      header.className = "kanban-col-header";

      const headerTitle = document.createElement("span");
      headerTitle.textContent = col.icon + " " + col.label;
      header.appendChild(headerTitle);

      const badge = document.createElement("span");
      badge.className = "kanban-col-count";
      badge.textContent = colTasks.length;
      header.appendChild(badge);

      colEl.appendChild(header);

      // Body
      const body = document.createElement("div");
      body.className = "kanban-col-body";

      if (colTasks.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.className = "kanban-empty";
        emptyMsg.textContent = "Nessun task";
        body.appendChild(emptyMsg);
      } else {
        colTasks.forEach(function (task) {
          body.appendChild(createTaskItem(task, "kanban"));
        });
      }

      colEl.appendChild(body);
      board.appendChild(colEl);
    });

    mainContainer.appendChild(board);
  }

  /* ── CREA ELEMENTO TASK ───────────────────────────────── */

  function createTaskItem(task, layout) {
    /*
     * Usiamo createElement per ogni elemento (no innerHTML).
     * dataset.id collega l'elemento HTML all'oggetto nel array.
     */
    const item = layout === "list"
      ? document.createElement("li")
      : document.createElement("div");

    item.className = "task-item status-" + task.status;
    item.dataset.id = task.id;

    // Testo task
    const textEl = document.createElement("span");
    textEl.className = "task-text";
    textEl.textContent = task.title;
    item.appendChild(textEl);

    // Data scadenza
    const dateEl = document.createElement("span");
    dateEl.className = "task-date";
    dateEl.textContent = formatDate(task.date);
    item.appendChild(dateEl);

    // Select stato (Da fare / In corso / Completato)
    const select = document.createElement("select");
    select.className = "status-select";

    const statuses = [
      { value: "todo",  label: "Da fare"    },
      { value: "doing", label: "In corso"   },
      { value: "done",  label: "Completato" },
    ];

    statuses.forEach(function (s) {
      const opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = s.label;
      if (s.value === task.status) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", function () {
      updateStatus(task.id, this.value);
    });

    item.appendChild(select);

    // Bottone Rimuovi
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.textContent = "Rimuovi";
    removeBtn.addEventListener("click", function () {
      removeTask(task.id);
    });

    item.appendChild(removeBtn);
    return item;
  }

  /* ── OPERAZIONI SUI TASK ──────────────────────────────── */

  function addTask() {
    clearError();

    const title = taskInput.value.trim();
    const date  = dateInput.value;

    if (!title) {
      showError("Inserisci il nome del task.");
      taskInput.focus();
      return;
    }

    if (!date) {
      showError("Seleziona una data di scadenza.");
      dateInput.classList.add("input-error");
      dateInput.focus();
      return;
    }

    // Confronta con la data odierna (formato YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      showError("La data non può essere nel passato.");
      dateInput.classList.add("input-error");
      return;
    }

    // Crea l'oggetto task e aggiungilo all'array
    tasks.push({
      id:     Date.now(), // timestamp come ID univoco
      title:  title,
      date:   date,
      status: "todo",
    });

    saveTasks();

    taskInput.value = "";
    dateInput.value = "";
    taskInput.focus();

    render();
  }

  function removeTask(id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    saveTasks();
    render();
  }

  function updateStatus(id, newStatus) {
    /*
     * Troviamo l'oggetto tramite id (letto da dataset.id nell'HTML).
     * Aggiorniamo solo la proprietà status, poi salviamo e ri-renderizziamo.
     */
    const task = tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    task.status = newStatus;
    saveTasks();
    render();
  }

  /* ── GESTIONE ERRORI ──────────────────────────────────── */

  function showError(msg) {
    clearError();
    const div = document.createElement("div");
    div.className = "error-message";
    const icon = document.createElement("span");
    icon.textContent = "⚠ ";
    div.appendChild(icon);
    div.appendChild(document.createTextNode(msg));
    errorContainer.appendChild(div);
  }

  function clearError() {
    while (errorContainer.firstChild) {
      errorContainer.removeChild(errorContainer.firstChild);
    }
    dateInput.classList.remove("input-error");
  }

  /* ── FORMATTAZIONE DATA ───────────────────────────────── */

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-"); // ["2025", "12", "31"]
    return parts[2] + "/" + parts[1] + "/" + parts[0]; // "31/12/2025"
  }

  /* ── SESSION TIMER (PRO) ──────────────────────────────── */

  function initSessionTimer() {
    if (!sessionTimerEl) return;

    /*
     * Al login, login.js ha scritto session_expires = timestamp ms.
     * Calcoliamo la differenza con Date.now() ogni secondo.
     * Quando scade → logout automatico.
     */
    const expiresAt = parseInt(getCookie("session_expires") || "0", 10);

    if (!expiresAt) {
      sessionTimerEl.textContent = "";
      return;
    }

    function tick() {
      const remaining = expiresAt - Date.now();

      if (remaining <= 0) {
        logout();
        return;
      }

      const totalSec = Math.floor(remaining / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;

      const display = h > 0
        ? h + "h " + String(m).padStart(2, "0") + "m"
        : m + "m " + String(s).padStart(2, "0") + "s";

      sessionTimerEl.textContent = "⏱ " + display;

      // Warning rosso quando mancano meno di 5 minuti
      if (remaining < 5 * 60 * 1000) {
        sessionTimerEl.classList.add("timer-warning");
      } else {
        sessionTimerEl.classList.remove("timer-warning");
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ── LOGOUT ───────────────────────────────────────────── */

  function logout() {
    /*
     * Cancelliamo tutti i cookie di sessione.
     * NON cancelliamo il localStorage: i task rimangono salvati
     * e l'utente li ritrova al prossimo login.
     */
    deleteCookie("isLoggedIn");
    deleteCookie("current_user");
    deleteCookie("session_expires");
    deleteCookie("auth_ticket");
    window.location.href = "login.html";
  }

  /* ── EVENT LISTENERS ──────────────────────────────────── */

  addBtn.addEventListener("click", addTask);

  taskInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") addTask();
  });

  if (filterSelect) {
    filterSelect.addEventListener("change", function () {
      currentFilter = this.value;
      render();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      currentSort = this.value;
      render();
    });
  }

  btnList.addEventListener("click", function () {
    currentLayout = "list";
    btnList.classList.add("active");
    btnKanban.classList.remove("active");
    render();
  });

  btnKanban.addEventListener("click", function () {
    currentLayout = "kanban";
    btnKanban.classList.add("active");
    btnList.classList.remove("active");
    render();
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  /* ── INIT ─────────────────────────────────────────────── */

  // Saluto personalizzato (usa l'username dal cookie)
  if (greetingEl) {
    greetingEl.textContent = "Ciao, " + currentUser;
  }

  // Carica task dal localStorage e renderizza
  tasks = loadTasks();
  render();

  // Avvia il session timer
  initSessionTimer();
});
