export type RankingEntry = {
  teamId: number
  teamName: string
  score: number
  submittedAt: number
  color: string
  stageScores?: number[]
  rank?: number
}

export type RankChange = {
  teamId: number
  previousRank: number
  newRank: number
  positionsGained: number
  overtakenTeams: RankingEntry[]
  isNewLeader: boolean
}

export type AnimationPhase = 'idle' | 'revealingScore' | 'showingRankChange' | 'movingRanking' | 'highlightingResult' | 'completed'
