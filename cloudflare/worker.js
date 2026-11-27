const json = value => Response.json(value, { headers: { "Cache-Control": "no-store" } });
const weekAgo = () => new Date(Date.now() - 7 * 86400_000).toISOString();

function namedDeviceToken(request) {
  return /(?:^|;\s*)__Host-mood-device=([0-9a-f]{32})(?:;|$)/.exec(request.headers.get("Cookie") ?? "")?.[1] ?? null;
}

function deviceType(userAgent) {
  if (/iPhone|iPod/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android";
  if (/bot|crawl|spider|curl|wget/i.test(userAgent)) return "Automatischer Aufruf";
  if (/Windows|Macintosh|X11|CrOS/i.test(userAgent)) return "Computer";
  if (/Mobile/i.test(userAgent)) return "Mobilgerät";
  return null;
}

async function authorized(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const hash = text => crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const expected = "Basic " + btoa("admin:" + env.ADMIN_PASSWORD);
  const [actual, target] = await Promise.all([hash(request.headers.get("Authorization") ?? ""), hash(expected)]);
  return crypto.subtle.timingSafeEqual(actual, target);
}

function validContent(data) {
  if (!data || !Array.isArray(data.zitate) || !Array.isArray(data.banner)) return false;
  const validText = text => typeof text === "string" && text.trim().length > 0 && text.length <= 500;
  return data.zitate.length > 0 && data.zitate.length <= 300 && data.zitate.every(validText)
    && data.banner.length <= 100 && data.banner.some(item => item?.ab === 0)
    && data.banner.every(item => item && Number.isInteger(item.ab) && item.ab >= 0 && item.ab <= 23
      && validText(item.text) && typeof item.icon === "string" && item.icon.length <= 12);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.protocol === "http:" && url.hostname.endsWith(".workers.dev")) {
      url.protocol = "https:";
      return Response.redirect(url, 308);
    }
    const { pathname: path } = url;
    const method = request.method;
    const admin = ["/admin", "/admin/", "/admin.html", "/admin.js", "/api/visits", "/api/favorites/stats", "/api/content/history", "/api/doll-poll/stats", "/api/cat-name/suggestions", "/api/cat-shelf/admin", "/api/named-device"].includes(path);
    if ((admin || (path === "/api/content" && method === "POST")) && !(await authorized(request, env))) {
      return new Response("Anmeldung erforderlich", { status: 401, headers: {
        "WWW-Authenticate": 'Basic realm="Mood Booster", charset="UTF-8"',
        "Cache-Control": "no-store"
      } });
    }
    if (path === "/api/visits" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT time, device, device_label AS label FROM visits WHERE time >= ? ORDER BY id DESC LIMIT 20").bind(weekAgo()).all();
      return json(results);
    }
    if (path === "/api/named-device" && method === "GET") {
      const row = await env.DB.prepare("SELECT label FROM named_devices WHERE token = ?")
        .bind(namedDeviceToken(request)).first();
      return json({ label: row?.label ?? "" });
    }
    if (path === "/api/named-device" && method === "POST") {
      if (request.headers.get("Content-Type") !== "application/json") return new Response(null, { status: 415 });
      const body = await request.text();
      if (body.length > 512) return new Response(null, { status: 413 });
      let data;
      try { data = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
      const label = typeof data?.label === "string" ? data.label.trim() : "";
      if (!label || label.length > 40 || /[\u0000-\u001f\u007f]/.test(label)) {
        return new Response(null, { status: 400 });
      }
      const token = namedDeviceToken(request) ?? crypto.randomUUID().replaceAll("-", "");
      await env.DB.prepare("INSERT INTO named_devices (token, label) VALUES (?, ?) ON CONFLICT(token) DO UPDATE SET label = excluded.label")
        .bind(token, label).run();
      const response = json({ label });
      response.headers.set("Set-Cookie", `__Host-mood-device=${token}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`);
      return response;
    }
    if (path === "/api/cat-shelf/admin" && method === "GET") {
      return json(await env.DB.prepare("SELECT COUNT(*) AS empty FROM cat_shelves WHERE used = 3").first());
    }
    if (path === "/api/cat-shelf/admin" && method === "POST") {
      if (request.headers.get("Content-Type") !== "application/json") return new Response(null, { status: 415 });
      const result = await env.DB.prepare("UPDATE cat_shelves SET used = 0 WHERE used = 3").run();
      return json({ refilled: result.meta.changes });
    }
    if (path === "/api/cat-shelf" && method === "POST") {
      if (request.headers.get("Content-Type") !== "application/json") return new Response(null, { status: 415 });
      const body = await request.text();
      if (body.length > 256) return new Response(null, { status: 413 });
      let data;
      try { data = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
      const { token, initialUsed, feed } = data ?? {};
      if (typeof token !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(token)
          || !Number.isInteger(initialUsed) || initialUsed < 0 || initialUsed > 3 || typeof feed !== "boolean") {
        return new Response(null, { status: 400 });
      }
      const statements = [
        env.DB.prepare("INSERT OR IGNORE INTO cat_shelves (token, used) VALUES (?, ?)").bind(token, initialUsed)
      ];
      if (feed) statements.push(env.DB.prepare("UPDATE cat_shelves SET used = used + 1 WHERE token = ? AND used < 3").bind(token));
      statements.push(env.DB.prepare("SELECT used FROM cat_shelves WHERE token = ?").bind(token));
      const results = await env.DB.batch(statements);
      return json({ used: results.at(-1).results[0].used, fed: feed && results[1].meta.changes === 1 });
    }
    if (path === "/api/cat-name/suggestions" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT name FROM cat_names ORDER BY rowid DESC LIMIT 100").all();
      return json(results);
    }
    if (path === "/api/cat-name" && method === "POST") {
      if (request.headers.get("Content-Type") !== "application/json") return new Response(null, { status: 415 });
      const body = await request.text();
      if (body.length > 512) return new Response(null, { status: 413 });
      let data;
      try { data = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
      const { token, name } = data ?? {};
      if (typeof token !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(token)
          || typeof name !== "string" || !name.trim() || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) {
        return new Response(null, { status: 400 });
      }
      await env.DB.prepare("INSERT INTO cat_names (token, name) VALUES (?, ?) ON CONFLICT(token) DO UPDATE SET name = excluded.name")
        .bind(token, name.trim()).run();
      return json({ saved: true });
    }
    if (path === "/api/doll-poll/stats" && method === "GET") {
      const counts = await env.DB.prepare(
        "SELECT COUNT(CASE WHEN vote = 'yes' THEN 1 END) AS yes, COUNT(CASE WHEN vote = 'no' THEN 1 END) AS no FROM doll_poll"
      ).first();
      return json(counts);
    }
    if (path === "/api/doll-poll" && method === "POST") {
      if (request.headers.get("Content-Type") !== "application/json") return new Response(null, { status: 415 });
      const body = await request.text();
      if (body.length > 256) return new Response(null, { status: 413 });
      let data;
      try { data = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
      const { token, vote } = data ?? {};
      if (typeof token !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(token)
          || (vote !== "yes" && vote !== "no")) return new Response(null, { status: 400 });
      await env.DB.prepare("INSERT INTO doll_poll (token, vote) VALUES (?, ?) ON CONFLICT(token) DO UPDATE SET vote = excluded.vote")
        .bind(token, vote).run();
      return json({ saved: true });
    }
    if (path === "/api/favorites/stats" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT quote, COUNT(*) AS count FROM favorites GROUP BY quote ORDER BY count DESC, quote LIMIT 100"
      ).all();
      return json(results);
    }
    if (path === "/api/favorites" && method === "POST") {
      if (request.headers.get("Content-Type") !== "application/json") return new Response(null, { status: 415 });
      const body = await request.text();
      if (body.length > 3000) return new Response(null, { status: 413 });
      let data;
      try { data = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
      const { quote, token, selected } = data ?? {};
      if (typeof quote !== "string" || !quote.trim() || quote.length > 500
          || typeof token !== "string" || !/^[0-9a-f-]{36}$/.test(token) || typeof selected !== "boolean") {
        return new Response(null, { status: 400 });
      }
      if (!selected) {
        await env.DB.prepare("DELETE FROM favorites WHERE token = ? AND quote = ?").bind(token, quote).run();
        return json({ saved: true });
      }
      const [, row] = await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO favorites (token, quote)
          SELECT ?, ? WHERE EXISTS (
            SELECT 1 FROM content, json_each(content.body, '$.zitate') WHERE json_each.value = ?
          )`).bind(token, quote, quote),
        env.DB.prepare("SELECT token FROM favorites WHERE token = ? AND quote = ?").bind(token, quote)
      ]);
      return row.results.length ? json({ saved: true }) : new Response("Dieser Spruch ist nicht mehr verfügbar.", { status: 409 });
    }
    if (path === "/api/content/history" && method === "GET") {
      const row = await env.DB.prepare("SELECT id FROM previous_content WHERE id = 1").first();
      return json({ available: Boolean(row) });
    }
    if (path === "/api/content/history" && method === "POST") {
      if (request.headers.get("Content-Type") !== "application/json") return new Response(null, { status: 415 });
      const [, , removed] = await env.DB.batch([
        env.DB.prepare("DELETE FROM content WHERE EXISTS (SELECT 1 FROM previous_content WHERE body IS NULL)"),
        env.DB.prepare(`INSERT INTO content SELECT id, body FROM previous_content WHERE body IS NOT NULL
          ON CONFLICT(id) DO UPDATE SET body = excluded.body`),
        env.DB.prepare("DELETE FROM previous_content WHERE id = 1")
      ]);
      return removed.meta.changes ? json({ restored: true }) : new Response("Keine frühere Version vorhanden.", { status: 409 });
    }
    if (path === "/api/content" && method === "GET") {
      const row = await env.DB.prepare("SELECT body FROM content WHERE id = 1").first();
      return json(row ? JSON.parse(row.body) : null);
    }
    if (path === "/api/content" && method === "POST") {
      if (request.headers.get("Content-Type") !== "application/json") return new Response(null, { status: 415 });
      const body = await request.text();
      if (body.length > 256_000) return new Response(null, { status: 413 });
      let data;
      try { data = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
      if (!validContent(data)) return new Response("Bitte Texte und Uhrzeiten prüfen. Ein Banner ab 00:00 ist erforderlich.", { status: 400 });
      const { zitate, banner } = data;
      const content = JSON.stringify({ zitate, banner });
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO previous_content
          SELECT 1, (SELECT body FROM content WHERE id = 1)
          WHERE (SELECT body FROM content WHERE id = 1) IS NOT ?
          ON CONFLICT(id) DO UPDATE SET body = excluded.body`).bind(content),
        env.DB.prepare("INSERT INTO content VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body").bind(content)
      ]);
      return json({ saved: true });
    }
    if (path.startsWith("/api/")) return new Response(null, { status: 404 });
    const assetUrl = new URL(request.url);
    if (path === "/") assetUrl.pathname = "/index.html";
    if (admin && path !== "/admin.js") assetUrl.pathname = "/admin.html";
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (method === "GET" && response.ok && ["/", "/index.html"].includes(path)) {
      ctx.waitUntil(env.DB.batch([
        env.DB.prepare("DELETE FROM visits WHERE time < ?").bind(weekAgo()),
        env.DB.prepare("INSERT INTO visits (time, device, device_label) VALUES (?, ?, (SELECT label FROM named_devices WHERE token = ?))")
          .bind(new Date().toISOString(), deviceType(request.headers.get("User-Agent") ?? ""), namedDeviceToken(request))
      ]));
    }
    if (!admin && !["/", "/index.html"].includes(path)) return response;
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  }
};
