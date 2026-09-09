// Cloudflare Pages Function: /api/comments
// GET  /api/comments?entry=viet:ve-su-cham        -> danh sách bình luận đã duyệt
// POST /api/comments  { entry, name, body, token } -> gửi bình luận mới, chờ duyệt

const MAX_NAME_LEN = 60;
const MAX_BODY_LEN = 2000;
const MIN_BODY_LEN = 2;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const entry = url.searchParams.get('entry');
  if (!entry) return json({ error: 'Thiếu tham số entry' }, 400);

  const { results } = await env.DB.prepare(
    'SELECT id, name, body, created_at FROM comments WHERE entry_id = ? AND approved = 1 ORDER BY created_at ASC'
  )
    .bind(entry)
    .all();

  return json({ comments: results });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400);
  }

  const entry = String(payload.entry || '').trim();
  const name = String(payload.name || '').trim().slice(0, MAX_NAME_LEN);
  const body = String(payload.body || '').trim();
  const token = String(payload.token || '');

  if (!entry) return json({ error: 'Thiếu bài viết' }, 400);
  if (body.length < MIN_BODY_LEN) return json({ error: 'Bình luận quá ngắn' }, 400);
  if (body.length > MAX_BODY_LEN) return json({ error: 'Bình luận quá dài' }, 400);
  if (!token) return json({ error: 'Thiếu xác thực chống spam' }, 400);

  // Xác thực Cloudflare Turnstile
  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') || '',
    }),
  });
  const verify = await verifyRes.json();
  if (!verify.success) return json({ error: 'Xác thực chống spam thất bại, thử lại nhé' }, 400);

  await env.DB.prepare(
    'INSERT INTO comments (entry_id, name, body, created_at, approved) VALUES (?, ?, ?, ?, 0)'
  )
    .bind(entry, name || 'Ẩn danh', body, new Date().toISOString())
    .run();

  return json({ ok: true, message: 'Đã gửi. Bình luận sẽ hiện sau khi được duyệt.' });
}
