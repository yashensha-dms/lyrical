export interface Env {
  songwriting_db: D1Database;
  songwriting_assets: R2Bucket;
  RECOMMENDER: Fetcher;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

// ── JWT Helper using Web Crypto API ──────────────────────────────────────────

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signJwt(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;

  const key = await getCryptoKey(secret);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));

  let sigBinary = '';
  const sigBytes = new Uint8Array(sigBuffer);
  for (let i = 0; i < sigBytes.byteLength; i++) {
    sigBinary += String.fromCharCode(sigBytes[i]);
  }
  const encSig = btoa(sigBinary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${data}.${encSig}`;
}

async function verifyJwt(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const data = `${parts[0]}.${parts[1]}`;
    const sigBase64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const sigBinary = atob(sigBase64);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i);
    }

    const key = await getCryptoKey(secret);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Auth Helper ──────────────────────────────────────────────────────────────

async function authenticate(request: Request, env: Env): Promise<{ id: string; email?: string; name?: string; pen_name?: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const payload = await verifyJwt(token, env.JWT_SECRET || 'default_secret');
  if (!payload || !payload.sub) return null;

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    pen_name: payload.pen_name
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

function parseArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const db = env.songwriting_db;
    const secret = env.JWT_SECRET || 'default_secret';

    try {
      // ── Health Check ────────────────────────────────────────────────────────
      if (path === '/api/health') {
        try {
          await db.prepare("SELECT id FROM projects LIMIT 1").first();
          return json({ status: 'ok', database: 'connected' });
        } catch (e) {
          return json({ status: 'ok', database: 'disconnected' });
        }
      }

      // ── Recommendation Engine Proxies ──────────────────────────────────────
      if (
        path === '/api/rhyme' ||
        path === '/api/synonyms' ||
        path === '/api/rhyme-density' ||
        path === '/api/phonetic-swap' ||
        path === '/api/semantic-search'
      ) {
        const recommenderPath = path.replace(/^\/api/, '');
        const targetUrl = new URL(recommenderPath, 'https://recommender');
        targetUrl.search = url.search;

        const forwardReq = new Request(targetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
        });

        const recResponse = await env.RECOMMENDER.fetch(forwardReq);
        const data = await recResponse.json();
        return json(data, recResponse.status);
      }

      // ── Auth Endpoints (Pure Cloudflare Native) ──────────────────────────────
      if (path === '/api/auth/guest' && request.method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const guestId = body.id || `writer_${crypto.randomUUID().slice(0, 8)}`;
        const name = body.name || 'Writer';
        const pen_name = body.pen_name || '';

        const token = await signJwt({
          sub: guestId,
          name,
          email: `${guestId}@lyrical.local`,
          pen_name,
          exp: Date.now() + 365 * 24 * 3600 * 1000 // 1 year
        }, secret);

        return json({
          token,
          user: { id: guestId, name, email: `${guestId}@lyrical.local`, pen_name }
        });
      }

      if (path === '/api/auth/google' && request.method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        let credential = body.credential; // ID token from Google Identity Services button
        const code = body.code; // Auth code if using authorization code flow

        const clientId = env.GOOGLE_CLIENT_ID || '14287582180-0eanrl7vhg7h6obhogemb18jkqjmtc24.apps.googleusercontent.com';

        // If client sent an authorization code, exchange it using GOOGLE_CLIENT_SECRET
        if (!credential && code && env.GOOGLE_CLIENT_SECRET) {
          const params = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: body.redirect_uri || 'postmessage',
            grant_type: 'authorization_code'
          });
          const exchangeRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
          });
          if (exchangeRes.ok) {
            const tokenData: any = await exchangeRes.json();
            credential = tokenData.id_token;
          }
        }

        if (!credential) {
          return json({ error: 'Missing Google credential or auth code' }, 400);
        }

        // Verify ID token directly with Google API
        const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!gRes.ok) {
          return json({ error: 'Invalid Google token' }, 401);
        }
        const gUser: any = await gRes.json();

        // Verify audience matches our Client ID
        if (gUser.aud !== clientId) {
          return json({ error: 'Google Client ID mismatch' }, 401);
        }

        const userId = `google_${gUser.sub}`;
        const name = gUser.name || gUser.email?.split('@')[0] || 'Writer';

        const token = await signJwt({
          sub: userId,
          email: gUser.email,
          name,
          picture: gUser.picture,
          exp: Date.now() + 30 * 24 * 3600 * 1000 // 30 days
        }, secret);

        return json({
          token,
          user: { id: userId, email: gUser.email, name, picture: gUser.picture }
        });
      }

      if (path === '/api/auth/me' && request.method === 'GET') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);
        return json({ user });
      }

      // ── Storage Endpoints (Cloudflare R2) ───────────────────────────────────
      if (path === '/api/storage/upload' && request.method === 'POST') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const contentType = request.headers.get('content-type') || 'application/octet-stream';
        let fileData: ArrayBuffer | null = null;
        let filename = 'file';

        if (contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const file = formData.get('file') as File | null;
          if (!file) return json({ error: 'No file provided' }, 400);
          filename = file.name || 'file';
          fileData = await file.arrayBuffer();
        } else {
          fileData = await request.arrayBuffer();
          const nameHeader = request.headers.get('x-file-name');
          if (nameHeader) filename = decodeURIComponent(nameHeader);
        }

        const ext = filename.split('.').pop() || 'bin';
        const key = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

        await env.songwriting_assets.put(key, fileData, {
          httpMetadata: {
            contentType: request.headers.get('x-file-type') || contentType
          }
        });

        const publicUrl = `/api/storage/file/${encodeURIComponent(key)}`;
        return json({ success: true, key, url: publicUrl });
      }

      // Serve file from R2
      if (path.startsWith('/api/storage/file/')) {
        const key = decodeURIComponent(path.slice('/api/storage/file/'.length));
        const object = await env.songwriting_assets.get(key);
        if (!object) return new Response('Not Found', { status: 404 });

        const headers = new Headers();
        if (object.httpMetadata?.contentType) {
          headers.set('Content-Type', object.httpMetadata.contentType);
        }
        headers.set('etag', object.etag);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new Response(object.body, { headers });
      }

      // Delete file from R2
      if (path.startsWith('/api/storage/delete/') && request.method === 'DELETE') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const key = decodeURIComponent(path.slice('/api/storage/delete/'.length));
        if (!key.startsWith(`${user.id}/`)) {
          return json({ error: 'Forbidden' }, 403);
        }
        await env.songwriting_assets.delete(key);
        return json({ success: true });
      }

      // ── Phrases Endpoints (D1) ──────────────────────────────────────────────
      if (path === '/api/phrases') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        if (request.method === 'GET') {
          const { results } = await db.prepare("SELECT * FROM phrases WHERE user_id = ? ORDER BY created_at DESC").bind(user.id).all();
          return json(results);
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const content = (body.content || '').trim();
          if (!content) return json({ error: 'Empty content' }, 400);

          const id = body.id || crypto.randomUUID();
          const now = new Date().toISOString();
          await db.prepare("INSERT INTO phrases (id, user_id, content, created_at) VALUES (?, ?, ?, ?)").bind(id, user.id, content, now).run();
          return json({ id, user_id: user.id, content, created_at: now }, 201);
        }
      }

      const phraseMatch = path.match(/^\/api\/phrases\/([a-zA-Z0-9-]+)$/);
      if (phraseMatch && request.method === 'DELETE') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);
        await db.prepare("DELETE FROM phrases WHERE id = ? AND user_id = ?").bind(phraseMatch[1], user.id).run();
        return json({ success: true });
      }

      // ── Graveyard Endpoints (D1) ────────────────────────────────────────────
      if (path === '/api/graveyard') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        if (request.method === 'GET') {
          const { results } = await db.prepare("SELECT * FROM graveyard WHERE user_id = ? ORDER BY created_at DESC").bind(user.id).all();
          return json(results);
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const content = (body.content || '').trim();
          const projectName = body.project_name || 'Untitled';
          if (!content) return json({ error: 'Empty content' }, 400);

          const id = body.id || crypto.randomUUID();
          const now = new Date().toISOString();
          await db.prepare("INSERT INTO graveyard (id, user_id, content, project_name, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, user.id, content, projectName, now).run();
          return json({ id, user_id: user.id, content, project_name: projectName, created_at: now }, 201);
        }
      }

      const graveyardMatch = path.match(/^\/api\/graveyard\/([a-zA-Z0-9-]+)$/);
      if (graveyardMatch && request.method === 'DELETE') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);
        await db.prepare("DELETE FROM graveyard WHERE id = ? AND user_id = ?").bind(graveyardMatch[1], user.id).run();
        return json({ success: true });
      }

      // ── Scrapbook Endpoints (D1) ────────────────────────────────────────────
      const scrapbookMatch = path.match(/^\/api\/projects\/([0-9a-fA-F-]+)\/scrapbook$/);
      if (scrapbookMatch) {
        const projectId = scrapbookMatch[1];
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        if (request.method === 'GET') {
          const entry: any = await db.prepare("SELECT content FROM scrapbook_entries WHERE project_id = ?").bind(projectId).first();
          let parsed = {};
          if (entry && entry.content) {
            try { parsed = JSON.parse(entry.content); } catch {}
          }
          return json(parsed);
        }

        if (request.method === 'PUT') {
          const body = await request.json().catch(() => ({}));
          const contentStr = JSON.stringify(body);
          const now = new Date().toISOString();
          await db.prepare(
            `INSERT INTO scrapbook_entries (id, project_id, content, updated_at) 
             VALUES (?, ?, ?, ?) 
             ON CONFLICT(project_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
          ).bind(crypto.randomUUID(), projectId, contentStr, now).run();
          return json({ success: true });
        }
      }

      // ── Voice Memos Endpoints (D1 + R2) ─────────────────────────────────────
      const memosMatch = path.match(/^\/api\/projects\/([0-9a-fA-F-]+)\/memos(?:\/([a-zA-Z0-9-]+))?$/);
      if (memosMatch) {
        const projectId = memosMatch[1];
        const memoId = memosMatch[2];
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        if (!memoId && request.method === 'GET') {
          const { results } = await db.prepare("SELECT * FROM voice_memos WHERE project_id = ? ORDER BY created_at DESC").bind(projectId).all();
          return json(results);
        }

        if (!memoId && request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const audioUrl = body.audio_url;
          if (!audioUrl) return json({ error: 'Missing audio_url' }, 400);

          const id = body.id || crypto.randomUUID();
          const now = new Date().toISOString();
          try {
            await db.prepare("INSERT INTO voice_memos (id, project_id, audio_url, created_at) VALUES (?, ?, ?, ?)").bind(id, projectId, audioUrl, now).run();
          } catch (dbErr: any) {
            console.warn('D1 row insert deferred / limit (handled):', dbErr.message);
          }
          return json({ id, project_id: projectId, audio_url: audioUrl, created_at: now }, 201);
        }

        if (memoId && request.method === 'DELETE') {
          try {
            const memo: any = await db.prepare("SELECT audio_url FROM voice_memos WHERE id = ?").bind(memoId).first().catch(() => null);
            if (memo && memo.audio_url && memo.audio_url.startsWith('/api/storage/file/')) {
              const key = decodeURIComponent(memo.audio_url.slice('/api/storage/file/'.length));
              await env.songwriting_assets.delete(key).catch(() => {});
            }
          } catch (storageErr) {
            console.warn('Storage cleanup non-fatal error:', storageErr);
          }

          try {
            await db.prepare("DELETE FROM voice_memos WHERE id = ?").bind(memoId).run();
          } catch (dbErr: any) {
            console.warn('D1 row delete deferred / limit (handled):', dbErr.message);
          }
          return json({ success: true });
        }
      }

      // ── Projects Endpoints (D1) ─────────────────────────────────────────────
      if (path === '/api/projects' && request.method === 'GET') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const { results: owned } = await db.prepare(
          "SELECT id, title, created_at, user_id, status, writers, producers, featured_artists FROM projects WHERE user_id = ?"
        ).bind(user.id).all();

        const { results: collab } = await db.prepare(
          `SELECT p.id, p.title, p.created_at, p.user_id, p.status, p.writers, p.producers, p.featured_artists 
           FROM projects p 
           JOIN project_collaborators c ON p.id = c.project_id 
           WHERE c.user_id = ?`
        ).bind(user.id).all();

        const combined = [...(owned as any[]), ...(collab as any[])];
        const seen = new Set<string>();
        const unique: any[] = [];
        for (const item of combined) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            unique.push({
              ...item,
              writers: parseArray(item.writers),
              producers: parseArray(item.producers),
              featured_artists: parseArray(item.featured_artists)
            });
          }
        }
        unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return json(unique);
      }

      if (path === '/api/projects' && request.method === 'POST') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const body: any = await request.json().catch(() => ({}));
        const title = (body.title || '').trim();
        if (!title) return json({ error: 'Missing project title' }, 400);

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.prepare(
          "INSERT INTO projects (id, user_id, title, content, status, writers, producers, featured_artists, created_at) VALUES (?, ?, ?, '', 'Demo', '[]', '[]', '[]', ?)"
        ).bind(id, user.id, title, now).run();

        return json({
          id,
          title,
          user_id: user.id,
          status: 'Demo',
          writers: [],
          producers: [],
          featured_artists: [],
          created_at: now
        }, 201);
      }

      // Project by ID subroutes
      const projectMatch = path.match(/^\/api\/projects\/([0-9a-fA-F-]+)(?:\/([a-zA-Z0-9_-]+))?$/);
      if (projectMatch) {
        const projectId = projectMatch[1];
        const subAction = projectMatch[2];
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const project: any = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
        if (!project) return json({ error: 'Project not found' }, 404);

        let hasAccess = project.user_id === user.id;
        if (!hasAccess) {
          const collab = await db.prepare("SELECT project_id FROM project_collaborators WHERE project_id = ? AND user_id = ?").bind(projectId, user.id).first();
          if (collab) hasAccess = true;
        }

        if (subAction === 'join' && request.method === 'POST') {
          if (project.user_id !== user.id) {
            await db.prepare("INSERT OR IGNORE INTO project_collaborators (project_id, user_id) VALUES (?, ?)").bind(projectId, user.id).run();
          }
          return json({
            ...project,
            writers: parseArray(project.writers),
            producers: parseArray(project.producers),
            featured_artists: parseArray(project.featured_artists)
          });
        }

        if (subAction === 'content') {
          if (!hasAccess) return json({ error: 'Forbidden' }, 403);
          if (request.method === 'GET') {
            return json({ id: project.id, title: project.title, content: project.content || '' });
          }
          if (request.method === 'PUT') {
            const body: any = await request.json().catch(() => ({}));
            const { title, content } = body;
            const updates: string[] = [];
            const bindings: any[] = [];
            if (title !== undefined) { updates.push("title = ?"); bindings.push(title); }
            if (content !== undefined) { updates.push("content = ?"); bindings.push(content); }
            if (updates.length > 0) {
              bindings.push(projectId);
              await db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings).run();
            }
            return json({ success: true });
          }
        }

        if (!hasAccess) return json({ error: 'Forbidden' }, 403);

        if (request.method === 'GET') {
          return json({
            ...project,
            writers: parseArray(project.writers),
            producers: parseArray(project.producers),
            featured_artists: parseArray(project.featured_artists)
          });
        }

        if (request.method === 'PATCH') {
          const body: any = await request.json().catch(() => ({}));
          const updates: string[] = [];
          const bindings: any[] = [];
          if (body.title !== undefined) { updates.push("title = ?"); bindings.push(body.title); }
          if (body.status !== undefined) { updates.push("status = ?"); bindings.push(body.status); }
          if (body.writers !== undefined) { updates.push("writers = ?"); bindings.push(JSON.stringify(body.writers)); }
          if (body.producers !== undefined) { updates.push("producers = ?"); bindings.push(JSON.stringify(body.producers)); }
          if (body.featured_artists !== undefined) { updates.push("featured_artists = ?"); bindings.push(JSON.stringify(body.featured_artists)); }

          if (updates.length > 0) {
            bindings.push(projectId);
            await db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings).run();
          }

          const updated: any = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
          return json({
            ...updated,
            writers: parseArray(updated.writers),
            producers: parseArray(updated.producers),
            featured_artists: parseArray(updated.featured_artists)
          });
        }

        if (request.method === 'DELETE') {
          if (project.user_id === user.id) {
            await db.prepare("DELETE FROM projects WHERE id = ?").bind(projectId).run();
          } else {
            await db.prepare("DELETE FROM project_collaborators WHERE project_id = ? AND user_id = ?").bind(projectId, user.id).run();
          }
          return json({ success: true });
        }
      }

      return json({ error: 'Not Found' }, 404);
    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
  }
};
