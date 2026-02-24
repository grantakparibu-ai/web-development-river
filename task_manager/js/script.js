/* ================================================================
   TASK MANAGER — script.js
   Architettura: Data Layer (array + localStorage) → Render (DOM)
   ================================================================

   FLUSSO GENERALE:
   1. L'utente interagisce (click, cambio select, ecc.)
   2. JS aggiorna l'ARRAY dei dati in memoria
   3. JS salva l'array nel localStorage (persistenza)
   4. JS chiama render() che svuota il DOM e lo ricostruisce
      leggendo i dati aggiornati dall'array

   Principio chiave: il DOM è solo uno SPECCHIO dei dati.
   Non è mai la fonte di verità.
================================================================ */

/* ----------------------------------------------------------------
   COSTANTI
   ---------------------------------------------------------------- */

// Chiave usata per leggere/scrivere nel localStorage.
// Centralizzarla evita errori di battitura (typo) sparsi nel codice.
document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "taskmanager_tasks";

  /* ----------------------------------------------------------------
   SELEZIONE ELEMENTI DAL DOM
   ---------------------------------------------------------------- */
  const taskInput = document.getElementById("taskInput");
  const dateInput = document.getElementById("dateInput");
  const addBtn = document.getElementById("addBtn");
  const errorContainer = document.getElementById("errorContainer");
  const taskCount = document.getElementById("taskCount");
  const filterSelect = document.getElementById("filterSelect");
  const sortSelect = document.getElementById("sortSelect");
  const controlsBar = document.getElementById("controlsBar");
  const listControls = document.getElementById("listControls");
  const btnList = document.getElementById("btnList");
  const btnKanban = document.getElementById("btnKanban");
  const mainContainer = document.getElementById("mainContainer");

  /* ----------------------------------------------------------------
   STATO DELL'APPLICAZIONE
   currentLayout: 'list' | 'kanban'
   Questa variabile è in memoria, non nel DOM né nel localStorage.
   Si azzera ad ogni refresh (va bene per un layout switcher).
   ---------------------------------------------------------------- */
  let currentLayout = "list";

  /* ================================================================
   STEP 1 — DATA LAYER: localStorage
   Separare la lettura/scrittura dal resto del codice ci permette
   di cambiare il sistema di persistenza (es. passare a un'API)
   toccando solo queste due funzioni.
================================================================ */

  /* ----------------------------------------------------------------
   getTasks()
   Legge la stringa JSON dal localStorage e la converte in array.

   Perché || [] ?
   Se la chiave non esiste ancora (primo avvio), localStorage
   restituisce null. JSON.parse(null) restituisce null, non [].
   Con || [] garantiamo di restituire sempre un array valido.
   ---------------------------------------------------------------- */
  function getTasks() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }

  /* ----------------------------------------------------------------
   saveTasks(tasks)
   Converte l'array in stringa JSON e la scrive nel localStorage.
   Chiamata OGNI VOLTA che i dati cambiano (aggiunta, modifica,
   eliminazione) prima di richiamare render().
   ---------------------------------------------------------------- */
  function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  /* ----------------------------------------------------------------
   generateId()
   Genera un ID numerico unico basandosi sul timestamp corrente.
   Date.now() restituisce i millisecondi dall'Epoch Unix:
   praticamente impossibile avere due ID uguali in uso normale.
   ---------------------------------------------------------------- */
  function generateId() {
    return Date.now();
  }

  /* ================================================================
   UTILITY: messaggi di errore
================================================================ */

  function showError(message) {
    while (errorContainer.firstChild) {
      errorContainer.removeChild(errorContainer.firstChild);
    }
    const p = document.createElement("p");
    p.textContent = message;
    p.classList.add("error-message");
    errorContainer.appendChild(p);
  }

  function clearError() {
    while (errorContainer.firstChild) {
      errorContainer.removeChild(errorContainer.firstChild);
    }
  }

  /* ================================================================
   CREAZIONE ELEMENTO TASK
   Funzione riutilizzata sia da renderList() che da renderKanban().
   Riceve un oggetto task e restituisce un elemento <li> completo.
================================================================ */

  /* ----------------------------------------------------------------
   buildTaskElement(task)
   Costruisce e restituisce un <li> per un singolo task.
   Incapsula tutta la logica di creazione DOM di un task,
   così renderList e renderKanban non la duplicano.

   IMPORTANTE: usa task.id per impostare dataset.id sul nodo.
   Questo attributo data-id è il "ponte" tra DOM e array:
   quando l'utente modifica o elimina, leggiamo dataset.id
   per trovare l'oggetto corrispondente nell'array.
   ---------------------------------------------------------------- */
  function buildTaskElement(task) {
    /* --- Contenitore li --- */
    const li = document.createElement("li");
    li.classList.add("task-item", `status-${task.status}`);

    // dataset.id collega questo nodo DOM all'oggetto nell'array.
    // Sarà letto come stringa, quindi nelle ricerche usiamo ==
    // oppure convertiamo con Number().
    li.dataset.id = task.id;

    /* --- Testo del task --- */
    const taskSpan = document.createElement("span");
    taskSpan.textContent = task.title;
    taskSpan.classList.add("task-text");

    /* --- Data di scadenza --- */
    const dateSpan = document.createElement("span");
    dateSpan.classList.add("task-date");
    if (task.date) {
      const d = new Date(task.date + "T00:00:00");
      dateSpan.textContent =
        "📅 " +
        d.toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
    } else {
      dateSpan.textContent = "—";
    }

    /* --- Select per lo stato --- */
    const statusSelect = document.createElement("select");
    statusSelect.classList.add("status-select");

    // Mappa: valore → etichetta leggibile
    const statusOptions = [
      { value: "todo", label: "Da fare" },
      { value: "doing", label: "In corso" },
      { value: "done", label: "Completato" },
    ];

    statusOptions.forEach(function (opt) {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      // Preseleziona l'opzione corrispondente allo stato attuale
      if (opt.value === task.status) {
        option.selected = true;
      }
      statusSelect.appendChild(option);
    });

    /*
    STEP 2 — Cambio stato:
    Quando la select cambia:
    1. Leggiamo l'id dal dataset del li padre
    2. Troviamo l'oggetto nell'array con .find()
    3. Aggiorniamo task.status
    4. Salviamo nel localStorage
    5. Ri-eseguiamo render() → il DOM si aggiorna
  */
    statusSelect.addEventListener("change", function () {
      const id = Number(li.dataset.id); // dataset restituisce stringa → convertiamo
      const tasks = getTasks();
      const taskObj = tasks.find(function (t) {
        return t.id === id;
      });

      if (taskObj) {
        taskObj.status = statusSelect.value; // modifica l'oggetto nell'array
        saveTasks(tasks); // persiste l'array aggiornato
        render(); // ridisegna il DOM dai dati
      }
    });

    /* --- Pulsante Rimuovi --- */
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Rimuovi";
    removeBtn.classList.add("btn", "btn-remove");

    removeBtn.addEventListener("click", function () {
      const id = Number(li.dataset.id);
      let tasks = getTasks();
      // .filter() crea un NUOVO array senza il task eliminato
      tasks = tasks.filter(function (t) {
        return t.id !== id;
      });
      saveTasks(tasks);
      render();
    });

    /* --- Assemblaggio --- */
    li.appendChild(taskSpan);
    li.appendChild(dateSpan);
    li.appendChild(statusSelect);
    li.appendChild(removeBtn);

    return li;
  }

  /* ================================================================
   STEP 3 — RENDERING
   Due funzioni di visualizzazione che leggono gli stessi dati
   e li mostrano in modo diverso.
================================================================ */

  /* ----------------------------------------------------------------
   renderList(tasks)
   Crea un <ul> con tutti i task in ordine.
   Applica filtro e ordinamento leggendo i select della barra
   controlli.
   ---------------------------------------------------------------- */
  function renderList(tasks) {
    /* --- Filtro --- */
    const filter = filterSelect.value; // 'all' | 'todo' | 'doing' | 'done'
    let filtered = tasks;

    if (filter !== "all") {
      filtered = tasks.filter(function (t) {
        return t.status === filter;
      });
    }

    /* --- Ordinamento --- */
    const sort = sortSelect.value; // 'none' | 'date' | 'status'

    if (sort === "date") {
      filtered = filtered.slice().sort(function (a, b) {
        // I task senza data vanno in fondo
        const da = a.date || "9999-99-99";
        const db = b.date || "9999-99-99";
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
      });
    }

    if (sort === "status") {
      // Ordine: todo → doing → done
      const order = { todo: 0, doing: 1, done: 2 };
      filtered = filtered.slice().sort(function (a, b) {
        return order[a.status] - order[b.status];
      });
    }

    /* --- Costruzione ul --- */
    const ul = document.createElement("ul");
    ul.classList.add("task-list");

    if (filtered.length === 0) {
      // Mostriamo un messaggio se non ci sono task (o il filtro è vuoto)
      const empty = document.createElement("div");
      empty.classList.add("empty-state");
      empty.textContent =
        filter === "all"
          ? "Nessun task. Aggiungine uno!"
          : "Nessun task corrisponde al filtro.";
      mainContainer.appendChild(empty);
      return; // non aggiungiamo la ul
    }

    filtered.forEach(function (task) {
      ul.appendChild(buildTaskElement(task));
    });

    mainContainer.appendChild(ul);
  }

  /* ----------------------------------------------------------------
   renderKanban(tasks)
   Crea 3 colonne affiancate.
   Usa .filter() per distribuire i task nelle colonne giuste.

   La logica è chiara: una colonna per stato, filter() seleziona
   solo i task con quello status.
   ---------------------------------------------------------------- */
  function renderKanban(tasks) {
    const columns = [
      { status: "todo", label: "Da fare" },
      { status: "doing", label: "In corso" },
      { status: "done", label: "Completato" },
    ];

    /* --- Wrapper a 3 colonne --- */
    const board = document.createElement("div");
    board.classList.add("kanban-board");

    columns.forEach(function (col) {
      /* --- Filtra i task per questa colonna --- */
      const colTasks = tasks.filter(function (t) {
        return t.status === col.status;
      });

      /* --- Colonna --- */
      const colEl = document.createElement("div");
      colEl.classList.add("kanban-col");
      colEl.dataset.status = col.status; // usato dal CSS per colorare l'header

      /* --- Header colonna con etichetta e contatore --- */
      const header = document.createElement("div");
      header.classList.add("kanban-col-header");

      const headerLabel = document.createElement("span");
      headerLabel.textContent = col.label;

      const headerCount = document.createElement("span");
      headerCount.classList.add("kanban-col-count");
      headerCount.textContent = colTasks.length;

      header.appendChild(headerLabel);
      header.appendChild(headerCount);

      /* --- Body colonna: lista task --- */
      const body = document.createElement("div");
      body.classList.add("kanban-col-body");

      if (colTasks.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.classList.add("kanban-empty");
        emptyMsg.textContent = "Nessun task";
        body.appendChild(emptyMsg);
      } else {
        colTasks.forEach(function (task) {
          body.appendChild(buildTaskElement(task));
        });
      }

      /* --- Assemblaggio colonna --- */
      colEl.appendChild(header);
      colEl.appendChild(body);
      board.appendChild(colEl);
    });

    mainContainer.appendChild(board);
  }

  /* ----------------------------------------------------------------
   render()
   Funzione "orchestratore" centrale.
   Legge l'array dal localStorage, svuota il contenitore
   e chiama la funzione di visualizzazione corretta.

   Perché innerHTML = '' per svuotare?
   È il metodo più diretto per azzerare completamente un
   contenitore prima di ridisegnarlo. I vecchi nodi non
   ci servono più: vengono rimpiazzati dai nuovi basati
   sui dati aggiornati. (Come da suggerimento dell'esercizio.)
   ---------------------------------------------------------------- */
  function render() {
    const tasks = getTasks();

    /* --- Svuota il contenitore --- */
    mainContainer.innerHTML = "";

    /* --- Aggiorna il contatore nell'header --- */
    // Legge tasks.length dall'array, non dal DOM: la fonte di verità
    // sono i dati, non il numero di elementi visibili.
    taskCount.textContent =
      tasks.length === 1 ? "1 task" : `${tasks.length} task`;

    /* --- Mostra/nascondi barra controlli --- */
    if (tasks.length === 0) {
      controlsBar.classList.add("hidden");
    } else {
      controlsBar.classList.remove("hidden");
    }

    /* --- Mostra/nascondi filtri (solo in vista lista) --- */
    if (currentLayout === "kanban") {
      listControls.classList.add("hidden");
    } else {
      listControls.classList.remove("hidden");
    }

    /* --- Caso speciale: nessun task nel sistema --- */
    if (tasks.length === 0) {
      const empty = document.createElement("div");
      empty.classList.add("empty-state");

      const icon = document.createElement("span");
      icon.classList.add("empty-icon");
      icon.textContent = "○";

      const msg = document.createElement("p");
      msg.textContent = "Nessun task. Aggiungine uno!";

      empty.appendChild(icon);
      empty.appendChild(msg);
      mainContainer.appendChild(empty);
      return;
    }

    /* --- Chiama la visualizzazione corretta --- */
    if (currentLayout === "kanban") {
      renderKanban(tasks);
    } else {
      renderList(tasks);
    }
  }

  /* ================================================================
   STEP 1 — AGGIUNTA TASK
   Legge input → valida → crea oggetto → aggiorna array →
   salva → render()
================================================================ */

  function addTask() {
    const title = taskInput.value.trim();
    const dateValue = dateInput.value;

    /* --- Validazione 1: testo obbligatorio --- */
    if (title === "") {
      showError("⚠ Il nome del task non può essere vuoto.");
      return;
    }

    /* --- Validazione 2: data OBBLIGATORIA ---
     La data è richiesta. Se manca:
     - mostriamo il messaggio di errore
     - aggiungiamo la classe .input-error sull'input (bordo rosso via CSS)
     - spostiamo il focus sull'input data
     La classe viene rimossa a validazione superata (clearError + rimozione). */
    if (dateValue === "") {
      showError("⚠ La data di scadenza è obbligatoria.");
      dateInput.classList.add("input-error");
      dateInput.focus();
      return;
    }

    /* --- Validazione 3: data non nel passato --- */
    const scadenza = new Date(dateValue + "T00:00:00");
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    if (scadenza < oggi) {
      showError("⚠ La data di scadenza non può essere nel passato.");
      dateInput.classList.add("input-error");
      dateInput.focus();
      return;
    }

    /* Validazione superata: rimuoviamo stili di errore */
    clearError();
    dateInput.classList.remove("input-error");

    /* --- Crea l'oggetto task --- */
    // Struttura: { id, title, status, date }
    const newTask = {
      id: generateId(),
      title: title,
      status: "todo", // stato iniziale sempre "da fare"
      date: dateValue, // stringa 'YYYY-MM-DD' o '' se non inserita
    };

    /* --- Carica array esistente, aggiunge il nuovo task, salva --- */
    const tasks = getTasks();
    tasks.push(newTask);
    saveTasks(tasks);

    /* --- Ridisegna il DOM --- */
    render();

    /* --- Pulizia input --- */
    taskInput.value = "";
    dateInput.value = "";
    taskInput.focus();
  }

  /* ================================================================
   EVENT LISTENERS
================================================================ */

  // Aggiunta task
  addBtn.addEventListener("click", addTask);

  taskInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") addTask();
  });

  // Filtro e ordinamento → aggiornano la vista lista
  filterSelect.addEventListener("change", render);
  sortSelect.addEventListener("change", render);

  /*
  Layout switcher:
  Cambiano currentLayout e aggiornano le classi .active
  sui pulsanti, poi chiamano render().
  I DATI non vengono toccati.
*/
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

  /* ================================================================
   AVVIO APPLICAZIONE
   Chiamiamo render() subito: se nel localStorage ci sono task
   salvati da sessioni precedenti, vengono mostrati immediatamente.
================================================================ */
  render();
});
