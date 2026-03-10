/* ============================================
   LOGIN.JS — TaskFlow
   
   PROCESSO: 
   1. Leggiamo credenziali dall'input
   2. Validiamo con regex (password forte)
   3. Confrontiamo con dati statici
   4. Se OK → scriviamo il cookie → redirect
   ============================================ */

// ── Credenziali statiche (in un progetto reale: backend) ──
const CREDENTIALS = {
  admin: 'Admin123!'
};

// ── Selezione elementi DOM ──
const usernameInput  = document.getElementById('username');
const passwordInput  = document.getElementById('password');
const rememberMe     = document.getElementById('remember-me');
const loginBtn       = document.getElementById('login-btn');
const messageBox     = document.getElementById('message-box');
const togglePassword = document.getElementById('toggle-password');
const passwordHint   = document.getElementById('password-hint');

// ════════════════════════════════════════════
// FUNZIONE: setCookie
// Crea un cookie nel browser.
// - name: nome del cookie
// - value: valore da salvare
// - days: se undefined → Session Cookie (scade alla chiusura del browser)
// ════════════════════════════════════════════
function setCookie(name, value, days) {
  let expires = '';
  if (days) {
    const date = new Date();
    // .setTime aggiunge millisecondi: days × 24h × 60min × 60sec × 1000ms
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }
  // path=/ → il cookie è leggibile da TUTTE le pagine del sito
  document.cookie = `${name}=${value}${expires}; path=/`;
}

// ════════════════════════════════════════════
// FUNZIONE: showMessage
// Mostra un messaggio colorato dentro #message-box
// type: 'error' | 'success'
// ════════════════════════════════════════════
function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className   = `message-box ${type}`;
  // Forza il reflow per re-triggerare l'animazione shake
  void messageBox.offsetWidth;
}

// ════════════════════════════════════════════
// PRO: Validazione password con RegEx
// Regex spiegazione:
//   (?=.{8,})      → minimo 8 caratteri
//   (?=.*[A-Z])    → almeno 1 lettera maiuscola
//   (?=.*[0-9])    → almeno 1 numero
//   (?=.*[!@#$%^&*]) → almeno 1 carattere speciale
// ════════════════════════════════════════════
const PASSWORD_REGEX = /^(?=.{8,})(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/;

function validatePasswordStrength(pwd) {
  if (pwd.length === 0)   return '';
  if (pwd.length < 8)     return 'Minimo 8 caratteri';
  if (!/[A-Z]/.test(pwd)) return 'Serve almeno 1 maiuscola';
  if (!/[0-9]/.test(pwd)) return 'Serve almeno 1 numero';
  if (!/[!@#$%^&*]/.test(pwd)) return 'Serve 1 carattere speciale (!@#$...)';
  return '';
}

// Feedback in tempo reale mentre l'utente scrive la password
passwordInput.addEventListener('input', () => {
  passwordHint.textContent = validatePasswordStrength(passwordInput.value);
});

// ════════════════════════════════════════════
// PRO: Toggle visibilità password
// Cambiamo il type dell'input tra 'password' e 'text'
// ════════════════════════════════════════════
togglePassword.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  
  // Aggiorniamo l'icona SVG
  const icon = document.getElementById('eye-icon');
  if (isHidden) {
    icon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    `;
  } else {
    icon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }
});

// ════════════════════════════════════════════
// EVENTO PRINCIPALE: click sul pulsante Login
// ════════════════════════════════════════════
loginBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const remember = rememberMe.checked;

  // 1. Campi vuoti?
  if (!username || !password) {
    showMessage('⚠ Compila tutti i campi.', 'error');
    return;
  }

  // 2. Password abbastanza forte?
  const hint = validatePasswordStrength(password);
  if (hint) {
    showMessage(`⚠ Password non valida: ${hint}`, 'error');
    return;
  }

  // 3. Credenziali corrette?
  if (CREDENTIALS[username] && CREDENTIALS[username] === password) {
    showMessage('✓ Accesso riuscito. Reindirizzamento…', 'success');

    // Scriviamo i cookie:
    // - remember=true → scade dopo 7 giorni
    // - remember=false → Session Cookie (nessuna scadenza = si cancella alla chiusura del browser)
    const days = remember ? 7 : undefined;
    setCookie('isLoggedIn', 'true', days);
    setCookie('username',   username, days);
    setCookie('loginTime',  Date.now(), days);

    // Dopo 800ms redirect all'app principale
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 800);

  } else {
    showMessage('✗ Username o password errati.', 'error');
    // Piccolo feedback visivo sulla card
    loginBtn.style.animation = 'none';
  }
});

// Permetti di fare login anche premendo Invio
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') passwordInput.focus();
});
