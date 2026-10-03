import { useEffect, useMemo, useRef, useState } from 'react';
import { buildDemoVisionDetection, buildFallbackAiInsight, validateAiInsight } from './lib/ai';
import { normalizePointFromPixels, scoreArrow, clampNormalized } from './lib/target';
import { sortSessionsByDate, summarizeSession } from './lib/statistics';
import type { ArrowRecord, EndRecord, SessionRecord } from './lib/types';

const WA_TARGET_OPTIONS = [
  'WA 122 cm',
  'WA 100 cm',
  'WA 80 cm',
  'WA 60 cm',
  'WA 40 cm',
] as const;

const defaultSessionForm = {
  distance: 70,
  targetType: 'WA 122 cm',
  bowDivision: 'Barebow',
  sessionType: 'Practice',
  arrowsPerEnd: 6,
  notes: '',
  weatherInfo: '',
  equipmentConfig: '',
};

function App() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState(defaultSessionForm);
  const [currentEndNumber, setCurrentEndNumber] = useState(1);
  const [arrows, setArrows] = useState<ArrowRecord[]>([]);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'analysis'>('new');
  const [viewMode, setViewMode] = useState<'setup' | 'session'>('setup');
  const [analysis, setAnalysis] = useState<any>(null);
  const [visionPreview, setVisionPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentSession = sessions.find((session) => session.id === currentSessionId) ?? null;

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(sortSessionsByDate(data));
    } catch (err) {
      setError('Unable to reach the training data API.');
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const saveEnd = async () => {
    if (!currentSessionId) {
      setError('Create a session before saving an end.');
      return;
    }

    const payload = {
      endNumber: currentEndNumber,
      arrows: arrows.map((arrow, index) => ({
        ...arrow,
        arrowNumber: index + 1,
        score: Math.max(0, Math.min(10, arrow.score)),
      })),
    };

    const response = await fetch(`/api/sessions/${currentSessionId}/ends`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setError('Unable to save the end.');
      return;
    }

    setArrows([]);
    setCurrentEndNumber((value) => value + 1);
    setSelectedArrowId(null);
    await loadSessions();
  };

  const createSession = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sessionForm,
          date: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Create session failed');
      }

      const created = await response.json();
      setSessions((current) => sortSessionsByDate([...current, created]));
      setCurrentSessionId(created.id);
      setCurrentEndNumber(1);
      setArrows([]);
      setViewMode('session');
      setActiveTab('new');
      await loadSessions();
    } catch (err) {
      setError('Unable to create the training session.');
    } finally {
      setLoading(false);
    }
  };

  const runVisionAnalysis = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const image = new Image();
      image.src = String(reader.result);
      image.onload = async () => {
        const preview = buildDemoVisionDetection(image.width, image.height);
        setVisionPreview(preview);

        try {
          const response = await fetch('/api/vision/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ width: image.width, height: image.height, imageData: String(reader.result) }),
          });

          if (!response.ok) {
            throw new Error('Vision request failed');
          }

          const body = await response.json();
          setVisionPreview(body);
        } catch (error) {
          setVisionPreview(preview);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleAiReview = async () => {
    const targetSession = currentSession ?? sessions[0];
    if (!targetSession) return;

    const summary = summarizeSession(targetSession);

    try {
      const response = await fetch('/api/ai/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentSession: summary,
          previousSessions: sessions.slice(-3).map((item) => summarizeSession(item)),
          notes: targetSession.notes,
        }),
      });

      const body = await response.json();
      const insight = validateAiInsight(body);
      setAnalysis(insight);
    } catch (err) {
      setAnalysis(buildFallbackAiInsight());
    }
  };

  const selectedSession = useMemo(() => sessions[sessions.length - 1] ?? null, [sessions]);

  const totalSavedScore = currentSession?.ends.reduce((sum, end) => sum + end.totalScore, 0) ?? 0;
  const runningScore = arrows.reduce((total, arrow) => total + arrow.score, 0);
  const completedArrowCount = currentSession ? currentSession.ends.reduce((total, end) => total + end.arrows.length, 0) : 0;
  const totalArrowCount = completedArrowCount + arrows.length;
  const runningAverage = totalArrowCount ? (totalSavedScore + runningScore) / totalArrowCount : 0;
  const maxScore = Math.max((currentSession?.arrowsPerEnd ?? sessionForm.arrowsPerEnd) * 10, 0);
  const totalSessionScore = totalSavedScore + runningScore;
  const totalPossibleScore = ((currentSession?.ends.length ?? 0) + 1) * (currentSession?.arrowsPerEnd ?? sessionForm.arrowsPerEnd) * 10;

  if (viewMode === 'session' && currentSession) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Session</p>
            <h1>{new Date(currentSession.date).toLocaleDateString()}</h1>
          </div>
          <nav className="nav">
            <button onClick={() => {
              setViewMode('setup');
              setActiveTab('new');
            }}>Back to setup</button>
          </nav>
        </header>

        <main className="main-grid">
          <section className="panel primary-panel">
            <div className="section-header">
              <h2>{currentSession.targetType} • {currentSession.distance}m</h2>
              <span>{currentSession.sessionType}</span>
            </div>

            <div className="stats-grid compact-grid">
              <StatCard label="Total score" value={`${totalSessionScore}`} />
              <StatCard label="Running score" value={`${runningScore}`} />
              <StatCard label="Max score" value={`${totalPossibleScore}`} />
              <StatCard label="Running average" value={runningAverage.toFixed(1)} />
            </div>

            <div className="entry-methods session-layout">
              <div className="entry-card">
                <h4>Manual entry</h4>
                <TargetEditor
                  arrows={arrows}
                  setArrows={setArrows}
                  selectedArrowId={selectedArrowId}
                  setSelectedArrowId={setSelectedArrowId}
                  targetType={currentSession.targetType}
                />
              </div>
              <div className="entry-card">
                <h4>Photo analysis</h4>
                <input type="file" accept="image/*" capture="environment" onChange={runVisionAnalysis} />
                {visionPreview ? (
                  <div className="vision-preview">
                    <h5>Detected target</h5>
                    <pre>{JSON.stringify(visionPreview, null, 2)}</pre>
                  </div>
                ) : (
                  <p className="muted">Upload a target photo to review AI-detected impacts.</p>
                )}
              </div>
            </div>

            <div className="meta-block">
              <div><strong>Distance:</strong> {currentSession.distance}m</div>
              <div><strong>Bow division:</strong> {currentSession.bowDivision}</div>
              <div><strong>Arrows per end:</strong> {currentSession.arrowsPerEnd ?? sessionForm.arrowsPerEnd}</div>
              <div><strong>Weather:</strong> {currentSession.weatherInfo || '—'}</div>
              <div><strong>Equipment:</strong> {currentSession.equipmentConfig || '—'}</div>
              <div><strong>Notes:</strong> {currentSession.notes || '—'}</div>
            </div>

            <div className="end-actions">
              <button className="primary" onClick={saveEnd}>Save end</button>
              <button onClick={() => setArrows([])}>Clear arrows</button>
            </div>
          </section>

          <aside className="panel side-panel">
            <div className="section-header">
              <h3>End overview</h3>
            </div>
            <div className="current-end-summary">
              <strong>End {currentEndNumber}</strong>
              <span>{runningScore} pts</span>
            </div>
            <div className="arrow-list">
              {arrows.length ? arrows.map((arrow, index) => (
                <div key={arrow.id} className={`arrow-row ${selectedArrowId === arrow.id ? 'selected' : ''}`} onClick={() => setSelectedArrowId(arrow.id)}>
                  <span>Arrow {index + 1}</span>
                  <span>{arrow.score}</span>
                  <span>{arrow.x.toFixed(2)}, {arrow.y.toFixed(2)}</span>
                </div>
              )) : <p className="muted">No arrows yet for this end.</p>}
            </div>

            {currentSession.ends.length ? (
              <>
                <div className="section-header compact-header">
                  <h3>Saved ends</h3>
                </div>
                <div className="session-list narrow">
                  {currentSession.ends.map((end) => (
                    <div key={end.id} className="mini-end">
                      <span>End {end.endNumber}</span>
                      <strong>{end.totalScore}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Training analytics</p>
          <h1>Archery Shot Trainer</h1>
        </div>
        <nav className="nav">
          <button className={activeTab === 'new' ? 'active' : ''} onClick={() => setActiveTab('new')}>New Session</button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>History</button>
          <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}>Analysis</button>
        </nav>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <main className="main-grid">
        <section className="panel primary-panel">
          {activeTab === 'new' ? (
            <>
              <div className="section-header">
                <h2>Session setup</h2>
              </div>

              <div className="session-form">
                <label>
                  Distance (m)
                  <input type="number" value={sessionForm.distance} onChange={(event) => setSessionForm({ ...sessionForm, distance: Number(event.target.value) })} />
                </label>
                <label>
                  Target type
                  <select value={sessionForm.targetType} onChange={(event) => setSessionForm({ ...sessionForm, targetType: event.target.value })}>
                    {WA_TARGET_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Bow division
                  <input value={sessionForm.bowDivision} onChange={(event) => setSessionForm({ ...sessionForm, bowDivision: event.target.value })} />
                </label>
                <label>
                  Arrows per end
                  <select value={sessionForm.arrowsPerEnd} onChange={(event) => setSessionForm({ ...sessionForm, arrowsPerEnd: Number(event.target.value) })}>
                    <option value={3}>3</option>
                    <option value={6}>6</option>
                  </select>
                </label>
                <label>
                  Session type
                  <select value={sessionForm.sessionType} onChange={(event) => setSessionForm({ ...sessionForm, sessionType: event.target.value })}>
                    <option value="Practice">Practice</option>
                    <option value="Competition">Competition</option>
                    <option value="Warmup">Warmup</option>
                  </select>
                </label>
                <label>
                  Notes
                  <textarea value={sessionForm.notes} onChange={(event) => setSessionForm({ ...sessionForm, notes: event.target.value })} />
                </label>
                <label>
                  Weather
                  <input value={sessionForm.weatherInfo} onChange={(event) => setSessionForm({ ...sessionForm, weatherInfo: event.target.value })} />
                </label>
                <label>
                  Equipment
                  <input value={sessionForm.equipmentConfig} onChange={(event) => setSessionForm({ ...sessionForm, equipmentConfig: event.target.value })} />
                </label>
                <button className="primary" onClick={createSession} disabled={loading}>
                  {loading ? 'Creating…' : 'Create session'}
                </button>
              </div>

              {currentSession ? (
                <>
                  <div className="section-header compact-header">
                    <h3>Current session</h3>
                    <span>{currentSession.targetType} • {currentSession.distance}m</span>
                  </div>

                  <div className="entry-methods">
                    <div className="entry-card">
                      <h4>Manual entry</h4>
                      <TargetEditor
                        arrows={arrows}
                        setArrows={setArrows}
                        selectedArrowId={selectedArrowId}
                        setSelectedArrowId={setSelectedArrowId}
                        targetType={sessionForm.targetType}
                      />
                    </div>
                    <div className="entry-card">
                      <h4>Photo analysis</h4>
                      <input type="file" accept="image/*" capture="environment" onChange={runVisionAnalysis} />
                      {visionPreview ? (
                        <div className="vision-preview">
                          <h5>Detected target</h5>
                          <pre>{JSON.stringify(visionPreview, null, 2)}</pre>
                        </div>
                      ) : (
                        <p className="muted">Upload a target photo to review AI-detected impacts.</p>
                      )}
                    </div>
                  </div>

                  <div className="end-actions">
                    <button className="primary" onClick={saveEnd}>Save end</button>
                    <button onClick={() => setArrows([])}>Clear arrows</button>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {activeTab === 'history' ? (
            <>
              <div className="section-header">
                <h2>Session history</h2>
              </div>
              <div className="session-list">
                {sessions.map((session) => (
                  <button key={session.id} className="session-item" onClick={() => setCurrentSessionId(session.id)}>
                    <strong>{new Date(session.date).toLocaleDateString()}</strong>
                    <span>{session.distance} m</span>
                    <span>{session.sessionType}</span>
                    <small>{summarizeSession(session).totalScore} pts</small>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === 'analysis' ? (
            <>
              <div className="section-header">
                <h2>Analytics</h2>
              </div>

              {selectedSession ? (
                <>
                  <div className="stats-grid">
                    <StatCard label="Total score" value={`${summarizeSession(selectedSession).totalScore}`} />
                    <StatCard label="Average arrow" value={summarizeSession(selectedSession).averageArrowScore.toFixed(1)} />
                    <StatCard label="Group size" value={summarizeSession(selectedSession).groupSize.toFixed(2)} />
                    <StatCard label="Bias" value={`${summarizeSession(selectedSession).leftRightBias.toFixed(2)}, ${summarizeSession(selectedSession).highLowBias.toFixed(2)}`} />
                  </div>

                  <div className="chart-card">
                    <h3>Score distribution</h3>
                    <ScoreChart session={selectedSession} />
                  </div>

                  <div className="ai-panel">
                    <button className="primary" onClick={handleAiReview}>Ask AI for pattern review</button>
                    {analysis ? (
                      <div className="insight-box">
                        {Object.entries(analysis).map(([key, value]) => (
                          <div key={key}>
                            <h4>{key}</h4>
                            <ul>
                              {Array.isArray(value) ? value.map((entry) => <li key={entry}>{entry}</li>) : null}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="muted">Create a session to view analytics.</p>
              )}
            </>
          ) : null}
        </section>

        <aside className="panel side-panel">
          <div className="section-header">
            <h3>End overview</h3>
          </div>
          {currentSession ? (
            <>
              <div className="current-end-summary">
                <strong>End {currentEndNumber}</strong>
                <span>{arrows.reduce((sum, arrow) => sum + arrow.score, 0)} pts</span>
              </div>
              <div className="arrow-list">
                {arrows.length ? arrows.map((arrow, index) => (
                  <div key={arrow.id} className={`arrow-row ${selectedArrowId === arrow.id ? 'selected' : ''}`} onClick={() => setSelectedArrowId(arrow.id)}>
                    <span>Arrow {index + 1}</span>
                    <span>{arrow.score}</span>
                    <span>{arrow.x.toFixed(2)}, {arrow.y.toFixed(2)}</span>
                  </div>
                )) : <p className="muted">No arrows yet for this end.</p>}
              </div>

              {currentSession.ends.length ? (
                <>
                  <div className="section-header compact-header">
                    <h3>Saved ends</h3>
                  </div>
                  <div className="session-list narrow">
                    {currentSession.ends.map((end) => (
                      <div key={end.id} className="mini-end">
                        <span>End {end.endNumber}</span>
                        <strong>{end.totalScore}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <p className="muted">No active session selected.</p>
          )}
        </aside>
      </main>
    </div>
  );
}

type TargetEditorProps = {
  arrows: ArrowRecord[];
  setArrows: React.Dispatch<React.SetStateAction<ArrowRecord[]>>;
  selectedArrowId: string | null;
  setSelectedArrowId: React.Dispatch<React.SetStateAction<string | null>>;
  targetType: string;
};

function TargetEditor({ arrows, setArrows, selectedArrowId, setSelectedArrowId, targetType }: TargetEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const handleTargetClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (dragIdRef.current) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const normalized = normalizePointFromPixels(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    const nextArrow: ArrowRecord = {
      id: crypto.randomUUID(),
      arrowNumber: arrows.length + 1,
      x: clampNormalized(normalized.x),
      y: clampNormalized(normalized.y),
      score: scoreArrow(normalized.x, normalized.y),
      detectionMethod: 'manual',
    };

    setArrows((current) => [...current, nextArrow]);
    setSelectedArrowId(nextArrow.id);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragIdRef.current || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const normalized = normalizePointFromPixels(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);

    setArrows((current) => current.map((arrow) => {
      if (arrow.id !== dragIdRef.current) return arrow;
      return { ...arrow, x: clampNormalized(normalized.x), y: clampNormalized(normalized.y), score: scoreArrow(normalized.x, normalized.y) };
    }));
  };

  const handlePointerUp = () => {
    dragIdRef.current = null;
  };

  const scale = 1;
  const targetRingPalette = [
    { radius: 140 * scale, color: '#ffffff', stroke: '#dfeaf7' },
    { radius: 126 * scale, color: '#ffffff', stroke: '#dfeaf7' },
    { radius: 118 * scale, color: '#111111', stroke: '#111111' },
    { radius: 102 * scale, color: '#111111', stroke: '#dfeaf7' },
    { radius: 86 * scale, color: '#1f5bc3', stroke: '#dfeaf7' },
    { radius: 70 * scale, color: '#1f5bc3', stroke: '#dfeaf7' },
    { radius: 54 * scale, color: '#d94848', stroke: '#dfeaf7' },
    { radius: 38 * scale, color: '#d94848', stroke: '#dfeaf7' },
    { radius: 24 * scale, color: '#f0c94b', stroke: '#dfeaf7' },
    { radius: 16 * scale, color: '#f0c94b', stroke: '#dfeaf7' },
    { radius: 10 * scale, color: '#f3d66a', stroke: '#dfeaf7' },
    { radius: 6 * scale, color: '#f8dd7a', stroke: '#dfeaf7' },
  ];

  return (
    <div className="target-editor">
      <svg ref={svgRef} viewBox="0 0 300 300" className="target-svg" onClick={handleTargetClick} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
        {targetRingPalette.map((ring) => (
          <circle
            key={ring.radius}
            cx="150"
            cy="150"
            r={ring.radius}
            className="target-ring"
            fill={ring.color}
            stroke={ring.stroke}
            strokeWidth={1.5}
          />
        ))}
        <circle cx="150" cy="150" r="3" className="center-dot" />

        {arrows.map((arrow, index) => {
          const x = 150 + arrow.x * 120;
          const y = 150 - arrow.y * 120;
          const isSelected = selectedArrowId === arrow.id;

          return (
            <g
              key={arrow.id}
              transform={`translate(${x}, ${y})`}
              className={isSelected ? 'arrow selected' : 'arrow'}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedArrowId(arrow.id);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                dragIdRef.current = arrow.id;
                setSelectedArrowId(arrow.id);
              }}
            >
              <g className="arrow-marker-x" transform="scale(1.05)">
                <line x1="-7" y1="-7" x2="7" y2="7" />
                <line x1="-7" y1="7" x2="7" y2="-7" />
              </g>
              <text y={-14} textAnchor="middle" className="arrow-number">{index + 1}</text>
            </g>
          );
        })}
      </svg>

      <div className="target-controls">
        {selectedArrowId ? (
          <>
            <button onClick={() => {
              setArrows((current) => current.filter((arrow) => arrow.id !== selectedArrowId));
              setSelectedArrowId(null);
            }}>Delete selected</button>
            <button onClick={() => {
              const arrow = arrows.find((item) => item.id === selectedArrowId);
              if (!arrow) return;
              setArrows((current) => current.map((item) => item.id === arrow.id ? { ...item, score: scoreArrow(item.x, item.y) } : item));
            }}>Re-score</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ScoreChart({ session }: { session: SessionRecord }) {
  const ends = session.ends;
  const max = Math.max(...(ends.map((end) => end.totalScore) || [1]), 1);

  return (
    <div className="chart">
      {ends.map((end, index) => (
        <div key={end.id} className="bar-group" title={`End ${end.endNumber}: ${end.totalScore}`}>
          <div className="bar" style={{ height: `${(end.totalScore / max) * 100}%` }} />
          <span>{index + 1}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
