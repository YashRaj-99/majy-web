const COURSE_DAYS = [
  ["Stock Market Fundamentals", "02 Nov 2026"],
  ["Candlesticks and Price Action", "03 Nov 2026"],
  ["Technical Indicators", "04 Nov 2026"],
  ["Trading Strategies", "05 Nov 2026"],
  ["Quantitative Trading and Mathematics", "06 Nov 2026"],
  ["Algo Trading and Backtesting", "07 Nov 2026"],
  ["Risk Management, AI and System Design", "08 Nov 2026"]
];

const STORE_KEY = "majy-academy-progress-v1";
const ACCOUNT_STORE_PREFIX = "majy-academy-progress-account-v1:";
let activeProgressKey = STORE_KEY;

function accountProgressKey(email) {
  return ACCOUNT_STORE_PREFIX + encodeURIComponent(email.toLowerCase());
}

function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(activeProgressKey) || "{}");
  } catch {
    return {};
  }
}

function writeProgress(progress) {
  localStorage.setItem(activeProgressKey, JSON.stringify(progress));
}

async function syncAccountProgress(email) {
  const accountKey = accountProgressKey(email);
  const accountCacheExists = localStorage.getItem(accountKey) !== null;

  // Only merge guest progress into this account the first time.
  if (!accountCacheExists) {
    const guestProgress = JSON.parse(
      localStorage.getItem(STORE_KEY) || "{}"
    );

    const entries = Object.entries(guestProgress)
      .filter(([, item]) => item?.completed)
      .map(([day, item]) => ({
        day_number: Number(day),
        completed: true,
        score: Number(item.score),
        total: Number(item.total)
      }));

    if (entries.length) {
      const mergeResponse = await fetch("/api/academy/auth/progress", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: entries })
      });

      if (!mergeResponse.ok) {
        throw new Error("Could not merge your guest progress.");
      }
    }
  }

  const response = await fetch("/api/academy/auth/progress", {
    credentials: "same-origin"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load account progress.");
  }

  const cloudProgress = {};

  for (const item of data.progress || []) {
    cloudProgress[item.day_number] = {
      completed: Boolean(item.completed),
      score: item.score,
      total: item.total,
      percentage: item.percentage,
      completedAt: item.completed_at
    };
  }

  activeProgressKey = accountKey;
  writeProgress(cloudProgress);
  await initAcademy();
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

/* ---------------- COURSE OVERVIEW ---------------- */

async function initAcademy() {
  const list = document.getElementById("lesson-list");
  if (!list) return;

  const progress = readProgress();

  try {
    const response = await fetch("/api/academy/lessons");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load lessons");
    }

    const published = new Set(
      (data.lessons || []).map(item => item.day_number)
    );

    const completed = Object.keys(progress).filter(
      key => progress[key]?.completed
    ).length;

    document.getElementById("progress-label").textContent =
      `${completed} / 7 complete`;

    document.getElementById("progress-bar").style.width =
      `${completed / 7 * 100}%`;

    document.getElementById("progress-note").textContent =
      "Progress is stored in this browser. Use the same browser and device to continue.";

    list.innerHTML = COURSE_DAYS.map(([title, date], index) => {
      const day = index + 1;
      const score = progress[day]?.score;
      const isPublished = published.has(day);
      const locked = !isPublished;

      const state = progress[day]?.completed
        ? `Completed · ${score}/3`
        : isPublished
          ? "Available"
          : "Unlocks at 8:00 AM IST";

      return `
        <article class="lesson-row ${locked ? "locked" : ""}">
          <div class="day-number">${String(day).padStart(2, "0")}</div>
          <div class="lesson-info">
            <div class="lesson-date">${date} · DAY ${day}</div>
            <h3>${esc(title)}</h3>
            <p>${state}</p>
          </div>
          ${
            isPublished
              ? `<a class="row-action" href="/academy/lesson/${day}">
                   ${progress[day]?.completed ? "Review lesson" : "Start lesson"}
                   <span>↗</span>
                 </a>`
              : `<span class="lock-label">LOCKED</span>`
          }
        </article>
      `;
    }).join("");

  } catch (error) {
    list.innerHTML =
      `<p class="error">${esc(error.message)}. Please refresh or try again later.</p>`;
  }
}

/* ---------------- ACCOUNT AUTHENTICATION ---------------- */

