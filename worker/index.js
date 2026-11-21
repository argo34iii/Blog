// /api/* だけをここで処理し、それ以外は静的サイト（dist）をそのまま返す。
// コメントと投票、お問い合わせは D1（Cloudflare の無料DB）に保存する。
// お問い合わせは Discord の Webhook（シークレット DISCORD_WEBHOOK_URL）と、
// Resend 経由のメール（シークレット RESEND_API_KEY / CONTACT_EMAIL）にも通知する。

// Feedback.astro のボタンと同じ並び
export const REACTIONS = ['useful', 'moved', 'alive', 'motto', 'someday'];

const SLUG_RE = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_NAME = 30;
const MAX_BODY = 2000;
const COMMENT_INTERVAL_SEC = 30; // 同じ人の連続投稿を防ぐ

let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ip_hash TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS comments_slug ON comments(slug, id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      reply_to TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      notified INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS reactions (
      slug TEXT NOT NULL,
      kind TEXT NOT NULL,
      voter TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (slug, kind, voter)
    )`),
  ]);
  schemaReady = true;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 存在する記事にだけ書き込めるようにする
async function postExists(env, url, slug) {
  const res = await env.ASSETS.fetch(new URL(`/blog/${slug}/`, url));
  return res.ok;
}

async function getState(db, slug, voter) {
  const [comments, counts, mine] = await db.batch([
    db.prepare(`SELECT id, name, body, created_at FROM comments WHERE slug = ? ORDER BY id`).bind(slug),
    db.prepare(`SELECT kind, COUNT(*) AS n FROM reactions WHERE slug = ? GROUP BY kind`).bind(slug),
    db.prepare(`SELECT kind FROM reactions WHERE slug = ? AND voter = ?`).bind(slug, voter || ''),
  ]);
  const reactions = Object.fromEntries(REACTIONS.map((k) => [k, 0]));
  for (const r of counts.results) if (r.kind in reactions) reactions[r.kind] = r.n;
  return {
    comments: comments.results,
    reactions,
    mine: mine.results.map((r) => r.kind),
  };
}

const CONTACT = {
  maxName: 50,
  maxReplyTo: 200,
  maxBody: 3000,
  intervalSec: 60, // 同じ人の連続送信を防ぐ
  perDay: 5, // 同じ人から1日に受け付ける件数
};

async function notifyDiscord(env, { name, replyTo, body, createdAt }) {
  if (!env.DISCORD_WEBHOOK_URL) return false;
  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'ホームページのお問い合わせ',
      allowed_mentions: { parse: [] }, // 本文の @everyone などで通知が飛ばないように
      embeds: [
        {
          title: '📮 お問い合わせが届きました',
          description: body.slice(0, 4000),
          color: 0x4a6cf7,
          fields: [
            { name: 'お名前', value: name.slice(0, 1024), inline: true },
            { name: '返信先', value: replyTo.slice(0, 1024), inline: true },
          ],
          timestamp: createdAt,
        },
      ],
    }),
  });
  if (!res.ok) console.error('discord webhook failed', res.status, await res.text().catch(() => ''));
  return res.ok;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// Resend の無料枠（独自ドメインなし）は、Resend に登録したメールアドレス宛てにだけ送れる
async function notifyEmail(env, { name, replyTo, body, createdAt }) {
  if (!env.RESEND_API_KEY || !env.CONTACT_EMAIL) return false;
  const when = new Date(createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  // RESEND_API_BASE はローカルテスト用（普段は未設定）
  const res = await fetch(`${env.RESEND_API_BASE || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'ホームページのお問い合わせ <onboarding@resend.dev>',
      to: [env.CONTACT_EMAIL],
      // 返信先がメールアドレスなら、そのまま「返信」で相手に返せるようにする
      ...(EMAIL_RE.test(replyTo) ? { reply_to: replyTo } : {}),
      subject: `【お問い合わせ】${name}`.slice(0, 200),
      text: `ホームページからお問い合わせが届きました。\n\nお名前: ${name}\n返信先: ${replyTo}\n日時: ${when}\n\n${body}\n`,
    }),
  });
  if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''));
  return res.ok;
}

