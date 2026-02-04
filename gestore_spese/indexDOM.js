document.addEventListener("DOMContentLoaded", () => {
  const desc_spesa = document.querySelector(".text_input");
  const importo_spesa = document.querySelector(".importo");
  const div_errore = document.querySelector(".div_errore");
  const btn_aggiungi = document.querySelector(".btn_aggiungi");
  const menu_risultati = document.querySelector(".risultati ul");
  const totaleSpese = document.querySelector(".totale-spese");

  function calcolaTotale() {
    let totale = 0;
    menu_risultati.querySelectorAll("li").forEach((li) => {
      const importoText = li.textContent.match(/€([\d.,]+)/);
      if (importoText) {
        totale += parseFloat(importoText[1].replace(",", "."));
      }
    });

    totaleSpese.textContent = `€ ${totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

    if (totale > 100) {
      totaleSpese.classList.add("totale-alto");
      div_errore.textContent = "⚠️ Spesa totale elevata!";
      div_errore.classList.add("errore");
    } else {
      totaleSpese.classList.remove("totale-alto");
      div_errore.classList.remove("errore");
    }
  }

  btn_aggiungi.addEventListener("click", () => {
    const descrizione = desc_spesa.value.trim();
    const importo = parseFloat(importo_spesa.value);

    if (descrizione === "" || isNaN(importo) || importo <= 0) {
      div_errore.textContent = "Uno o più campi sono vuoti o non validi";
      div_errore.classList.add("errore");
      return;
    }

    const voce = document.createElement("li");
    voce.textContent = `${descrizione}: €${importo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

    if (importo > 50) {
      voce.classList.add("spesa-alta");
    }

    const btnRimuovi = document.createElement("button");
    btnRimuovi.textContent = "✕";
    btnRimuovi.className = "btn-rimuovi";
    btnRimuovi.addEventListener("click", () => {
      voce.remove(); // Rimuove li
      calcolaTotale(); // Ricalcola
    });

    voce.appendChild(btnRimuovi);
    menu_risultati.appendChild(voce);

    desc_spesa.value = "";
    importo_spesa.value = "";
    div_errore.innerHTML = "";
    div_errore.classList.remove("errore");
    calcolaTotale();
  });

  calcolaTotale();
});
