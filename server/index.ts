import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { DraftModel, AudioMemoModel } from './models';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lyrical';

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit to allow base64 audio uploads

let isDbConnected = false;

// Connect to MongoDB
const connectDb = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    isDbConnected = true;
    console.log('Successfully connected to MongoDB.');
  } catch (error) {
    isDbConnected = false;
    console.error('MongoDB connection error. Server running in disconnected health state:', error);
  }
};

connectDb();

// Re-try database connection if check health requested
app.get('/api/health', async (req, res) => {
  // If not connected, attempt reconnect on check
  if (!isDbConnected) {
    try {
      if (mongoose.connection.readyState === 0) {
        await connectDb();
      } else {
        isDbConnected = mongoose.connection.readyState === 1;
      }
    } catch (e) {
      isDbConnected = false;
    }
  }
  
  res.json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'disconnected'
  });
});

// Middleware to guard database routes if DB is offline
const requireDb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!isDbConnected) {
    return res.status(503).json({ error: 'Database is offline' });
  }
  next();
};

// 1. Get all drafts (excluding heavy audio data)
app.get('/api/drafts', requireDb, async (req, res) => {
  try {
    const drafts = await DraftModel.find();
    const audioMemos = await AudioMemoModel.find({}, 'draftId');
    const audioDraftIds = new Set(audioMemos.map(a => a.draftId));

    const response = drafts.map(d => ({
      id: d._id,
      title: d.title,
      content: d.content,
      scrapbook: d.scrapbook,
      targetTemplate: d.targetTemplate,
      syllableTolerance: d.syllableTolerance ?? 1,
      hasAudio: audioDraftIds.has(d._id),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a new draft
app.post('/api/drafts', requireDb, async (req, res) => {
  const { id, title, content, scrapbook, targetTemplate, syllableTolerance } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing draft id' });
  }
  
  try {
    const newDraft = new DraftModel({
      _id: id,
      title: title || '',
      content: content || '',
      scrapbook: scrapbook || '',
      targetTemplate: targetTemplate || '',
      syllableTolerance: syllableTolerance !== undefined ? syllableTolerance : 1,
    });
    await newDraft.save();
    
    res.status(201).json({
      id: newDraft._id,
      title: newDraft.title,
      content: newDraft.content,
      scrapbook: newDraft.scrapbook,
      targetTemplate: newDraft.targetTemplate,
      syllableTolerance: newDraft.syllableTolerance ?? 1,
      hasAudio: false,
      createdAt: newDraft.createdAt.toISOString(),
      updatedAt: newDraft.updatedAt.toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Update an existing draft
app.put('/api/drafts/:id', requireDb, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  try {
    const draft = await DraftModel.findById(id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    // Update allowed fields
    if (updates.title !== undefined) draft.title = updates.title;
    if (updates.content !== undefined) draft.content = updates.content;
    if (updates.scrapbook !== undefined) draft.scrapbook = updates.scrapbook;
    if (updates.targetTemplate !== undefined) draft.targetTemplate = updates.targetTemplate;
    if (updates.syllableTolerance !== undefined) draft.syllableTolerance = updates.syllableTolerance;
    
    await draft.save();
    
    res.json({
      id: draft._id,
      title: draft.title,
      content: draft.content,
      scrapbook: draft.scrapbook,
      targetTemplate: draft.targetTemplate,
      syllableTolerance: draft.syllableTolerance ?? 1,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete a draft (and associated audio memo)
app.delete('/api/drafts/:id', requireDb, async (req, res) => {
  const { id } = req.params;
  
  try {
    await DraftModel.findByIdAndDelete(id);
    await AudioMemoModel.findOneAndDelete({ draftId: id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get the audio memo for a draft
app.get('/api/drafts/:id/audio', requireDb, async (req, res) => {
  const { id } = req.params;
  
  try {
    const memo = await AudioMemoModel.findOne({ draftId: id });
    if (!memo) {
      return res.status(404).json({ error: 'Audio memo not found' });
    }
    res.json({
      draftId: memo.draftId,
      audioData: memo.audioData,
      duration: memo.duration,
      mimeType: memo.mimeType,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Save or update the audio memo for a draft
app.post('/api/drafts/:id/audio', requireDb, async (req, res) => {
  const { id } = req.params;
  const { audioData, duration, mimeType } = req.body;
  
  if (!audioData || duration === undefined || !mimeType) {
    return res.status(400).json({ error: 'Missing required audio fields' });
  }
  
  try {
    const memo = await AudioMemoModel.findOneAndUpdate(
      { draftId: id },
      { audioData, duration, mimeType },
      { upsert: true, new: true }
    );
    res.json({ success: true, draftId: memo.draftId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Delete the audio memo for a draft
app.delete('/api/drafts/:id/audio', requireDb, async (req, res) => {
  const { id } = req.params;
  
  try {
    await AudioMemoModel.findOneAndDelete({ draftId: id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Bulk sync local drafts to cloud
app.post('/api/sync', requireDb, async (req, res) => {
  const { drafts } = req.body;
  if (!Array.isArray(drafts)) {
    return res.status(400).json({ error: 'Invalid sync payload' });
  }
  
  try {
    for (const draft of drafts) {
      await DraftModel.findByIdAndUpdate(
        draft.id,
        {
          _id: draft.id,
          title: draft.title || '',
          content: draft.content || '',
          scrapbook: draft.scrapbook || '',
          targetTemplate: draft.targetTemplate || '',
          syllableTolerance: draft.syllableTolerance !== undefined ? draft.syllableTolerance : 1,
        },
        { upsert: true }
      );
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
