import type { ArrowRecord, EndRecord, SessionRecord, SessionSummary } from './types';

export function getAllArrows(session: SessionRecord): ArrowRecord[] {
  return session.ends.flatMap((end) => end.arrows);
}

export function getScoreDistribution(arrows: ArrowRecord[]): Record<string, number> {
  const distribution: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 };

  for (const arrow of arrows) {
    const score = Math.max(0, Math.min(10, arrow.score));
    distribution[String(score)] += 1;
  }

  return distribution;
}

export function calculateCentroid(arrows: ArrowRecord[]): { x: number; y: number } {
  if (arrows.length === 0) return { x: 0, y: 0 };

  const xTotal = arrows.reduce((total, arrow) => total + arrow.x, 0);
  const yTotal = arrows.reduce((total, arrow) => total + arrow.y, 0);

  return {
    x: xTotal / arrows.length,
    y: yTotal / arrows.length,
  };
}

export function calculateGroupSize(arrows: ArrowRecord[]): number {
  if (arrows.length < 2) return 0;
  const centroid = calculateCentroid(arrows);
  const distances = arrows.map((arrow) => Math.hypot(arrow.x - centroid.x, arrow.y - centroid.y));
  return distances.reduce((total, value) => total + value, 0) / distances.length;
}

export function calculateExtremeSpread(arrows: ArrowRecord[]): number {
  if (arrows.length < 2) return 0;
  const distances = arrows.map((arrow) => Math.hypot(arrow.x, arrow.y));
  return Math.max(...distances) - Math.min(...distances);
}

export function calculateHorizontalDeviation(arrows: ArrowRecord[]): number {
  if (arrows.length === 0) return 0;
  const centroid = calculateCentroid(arrows);
  return Math.abs(centroid.x);
}

export function calculateVerticalDeviation(arrows: ArrowRecord[]): number {
  if (arrows.length === 0) return 0;
  const centroid = calculateCentroid(arrows);
  return Math.abs(centroid.y);
}

export function calculateRadialDistance(arrows: ArrowRecord[]): number {
  if (arrows.length === 0) return 0;
  const centroid = calculateCentroid(arrows);
  return Math.hypot(centroid.x, centroid.y);
}

export function calculateStandardDeviation(arrows: ArrowRecord[]): number {
  if (arrows.length === 0) return 0;
  const scores = arrows.map((arrow) => arrow.score);
  const average = scores.reduce((total, score) => total + score, 0) / scores.length;
  const variance = scores.reduce((total, score) => total + (score - average) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}

export function calculateLeftRightBias(arrows: ArrowRecord[]): number {
  if (arrows.length === 0) return 0;
  const xValues = arrows.map((arrow) => arrow.x);
  return xValues.reduce((total, value) => total + value, 0) / xValues.length;
}

export function calculateHighLowBias(arrows: ArrowRecord[]): number {
  if (arrows.length === 0) return 0;
  const yValues = arrows.map((arrow) => arrow.y);
  return yValues.reduce((total, value) => total + value, 0) / yValues.length;
}

export function summarizeSession(session: SessionRecord): SessionSummary {
  const arrows = getAllArrows(session);
  const ends = session.ends;
  const totalScore = arrows.reduce((total, arrow) => total + arrow.score, 0);
  const averageArrowScore = arrows.length ? totalScore / arrows.length : 0;
  const averageEndScore = ends.length ? totalScore / ends.length : 0;
  const scoreDistribution = getScoreDistribution(arrows);
  const centroid = calculateCentroid(arrows);
  const groupSize = calculateGroupSize(arrows);

  const firstHalf = ends.slice(0, Math.ceil(ends.length / 2));
  const secondHalf = ends.slice(Math.ceil(ends.length / 2));
  const firstHalfScore = firstHalf.reduce((total, end) => total + end.totalScore, 0);
  const secondHalfScore = secondHalf.reduce((total, end) => total + end.totalScore, 0);

  const numericConsistency = ends.length > 1
    ? ends.reduce((total, end) => total + Math.abs(end.totalScore - averageEndScore), 0) / ends.length
    : 0;

  return {
    totalScore,
    averageArrowScore,
    averageEndScore,
    scoreDistribution,
    groupCentroid: centroid,
    horizontalDeviation: calculateHorizontalDeviation(arrows),
    verticalDeviation: calculateVerticalDeviation(arrows),
    radialDistance: calculateRadialDistance(arrows),
    groupSize,
    extremeSpread: calculateExtremeSpread(arrows),
    standardDeviation: calculateStandardDeviation(arrows),
    leftRightBias: calculateLeftRightBias(arrows),
    highLowBias: calculateHighLowBias(arrows),
    firstHalfPerformance: firstHalf.length ? firstHalfScore / firstHalf.length : 0,
    secondHalfPerformance: secondHalf.length ? secondHalfScore / secondHalf.length : 0,
    endConsistency: numericConsistency,
  };
}

export function buildTrendAnalysis(session: SessionRecord, previous: SessionRecord[]): { label: string; details: string[] } {
  const summary = summarizeSession(session);
  const previousSummaries = previous.map((entry) => summarizeSession(entry));

  const details: string[] = [];
  const avg = previousSummaries.reduce((total, current) => total + current.averageArrowScore, 0) / Math.max(previousSummaries.length, 1);

  if (summary.averageArrowScore > avg + 0.3) {
    details.push(`Your average arrow score is above your recent baseline by ${Math.abs(summary.averageArrowScore - avg).toFixed(1)} points.`);
  }
  if (summary.groupSize > 0 && previousSummaries.some((entry) => entry.groupSize > summary.groupSize)) {
    details.push('Your group size is tighter than several recent sessions.');
  }
  if (Math.abs(summary.leftRightBias) > 0.08) {
    details.push(`Your group is biased ${summary.leftRightBias < 0 ? 'left' : 'right'} of center in the current session.`);
  }

  return {
    label: `${session.sessionType} session at ${session.distance}m`,
    details,
  };
}

export function sortSessionsByDate(sessions: SessionRecord[]): SessionRecord[] {
  return [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
