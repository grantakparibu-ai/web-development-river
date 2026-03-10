/* ============================================
   DASHBOARD.JS — TaskFlow Analytics
   
   PROCESSO:
   1. Verifica autenticazione (stesso cookie)
   2. Legge i task dal localStorage (stessa chiave)
   3. Calcola statistiche (funzioni pure)
   4. Inizializza Chart.js con i dati
   5. Genera la tabella via createElement
   6. Applica filtri temporali
   ============================================ */

// ════════════════════════════════════════════
// SEZIONE 1: AUTENTICAZIONE
// ════════════════════════════════════════════
function getCookie(name) {
  return document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(name + '='))
    ?.split('=')[1] || null;
}
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

const isLoggedIn = getCookie('isLoggedIn');
if (!isLoggedIn || isLoggedIn !== 'true') {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('access-denied').classList.remove('hidden');
  setTimeout(() => { window.location.href = 'login.html'; }, 2000);
}

const USERNAME    = getCookie('username') || 'guest';
const STORAGE_KEY = `tasks_${USERNAME}`;
document.getElementById('user-badge').textContent = `@${USERNAME}`;

document.getElementById('logout-btn').addEventListener('click', () => {
  deleteCookie('isLoggedIn');
  deleteCookie('username');
  deleteCookie('loginTime');
  window.location.href = 'login.html';
});

// ════════════════════════════════════════════
// SEZIONE 2: LETTURA DATI
// ════════════════════════════════════════════
function getTasks() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

// ════════════════════════════════════════════
// SEZIONE 3: FUNZIONI DI CALCOLO
// Sono funzioni "pure": dato un input, tornano sempre lo stesso output.
// Facile da testare e riutilizzare.
// ════════════════════════════════════════════

// Calcola le statistiche base dell'array tasks
function calcStats(tasks) {
  const total = tasks.length;
  const todo  = tasks.filter(t => t.status === 'todo').length;
  const doing = tasks.filter(t => t.status === 'doing').length;
  const done  = tasks.filter(t => t.status === 'done').length;
  // Percentuale: se total è 0, evitiamo divisione per zero
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, todo, doing, done, pct };
}

// Calcola le scadenze (PRO: filtro temporale)
function calcDueDates(tasks) {
  const today    = new Date().toISOString().split('T')[0];
  // Data di fine settimana: oggi + 7 giorni
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const dueToday   = tasks.filter(t => t.dueDate === today).length;
  const dueWeek    = tasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= nextWeek).length;
  const overdue    = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;

  return { dueToday, dueWeek, overdue };
}

// Filtra task per categoria temporale
function filterByTime(tasks, timeFilter) {
  const today    = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  switch (timeFilter) {
    case 'today':   return tasks.filter(t => t.dueDate === today);
    case 'week':    return tasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= nextWeek);
    case 'overdue': return tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
    default:        return tasks;
  }
}

// ════════════════════════════════════════════
// SEZIONE 4: GRAFICO (Chart.js)
// Chart.js usa un elemento <canvas> come "tela" per disegnare.
// Dobbiamo passargli:
//   - type: tipo di grafico ('pie', 'bar', 'line'...)
//   - data: le etichette e i valori
//   - options: configurazioni visive
// ════════════════════════════════════════════
let chartInstance = null; // Riferimento globale per poterlo aggiornare

function renderChart(stats) {
  const ctx = document.getElementById('myChart').getContext('2d');

  // Se esiste già un grafico, lo distruggiamo prima di crearne uno nuovo
  // (altrimenti Chart.js darebbe errore di canvas già in uso)
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'doughnut', // torta con buco centrale
    data: {
      labels: ['Da fare', 'In corso', 'Completati'],
      datasets: [{
        data: [stats.todo, stats.doing, stats.done],
        backgroundColor: [
          'rgba(74,158,255,0.8)',  // --todo
          'rgba(240,165,0,0.8)',   // --doing
          'rgba(76,175,125,0.8)'   // --done
        ],
        borderColor: [
          'rgba(74,158,255,1)',
          'rgba(240,165,0,1)',
          'rgba(76,175,125,1)'
        ],
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      cutout: '65%', // percentuale del buco centrale
      plugins: {
        legend: { display: false }, // gestiamo la legenda manualmente
        tooltip: {
          backgroundColor: '#16161c',
          borderColor: '#2a2a38',
          borderWidth: 1,
          titleColor: '#e8e6e0',
          bodyColor: '#6b6878',
          callbacks: {
            label: (ctx) => ` ${ctx.parsed} task (${stats.total > 0 ? Math.round(ctx.parsed/stats.total*100) : 0}%)`
          }
        }
      }
    }
  });

  // Legenda personalizzata
  const legendEl = document.getElementById('chart-legend');
  legendEl.innerHTML = '';
  const items = [
    { label: 'Da fare',    color: '#4a9eff', val: stats.todo },
    { label: 'In corso',   color: '#f0a500', val: stats.doing },
    { label: 'Completati', color: '#4caf7d', val: stats.done }
  ];
  items.forEach(item => {
    const div   = document.createElement('div');
    div.className = 'legend-item';
    const dot   = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = item.color;
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = item.label;
    const val   = document.createElement('span');
    val.className = 'legend-val';
    val.textContent = item.val;
    div.appendChild(dot);
    div.appendChild(label);
    div.appendChild(val);
    legendEl.appendChild(div);
  });
}

