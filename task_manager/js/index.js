/* ============================================
   INDEX.JS — TaskFlow Task Manager
   
   ARCHITETTURA (Data-first):
   Array tasks[] → saveTasks() → localStorage
                              ↘ render() → DOM

   Ogni azione:
   1. Modifica i dati (array)
   2. Salva nel localStorage
   3. Chiama render() che ricostruisce il DOM

   Questo evita inconsistenze tra dati e UI.
   ============================================ */

// ════════════════════════════════════════════
// SEZIONE 1: AUTENTICAZIONE E COOKIE
// ════════════════════════════════════════════

// FUNZIONE: getCookie
// Legge document.cookie, lo divide in coppie chiave=valore
// e cerca quella col nome richiesto.
function getCookie(name) {
  return document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(name + '='))
    ?.split('=')[1] || null;
}

// FUNZIONE: deleteCookie
// Per "cancellare" un cookie impostiamo una scadenza nel passato.
// Il browser lo rimuove automaticamente.
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

// ── Controllo accesso all'avvio ──
const isLoggedIn = getCookie('isLoggedIn');

if (!isLoggedIn || isLoggedIn !== 'true') {
  // Nascondi tutto il body per sicurezza visiva
  document.getElementById('app').classList.add('hidden');
  document.getElementById('access-denied').classList.remove('hidden');
  // Dopo 2 secondi reindirizza al login
  setTimeout(() => { window.location.href = 'login.html'; }, 2000);
}

// ── Dati sessione utente ──
const USERNAME    = getCookie('username') || 'guest';
const LOGIN_TIME  = parseInt(getCookie('loginTime')) || Date.now();
// Chiave localStorage personalizzata per utente (Data Integrity)
const STORAGE_KEY = `tasks_${USERNAME}`;

// Mostra username nella topbar
document.getElementById('user-badge').textContent = `@${USERNAME}`;

// ── Logout ──
document.getElementById('logout-btn').addEventListener('click', () => {
  deleteCookie('isLoggedIn');
  deleteCookie('username');
  deleteCookie('loginTime');
  window.location.href = 'login.html';
});

// ════════════════════════════════════════════
// SEZIONE 2: SESSION TIMER (PRO)
// Calcola il tempo trascorso dalla loginTime del cookie
// e mostra un conto alla rovescia (sessione max 60 min)
// ════════════════════════════════════════════
const SESSION_DURATION = 60 * 60 * 1000; // 60 minuti in ms
const timerEl = document.getElementById('session-timer');

function updateTimer() {
  const elapsed   = Date.now() - LOGIN_TIME;
  const remaining = SESSION_DURATION - elapsed;
  if (remaining <= 0) {
    // Sessione scaduta → logout automatico
    deleteCookie('isLoggedIn');
    window.location.href = 'login.html';
    return;
  }
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const pad  = n => String(n).padStart(2, '0');
  timerEl.textContent = `⏱ ${pad(mins)}:${pad(secs)}`;
  // Avvisa quando mancano meno di 5 minuti
  timerEl.classList.toggle('warning', mins < 5);
}
updateTimer();
setInterval(updateTimer, 1000);

// ════════════════════════════════════════════
// SEZIONE 3: GESTIONE DATI (localStorage)
// ════════════════════════════════════════════

// FUNZIONE: getTasks
// JSON.parse converte la stringa JSON salvata in un array JavaScript.
// Se non esiste ancora nulla, torniamo un array vuoto [].
function getTasks() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

// FUNZIONE: saveTasks
// JSON.stringify converte l'array JavaScript in una stringa JSON
// e la salva nel localStorage con la chiave personalizzata.
function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ════════════════════════════════════════════
// SEZIONE 4: STATO DELL'INTERFACCIA
// Variabili che tengono traccia del filtro e vista attivi
// ════════════════════════════════════════════
let currentFilter = 'all';   // 'all' | 'todo' | 'doing' | 'done'
let currentSort   = 'newest'; // 'newest' | 'oldest' | 'due' | 'status'
let currentView   = 'list';  // 'list' | 'kanban'

