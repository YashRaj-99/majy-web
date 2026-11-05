const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });

function todayIST() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const get = (type) => parts.find(p => p.type === type).value;

  let date = `${get("year")}-${get("month")}-${get("day")}`;

  // Do not publish today's lesson before 8:00 AM IST.
  if (Number(get("hour")) < 8) {
    const previous = new Date(`${date}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    date = previous.toISOString().slice(0, 10);
  }

  return date;
}

async function publishDueLessons(db) {
  const today = todayIST();
  await db.prepare(`
    UPDATE academy_lessons
    SET status = 'published', published_at = COALESCE(published_at, CURRENT_TIMESTAMP)
    WHERE status = 'scheduled' AND publish_date <= ?
  `).bind(today).run();
}

async function handleApi(request, env, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    }});
  }

  if (url.pathname === "/api/academy/lessons" && request.method === "GET") {
    await publishDueLessons(env.DB);
    const { results } = await env.DB.prepare(`
      SELECT day_number, publish_date, title, subtitle, status
      FROM academy_lessons WHERE status = 'published' ORDER BY day_number
    `).all();
    return json({ lessons: results, today: todayIST() });
  }

  const lessonMatch = url.pathname.match(/^\/api\/academy\/lesson\/([1-7])$/);
  if (lessonMatch && request.method === "GET") {
    await publishDueLessons(env.DB);
    const row = await env.DB.prepare(`
      SELECT day_number, publish_date, title, subtitle, content_json
      FROM academy_lessons
      WHERE day_number = ? AND status = 'published'
    `).bind(Number(lessonMatch[1])).first();
    if (!row) return json({ error: "This lesson is not published yet." }, 404);
    return json({ lesson: { ...row, content: JSON.parse(row.content_json) } });
  }

  const quizMatch = url.pathname.match(/^\/api\/academy\/quiz\/([1-7])$/);
  if (quizMatch && request.method === "GET") {
    await publishDueLessons(env.DB);
    const row = await env.DB.prepare(`
      SELECT quiz_json FROM academy_lessons
      WHERE day_number = ? AND status = 'published'
    `).bind(Number(quizMatch[1])).first();
    if (!row) return json({ error: "This lesson is not published yet." }, 404);
    const questions = JSON.parse(row.quiz_json).map(({ id, question, options }) => ({ id, question, options }));
    return json({ questions });
  }

  if (quizMatch && request.method === "POST") {
    await publishDueLessons(env.DB);
    const day = Number(quizMatch[1]);
    const row = await env.DB.prepare(`
      SELECT quiz_json FROM academy_lessons
      WHERE day_number = ? AND status = 'published'
    `).bind(day).first();
    if (!row) return json({ error: "This lesson is not published yet." }, 404);
    let payload;
    try { payload = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
    if (!Array.isArray(payload.answers)) return json({ error: "answers must be an array." }, 400);

    const questions = JSON.parse(row.quiz_json);
    const submitted = new Map(payload.answers.map(a => [a.id, Number(a.answer)]));
    const results = questions.map(q => {
      const selected = submitted.get(q.id);
      const correct = Number.isInteger(selected) && selected === q.answer;
      return {
        id: q.id, question: q.question, selected: Number.isInteger(selected) ? selected : null,
        correctAnswer: q.answer, correct, explanation: q.explanation
      };
    });
    const score = results.filter(r => r.correct).length;
    return json({ day, score, total: questions.length, percentage: Math.round(score / questions.length * 100), results });
  }

  return json({ error: "API endpoint not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/academy/")) {
      try { return await handleApi(request, env, url); }
      catch (error) {
        console.error("Academy API error:", error);
      
        const diagnostic = error instanceof Error
          ? `${error.name}: ${error.message}`
          : "Unknown error";
      
        return json({
          error: "Academy service is temporarily unavailable.",
          diagnostic: diagnostic.slice(0, 250)
        }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(publishDueLessons(env.DB));
  }
};
