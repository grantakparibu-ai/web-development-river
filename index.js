// 1. Calcolatore di Prezzo Finale
const PREZZO_BASE = 50;
const codiceSconto = "STUDENTE";

if (codiceSconto === "STUDENTE" && PREZZO_BASE > 40) {
  const prezzoFinale = PREZZO_BASE * 0.8;
  console.log(prezzoFinale);
} else {
  console.log("Prezzo pieno");
}

// 2. Semaforo Semplice (if/else if)
const coloreSemaforo = "giallo";

if (coloreSemaforo === "verde") {
  console.log("Avanti!");
} else if (coloreSemaforo === "giallo") {
  console.log("Attenzione, rallentare.");
} else {
  console.log("Fermo, aspetta.");
}

// 3. Funzione per la Potenza
function calcolaPotenza(base, esponente) {
  return base ** esponente;
}

const risultatoPotenza = calcolaPotenza(2, 5);
console.log(risultatoPotenza);

// 4. Controllo del Limite di Età
const ETA_MINIMA_LEGGE = 18;

function puoAccedere(eta) {
  return eta >= ETA_MINIMA_LEGGE;
}

// Test con età maggiore di 18
console.log(puoAccedere(20)); // Stampa true
// Test con età minore di 18
console.log(puoAccedere(16)); // Stampa false

// ---
// Categoria 2: Avanzati
// ---

// 5. Incremento di Array con map()
const livelli = [5, 12, 8, 20];
const nuoviLivelli = livelli.map((livello) => livello + 1);

console.log(livelli); // Stampa [5, 12, 8, 20]
console.log(nuoviLivelli); // Stampa [6, 13, 9, 21]

// 6. Calcolo del Totale con forEach()
const spese = [15.5, 4.99, 30.0, 10.0];
let totale = 0;

spese.forEach((spesa) => {
  totale += spesa;
});

console.log(totale.toFixed(2)); // Stampa 60.49

// 7. Filtro con Ciclo for...of
const prodotti = ["latte", "pane", "uova", "formaggio", "burro"];
const soloLatticini = [];

for (const prodotto of prodotti) {
  if (
    prodotto.includes("latte") ||
    prodotto.includes("formaggio") ||
    prodotto.includes("burro")
  ) {
    soloLatticini.push(prodotto);
  }
}

console.log(soloLatticini); // Stampa ['latte', 'formaggio', 'burro']

// 8. Creazione di Oggetti con map()
const utentiId = ["u101", "u102", "u103"];

const utentiOggetti = utentiId.map((id) => ({
  id: id,
  attivo: true,
}));

console.log(utentiOggetti);
/* Stampa:
[
  { id: 'u101', attivo: true },
  { id: 'u102', attivo: true },
  { id: 'u103', attivo: true }
]
*/

// ---
// Categoria 3: DOM & Interazione
// Gli esercizi dal 9 al 12 richiedono la presenza di un file HTML e CSS
// e verranno eseguiti in un contesto di browser.
// Il codice JS che segue è la soluzione da inserire nel tag <script>
// o in un file JS collegato all'HTML.
// ---

/*
// ESEMPIO DI SETUP HTML NECESSARIO:
// <div id="box-colore" style="height: 50px; width: 50px; background-color: lightgray;"></div>
// <button id="tasto-toggle">Toggle ON/OFF</button>
// <input type="number" id="input-numero">
// <p id="risultato-input">Nessun valore inserito.</p>
// <h3 id="todo-titolo">Caricamento ToDo...</h3>

// ESEMPIO DI SETUP CSS NECESSARIO:
// .bordo-blu { border: 2px solid blue; }
// .sfondo-rosso { background-color: red !important; }
*/

// Codice JS per gli esercizi 9-12 (Assumendo l'HTML è stato preparato):

document.addEventListener("DOMContentLoaded", () => {
  // 9. Selezione e Stili
  const boxColore = document.querySelector("#box-colore");
  if (boxColore) {
    boxColore.classList.add("bordo-blu");
  }

  // 10. Toggle Interattivo (Tasto ON/OFF)
  const tastoToggle = document.querySelector("#tasto-toggle");
  const corpoPagina = document.body; // Elemento a scelta

  const toggleClasse = () => {
    corpoPagina.classList.toggle("sfondo-rosso"); // Assumendo esista una classe .sfondo-rosso nel CSS
    tastoToggle.textContent = corpoPagina.classList.contains("sfondo-rosso")
      ? "Toggle ON"
      : "Toggle OFF";
  };

  if (tastoToggle) {
    tastoToggle.addEventListener("click", toggleClasse);
    tastoToggle.textContent = "Toggle OFF";
  }

  // 11. Gestione Input e change Event
  const inputNumero = document.querySelector("#input-numero");
  const risultatoInput = document.querySelector("#risultato-input");

  if (inputNumero && risultatoInput) {
    inputNumero.addEventListener("change", () => {
      const valore = inputNumero.value;
      risultatoInput.textContent = `Hai inserito: ${valore}`;
    });
  }

  // 12. Fetch API e Visualizzazione (Todo API)
  const todoTitolo = document.querySelector("#todo-titolo");

  if (todoTitolo) {
    fetch("https://jsonplaceholder.typicode.com/todos/5")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Risposta di rete non OK");
        }
        return response.json();
      })
      .then((datiJson) => {
        todoTitolo.textContent = datiJson.title;
      })
      .catch((error) => {
        console.error("Errore durante il fetch:", error);
        todoTitolo.textContent = "Errore durante il caricamento del ToDo.";
      });
  }
});
