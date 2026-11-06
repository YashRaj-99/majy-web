
const SESSION_COOKIE = "__Host-majy_academy_session";
const SESSION_DAYS = 30;
const VERIFY_HOURS = 24;
const RESET_MINUTES = 30;
const PBKDF2_ITERATIONS = 100000;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });

function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), x =>
    x.toString(16).padStart(2, "0")
  ).join("");
}

async function sha256(value) {
  return hex(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  ));
}

function makeSalt() {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g),
    x => parseInt(x, 16)
  );

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS
    },
    key,
    256
  );

  let binary = "";
  for (const byte of new Uint8Array(bits)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function cookieValue(request) {
  const header = request.headers.get("Cookie") || "";

  for (const part of header.split(";")) {
    const pieces = part.trim().split("=");
    if (pieces.shift() === SESSION_COOKIE) {
      return pieces.join("=");
    }
  }

  return "";
}

function sessionCookie(token) {
  return SESSION_COOKIE + "=" + token +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
    (SESSION_DAYS * 86400);
}

function clearSessionCookie() {
  return SESSION_COOKIE +
    "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function sqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function validEmail(email) {
  return typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readJson(request) {
  const body = await request.text();

  if (body.length > 12000) {
    throw new Error("Request too large");
  }

  return JSON.parse(body);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function emailHtml(title, message, link, label) {
  return `<!doctype html>
<html>
<body style="font-family:Arial,sans-serif;color:#20372b;line-height:1.6">
<div style="max-width:560px;margin:32px auto;padding:28px;border:1px solid #e1e8e1">
<p style="font-weight:bold;letter-spacing:2px">MAJY ACADEMY</p>
<h2>${escapeHtml(title)}</h2>
<p>${escapeHtml(message)}</p>
<p style="margin:28px 0">
<a href="${escapeHtml(link)}"
style="background:#315c49;color:#fff;padding:13px 20px;text-decoration:none">
${escapeHtml(label)}
</a>
</p>
<p style="font-size:12px;color:#68756c">
If you did not request this, ignore this email.
</p>
</div>
</body>
</html>`;
}



async function sendEmail(env, to, subject, html) {
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  // Safe SHA-256 fingerprint: never logs the API key.
  const keyDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey)
  );

  const keyFingerprint = Array.from(new Uint8Array(keyDigest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);

  const payload = {
    from: "MAJY Academy <academy@majy.in>",
    to: [to],
    subject,
    html
  };

  const requestBody = JSON.stringify(payload);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: requestBody
  });

  const detail = await response.text();

  const diagnostic = {
    status: response.status,
    statusText: response.statusText,
    responseUrl: response.url,
    redirected: response.redirected,

    keyFingerprint,

    request: {
      method: "POST",
      endpoint: "https://api.resend.com/emails",
      contentType: "application/json",
      bodyBytes: new TextEncoder().encode(requestBody).length,
      sender: payload.from,
      recipientDomain: to.split("@")[1] || "unknown",
      subject,
      htmlLength: html.length
    },

    responseHeaders: {
      server: response.headers.get("server"),
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      wwwAuthenticate: response.headers.get("www-authenticate"),
      resendId: response.headers.get("x-resend-id"),
      cfRay: response.headers.get("cf-ray"),
      via: response.headers.get("via"),
      date: response.headers.get("date")
    },

    responseBody: detail.slice(0, 500)
      .replaceAll(to, "[recipient redacted]")
  };

  if (!response.ok) {
    console.error("RESEND ROOT CAUSE DIAGNOSTIC:", diagnostic);

    throw new Error(
      `Resend rejected email. HTTP ${response.status}.`
    );
  }

  console.log("Resend email accepted:", {
    status: response.status,
    keyFingerprint,
    recipientDomain: to.split("@")[1] || "unknown"
  });
}