async function handleContact(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  // website はボット用の罠（人には見えない欄）。入っていたら黙って成功扱い
  if (input.website) return json({ ok: true });

  const name = String(input.name || '').trim().slice(0, CONTACT.maxName) || '（未記入）';
  const replyTo = String(input.replyTo || '').trim().slice(0, CONTACT.maxReplyTo) || '（未記入）';
  const body = String(input.body || '').trim();
  if (!body) return json({ error: '内容を入力してください' }, 400);
  if (body.length > CONTACT.maxBody) return json({ error: `内容は${CONTACT.maxBody}文字までです` }, 400);

  const db = env.DB;
  await ensureSchema(db);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ipHash = await sha256(`contact:${ip}`);
  const now = Date.now();
  const recent = await db
    .prepare(
      `SELECT
         SUM(created_at > ?) AS last_minute,
         SUM(created_at > ?) AS last_day
       FROM contacts WHERE ip_hash = ?`,
    )
    .bind(new Date(now - CONTACT.intervalSec * 1000).toISOString(), new Date(now - 86400000).toISOString(), ipHash)
    .first();
  if (recent?.last_minute > 0) return json({ error: '少し時間をおいてから送信してください' }, 429);
  if (recent?.last_day >= CONTACT.perDay) return json({ error: '本日はこれ以上送信できません' }, 429);

  const createdAt = new Date(now).toISOString();
  const { meta } = await db
    .prepare(`INSERT INTO contacts (name, reply_to, body, created_at, ip_hash) VALUES (?, ?, ?, ?, ?)`)
    .bind(name, replyTo, body, createdAt, ipHash)
    .run();

  // 通知は返事を待たせないよう裏で送る。失敗しても DB には残っている
  const message = { name, replyTo, body, createdAt };
  ctx.waitUntil(
    notifyDiscord(env, message)
      .then((ok) => ok && db.prepare(`UPDATE contacts SET notified = 1 WHERE id = ?`).bind(meta.last_row_id).run())
      .catch((e) => console.error('discord notify error', e)),
  );
  ctx.waitUntil(notifyEmail(env, message).catch((e) => console.error('email notify error', e)));
  return json({ ok: true });
}

async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/api/contact') return handleContact(request, env, ctx);
  const m = url.pathname.match(/^\/api\/posts\/([^/]+)(?:\/(comments|reactions))?\/?$/);
  if (!m) return json({ error: 'not found' }, 404);
  const [, slug, action] = m;
  if (!SLUG_RE.test(slug)) return json({ error: 'bad slug' }, 400);

  const db = env.DB;
  await ensureSchema(db);
  const voter = (request.headers.get('x-voter') || '').slice(0, 64);

  if (request.method === 'GET' && !action) {
    return json(await getState(db, slug, voter));
  }

  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!(await postExists(env, url, slug))) return json({ error: 'no such post' }, 404);

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  if (action === 'comments') {
    // website はボット用の罠（人には見えない欄）。入っていたら黙って成功扱い
    if (input.website) return json(await getState(db, slug, voter));

    const name = String(input.name || '').trim().slice(0, MAX_NAME) || '名無しさん';
    const body = String(input.body || '').trim();
    if (!body) return json({ error: 'コメントを入力してください' }, 400);
    if (body.length > MAX_BODY) return json({ error: `コメントは${MAX_BODY}文字までです` }, 400);

    const ip = request.headers.get('cf-connecting-ip') || '';
    const ipHash = await sha256(`${ip}:${slug}`);
    const since = new Date(Date.now() - COMMENT_INTERVAL_SEC * 1000).toISOString();
    const recent = await db
      .prepare(`SELECT 1 FROM comments WHERE ip_hash = ? AND created_at > ? LIMIT 1`)
      .bind(ipHash, since)
      .first();
    if (recent) return json({ error: '少し時間をおいてから投稿してください' }, 429);

    await db
      .prepare(`INSERT INTO comments (slug, name, body, created_at, ip_hash) VALUES (?, ?, ?, ?, ?)`)
      .bind(slug, name, body, new Date().toISOString(), ipHash)
      .run();
    return json(await getState(db, slug, voter));
  }

  if (action === 'reactions') {
    const kind = String(input.kind || '');
    if (!REACTIONS.includes(kind)) return json({ error: 'bad reaction' }, 400);
    if (!/^[a-f0-9-]{16,64}$/.test(voter)) return json({ error: 'bad voter' }, 400);

    // もう押していたら取り消し、まだなら追加（トグル）
    const del = await db
      .prepare(`DELETE FROM reactions WHERE slug = ? AND kind = ? AND voter = ?`)
      .bind(slug, kind, voter)
      .run();
    if (del.meta.changes === 0) {
      await db
        .prepare(`INSERT INTO reactions (slug, kind, voter, created_at) VALUES (?, ?, ?, ?)`)
        .bind(slug, kind, voter, new Date().toISOString())
        .run();
    }
    return json(await getState(db, slug, voter));
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, ctx);
      } catch (e) {
        console.error(e);
        return json({ error: 'サーバでエラーが起きました' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
