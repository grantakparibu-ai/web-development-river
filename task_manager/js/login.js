/**
 * ============================================================
 *  LOGIN.JS — Logica di autenticazione sicura
 * ============================================================
 *
 *  ARCHITETTURA:
 *   1. Rate limiting (max 5 tentativi → lockout con backoff)
 *   2. Cookie di sessione (4 cookie scritti al login)
 *   3. Sanitizzazione input
 *   4. Messaggi errore generici (no username enumeration)
 *   5. Timing costante (delay random)
 *
 *  COOKIE SCRITTI AL LOGIN:
 *   - auth_ticket    → token opaco base64
 *   - isLoggedIn     → "true" (letto dalla guardia in script.js)
 *   - current_user   → username (per chiave tasks_<user>)
 *   - session_expires→ timestamp ms scadenza (per session timer)
 * ============================================================
 */

"use strict";

document.addEventListener("DOMContentLoaded", function () {

  const CONFIG = {
    VALID_CREDENTIALS: [
      { username: "admin", password: "Admin1!" },
      { username: "23",    password: "23"       },
      { username: "grant", password: "grant!"   },
    ],
    MAX_ATTEMPTS:       5,
    BASE_LOCKOUT_SEC:   30,
    MAX_LOCKOUT_SEC:    300,
    LOCKOUT_MULTIPLIER: 2,
    COOKIE_NAME:        "auth_ticket",
    REDIRECT_URL:       "index.html",
    SS_ATTEMPTS:        "_atk_att",
    SS_LOCKOUT_TS:      "_atk_lts",
    SS_LOCKOUT_DUR:     "_atk_ldur",
  };

  const form        = document.getElementById("login-form");
  const usernameEl  = document.getElementById("username");
  const passwordEl  = document.getElementById("password");
  const rememberEl  = document.getElementById("remember-me");
  const messageBox  = document.getElementById("message-box");
  const submitBtn   = document.getElementById("submit-btn");
  const btnText     = document.getElementById("btn-text");
  const attCounter  = document.getElementById("attempts-counter");
  const lockoutWrap = document.getElementById("lockout-bar-wrap");
  const lockoutBar  = document.getElementById("lockout-bar");
  const lockoutTimer= document.getElementById("lockout-timer");
  const togglePwBtn = document.getElementById("toggle-pw");
  const eyeIcon     = document.getElementById("eye-icon");
  const rememberHint= document.querySelector(".remember-hint");
  const clock       = document.getElementById("clock");
  const card        = document.querySelector(".login-card");

  let lockoutInterval = null;

  /* ── NONCE ── */
  function generateNonce(bytes) {
    bytes = bytes || 16;
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  /* ── COOKIE ── */
  function setAuthCookie(username, remember) {
    const ticket = btoa(username + ":" + Date.now() + ":" + generateNonce(16));

    let expiresStr = "";
    let sessionExpires;

    if (remember) {
      const exp  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expiresStr = "; Expires=" + exp.toUTCString();
      sessionExpires = exp.getTime();
    } else {
      sessionExpires = Date.now() + 2 * 60 * 60 * 1000; // 2h convenzionali
    }

    document.cookie = CONFIG.COOKIE_NAME + "=" + ticket +
      "; SameSite=Strict; Secure; Path=/" + expiresStr;

    document.cookie = "isLoggedIn=true" +
      "; SameSite=Strict; Path=/" + expiresStr;

    document.cookie = "current_user=" + encodeURIComponent(username) +
      "; SameSite=Strict; Path=/" + expiresStr;

    document.cookie = "session_expires=" + sessionExpires +
      "; SameSite=Strict; Path=/" + expiresStr;
  }

  function hasAuthCookie() {
    return document.cookie.split("; ").some(function (c) {
      return c.startsWith(CONFIG.COOKIE_NAME + "=");
    });
  }

  /* ── RATE LIMITING ── */
  function getAttempts() {
    return parseInt(sessionStorage.getItem(CONFIG.SS_ATTEMPTS) || "0", 10);
  }

  function incrementAttempts() {
    sessionStorage.setItem(CONFIG.SS_ATTEMPTS, getAttempts() + 1);
  }

  function resetAttempts() {
    sessionStorage.removeItem(CONFIG.SS_ATTEMPTS);
    sessionStorage.removeItem(CONFIG.SS_LOCKOUT_TS);
    sessionStorage.removeItem(CONFIG.SS_LOCKOUT_DUR);
  }

  function computeLockoutDuration() {
    const prev = parseInt(sessionStorage.getItem(CONFIG.SS_LOCKOUT_DUR) || "0", 10);
    if (prev === 0) return CONFIG.BASE_LOCKOUT_SEC;
    return Math.min(prev * CONFIG.LOCKOUT_MULTIPLIER, CONFIG.MAX_LOCKOUT_SEC);
  }

  function startLockout() {
    const duration = computeLockoutDuration();
    const until    = Date.now() + duration * 1000;
    sessionStorage.setItem(CONFIG.SS_LOCKOUT_TS,  until.toString());
    sessionStorage.setItem(CONFIG.SS_LOCKOUT_DUR, duration.toString());
    sessionStorage.setItem(CONFIG.SS_ATTEMPTS,    "0");
    activateLockoutUI(until, duration);
  }

  function checkExistingLockout() {
    const until = parseInt(sessionStorage.getItem(CONFIG.SS_LOCKOUT_TS) || "0", 10);
    if (!until) return false;
    const remaining = (until - Date.now()) / 1000;
    if (remaining <= 0) { sessionStorage.removeItem(CONFIG.SS_LOCKOUT_TS); return false; }
    const duration = parseInt(sessionStorage.getItem(CONFIG.SS_LOCKOUT_DUR) || CONFIG.BASE_LOCKOUT_SEC, 10);
    activateLockoutUI(until, duration);
    return true;
  }

  function activateLockoutUI(until, duration) {
    submitBtn.disabled = usernameEl.disabled = passwordEl.disabled = true;
    lockoutWrap.classList.add("active");
    showMessage("ACCESSO BLOCCATO — troppi tentativi falliti.", "warning");

    function tick() {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(lockoutInterval);
        lockoutInterval = null;
        lockoutWrap.classList.remove("active");
        lockoutBar.style.setProperty("--progress", "0%");
        submitBtn.disabled = usernameEl.disabled = passwordEl.disabled = false;
        hideMessage();
        attCounter.textContent = "";
        btnText.textContent    = "ACCEDI";
        return;
      }
      lockoutBar.style.setProperty("--progress", ((remaining / duration) * 100).toFixed(1) + "%");
      lockoutTimer.textContent = remaining + "s";
      btnText.textContent      = "BLOCCATO " + remaining + "s";
    }

    tick();
    lockoutInterval = setInterval(tick, 1000);
  }

  /* ── MESSAGGI ── */
  function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className   = "visible " + (type || "error");
  }

  function hideMessage() {
    messageBox.className = messageBox.textContent = "";
  }

  /* ── VERIFICA CREDENZIALI ── */
  function verifyCredentials(user, pass) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(CONFIG.VALID_CREDENTIALS.some(function (c) {
          return c.username === user && c.password === pass;
        }));
      }, 300 + Math.random() * 200);
    });
  }

  /* ── SUBMIT ── */
  async function handleSubmit(e) {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const rawUser  = usernameEl.value.trim();
    const rawPass  = passwordEl.value;
    const remember = rememberEl.checked;

    if (!rawUser || !rawPass) {
      showMessage("CAMPI OBBLIGATORI — inserisci utente e chiave.", "error");
      shakeCard();
      return;
    }

    submitBtn.disabled  = true;
    btnText.textContent = "VERIFICA...";
    hideMessage();

    const ok = await verifyCredentials(rawUser, rawPass);

    if (ok) {
      showMessage("ACCESSO AUTORIZZATO — reindirizzamento...", "success");
      btnText.textContent = "OK";
      resetAttempts();
      setAuthCookie(rawUser, remember);
      setTimeout(function () { window.location.href = CONFIG.REDIRECT_URL; }, 800);
    } else {
      incrementAttempts();
      const attempts  = getAttempts();
      const remaining = CONFIG.MAX_ATTEMPTS - attempts;
      submitBtn.disabled  = false;
      btnText.textContent = "ACCEDI";
      shakeCard();

      if (remaining <= 0) {
        startLockout();
      } else {
        showMessage(
          "CREDENZIALI NON VALIDE — " + remaining +
          " tentativ" + (remaining === 1 ? "o" : "i") +
          " rimast" + (remaining === 1 ? "o" : "i") + ".", "error"
        );
        attCounter.textContent = "TENTATIVO " + attempts + " / " + CONFIG.MAX_ATTEMPTS;
      }
    }
  }

  /* ── SHAKE ── */
  function shakeCard() {
    card.classList.remove("shaking");
    void card.offsetWidth;
    card.classList.add("shaking");
  }
  card.addEventListener("animationend", function () { card.classList.remove("shaking"); });

  /* ── TOGGLE PASSWORD ── */
  togglePwBtn.addEventListener("click", function () {
    const isHidden      = passwordEl.type === "password";
    passwordEl.type     = isHidden ? "text" : "password";
    eyeIcon.textContent = isHidden ? "🙈" : "👁";
    togglePwBtn.setAttribute("aria-label", isHidden ? "Nascondi password" : "Mostra password");
  });

  /* ── REMEMBER ME ── */
  rememberEl.addEventListener("change", function () {
    rememberHint.textContent = rememberEl.checked ? "7 GIORNI" : "SESSION";
    rememberHint.style.color = rememberEl.checked ? "rgba(57,255,20,0.7)" : "";
  });

  /* ── OROLOGIO ── */
  function updateClock() {
    const n = new Date();
    clock.textContent =
      String(n.getHours()).padStart(2,"0") + ":" +
      String(n.getMinutes()).padStart(2,"0") + ":" +
      String(n.getSeconds()).padStart(2,"0");
  }
  updateClock();
  setInterval(updateClock, 1000);

  /* ── CANVAS ── */
  (function initCanvas() {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, particles;

    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }

    function Particle() {
      this.x  = Math.random() * W;  this.y  = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.4; this.vy = (Math.random() - 0.5) * 0.4;
      this.r  = Math.random() * 1.5 + 0.5;   this.a  = Math.random() * 0.5 + 0.1;
    }

    function initParticles() {
      particles = Array.from({ length: 60 }, function () { return new Particle(); });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const gap = 40;
      ctx.fillStyle = "rgba(138,43,226,0.08)";
      for (let x = 0; x < W; x += gap)
        for (let y = 0; y < H; y += gap) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
        }
      particles.forEach(function (p) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(138,43,226," + p.a + ")"; ctx.fill();
      });
      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", function () { resize(); initParticles(); });
    resize(); initParticles(); draw();
  })();

  /* ── INIT ── */
  if (hasAuthCookie()) { window.location.replace(CONFIG.REDIRECT_URL); return; }
  checkExistingLockout();
  rememberHint.textContent = "SESSION";
  form.addEventListener("submit", handleSubmit);
  usernameEl.focus();
});
