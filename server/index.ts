import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
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
setPersistence({
  bindState: async (docName: string, ydoc: Y.Doc) => {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('title, yjs_state')
        .eq('id', docName)
        .single();

      if (error) {
        console.error(`Error fetching project ${docName} for Yjs binding:`, error.message);
        return;
      }

      if (project) {
        const titleText = ydoc.getText('title');
        
        // Hydrate from binary state if it exists
        if (project.yjs_state) {
          Y.applyUpdate(ydoc, Buffer.from(project.yjs_state));
        }

        // Initialize Yjs shared types if empty
        ydoc.transact(() => {
          if (titleText.length === 0 && project.title) {
            titleText.insert(0, project.title);
          }
        });
      }
    } catch (err) {
      console.error(`Error loading project ${docName} for Yjs persistence:`, err);
    }

    // Debounced save back to Supabase projects table
    const saveToDb = debounce(async () => {
      try {
        const title = ydoc.getText('title').toString();
        const stateUpdate = Y.encodeStateAsUpdate(ydoc);

        const { error } = await supabase
          .from('projects')
          .update({
            title,
            yjs_state: Buffer.from(stateUpdate)
          })
          .eq('id', docName);

        if (error) throw error;
        console.log(`Auto-saved collaborative project ${docName} to Supabase.`);
      } catch (err: any) {
        console.error(`Failed to auto-save collaborative project ${docName}:`, err.message);
      }
    }, 2000);

    ydoc.on('update', () => {
      saveToDb();
    });
  },
  writeState: async (docName: string, ydoc: Y.Doc) => {
    try {
      const title = ydoc.getText('title').toString();
      const stateUpdate = Y.encodeStateAsUpdate(ydoc);

      const { error } = await supabase
        .from('projects')
        .update({
          title,
          yjs_state: Buffer.from(stateUpdate)
        })
        .eq('id', docName);

      if (error) throw error;
      console.log(`Final saved collaborative project ${docName} to Supabase.`);
    } catch (err: any) {
      console.error(`Failed to final save collaborative project ${docName}:`, err.message);
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

      if (dbError || !project || project.user_id !== user.id) {
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

// 1. Get all projects belonging to logged in user
app.get('/api/projects', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(projects);
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
      .select('id, title, created_at')
      .single();

    if (error) throw error;
    res.status(201).json(newProject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Delete a project
app.delete('/api/projects/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;

  try {
    const user = (req as any).user;
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
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
