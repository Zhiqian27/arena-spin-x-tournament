import { motion, AnimatePresence } from 'framer-motion'
import { Crown, TrendingUp } from 'lucide-react'
import type { AnimationPhase, RankChange } from '../ranking/types'

export function RankChangeOverlay({ phase, change }: { phase: AnimationPhase, change: RankChange | null }) {
  const visible = phase === 'showingRankChange' && change
  return <AnimatePresence>{visible && <motion.div className="rank-change-overlay" initial={{ opacity: 0, scale: .75 }} animate={{ opacity: 1, scale: 1, x: [0, -4, 4, -3, 0] }} exit={{ opacity: 0, scale: 1.1 }}><div>{change.isNewLeader ? <Crown /> : <TrendingUp />}</div><strong>{change.isNewLeader ? 'NEW LEADER' : `排名上升 +${change.positionsGained}`}</strong><span>{change.isNewLeader ? '新晋第一名' : `超越 ${change.overtakenTeams.length} 支团队`}</span></motion.div>}</AnimatePresence>
}