async function createToken(db, userId, type, expiry) {
  const token = randomToken();

  await db.prepare(`
    INSERT INTO academy_email_tokens
    (token_id, user_id, token_hash, token_type, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    userId,
    await sha256(token),
    type,
    sqlDate(expiry)
  ).run();

  return token;
}

async function getSessionUser(request, db) {
  const token = cookieValue(request);
  if (!token) return null;

  const tokenHash = await sha256(token);

  const user = await db.prepare(`
    SELECT u.user_id, u.email
    FROM academy_sessions s
    JOIN academy_users u ON u.user_id = s.user_id
    WHERE s.token_hash = ?
      AND s.expires_at > CURRENT_TIMESTAMP
      AND u.email_verified = 1
  `).bind(tokenHash).first();

  if (user) {
    await db.prepare(`
      UPDATE academy_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE token_hash = ?
    `).bind(tokenHash).run();
  }

  return user || null;
}

export async function saveAcademyQuizProgress(
  request,
  env,
  day,
  score,
  total,
  percentage,
  answers
) {
  const user = await getSessionUser(request, env.DB);

  // Guest attempts remain browser-only.
  if (!user) return;

  const answersJson = JSON.stringify(answers);

  await env.DB.prepare(`
    INSERT INTO academy_user_progress (
      user_id,
      day_number,
      completed,
      score,
      total,
      percentage,
      answers_json,
      completed_at,
      updated_at
    )
    VALUES (?, ?, 1, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, day_number)
    DO UPDATE SET
      completed = 1,
      score = MAX(
        COALESCE(academy_user_progress.score, 0),
        excluded.score
      ),
      total = excluded.total,
      percentage = MAX(
        COALESCE(academy_user_progress.percentage, 0),
        excluded.percentage
      ),
      answers_json = CASE
        WHEN excluded.score >= COALESCE(academy_user_progress.score, 0)
        THEN excluded.answers_json
        ELSE academy_user_progress.answers_json
      END,
      completed_at = COALESCE(
        academy_user_progress.completed_at,
        excluded.completed_at
      ),
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    user.user_id,
    day,
    score,
    total,
    percentage,
    answersJson
  ).run();
}

function originIsValid(request, url) {
  return request.headers.get("Origin") === url.origin;
}

function verificationRedirect(url, result) {
  const target = new URL("/academy/", url.origin);
  target.searchParams.set("verification", result);
  return Response.redirect(target.toString(), 302);
}

