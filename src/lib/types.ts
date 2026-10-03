export type ScoreRing = 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0;

export type DetectionMethod = 'manual' | 'ai';

export type ArrowRecord = {
  id: string;
  arrowNumber: number;
  x: number;
  y: number;
  score: number;
  detectionMethod: DetectionMethod;
  confidence?: number;
};

export type EndRecord = {
  id: string;
  endNumber: number;
  arrows: ArrowRecord[];
  totalScore: number;
};

export type SessionRecord = {
  id: string;
  date: string;
  distance: number;
  targetType: string;
  bowDivision: string;
  sessionType: string;
  arrowsPerEnd?: number;
  notes: string;
  weatherInfo: string;
  equipmentConfig: string;
  ends: EndRecord[];
};

export type SessionSummary = {
  totalScore: number;
  averageArrowScore: number;
  averageEndScore: number;
  scoreDistribution: Record<string, number>;
  groupCentroid: { x: number; y: number };
  horizontalDeviation: number;
  verticalDeviation: number;
  radialDistance: number;
  groupSize: number;
  extremeSpread: number;
  standardDeviation: number;
  leftRightBias: number;
  highLowBias: number;
  firstHalfPerformance: number;
  secondHalfPerformance: number;
  endConsistency: number;
};