function initAcademyAuth() {
  const accountPanel = document.getElementById("account-panel");
  if (!accountPanel) return;

  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");
  const loginPanel = document.getElementById("login-panel");
  const registerPanel = document.getElementById("register-panel");

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const registerEmail = document.getElementById("register-email");
  const registerPassword = document.getElementById("register-password");

  const authMessage = document.getElementById("auth-message");
  const verificationNotice = document.getElementById("verification-notice");

  const signedInPanel = document.getElementById("signed-in-panel");
  const signedInEmail = document.getElementById("signed-in-email");
  const logoutButton = document.getElementById("logout-button");

  let resendButton = null;

  function showMessage(message, type = "") {
    authMessage.textContent = message;
    authMessage.className = `auth-message ${type}`.trim();
  }

  function showVerificationNotice(message) {
    verificationNotice.textContent = message;
    verificationNotice.hidden = false;
  }

  function showTab(tab) {
    const showLogin = tab === "login";

    loginPanel.hidden = !showLogin;
    registerPanel.hidden = showLogin;

    loginTab.classList.toggle("active", showLogin);
    registerTab.classList.toggle("active", !showLogin);

    loginTab.setAttribute("aria-selected", String(showLogin));
    registerTab.setAttribute("aria-selected", String(!showLogin));

    showMessage("");
  }

  function showSignedIn(user) {
    accountPanel.hidden = true;
    signedInPanel.hidden = false;
    signedInEmail.textContent = user.email || "";
  }

  function showSignedOut() {
    accountPanel.hidden = false;
    signedInPanel.hidden = true;
  }

  function setLoading(form, loading) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Please wait…";
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "Submit";
    }
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      // Keep an empty response object if the server returns no JSON.
    }

    return { response, data };
  }

  function addResendButton(email) {
    if (resendButton) {
      resendButton.remove();
    }

    resendButton = document.createElement("button");
    resendButton.type = "button";
    resendButton.className = "text-button";
    resendButton.textContent = "Resend verification email";

    authMessage.insertAdjacentElement("afterend", resendButton);

    resendButton.addEventListener("click", async () => {
      resendButton.disabled = true;
      resendButton.textContent = "Sending…";

      try {
        const { response, data } = await apiRequest(
          "/api/academy/auth/resend-verification",
          {
            method: "POST",
            body: JSON.stringify({ email })
          }
        );

        if (!response.ok) {
          throw new Error(data.error || "Unable to resend verification email.");
        }

        showMessage(
          data.message || "If your account needs verification, a new email will be sent.",
          "success"
        );

      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        resendButton.disabled = false;
        resendButton.textContent = "Resend verification email";
      }
    });
  }

  /* Tab navigation */

  loginTab.addEventListener("click", () => showTab("login"));
  registerTab.addEventListener("click", () => showTab("register"));

  document.getElementById("show-register")?.addEventListener("click", () => {
    showTab("register");
  });

  document.getElementById("show-login")?.addEventListener("click", () => {
    showTab("login");
  });

  /* Email verification return message */

  const params = new URLSearchParams(window.location.search);
  const verification = params.get("verification");

  if (verification === "success") {
    showVerificationNotice(
      "Email verified successfully. Please log in to continue."
    );
    showTab("login");
  } else if (verification === "invalid") {
    showVerificationNotice(
      "This verification link is invalid, expired, or already used. You can request a fresh link."
    );
    showTab("login");
  }

  if (verification) {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname + window.location.hash
    );
  }

  /* Login */

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage("");

    setLoading(loginForm, true);

    try {
      const email = loginEmail.value.trim();
      const password = loginPassword.value;

      const { response, data } = await apiRequest(
        "/api/academy/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password })
        }
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Login failed. Check your email and password."
        );
      }

      const userResponse = await apiRequest("/api/academy/auth/me", {
        method: "GET",
        headers: {}
      });

      if (!userResponse.response.ok || !userResponse.data.user) {
        throw new Error("Login succeeded, but your session could not be confirmed. Please try again.");
      }

      loginPassword.value = "";
      showSignedIn(userResponse.data.user);
      
      try {
        await syncAccountProgress(userResponse.data.user.email);
        showMessage("Login successful. Your account progress is synced.", "success");
      } catch (syncError) {
        showMessage(
          "You are logged in, but progress sync failed: " + syncError.message,
          "error"
        );
      }

    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(loginForm, false);
    }
  });

  /* Registration */

  registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage("");

    setLoading(registerForm, true);

    try {
      const email = registerEmail.value.trim();
      const password = registerPassword.value;

      const { response, data } = await apiRequest(
        "/api/academy/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ email, password })
        }
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to create your account. Please try again."
        );
      }

      registerPassword.value = "";

      showMessage(
        data.message || "Account request received. Check your email for a verification link.",
        "success"
      );

      addResendButton(email);

    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(registerForm, false);
    }
  });

  /* Logout */

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out…";

    try {
      const { response, data } = await apiRequest(
        "/api/academy/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      if (!response.ok) {
        throw new Error(data.error || "Unable to log out.");
      }

      activeProgressKey = STORE_KEY;
      showSignedOut();
      showTab("login");
      await initAcademy();
      showMessage("You have been logged out. Guest progress is available.", "success");

    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      logoutButton.disabled = false;
      logoutButton.textContent = "Log out";
    }
  });

  /* Check existing session */

  async function checkExistingSession() {
    try {
      const { response, data } = await apiRequest(
        "/api/academy/auth/me",
        {
          method: "GET",
          headers: {}
        }
      );

      if (response.ok && data.user) {
        showSignedIn(data.user);
      
        try {
          await syncAccountProgress(data.user.email);
        } catch (syncError) {
          showMessage(
            "Your account is logged in, but progress sync failed: " + syncError.message,
            "error"
          );
        }
      } else {
        showSignedOut();
      }
    } catch {
      showSignedOut();
    }
  }

  checkExistingSession();
}

/* ---------------- PAGE INITIALIZATION ---------------- */

initAcademy();
initAcademyAuth();
