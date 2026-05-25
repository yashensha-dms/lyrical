import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
// @ts-ignore
import { setupWSConnection, setPersistence, docs } from 'y-websocket/bin/utils';
import { supabase } from './supabase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Simple inline debounce to prevent types and external dependency issues
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ── Yjs Collaboration & Supabase Persistence ────────────────────────────────
// Persistence uses plain text (title + content) stored directly in the projects
// table — no binary Yjs state. This avoids the dual-module Yjs constructor
// conflict where y-websocket's internal Yjs and our import are different instances.
setPersistence({
  bindState: async (docName: string, ydoc: any) => {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('title, content')
        .eq('id', docName)
        .single();

      if (error) {
        console.error(`Error fetching project ${docName} for Yjs binding:`, error.message);
        return;
      }

      if (project) {
        // Hydrate Yjs shared types from plain text — safe across module instances
        ydoc.transact(() => {
          const titleText = ydoc.getText('title');
          if (titleText.length === 0 && project.title) {
            titleText.insert(0, project.title);
          }
          const contentText = ydoc.getText('content');
          if (contentText.length === 0 && project.content) {
            contentText.insert(0, project.content);
          }
        });
      }
    } catch (err) {
      console.error(`Error loading project ${docName} for Yjs persistence:`, err);
    }

    // Debounced save: extract plain text and write to Supabase
    const saveToDb = debounce(async () => {
      try {
        const title = ydoc.getText('title').toString();
        const content = ydoc.getText('content').toString();

        const { error } = await supabase
          .from('projects')
          .update({ title, content })
          .eq('id', docName);

        if (error) throw error;
        console.log(`Auto-saved project ${docName} to Supabase.`);
      } catch (err: any) {
        console.error(`Failed to auto-save project ${docName}:`, err.message);
      }
    }, 2000);

    ydoc.on('update', () => {
      saveToDb();
    });
  },
  writeState: async (docName: string, ydoc: any) => {
    try {
      const title = ydoc.getText('title').toString();
      const content = ydoc.getText('content').toString();

      const { error } = await supabase
        .from('projects')
        .update({ title, content })
        .eq('id', docName);

      if (error) throw error;
      console.log(`Final saved project ${docName} to Supabase.`);
    } catch (err: any) {
      console.error(`Failed to final save project ${docName}:`, err.message);
    }
  }
});

const wss = new WebSocketServer({ noServer: true });
const httpServer = http.createServer(app);

// Secure HTTP connection upgrade check (JWT Auth & Project Ownership)
httpServer.on('upgrade', async (request, socket, head) => {
  const url = request.url || '';
  if (url.startsWith('/ws/')) {
    try {
      const parsedUrl = new URL(url, `http://${request.headers.host || 'localhost'}`);
      const projectId = parsedUrl.pathname.slice(4); // strip "/ws/"
      const token = parsedUrl.searchParams.get('token');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // 1. Verify user with Supabase JWT
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // 2. Check if user owns the project
      const { data: project, error: dbError } = await supabase
        .from('projects')
        .select('id, user_id')
        .eq('id', projectId)
        .single();

      if (dbError || !project) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      // Check if user is the owner OR a collaborator
      let hasAccess = project.user_id === user.id;
      if (!hasAccess) {
        const { data: collab, error: collabError } = await supabase
          .from('project_collaborators')
          .select('project_id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!collabError && collab) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // Upgrade to WebSocket connection
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws: any, req: any) => {
  const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const projectId = parsedUrl.pathname.slice(4);
  setupWSConnection(ws, req, { docName: projectId });
});

console.log(`WebSocket server attached at /ws/:projectId`);

// ── REST API Authentication Middleware ──────────────────────────────────────
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    (req as any).user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
};

// ── REST API Endpoints ──────────────────────────────────────────────────────

// Health check endpoint verifying database connectivity
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('projects').select('id').limit(1);
    res.json({
      status: 'ok',
      database: error ? 'disconnected' : 'connected'
    });
  } catch (e) {
    res.json({
      status: 'ok',
      database: 'disconnected'
    });
  }
});

