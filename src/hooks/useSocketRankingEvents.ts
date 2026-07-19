import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import type { RankingEntry } from '../ranking/types'

type Payload = { rankings: RankingEntry[], announcedTeamId?: number }

/** Optional adapter: no connection is made until VITE_SOCKET_URL is configured. */
export function useSocketRankingEvents(onSnapshot: (ranking: RankingEntry[]) => void, onUpdate: (ranking: RankingEntry[], announcedTeamId?: number) => void) {
  const callbacks = useRef({ onSnapshot, onUpdate })
  useEffect(() => { callbacks.current = { onSnapshot, onUpdate } }, [onSnapshot, onUpdate])
  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL as string | undefined
    if (!url) return
    const socket = io(url, { transports: ['websocket'] })
    let needsSnapshot = true
    socket.on('connect', () => { needsSnapshot = true })
    socket.on('ranking:update', (payload: Payload) => {
      if (!payload?.rankings) return
      if (needsSnapshot) { needsSnapshot = false; callbacks.current.onSnapshot(payload.rankings); return }
      callbacks.current.onUpdate(payload.rankings, payload.announcedTeamId)
    })
    return () => { socket.disconnect() }
  }, [])
}