// ════════════════════════════════════════════
// SEZIONE 5: FUNZIONE RENDER
// Questa è il cuore dell'app. Viene chiamata ogni volta
// che i dati cambiano. Svuota il container e lo ricostruisce.
// ════════════════════════════════════════════
function render() {
  const tasks     = getTasks();
  const container = document.getElementById('task-container');
  const emptyState = document.getElementById('empty-state');

  // 1. FILTRA i task in base al filtro attivo
  let filtered = tasks.filter(task => {
    if (currentFilter === 'all')  return true;
    return task.status === currentFilter;
  });

  // 2. ORDINA i task
  filtered.sort((a, b) => {
    if (currentSort === 'newest') return b.id - a.id;
    if (currentSort === 'oldest') return a.id - b.id;
    if (currentSort === 'due') {
      if (!a.dueDate) return 1;  // i task senza data vanno in fondo
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (currentSort === 'status') {
      const order = { todo: 0, doing: 1, done: 2 };
      return order[a.status] - order[b.status];
    }
    return 0;
  });

  // 3. SVUOTA il container (innerHTML='' rimuove tutti i figli)
  container.innerHTML = '';

  // 4. Mostra stato vuoto se non ci sono task
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    updateCounter(tasks);
    return;
  }
  emptyState.classList.add('hidden');

  // 5. DISEGNA in base alla vista corrente
  if (currentView === 'list') {
    renderList(filtered, container);
  } else {
    renderKanban(filtered, container);
  }

  updateCounter(tasks);
}

// ── Render: Vista Lista ──
function renderList(tasks, container) {
  container.className = 'list-view';

  tasks.forEach(task => {
    const li = createTaskCard(task);
    container.appendChild(li);
  });
}

// ── Render: Vista Kanban ──
function renderKanban(tasks, container) {
  container.className = 'kanban-view';

  const columns = [
    { key: 'todo',  label: 'Da fare' },
    { key: 'doing', label: 'In corso' },
    { key: 'done',  label: 'Completato' }
  ];

  columns.forEach(col => {
    // Filtra i task di questa colonna
    const colTasks = tasks.filter(t => t.status === col.key);

    // Crea la colonna
    const colEl = document.createElement('div');
    colEl.className = 'kanban-col';

    // Header colonna
    const header = document.createElement('div');
    header.className = `kanban-col-header ${col.key}`;

    const labelEl = document.createElement('span');
    labelEl.textContent = col.label;

    const badge = document.createElement('span');
    badge.className = 'kanban-badge';
    badge.textContent = colTasks.length;

    header.appendChild(labelEl);
    header.appendChild(badge);
    colEl.appendChild(header);

    // Body della colonna
    const body = document.createElement('div');
    body.className = 'kanban-body';

    colTasks.forEach(task => {
      const card = createTaskCard(task, true); // true = modalità kanban
      body.appendChild(card);
    });

    colEl.appendChild(body);
    container.appendChild(colEl);
  });
}

// ════════════════════════════════════════════
// FUNZIONE: createTaskCard
// Costruisce l'elemento HTML per un singolo task.
// isKanban: true → layout compatto per kanban
// ════════════════════════════════════════════
function createTaskCard(task, isKanban = false) {
  const card = document.createElement('div');
  card.className = `task-card ${task.status}${isKanban ? ' kanban-card' : ''}`;
  // dataset.id memorizza l'ID del task nell'HTML
  // Lo useremo per trovare il task nell'array quando cambia stato o viene rimosso
  card.dataset.id = task.id;

  // Titolo
  const titleEl = document.createElement('span');
  titleEl.className = 'task-title-text';
  titleEl.textContent = task.title;

  // Informazioni (data)
  const metaEl = document.createElement('div');
  metaEl.className = 'task-meta';

  if (task.dueDate) {
    const dueEl   = document.createElement('span');
    const today   = new Date().toISOString().split('T')[0];
    const isToday = task.dueDate === today;
    const isPast  = task.dueDate < today && task.status !== 'done';
    dueEl.className = `task-due${isPast ? ' overdue' : isToday ? ' today' : ''}`;
    dueEl.textContent = (isPast ? '⚠ ' : isToday ? '◉ ' : '◷ ') + formatDate(task.dueDate);
    metaEl.appendChild(dueEl);
  }

  // Select per cambiare stato (PRO: modificabile inline)
  const select = document.createElement('select');
  select.className = `status-select ${task.status}`;
  [
    { value: 'todo',  label: 'Da fare' },
    { value: 'doing', label: 'In corso' },
    { value: 'done',  label: 'Completato' }
  ].forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === task.status) option.selected = true;
    select.appendChild(option);
  });

  // Quando l'utente cambia la select → aggiorna il task
  select.addEventListener('change', () => {
    updateTaskStatus(task.id, select.value);
  });

  // Pulsante rimuovi
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-remove';
  removeBtn.setAttribute('aria-label', 'Rimuovi task');
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => removeTask(task.id, card));

  // Assembla l'elemento
  const mainEl = document.createElement('div');
  mainEl.className = 'task-main';
  mainEl.appendChild(titleEl);
  if (task.dueDate) mainEl.appendChild(metaEl);

  if (isKanban) {
    // Layout kanban: titolo + meta + actions
    const actionsEl = document.createElement('div');
    actionsEl.className = 'task-actions';
    actionsEl.appendChild(select);
    actionsEl.appendChild(removeBtn);
    card.appendChild(titleEl);
    if (task.dueDate) card.appendChild(metaEl);
    card.appendChild(actionsEl);
  } else {
    // Layout lista: tutto in riga
    card.appendChild(mainEl);
    card.appendChild(select);
    card.appendChild(removeBtn);
  }

  return card;
}