// ════════════════════════════════════════════
// SEZIONE 5: TABELLA RIEPILOGATIVA
// Usiamo createElement (NON innerHTML) come richiesto.
// ════════════════════════════════════════════
function renderTable(stats) {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = ''; // svuota prima di ricaricare

  const rows = [
    { key: 'todo',  label: 'Da fare',    count: stats.todo },
    { key: 'doing', label: 'In corso',   count: stats.doing },
    { key: 'done',  label: 'Completati', count: stats.done }
  ];

  rows.forEach(row => {
    const pct = stats.total > 0 ? Math.round(row.count / stats.total * 100) : 0;
    const tr  = document.createElement('tr');

    // Cella: stato
    const tdStatus = document.createElement('td');
    const dot = document.createElement('span');
    dot.className = `status-dot ${row.key}`;
    dot.textContent = row.label;
    tdStatus.appendChild(dot);

    // Cella: quantità
    const tdCount = document.createElement('td');
    tdCount.textContent = row.count;
    tdCount.style.fontWeight = '600';

    // Cella: percentuale
    const tdPct = document.createElement('td');
    tdPct.textContent = `${pct}%`;
    tdPct.style.color = 'var(--text-muted)';

    // Cella: barra visiva
    const tdBar = document.createElement('td');
    const barCont = document.createElement('div');
    barCont.className = 'bar-container';
    const barFill = document.createElement('div');
    barFill.className = `bar-fill ${row.key}`;
    barFill.style.width = '0%'; // parte da 0 per l'animazione
    barCont.appendChild(barFill);
    tdBar.appendChild(barCont);

    tr.appendChild(tdStatus);
    tr.appendChild(tdCount);
    tr.appendChild(tdPct);
    tr.appendChild(tdBar);
    tbody.appendChild(tr);

    // Animazione della barra (con setTimeout per triggherare la transizione CSS)
    setTimeout(() => { barFill.style.width = `${pct}%`; }, 50);
  });
}

// ════════════════════════════════════════════
// SEZIONE 6: LISTA TASK FILTRATA
// ════════════════════════════════════════════
function renderFilteredList(tasks, timeFilter) {
  const filtered    = filterByTime(tasks, timeFilter);
  const listEl      = document.getElementById('filtered-list');
  const emptyEl     = document.getElementById('filtered-empty');
  const labelEl     = document.getElementById('filtered-label');
  const labels      = { all: 'tutti', today: 'in scadenza oggi', week: 'in scadenza questa settimana', overdue: 'scaduti' };
  
  labelEl.textContent = labels[timeFilter] || 'tutti';
  listEl.innerHTML    = '';

  if (filtered.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  filtered.forEach((task, i) => {
    const today  = new Date().toISOString().split('T')[0];
    const div    = document.createElement('div');
    div.className = 'filtered-task';
    div.style.animationDelay = `${i * 0.04}s`;

    const titleEl = document.createElement('span');
    titleEl.className = 'filtered-task-title';
    titleEl.textContent = task.title;

    const badge = document.createElement('span');
    badge.className = `filter-badge ${task.status}`;
    badge.textContent = { todo: 'Da fare', doing: 'In corso', done: 'Completato' }[task.status];

    div.appendChild(titleEl);

    if (task.dueDate) {
      const dueEl = document.createElement('span');
      dueEl.className = 'filtered-task-due';
      const isPast  = task.dueDate < today && task.status !== 'done';
      dueEl.textContent = (isPast ? '⚠ ' : '◷ ') + task.dueDate;
      if (isPast) dueEl.style.color = 'var(--error)';
      div.appendChild(dueEl);
    }

    div.appendChild(badge);
    listEl.appendChild(div);
  });
}

// ════════════════════════════════════════════
// SEZIONE 7: RENDER PRINCIPALE
// Aggiorna tutti i componenti della dashboard
// ════════════════════════════════════════════
function renderDashboard(timeFilter = 'all') {
  const tasks   = getTasks();
  const stats   = calcStats(tasks);
  const due     = calcDueDates(tasks);

  // KPI cards
  document.getElementById('kpi-total-val').textContent = stats.total;
  document.getElementById('kpi-todo-val').textContent  = stats.todo;
  document.getElementById('kpi-doing-val').textContent = stats.doing;
  document.getElementById('kpi-done-val').textContent  = stats.done;

  // Percentuale completamento
  document.getElementById('completion-pct').textContent =
    stats.total > 0
      ? `Hai completato il ${stats.pct}% dei tuoi obiettivi`
      : 'Nessun task ancora. Inizia aggiungendone uno!';

  // Banner congratulazioni (PRO)
  const congratsBanner = document.getElementById('congrats-banner');
  if (stats.total > 0 && stats.pct === 100) {
    congratsBanner.classList.remove('hidden');
  } else {
    congratsBanner.classList.add('hidden');
  }

  // Scadenze
  document.getElementById('due-today').textContent   = due.dueToday;
  document.getElementById('due-week').textContent    = due.dueWeek;
  document.getElementById('due-overdue').textContent = due.overdue;

  // Grafico e tabella
  renderChart(stats);
  renderTable(stats);

  // Lista filtrata
  renderFilteredList(tasks, timeFilter);
}

// ── Filtro temporale ──
document.getElementById('time-filter').addEventListener('change', (e) => {
  renderDashboard(e.target.value);
});

// ── Avvio ──
renderDashboard();
