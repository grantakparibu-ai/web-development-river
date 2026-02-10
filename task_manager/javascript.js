 <script>
        // --- STEP 1: LOGICA JAVASCRIPT ---
        const input = document.getElementById('task-input');
        const addBtn = document.getElementById('add-btn');
        const taskList = document.getElementById('task-list');
        const errorContainer = document.getElementById('error-container');

        addBtn.addEventListener('click', () => {
            const taskText = input.value.trim();

            // Reset errore
            errorContainer.textContent = "";

            // Validazione
            if (taskText === "") {
                errorContainer.textContent = "Per favore, inserisci un task!";
                return;
            }

            // Creazione elementi con createElement
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = taskText;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = "Rimuovi";
            removeBtn.classList.add('remove-btn');

            // Logica per rimuovere il task
            removeBtn.addEventListener('click', () => {
                li.remove(); // Uso di remove() per eliminare l'elemento
            });

            // Assemblaggio e aggiunta al DOM
            li.appendChild(span);
            li.appendChild(removeBtn);
            taskList.appendChild(li);

            // Pulizia input
            input.value = "";
            input.focus();
        });
    </script>