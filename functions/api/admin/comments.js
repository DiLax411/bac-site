// Cloudflare Pages Function: /api/admin/comments
// Bảo vệ bằng header "x-admin-token" phải khớp biến môi trường ADMIN_TOKEN.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function checkAuth(request, env) {
  const token = request.headers.get('x-admin-token');
  return Boolean(env.ADMIN_TOKEN) && token === env.ADMIN_TOKEN;
}

export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return json({ error: 'Không có quyền' }, 401);

  const { results } = await env.DB.prepare(
    'SELECT id, entry_id, name, body, created_at FROM comments WHERE approved = 0 ORDER BY created_at ASC'
  ).all();

  return json({ comments: results });
}

export async function onRequestPatch({ request, env }) {
  if (!checkAuth(request, env)) return json({ error: 'Không có quyền' }, 401);

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
