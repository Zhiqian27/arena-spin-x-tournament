export type ScoreStage = 'women' | 'men' | 'duo' | 'team'

export function calculateStageScore(scores: number[], stage: ScoreStage) {
  const total = scores.reduce((sum, score) => sum + score, 0)
  if (stage === 'duo') return total * 1.25
  if (stage === 'team') return total / 2 * 1.5
  return total
}

export const formatScore = (score: number) => Number.isInteger(score) ? String(score) : String(Number(score.toFixed(2)))
