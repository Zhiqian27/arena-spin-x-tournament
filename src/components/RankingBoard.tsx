import { LayoutGroup } from 'framer-motion'
import type { AnimationPhase, RankChange, RankingEntry } from '../ranking/types'
import { RankingItem } from './RankingItem'

export function RankingBoard({ ranking, highlightedTeamId, change, phase }: { ranking: RankingEntry[], highlightedTeamId: number | null, change: RankChange | null, phase: AnimationPhase }) {
  const dimmed = new Set(phase === 'movingRanking' ? change?.overtakenTeams.map(item => item.teamId) : [])
  return <section className="rank-board leaderboard-focus"><div className="board-title"><div><span>团队总积分排名</span><small>ALL FOUR STAGES · TOTAL SCORE</small></div><b>实时榜单</b></div><div className="overall-head"><span>排名</span><span>参赛团队</span><span>女子个人</span><span>男子个人</span><span>双人</span><span>团体</span><span>总分</span></div><LayoutGroup><div className="rank-list">{ranking.map(entry => <RankingItem key={entry.teamId} entry={entry} highlighted={entry.teamId === highlightedTeamId} dimmed={dimmed.has(entry.teamId)} />)}</div></LayoutGroup></section>
}
