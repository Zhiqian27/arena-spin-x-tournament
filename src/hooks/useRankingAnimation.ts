import { useCallback, useRef, useState } from 'react'
import { compareRankings, sortRankings } from '../ranking/compareRankings'
import type { AnimationPhase, RankChange, RankingEntry } from '../ranking/types'

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds))
// Integration point only: an admin-controlled audio layer may listen after a user gesture.
const requestSound = (name: 'scoreReveal' | 'rankUp' | 'newLeader') => window.dispatchEvent(new CustomEvent('ranking:sound', { detail: name }))

export function useRankingAnimation(initialRanking: RankingEntry[]) {
  const [ranking, setRanking] = useState(() => sortRankings(initialRanking))
  const [phase, setPhase] = useState<AnimationPhase>('idle')
  const [change, setChange] = useState<RankChange | null>(null)
  const [announcedTeam, setAnnouncedTeam] = useState<RankingEntry | null>(null)
  const [highlightedTeamId, setHighlightedTeamId] = useState<number | null>(null)
  const running = useRef(false)
  const queued = useRef<{ next: RankingEntry[], teamId?: number } | null>(null)
  const initialized = useRef(true)

  const applyUpdate = useCallback(async (next: RankingEntry[], announcedTeamId?: number) => {
    if (!initialized.current) { initialized.current = true; setRanking(sortRankings(next)); return }
    if (running.current) { queued.current = { next, teamId: announcedTeamId }; return }
    const previous = ranking
    const nextRanked = sortRankings(next)
    const subject = announcedTeamId ? nextRanked.find(item => item.teamId === announcedTeamId) : undefined
    const rankChange = subject ? compareRankings(previous, nextRanked, subject.teamId) : null
    if (!subject || !rankChange || rankChange.positionsGained === 0) { setRanking(nextRanked); return }
    running.current = true; setAnnouncedTeam(subject); setChange(rankChange); setHighlightedTeamId(subject.teamId)
    setPhase('revealingScore'); requestSound('scoreReveal'); await wait(1500)
    setPhase('showingRankChange'); requestSound(rankChange.isNewLeader ? 'newLeader' : 'rankUp'); await wait(1000)
    setPhase('movingRanking'); setRanking(nextRanked); await wait(1200)
    setPhase('highlightingResult'); await wait(1500)
    setPhase('completed'); await wait(250)
    setPhase('idle'); setHighlightedTeamId(null); setAnnouncedTeam(null); setChange(null); running.current = false
    const pending = queued.current; queued.current = null
    if (pending) void applyUpdate(pending.next, pending.teamId)
  }, [ranking])

  const replaceRanking = useCallback((next: RankingEntry[]) => { queued.current = null; setRanking(sortRankings(next)); setPhase('idle'); setHighlightedTeamId(null); setChange(null); setAnnouncedTeam(null) }, [])
  return { ranking, phase, change, announcedTeam, highlightedTeamId, applyUpdate, replaceRanking, isAnimating: phase !== 'idle' }
}
