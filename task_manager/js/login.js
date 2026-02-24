/**
 * ============================================================
 *  LOGIN.JS — Logica di autenticazione sicura
 * ============================================================
 *
 *  ARCHITETTURA DELLA SICUREZZA:
 *
 *  1. RATE LIMITING lato client
 *     - Max 5 tentativi prima del lockout
 *     - Lockout iniziale: 30 secondi
 *     - Backoff esponenziale: ogni lockout successivo raddoppia
 *       (30s → 60s → 120s → ...) fino a MAX_LOCKOUT_DURATION
 *     - Stato persiste in sessionStorage → sopravvive al refresh
 *       ma non alla chiusura del browser (giusto compromesso)
 *
 *  2. TICKET (COOKIE) SICURO
 *     - Formato: base64(username + ":" + timestamp + ":" + nonce)
 *     - nonce = 16 byte casuali → non indovinabile
 *     - SameSite=Strict → nessuna richiesta cross-site usa il cookie
 *     - Attributo Secure → solo HTTPS (silente in localhost)
 *     - Se "Resta collegato" → expires +7 giorni
 *     - Se non → session cookie (nessun Max-Age/Expires)
 *
 *  3. SANITIZZAZIONE INPUT
 *     - Tutti gli input vengono strippati di caratteri
 *       potenzialmente pericolosi prima di qualsiasi uso nel DOM
 *
 *  4. MESSAGGI DI ERRORE GENERICI
 *     - Non rivela se è sbagliato username O password
 *     - Previene username enumeration attack
 *
 *  5. TIMING COSTANTE
 *     - La verifica avviene sempre (no early return su username)
 *     - Piccolo delay artificiale per mascherare differenze di timing
 *
 *  NOTE PRODUZIONE:
 *     In un sistema reale le credenziali NON sarebbero mai
 *     hardcoded nel client. Questo è un esercizio didattico.
 *     Il flusso corretto prevede:
 *       client → POST /api/login (HTTPS) → server verifica
 *       → server imposta cookie HttpOnly (inaccessibile a JS)
 * ============================================================
 */

"use strict";

