// Worker entry point cho Cloudflare Workers (Static Assets + API routes).
// Mọi request không khớp /api/* sẽ được chuyển thẳng cho static assets (env.ASSETS)
// nhờ cấu hình "run_worker_first": ["/api/*"] trong wrangler.jsonc.

const MAX_NAME_LEN = 60;
const MAX_BODY_LEN = 2000;
const MIN_BODY_LEN = 2;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function checkAdminAuth(request, env) {
  const token = request.headers.get('x-admin-token');
  return Boolean(env.ADMIN_TOKEN) && token === env.ADMIN_TOKEN;
}

async function handleGetComments(url, env) {
  const entry = url.searchParams.get('entry');
  if (!entry) return json({ error: 'Thiếu tham số entry' }, 400);

  const { results } = await env.DB.prepare(
    'SELECT id, name, body, created_at FROM comments WHERE entry_id = ? AND approved = 1 ORDER BY created_at ASC'
  )
    .bind(entry)
    .all();

  return json({ comments: results });
}

async function handlePostComment(request, env) {
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
  if (!verify.success) {
    return json({ error: 'Xác thực chống spam thất bại, thử lại nhé', debug: verify['error-codes'] }, 400);
  }

  await env.DB.prepare(
    'INSERT INTO comments (entry_id, name, body, created_at, approved) VALUES (?, ?, ?, ?, 0)'
  )
    .bind(entry, name || 'Ẩn danh', body, new Date().toISOString())
    .run();

  return json({ ok: true, message: 'Đã gửi. Bình luận sẽ hiện sau khi được duyệt.' });
}

async function handleAdminGet(request, env) {
  if (!checkAdminAuth(request, env)) return json({ error: 'Không có quyền' }, 401);

  const { results } = await env.DB.prepare(
    'SELECT id, entry_id, name, body, created_at FROM comments WHERE approved = 0 ORDER BY created_at ASC'
  ).all();

  return json({ comments: results });
}

async function handleAdminPatch(request, env) {
  if (!checkAdminAuth(request, env)) return json({ error: 'Không có quyền' }, 401);

  const { id, action } = await request.json();
  if (!id || !['approve', 'reject'].includes(action)) {
    return json({ error: 'Yêu cầu không hợp lệ' }, 400);
  }

  if (action === 'approve') {
    await env.DB.prepare('UPDATE comments SET approved = 1 WHERE id = ?').bind(id).run();
  } else {
    await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  }

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      if (pathname === '/api/comments' && method === 'GET') return await handleGetComments(url, env);
      if (pathname === '/api/comments' && method === 'POST') return await handlePostComment(request, env);
      if (pathname === '/api/admin/comments' && method === 'GET') return await handleAdminGet(request, env);
      if (pathname === '/api/admin/comments' && method === 'PATCH') return await handleAdminPatch(request, env);
    } catch (err) {
      return json({ error: 'Lỗi máy chủ: ' + (err && err.message ? err.message : String(err)) }, 500);
    }

    // Không khớp route API nào -> trả về static asset tương ứng (hoặc 404 nếu không có).
    return env.ASSETS.fetch(request);
  },
};
