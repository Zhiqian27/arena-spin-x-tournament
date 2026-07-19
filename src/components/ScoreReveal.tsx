import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import type { RankingEntry } from '../ranking/types'

export function ScoreReveal({ team }: { team: RankingEntry }) {
  const score = useMotionValue(0)
  const shown = useTransform(score, value => Math.round(value))
  useEffect(() => { const controls = animate(score, team.score, { duration: 1.5, ease: 'easeOut' }); return () => controls.stop() }, [score, team.score])
  return <motion.div className="score-reveal"><span>最终成绩公布</span><strong>{team.teamName}</strong><motion.b>{shown}</motion.b></motion.div>
}