export async function handleAcademyAuth(request, env, url) {
  const db = env.DB;
  const path = url.pathname;

  if (
    request.method === "POST" &&
    !originIsValid(request, url)
  ) {
    return json({
      error: "Request origin could not be verified."
    }, 403);
  }

  // REGISTER
  if (
    path === "/api/academy/auth/register" &&
    request.method === "POST"
  ) {
    let body;

    try {
      body = await readJson(request);
    } catch {
      return json({
        error: "Please enter valid registration details."
      }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!validEmail(email)) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    if (password.length < 4 || password.length > 128) {
      return json({
        error: "Password must be between 4 and 128 characters."
      }, 400);
    }

    const userId = crypto.randomUUID();
    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);

    try {
      await db.prepare(`
        INSERT INTO academy_users
        (user_id, email, password_hash, password_salt)
        VALUES (?, ?, ?, ?)
      `).bind(userId, email, passwordHash, salt).run();
    } catch (error) {
      if (String(error).toLowerCase().includes("unique")) {
        return json({
          message: "If this address can be registered, a verification email will be sent shortly."
        }, 202);
      }
      throw error;
    }

    const token = await createToken(
      db,
      userId,
      "verify_email",
      new Date(Date.now() + VERIFY_HOURS * 3600000)
    );

    const link = new URL(
      "/api/academy/auth/verify",
      url.origin
    );

    link.searchParams.set("token", token);

    try {
      await sendEmail(
        env,
        email,
        "Verify your MAJY Academy email",
        emailHtml(
          "Verify your email",
          "Confirm your email address to activate your account. This link expires in 24 hours.",
          link.toString(),
          "Verify email"
        )
      );
    } catch (error) {
      console.error("Verification email error:", error);

      return json({
        error: "Your account was created, but the verification email could not be sent. You can request another verification email."
      }, 503);
    }

    return json({
      message: "Check your inbox for the verification link."
    }, 201);
  }

  // RESEND VERIFICATION EMAIL
  if (
    path === "/api/academy/auth/resend-verification" &&
    request.method === "POST"
  ) {
    let body;

    try {
      body = await readJson(request);
    } catch {
      return json({ error: "Invalid request." }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();

    if (validEmail(email)) {
      const user = await db.prepare(`
        SELECT user_id
        FROM academy_users
        WHERE email = ? AND email_verified = 0
      `).bind(email).first();

      if (user) {
        const token = await createToken(
          db,
          user.user_id,
          "verify_email",
          new Date(Date.now() + VERIFY_HOURS * 3600000)
        );

        const link = new URL(
          "/api/academy/auth/verify",
          url.origin
        );

        link.searchParams.set("token", token);

        await sendEmail(
          env,
          email,
          "Verify your MAJY Academy email",
          emailHtml(
            "Verify your email",
            "Confirm your email address to activate your account. This link expires in 24 hours.",
            link.toString(),
            "Verify email"
          )
        );
      }
    }

    return json({
      message: "If the account needs verification, an email will be sent shortly."
    });
  }

  // VERIFY EMAIL
  if (
    path === "/api/academy/auth/verify" &&
    request.method === "GET"
  ) {
    const token = url.searchParams.get("token") || "";

    if (!token || token.length > 200) {
      return verificationRedirect(url, "invalid");
    }

    const row = await db.prepare(`
      SELECT token_id, user_id
      FROM academy_email_tokens
      WHERE token_hash = ?
        AND token_type = 'verify_email'
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
    `).bind(await sha256(token)).first();

    if (!row) {
      return verificationRedirect(url, "invalid");
    }

    await db.batch([
      db.prepare(`
        UPDATE academy_users
        SET email_verified = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(row.user_id),

      db.prepare(`
        UPDATE academy_email_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE token_id = ?
      `).bind(row.token_id)
    ]);

    return verificationRedirect(url, "success");
  }

  // LOGIN
  if (
    path === "/api/academy/auth/login" &&
    request.method === "POST"
  ) {
    let body;

    try {
      body = await readJson(request);
    } catch {
      return json({
        error: "Enter your email and password."
      }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!validEmail(email) || !password || password.length > 128) {
      return json({
        error: "Invalid email or password."
      }, 400);
    }

    const user = await db.prepare(`
      SELECT user_id, email, password_hash,
             password_salt, email_verified
      FROM academy_users
      WHERE email = ?
    `).bind(email).first();

    if (!user) {
      return json({ error: "Invalid email or password." }, 401);
    }

    const candidate = await hashPassword(
      password,
      user.password_salt
    );

    if (candidate !== user.password_hash) {
      return json({ error: "Invalid email or password." }, 401);
    }

    if (!user.email_verified) {
      return json({
        error: "Please verify your email before logging in."
      }, 403);
    }

    const token = randomToken();
    const expiry = new Date(
      Date.now() + SESSION_DAYS * 86400000
    );

    await db.prepare(`
      INSERT INTO academy_sessions
      (session_id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.user_id,
      await sha256(token),
      sqlDate(expiry)
    ).run();

    await db.prepare(`
      UPDATE academy_users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(user.user_id).run();

    return json(
      { user: { email: user.email } },
      200,
      { "set-cookie": sessionCookie(token) }
    );
  }

  // CURRENT LOGIN
  if (
    path === "/api/academy/auth/me" &&
    request.method === "GET"
  ) {
    const user = await getSessionUser(request, db);

    return user
      ? json({ user: { email: user.email } })
      : json({ user: null }, 401);
  }

  // LOGOUT
  if (
    path === "/api/academy/auth/logout" &&
    request.method === "POST"
  ) {
    const token = cookieValue(request);

    if (token) {
      await db.prepare(`
        DELETE FROM academy_sessions
        WHERE token_hash = ?
      `).bind(await sha256(token)).run();
    }

    return json(
      { message: "Logged out." },
      200,
      { "set-cookie": clearSessionCookie() }
    );
  }

    // GET / MERGE ACADEMY PROGRESS
  if (
    path === "/api/academy/auth/progress" &&
    request.method === "GET"
  ) {
    const user = await getSessionUser(request, db);

    if (!user) {
      return json({ error: "Please log in to access your progress." }, 401);
    }

    const { results } = await db.prepare(`
      SELECT
        day_number,
        completed,
        score,
        total,
        percentage,
        answers_json,
        completed_at,
        updated_at
      FROM academy_user_progress
      WHERE user_id = ?
      ORDER BY day_number
    `).bind(user.user_id).all();

    const progress = results.map(item => {
      let answers = [];

      try {
        answers = item.answers_json
          ? JSON.parse(item.answers_json)
          : [];
      } catch {
        answers = [];
      }

      return {
        ...item,
        answers
      };
    });

    return json({ progress });
  }

  // MERGE GUEST BROWSER PROGRESS INTO ACCOUNT
  if (
    path === "/api/academy/auth/progress" &&
    request.method === "POST"
  ) {
    const user = await getSessionUser(request, db);

    if (!user) {
      return json({ error: "Please log in to save your progress." }, 401);
    }

    let body;

    try {
      body = await readJson(request);
    } catch {
      return json({ error: "Invalid progress data." }, 400);
    }

    if (!Array.isArray(body.progress) || body.progress.length > 7) {
      return json({ error: "Invalid progress data." }, 400);
    }

    const statements = [];

    for (const item of body.progress) {
      const day = Number(item.day_number);
      const score = Number(item.score);
      const total = Number(item.total);

      if (
        !Number.isInteger(day) || day < 1 || day > 7 ||
        item.completed !== true ||
        !Number.isInteger(score) || score < 0 || score > 3 ||
        total !== 3
      ) {
        return json({ error: "Invalid lesson progress entry." }, 400);
      }

      let answersJson = null;

      if (Array.isArray(item.answers)) {
        if (
          item.answers.length !== 3 ||
          item.answers.some(answer =>
            !answer ||
            typeof answer.id !== "string" ||
            !answer.id.trim() ||
            !Number.isInteger(answer.selected) ||
            answer.selected < 0 ||
            answer.selected > 3
          )
        ) {
          return json({ error: "Invalid quiz answers." }, 400);
        }

        answersJson = JSON.stringify(item.answers);
      }

      const percentage = Math.round((score / total) * 100);

      statements.push(db.prepare(`
        INSERT INTO academy_user_progress (
          user_id,
          day_number,
          completed,
          score,
          total,
          percentage,
          answers_json,
          completed_at,
          updated_at
        )
        VALUES (?, ?, 1, ?, 3, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, day_number)
        DO UPDATE SET
          completed = 1,
          answers_json = CASE
            WHEN excluded.score >= COALESCE(academy_user_progress.score, 0)
              AND excluded.answers_json IS NOT NULL
            THEN excluded.answers_json
            ELSE academy_user_progress.answers_json
          END,
          score = MAX(
            COALESCE(academy_user_progress.score, 0),
            excluded.score
          ),
          total = 3,
          percentage = MAX(
            COALESCE(academy_user_progress.percentage, 0),
            excluded.percentage
          ),
          completed_at = COALESCE(
            academy_user_progress.completed_at,
            excluded.completed_at
          ),
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        user.user_id,
        day,
        score,
        percentage,
        answersJson
      ));
    }

    if (statements.length) {
      await db.batch(statements);
    }

    return json({
      message: "Guest progress merged successfully.",
      merged: statements.length
    });
  }
  
  // FORGOT PASSWORD
  if (
    path === "/api/academy/auth/forgot-password" &&
    request.method === "POST"
  ) {
    let body;

    try {
      body = await readJson(request);
    } catch {
      return json({ error: "Invalid request." }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();

    if (validEmail(email)) {
      const user = await db.prepare(`
        SELECT user_id
        FROM academy_users
        WHERE email = ? AND email_verified = 1
      `).bind(email).first();

      if (user) {
        const token = await createToken(
          db,
          user.user_id,
          "reset_password",
          new Date(Date.now() + RESET_MINUTES * 60000)
        );

        const link = new URL("/academy/", url.origin);
        link.searchParams.set("resetToken", token);

        await sendEmail(
          env,
          email,
          "Reset your MAJY Academy password",
          emailHtml(
            "Reset your password",
            "Use this link to choose a new password. It expires in 30 minutes.",
            link.toString(),
            "Reset password"
          )
        );
      }
    }

    return json({
      message: "If a verified account exists for that address, a password-reset email will be sent."
    });
  }

  // RESET PASSWORD
  if (
    path === "/api/academy/auth/reset-password" &&
    request.method === "POST"
  ) {
    let body;

    try {
      body = await readJson(request);
    } catch {
      return json({ error: "Invalid reset request." }, 400);
    }

    const token =
      typeof body.token === "string" ? body.token : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    if (!token || token.length > 200) {
      return json({
        error: "This reset link is invalid or expired."
      }, 400);
    }

    if (password.length < 4 || password.length > 128) {
      return json({
        error: "Password must be between 4 and 128 characters."
      }, 400);
    }

    const row = await db.prepare(`
      SELECT token_id, user_id
      FROM academy_email_tokens
      WHERE token_hash = ?
        AND token_type = 'reset_password'
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
    `).bind(await sha256(token)).first();

    if (!row) {
      return json({
        error: "This reset link is invalid or expired."
      }, 400);
    }

    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);

    await db.batch([
      db.prepare(`
        UPDATE academy_users
        SET password_hash = ?,
            password_salt = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(passwordHash, salt, row.user_id),

      db.prepare(`
        UPDATE academy_email_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE token_id = ?
      `).bind(row.token_id),

      db.prepare(`
        DELETE FROM academy_sessions
        WHERE user_id = ?
      `).bind(row.user_id)
    ]);

    return json({
      message: "Password updated. Please log in with your new password."
    });
  }

  return json({
    error: "Authentication endpoint not found."
  }, 404);
}
