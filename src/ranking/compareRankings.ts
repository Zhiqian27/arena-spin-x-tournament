import type { RankChange, RankingEntry } from './types'

/** Higher total wins; equal totals keep the team that completed scoring earlier ahead. */
export function sortRankings(entries: RankingEntry[]): RankingEntry[] {
  return [...entries]
    .sort((left, right) => right.score - left.score || left.submittedAt - right.submittedAt || left.teamId - right.teamId)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export function compareRankings(previous: RankingEntry[], next: RankingEntry[], teamId: number): RankChange | null {
  const nextRanked = sortRankings(next)
  const target = nextRanked.find(team => team.teamId === teamId)
  if (!target) return null
  const previousRanked = sortRankings(previous)
  const previousRank = previousRanked.findIndex(team => team.teamId === teamId) + 1 || previousRanked.length + 1
  const newRank = target.rank ?? nextRanked.length
  const positionsGained = Math.max(0, previousRank - newRank)
  return {
    teamId,
    previousRank,
    newRank,
    positionsGained,
    overtakenTeams: positionsGained ? previousRanked.filter(team => (team.rank ?? 0) >= newRank && (team.rank ?? 0) < previousRank && team.teamId !== teamId) : [],
    isNewLeader: newRank === 1 && previousRank !== 1,
  }
}
