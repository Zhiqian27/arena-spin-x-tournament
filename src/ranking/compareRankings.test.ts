import { describe, expect, it } from 'vitest'
import { compareRankings, sortRankings } from './compareRankings'
import type { RankingEntry } from './types'

const team = (teamId: number, score: number, submittedAt = teamId): RankingEntry => ({ teamId, score, submittedAt, teamName: `Team ${teamId}`, color: '#fff' })

describe('compareRankings', () => {
  it('detects fifth place rising to second', () => expect(compareRankings([team(1, 90), team(2, 80), team(3, 70), team(4, 60), team(5, 50)], [team(1, 90), team(2, 80), team(3, 70), team(4, 60), team(5, 85)], 5)).toMatchObject({ previousRank: 5, newRank: 2, positionsGained: 3 }))
  it('detects second place rising to first', () => expect(compareRankings([team(1, 90), team(2, 89)], [team(1, 90), team(2, 91)], 2)).toMatchObject({ previousRank: 2, newRank: 1, isNewLeader: true }))
  it('treats a new team as entering from outside the board', () => expect(compareRankings([team(1, 90), team(2, 80)], [team(1, 90), team(2, 80), team(3, 95)], 3)).toMatchObject({ previousRank: 3, newRank: 1, positionsGained: 2 }))
  it('does not report gained places when rank is unchanged', () => expect(compareRankings([team(1, 90), team(2, 80)], [team(1, 90), team(2, 81)], 2)?.positionsGained).toBe(0))
  it('uses earlier submittedAt as the tie breaker', () => expect(sortRankings([team(2, 90, 20), team(1, 90, 10)]).map(item => item.teamId)).toEqual([1, 2]))
  it('handles a removed team and an empty leaderboard', () => { expect(compareRankings([team(1, 90)], [], 1)).toBeNull(); expect(compareRankings([], [], 1)).toBeNull() })
})
