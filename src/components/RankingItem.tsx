import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import type { RankingEntry } from '../ranking/types'
import { formatScore } from '../scoring'

export function RankingItem({ entry, highlighted, dimmed }: { entry: RankingEntry, highlighted: boolean, dimmed: boolean }) {
  return <motion.article layout="position" transition={{ layout: { duration: 1.2, ease: 'easeInOut' } }} className={`overall-row rank-${entry.rank} ${highlighted ? 'ranking-highlight' : ''} ${dimmed ? 'ranking-dimmed' : ''}`}>
    <div className="rank-number">{entry.rank}{entry.rank === 1 && <Crown size={18} />}</div><div className="team-cell"><i style={{ background: entry.color }} /><strong>{entry.teamName}</strong></div>
    {(entry.stageScores ?? [0, 0, 0, 0]).map((score, index) => <div className="stage-total" key={index}>{formatScore(score)}</div>)}<div className="total-score">{formatScore(entry.score)}</div>
  </motion.article>
}
