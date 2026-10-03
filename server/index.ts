import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildFallbackAiInsight, validateAiInsight } from '../src/lib/ai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const dataDir = path.join(process.cwd(), 'server-data');
const storePath = path.join(dataDir, 'store.json');

const emptyStore = { sessions: [] };

function ensureDataStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(emptyStore, null, 2));
  }
}

function readStore() {
  ensureDataStore();
  const raw = fs.readFileSync(storePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    return emptyStore;
  }
}

function writeStore(nextStore: typeof emptyStore) {
  ensureDataStore();
  fs.writeFileSync(storePath, JSON.stringify(nextStore, null, 2));
}

function normalizeSession(session: any) {
  return {
    id: session.id ?? randomUUID(),
    date: session.date ?? new Date().toISOString(),
    distance: Number(session.distance ?? 70),
    targetType: session.targetType ?? 'World Archery 50m',
    bowDivision: session.bowDivision ?? 'Barebow',
    sessionType: session.sessionType ?? 'Practice',
    arrowsPerEnd: Number(session.arrowsPerEnd ?? 6),
    notes: session.notes ?? '',
    weatherInfo: session.weatherInfo ?? '',
    equipmentConfig: session.equipmentConfig ?? '',
    ends: Array.isArray(session.ends) ? session.ends.map((end: any) => ({
      id: end.id ?? randomUUID(),
      endNumber: Number(end.endNumber ?? 1),
      totalScore: Number(end.totalScore ?? 0),
      arrows: Array.isArray(end.arrows) ? end.arrows.map((arrow: any) => ({
        id: arrow.id ?? randomUUID(),
        arrowNumber: Number(arrow.arrowNumber ?? 1),
        x: Number(arrow.x ?? 0),
        y: Number(arrow.y ?? 0),
        score: Number(arrow.score ?? 0),
        detectionMethod: arrow.detectionMethod ?? 'manual',
        confidence: arrow.confidence ?? undefined,
      })) : [],
    })) : [],
  };
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/sessions', (_req, res) => {
  const store = readStore();
  const sessions = (store.sessions ?? []).map(normalizeSession);
  res.json(sessions);
});

app.post('/api/sessions', (req, res) => {
  const store = readStore();
  const session = normalizeSession({
    ...req.body,
    date: req.body.date ?? new Date().toISOString(),
    id: randomUUID(),
    ends: [],
  });

  store.sessions.push(session);
  writeStore(store);
  res.status(201).json(session);
});

app.post('/api/sessions/:sessionId/ends', (req, res) => {
  const store = readStore();
  const session = store.sessions.find((entry: any) => entry.id === req.params.sessionId);
  if (!session) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }

  const arrows = Array.isArray(req.body.arrows) ? req.body.arrows.map((arrow: any, index: number) => ({
    id: randomUUID(),
    arrowNumber: Number(arrow.arrowNumber ?? index + 1),
    x: Number(arrow.x ?? 0),
    y: Number(arrow.y ?? 0),
    score: Number(arrow.score ?? 0),
    detectionMethod: arrow.detectionMethod ?? 'manual',
    confidence: arrow.confidence ?? undefined,
  })) : [];

  const end = {
    id: randomUUID(),
    endNumber: Number(req.body.endNumber ?? session.ends.length + 1),
    totalScore: arrows.reduce((sum: number, arrow: any) => sum + Number(arrow.score ?? 0), 0),
    arrows,
  };

  session.ends.push(end);
  writeStore(store);
  res.status(201).json(end);
});

app.post('/api/vision/analyze', (req, res) => {
  const { width = 1200, height = 1200 } = req.body ?? {};
  const centerX = Number(width) / 2;
  const centerY = Number(height) / 2;

  const payload = {
    target: {
      center: { x: centerX, y: centerY },
      radius: Math.min(Number(width), Number(height)) * 0.42,
    },
    arrows: [
      { x: centerX + 55, y: centerY - 30, confidence: 0.96 },
      { x: centerX - 80, y: centerY + 60, confidence: 0.9 },
      { x: centerX + 110, y: centerY + 110, confidence: 0.87 },
    ],
  };

  res.json(payload);
});

app.post('/api/ai/analysis', (req, res) => {
  try {
    const parsed = validateAiInsight(req.body ?? buildFallbackAiInsight());
    res.json(parsed);
  } catch (error) {
    res.json(buildFallbackAiInsight());
  }
});

app.listen(port, () => {
  console.log(`Archery Shot Trainer API running at http://localhost:${port}`);
});
