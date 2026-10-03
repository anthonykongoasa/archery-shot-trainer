import { z } from 'zod';

const aiObservationSchema = z.object({
  observations: z.array(z.string()),
  trends: z.array(z.string()),
  changes: z.array(z.string()),
  possible_explanations: z.array(z.string()),
  suggested_focus: z.array(z.string()),
});

export type AIInsight = z.infer<typeof aiObservationSchema>;

export function validateAiInsight(payload: unknown): AIInsight {
  return aiObservationSchema.parse(payload);
}

export function buildFallbackAiInsight(): AIInsight {
  return {
    observations: ['The app is in offline mode. No Gemini key is configured.', 'Session data is still available for manual review.'],
    trends: ['Trend analysis is available in the local statistics engine.'],
    changes: ['Use the session history and score comparison tools to review recent progress.'],
    possible_explanations: ['The data is incomplete without a configured AI service.'],
    suggested_focus: ['Review the score distribution and end-by-end consistency in the current session.'],
  };
}

export function buildDemoVisionDetection(width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;

  return {
    target: {
      center: { x: centerX, y: centerY },
      radius: Math.min(width, height) * 0.42,
    },
    arrows: [
      { x: centerX + 60, y: centerY - 38, confidence: 0.95 },
      { x: centerX - 26, y: centerY + 70, confidence: 0.88 },
      { x: centerX + 110, y: centerY + 105, confidence: 0.81 },
    ],
  };
}