// 1. Get all projects belonging to logged in user (owned or collaborating)
app.get('/api/projects', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;

    // Fetch projects owned by user
    const { data: ownedProjects, error: ownedError } = await supabase
      .from('projects')
      .select('id, title, created_at, user_id, status, writers, producers, featured_artists')
      .eq('user_id', user.id);

    if (ownedError) throw ownedError;

    // Fetch projects where user is a collaborator
    const { data: collabProjects, error: collabError } = await supabase
      .from('project_collaborators')
      .select('projects(id, title, created_at, user_id, status, writers, producers, featured_artists)')
      .eq('user_id', user.id);

    if (collabError) throw collabError;

    const colabList = collabProjects
      ?.map((c: any) => c.projects)
      .filter(Boolean) || [];

    const combined = [...(ownedProjects || []), ...colabList];

    // Deduplicate projects by ID
    const uniqueProjects = combined.filter(
      (v, i, a) => a.findIndex((t) => t.id === v.id) === i
    );

    // Sort by created_at descending
    uniqueProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(uniqueProjects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 1b. Get a single project by ID (must be owner or collaborator)
app.get('/api/projects/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }

  try {
    const { data: project, error: getError } = await supabase
      .from('projects')
      .select('id, title, created_at, user_id, status, writers, producers, featured_artists')
      .eq('id', id)
      .single();

    if (getError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is owner or collaborator
    let hasAccess = project.user_id === user.id;
    if (!hasAccess) {
      const { data: collab, error: collabError } = await supabase
        .from('project_collaborators')
        .select('project_id')
        .eq('project_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!collabError && collab) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 1c. Update project metadata (must be owner or collaborator)
app.patch('/api/projects/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  const { title, status, writers, producers, featured_artists } = req.body;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
                 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }

  try {
    // Check if user is owner or collaborator
    const { data: project, error: getError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (getError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let hasAccess = project.user_id === user.id;
    if (!hasAccess) {
      const { data: collab, error: collabError } = await supabase
        .from('project_collaborators')
        .select('project_id')
        .eq('project_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!collabError && collab) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const dbUpdates: any = {};
    if (title !== undefined) dbUpdates.title = title;
    if (status !== undefined) dbUpdates.status = status;
    if (writers !== undefined) dbUpdates.writers = writers;
    if (producers !== undefined) dbUpdates.producers = producers;
    if (featured_artists !== undefined) dbUpdates.featured_artists = featured_artists;

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(dbUpdates)
      .eq('id', id)
      .select('id, title, created_at, user_id, status, writers, producers, featured_artists')
      .single();

    if (updateError) throw updateError;

    res.json(updatedProject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



// 2. Create a new project
app.post('/api/projects', authenticateUser, async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Missing project title' });
  }

  try {
    const user = (req as any).user;
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        title,
        user_id: user.id
      })
      .select('id, title, created_at, user_id, status, writers, producers, featured_artists')
      .single();

    if (error) throw error;
    res.status(201).json(newProject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2b. Join an existing project using link/id
app.post('/api/projects/:id/join', authenticateUser, async (req, res) => {
  const { id: projectId } = req.params;
  const user = (req as any).user;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  if (!isUuid) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }

  try {
    const { data: project, error: getError } = await supabase
      .from('projects')
      .select('id, title, created_at, user_id, status, writers, producers, featured_artists')
      .eq('id', projectId)
      .single();

    if (getError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Owner does not need to join, return metadata directly
    if (project.user_id === user.id) {
      return res.json(project);
    }

    const { error: joinError } = await supabase
      .from('project_collaborators')
      .insert({
        project_id: projectId,
        user_id: user.id
      });

    // Ignore duplicate key error (code 23505) in case they already joined
    if (joinError && (joinError as any).code !== '23505') {
      throw joinError;
    }

    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Delete a project (leaves if collaborator, deletes if owner)
app.delete('/api/projects/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }

  try {
    // Check project ownership
    const { data: project, error: getError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', id)
      .single();

    if (getError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id === user.id) {
      // Owner deletes the project completely
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
    } else {
      // Collaborator leaves the project
      const { error: leaveError } = await supabase
        .from('project_collaborators')
        .delete()
        .eq('project_id', id)
        .eq('user_id', user.id);
      if (leaveError) throw leaveError;
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend build in production
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