// ════════════════════════════════════════════
// SEZIONE 6: AZIONI SUI TASK
// ════════════════════════════════════════════

function addTask() {
  const titleInput  = document.getElementById('task-title');
  const dueInput    = document.getElementById('task-due');
  const statusInput = document.getElementById('task-status');
  const errorBox    = document.getElementById('error-box');

  const title   = titleInput.value.trim();
  const dueDate = dueInput.value;
  const status  = statusInput.value;

  // Validazione: titolo obbligatorio
  if (!title) {
    showError('⚠ Inserisci un titolo per il task.');
    titleInput.focus();
    return;
  }

  // Validazione: data non nel passato (se specificata)
  if (dueDate) {
    const today = new Date().toISOString().split('T')[0];
    if (dueDate < today) {
      showError('⚠ La data di scadenza non può essere nel passato.');
      dueInput.focus();
      return;
    }
  }

  errorBox.classList.add('hidden');

  // Crea il nuovo oggetto task
  // id: timestamp univoco (Date.now() → millisecondi da epoch)
  const newTask = {
    id:       Date.now(),
    title:    title,
    status:   status,
    dueDate:  dueDate || null,
    createdAt: new Date().toISOString()
  };

  // PATTERN DATA-FIRST:
  // 1. Leggi i dati attuali
  // 2. Aggiungi il nuovo task
  // 3. Salva tutto
  // 4. Ridisegna l'UI
  const tasks = getTasks();
  tasks.push(newTask);
  saveTasks(tasks);

  // Reset form
  titleInput.value  = '';
  dueInput.value    = '';
  statusInput.value = 'todo';

  render();
  titleInput.focus();
}

function removeTask(id, cardEl) {
  // Animazione di uscita
  cardEl.classList.add('removing');
  setTimeout(() => {
    const tasks    = getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    saveTasks(filtered);
    render();
  }, 280);
}

function updateTaskStatus(id, newStatus) {
  const tasks = getTasks();
  // .find() cerca nell'array l'oggetto con quell'id
  const task  = tasks.find(t => t.id === id);
  if (task) {
    task.status = newStatus;
    saveTasks(tasks);
    render();
  }
}

// ════════════════════════════════════════════
// SEZIONE 7: CONTATORE E UTILITÀ
// ════════════════════════════════════════════

function updateCounter(tasks) {
  document.getElementById('count-total').textContent = tasks.length;
  document.getElementById('count-done').textContent  = tasks.filter(t => t.status === 'done').length;
}

function showError(msg) {
  const box = document.getElementById('error-box');
  box.textContent = msg;
  box.classList.remove('hidden');
  // Auto-nascondi dopo 4 secondi
  clearTimeout(box._timeout);
  box._timeout = setTimeout(() => box.classList.add('hidden'), 4000);
}

// Formatta 'YYYY-MM-DD' in formato italiano 'GG/MM/YY'
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// ════════════════════════════════════════════
// SEZIONE 8: EVENT LISTENERS
// ════════════════════════════════════════════

// Aggiungi task
document.getElementById('add-btn').addEventListener('click', addTask);

// Invio con tasto Enter nel campo titolo
document.getElementById('task-title').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

// Filtri: usiamo la delegazione degli eventi sul container padre
// invece di attaccare un listener a ogni singolo bottone
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

// Ordinamento
document.getElementById('sort-select').addEventListener('change', e => {
  currentSort = e.target.value;
  render();
});

// Switcher di vista
document.getElementById('view-list').addEventListener('click', () => {
  currentView = 'list';
  document.getElementById('view-list').classList.add('active');
  document.getElementById('view-kanban').classList.remove('active');
  render();
});
document.getElementById('view-kanban').addEventListener('click', () => {
  currentView = 'kanban';
  document.getElementById('view-kanban').classList.add('active');
  document.getElementById('view-list').classList.remove('active');
  render();
});

// ── Avvio: prima render al caricamento della pagina ──
render();