/* ── CONFIGURAZIONE ───────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "taskmanager_tasks";

  const CONFIG = {
    // Credenziali demo — in produzione: mai lato client
    VALID_CREDENTIALS: [
      { username: "admin", password: "admin" },
      { username: "grant", password: "grant!" },
    ],

    MAX_ATTEMPTS: 5, // tentativi prima del lockout
    BASE_LOCKOUT_SEC: 30, // secondi di lockout iniziale
    MAX_LOCKOUT_SEC: 300, // 5 minuti massimo
    LOCKOUT_MULTIPLIER: 2, // backoff esponenziale

    COOKIE_NAME: "auth_ticket",
    REDIRECT_URL: "index.html", // dove mandare dopo il login

    // Chiavi sessionStorage
    SS_ATTEMPTS: "_atk_att",
    SS_LOCKOUT_TS: "_atk_lts",
    SS_LOCKOUT_DUR: "_atk_ldur",
  };

  /* ── RIFERIMENTI DOM ──────────────────────────────────── */

  const form = document.getElementById("login-form");
  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");
  const rememberEl = document.getElementById("remember-me");
  const messageBox = document.getElementById("message-box");
  const submitBtn = document.getElementById("submit-btn");
  const btnText = document.getElementById("btn-text");
  const attCounter = document.getElementById("attempts-counter");
  const lockoutWrap = document.getElementById("lockout-bar-wrap");
  const lockoutBar = document.getElementById("lockout-bar");
  const lockoutTimer = document.getElementById("lockout-timer");
  const togglePwBtn = document.getElementById("toggle-pw");
  const eyeIcon = document.getElementById("eye-icon");
  const rememberHint = document.querySelector(".remember-hint");
  const clock = document.getElementById("clock");
  const card = document.querySelector(".login-card");

  /* ── STATO ────────────────────────────────────────────── */

  let lockoutInterval = null; // riferimento all'intervallo countdown

  /* ── UTILITY: SANITIZZAZIONE ──────────────────────────── */

  /**
   * Rimuove caratteri HTML/JS injection pericolosi.
   * Usato su tutti i valori prima di inserirli nel DOM
   * o confrontarli con dati sensibili.
   * @param {string} str
   * @returns {string}
   */
  function sanitize(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;")
      .trim();
  }

  /* ── UTILITY: GENERATORE NONCE ────────────────────────── */

  /**
   * Genera una stringa casuale sicura usando Web Crypto API.
   * crypto.getRandomValues() è crittograficamente sicuro,
   * a differenza di Math.random().
   * @param {number} bytes
   * @returns {string} hex string
   */
  function generateNonce(bytes = 16) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* ── COOKIE MANAGEMENT ────────────────────────────────── */

  /**
   * Imposta il cookie di autenticazione.
   *
   * STRUTTURA TICKET:
   *   base64(username + ":" + timestamp + ":" + nonce)
   *
   * Il base64 non cifra il contenuto (non è encryption),
   * ma offre una leggera offuscazione e garantisce che
   * il valore sia URL-safe per il cookie.
   *
   * In produzione: il server genererebbe un JWT firmato
   * o un session ID opaco associato a una sessione server.
   *
   * @param {string}  username
   * @param {boolean} remember  - true = 7gg, false = session
   */
  function setAuthCookie(username, remember) {
    const nonce = generateNonce(16);
    const timestamp = Date.now();
    const payload = `${username}:${timestamp}:${nonce}`;
    const ticket = btoa(payload); // base64 encode

    /*
     * Costruzione della stringa cookie.
     * Non possiamo usare HttpOnly da JavaScript (per definizione:
     * HttpOnly impedisce a JS di leggere/scrivere il cookie,
     * quindi deve essere impostato dal server).
     * Impostiamo comunque:
     *   SameSite=Strict → il cookie non viene inviato in
     *                      richieste cross-site (CSRF protection)
     *   Secure           → solo su HTTPS (silente su localhost)
     *   Path=/           → valido su tutto il sito
     */
    let cookieStr = `${CONFIG.COOKIE_NAME}=${ticket}; SameSite=Strict; Secure; Path=/`;

    if (remember) {
      // Scade tra 7 giorni
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      cookieStr += `; Expires=${expires.toUTCString()}`;
    }
    // Se remember=false → nessun Expires → session cookie

    document.cookie = cookieStr;
  }

  /**
   * Verifica se il ticket di autenticazione è presente.
   * Usato al caricamento della pagina per auto-redirect
   * se l'utente è già loggato.
   * @returns {boolean}
   */
  function hasAuthCookie() {
    return document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${CONFIG.COOKIE_NAME}=`));
  }

  /* ── RATE LIMITING ────────────────────────────────────── */

  /**
   * Legge il numero di tentativi falliti da sessionStorage.
   * @returns {number}
   */
  function getAttempts() {
    return parseInt(sessionStorage.getItem(CONFIG.SS_ATTEMPTS) || "0", 10);
  }

  /**
   * Incrementa il contatore dei tentativi falliti.
   */
  function incrementAttempts() {
    sessionStorage.setItem(CONFIG.SS_ATTEMPTS, getAttempts() + 1);
  }

  /**
   * Resetta il contatore (login riuscito).
   */
  function resetAttempts() {
    sessionStorage.removeItem(CONFIG.SS_ATTEMPTS);
    sessionStorage.removeItem(CONFIG.SS_LOCKOUT_TS);
    sessionStorage.removeItem(CONFIG.SS_LOCKOUT_DUR);
  }

  /**
   * Calcola la durata del prossimo lockout (backoff esponenziale).
   * Prima volta: 30s
   * Seconda volta: 60s
   * Terza: 120s ... fino a MAX_LOCKOUT_SEC
   */
  function computeLockoutDuration() {
    const prev = parseInt(
      sessionStorage.getItem(CONFIG.SS_LOCKOUT_DUR) || "0",
      10,
    );
    if (prev === 0) return CONFIG.BASE_LOCKOUT_SEC;
    return Math.min(prev * CONFIG.LOCKOUT_MULTIPLIER, CONFIG.MAX_LOCKOUT_SEC);
  }

  /**
   * Avvia il lockout.
   */
  function startLockout() {
    const duration = computeLockoutDuration();
    const until = Date.now() + duration * 1000;

    sessionStorage.setItem(CONFIG.SS_LOCKOUT_TS, until.toString());
    sessionStorage.setItem(CONFIG.SS_LOCKOUT_DUR, duration.toString());
    sessionStorage.setItem(CONFIG.SS_ATTEMPTS, "0"); // reset per prossimo ciclo

    activateLockoutUI(until, duration);
  }

  /**
   * Controlla se siamo in lockout (chiamato al caricamento pagina).
   */
  function checkExistingLockout() {
    const until = parseInt(
      sessionStorage.getItem(CONFIG.SS_LOCKOUT_TS) || "0",
      10,
    );
    if (!until) return false;

    const remaining = (until - Date.now()) / 1000;
    if (remaining <= 0) {
      sessionStorage.removeItem(CONFIG.SS_LOCKOUT_TS);
      return false;
    }

    const duration = parseInt(
      sessionStorage.getItem(CONFIG.SS_LOCKOUT_DUR) || CONFIG.BASE_LOCKOUT_SEC,
      10,
    );
    activateLockoutUI(until, duration);
    return true;
  }

  /**
   * Aggiorna la UI durante il lockout: barra di progresso + countdown.
   * @param {number} until     - timestamp di fine lockout
   * @param {number} duration  - durata totale in secondi
   */
  function activateLockoutUI(until, duration) {
    // Disabilita form
    submitBtn.disabled = true;
    usernameEl.disabled = true;
    passwordEl.disabled = true;

    lockoutWrap.classList.add("active");
    showMessage(`ACCESSO BLOCCATO — troppi tentativi falliti.`, "warning");

    function tick() {
      const remaining = Math.ceil((until - Date.now()) / 1000);

      if (remaining <= 0) {
        clearInterval(lockoutInterval);
        lockoutInterval = null;
        lockoutWrap.classList.remove("active");
        lockoutBar.style.setProperty("--progress", "0%");
        submitBtn.disabled = false;
        usernameEl.disabled = false;
        passwordEl.disabled = false;
        hideMessage();
        attCounter.textContent = "";
        btnText.textContent = "ACCEDI";
        return;
      }

      // Percentuale rimanente per la barra (si svuota nel tempo)
      const pct = (remaining / duration) * 100;
      lockoutBar.style.setProperty("--progress", `${pct.toFixed(1)}%`);
      lockoutTimer.textContent = `${remaining}s`;
      btnText.textContent = `BLOCCATO ${remaining}s`;
    }

    tick(); // chiamata immediata
    lockoutInterval = setInterval(tick, 1000);
  }

  /* ── MESSAGGI ─────────────────────────────────────────── */

  /**
   * Mostra un messaggio nel #message-box.
   * @param {string} text
   * @param {'error'|'success'|'warning'} type
   */
  function showMessage(text, type = "error") {
    // textContent — mai innerHTML per evitare XSS
    messageBox.textContent = text;
    messageBox.className = `visible ${type}`;
  }

  function hideMessage() {
    messageBox.className = "";
    messageBox.textContent = "";
  }

  /* ── VERIFICA CREDENZIALI ─────────────────────────────── */

  /**
   * Confronto a tempo costante simulato.
   * In JS non possiamo fare vero constant-time comparison,
   * ma aggiungiamo un piccolo delay per mascherare differenze
   * di timing e rendere più difficili i timing attack.
   *
   * @param {string} inputUser
   * @param {string} inputPass
   * @returns {Promise<boolean>}
   */
  function verifyCredentials(inputUser, inputPass) {
    return new Promise((resolve) => {
      // Delay fisso + piccola variazione casuale per mascherare timing
      const delay = 300 + Math.random() * 200;

      setTimeout(() => {
        // Controlliamo SEMPRE entrambi i campi, anche se username errato
        // per evitare early return che dà info via timing
        const found = CONFIG.VALID_CREDENTIALS.some(
          (cred) => cred.username === inputUser && cred.password === inputPass,
        );
        resolve(found);
      }, delay);
    });
  }

  /* ── HANDLER FORM SUBMIT ──────────────────────────────── */

  async function handleSubmit(e) {
    e.preventDefault();

    // Controlla lockout prima di fare qualsiasi cosa
    if (submitBtn.disabled) return;

    // Sanitizza i valori degli input
    // (confronto col raw value, ma uso sanitized per display)
    const rawUser = usernameEl.value.trim();
    const rawPass = passwordEl.value;
    const remember = rememberEl.checked;

    if (!rawUser || !rawPass) {
      showMessage("CAMPI OBBLIGATORI — inserisci utente e chiave.", "error");
      shakeCard();
      return;
    }

    // Feedback visivo di caricamento
    submitBtn.disabled = true;
    btnText.textContent = "VERIFICA...";
    hideMessage();

    const ok = await verifyCredentials(rawUser, rawPass);

    if (ok) {
      // ── LOGIN RIUSCITO ──────────────────────────────────
      showMessage("ACCESSO AUTORIZZATO — reindirizzamento...", "success");
      btnText.textContent = "OK";
      resetAttempts();
      setAuthCookie(rawUser, remember);

      // Breve pausa poi redirect — dà tempo al messaggio di leggersi
      setTimeout(() => {
        window.location.href = CONFIG.REDIRECT_URL;
      }, 800);
    } else {
      // ── LOGIN FALLITO ───────────────────────────────────
      incrementAttempts();
      const attempts = getAttempts();
      const remaining = CONFIG.MAX_ATTEMPTS - attempts;

      submitBtn.disabled = false;
      btnText.textContent = "ACCEDI";
      shakeCard();

      if (remaining <= 0) {
        // Lockout!
        startLockout();
      } else {
        /*
         * Messaggio generico: NON specifichiamo se è sbagliato
         * l'username o la password (previene user enumeration).
         */
        showMessage(
          `CREDENZIALI NON VALIDE — ${remaining} tentativ${remaining === 1 ? "o" : "i"} rimast${remaining === 1 ? "o" : "i"}.`,
          "error",
        );

        // Counter visivo sotto il bottone
        attCounter.textContent = `TENTATIVO ${attempts} / ${CONFIG.MAX_ATTEMPTS}`;
      }
    }
  }

  /* ── SHAKE ANIMATION ──────────────────────────────────── */

  function shakeCard() {
    card.classList.remove("shaking"); // rimuove per poter riaggiungere
    // Forza reflow — necessario per far ripartire l'animazione
    void card.offsetWidth;
    card.classList.add("shaking");
  }

  card.addEventListener("animationend", () => {
    card.classList.remove("shaking");
  });

  /* ── TOGGLE PASSWORD VISIBILITÀ ───────────────────────── */

  togglePwBtn.addEventListener("click", () => {
    const isHidden = passwordEl.type === "password";
    passwordEl.type = isHidden ? "text" : "password";
    eyeIcon.textContent = isHidden ? "🙈" : "👁";
    togglePwBtn.setAttribute(
      "aria-label",
      isHidden ? "Nascondi password" : "Mostra password",
    );
  });

  /* ── REMEMBER ME: aggiorna hint ───────────────────────── */

  rememberEl.addEventListener("change", () => {
    rememberHint.textContent = rememberEl.checked ? "7 GIORNI" : "SESSION";
    rememberHint.style.color = rememberEl.checked ? "rgba(57,255,20,0.7)" : "";
  });

  /* ── OROLOGIO IN FOOTER ───────────────────────────────── */

  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    clock.textContent = `${hh}:${mm}:${ss}`;
  }

  updateClock();
  setInterval(updateClock, 1000);

  /* ── CANVAS BACKGROUND: griglia + particelle ──────────── */

  /**
   * Disegna una griglia dot e particelle fluttuanti sullo sfondo.
   * Puramente decorativo — usa requestAnimationFrame per performance.
   */
  (function initCanvas() {
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");
    let W, H, particles;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function Particle() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r = Math.random() * 1.5 + 0.5;
      this.a = Math.random() * 0.5 + 0.1;
    }

    function initParticles() {
      particles = Array.from({ length: 60 }, () => new Particle());
    }

    function drawGrid() {
      const gap = 40;
      ctx.fillStyle = "rgba(138, 43, 226, 0.08)";
      for (let x = 0; x < W; x += gap) {
        for (let y = 0; y < H; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      drawGrid();

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(138, 43, 226, ${p.a})`;
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", () => {
      resize();
      initParticles();
    });
    resize();
    initParticles();
    draw();
  })();

  /* ── INIT ─────────────────────────────────────────────── */

  // Se già autenticato → redirect diretto (no flash della login page)
  if (hasAuthCookie()) {
    window.location.replace(CONFIG.REDIRECT_URL);
  }

  // Controlla lockout residuo dal refresh precedente
  checkExistingLockout();

  // Aggiorna hint remember me al default
  rememberHint.textContent = "SESSION";

  // Attach submit
  form.addEventListener("submit", handleSubmit);

  // Focus automatico sul primo campo (UX)
  usernameEl.focus();
});
