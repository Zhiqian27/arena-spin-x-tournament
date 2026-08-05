import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Archive, Download, ExternalLink, GripVertical, Maximize2, Minimize2, Minus, Pencil, Plus, RotateCcw, Trash2, Upload, UserPlus, X } from 'lucide-react'
import type { ScreenMode } from './types'
import { RankingBoard } from './components/RankingBoard'
import { RankChangeOverlay } from './components/RankChangeOverlay'
import { ScoreReveal } from './components/ScoreReveal'
import { useRankingAnimation } from './hooks/useRankingAnimation'
import { useSocketRankingEvents } from './hooks/useSocketRankingEvents'
import type { RankingEntry } from './ranking/types'
import { calculateStageScore, formatScore, type ScoreStage } from './scoring'

type StageKey = ScoreStage
type Scores = Record<StageKey, number[]>
type Team = { id: number, name: string, color: string, female: string, male: string, duo: string, scores: Scores, submittedAt?: number, drawOrder?: number }
type TeamForm = Omit<Team, 'id' | 'scores'>
type Announcement = { teamId: number, id: number } | null
type TournamentArchive = { version: 1, id: number, eventName: string, archivedAt: string, teams: Team[], publishedTeams: Team[] }
type ArchiveIndexItem = Pick<TournamentArchive, 'id' | 'eventName' | 'archivedAt'> & { file: string }

const STAGES: { key: StageKey, name: string, judges: number, member: keyof Pick<Team, 'name' | 'female' | 'male' | 'duo'> }[] = [
  { key: 'women', name: '女子个人舞台赛', judges: 3, member: 'female' },
  { key: 'men', name: '男子个人舞台赛', judges: 3, member: 'male' },
  { key: 'duo', name: '双人舞台赛', judges: 3, member: 'duo' },
  { key: 'team', name: '团体舞台赛', judges: 6, member: 'name' },
]
const STORE_KEY = 'spinx-team-tournament-v2'
const ARCHIVE_STORE_KEY = 'spinx-team-tournament-archives-v1'
const EVENT_NAME = '2026 Spin-X Tournament'
const scoreSet = (count: number) => Array.from({ length: count }, () => 0)
const initialColors = ['#8a68ff', '#26d9bd', '#ffbc4d', '#f264b6', '#5caaff', '#fa7c57', '#8bc34a', '#e46dc8']
const initialTeams: Team[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((letter, index) => ({ id: index + 1, drawOrder: index + 1, name: `${letter} Infinite`, color: initialColors[index], female: `女子选手 ${letter}`, male: `男子选手 ${letter}`, duo: `双人选手 ${letter}1 / ${letter}2`, scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } }))

const normalizeScore = (value: number) => Number.isFinite(value) ? value : 0
const stageTotal = (team: Team, stage: StageKey) => calculateStageScore(team.scores[stage], stage)
const totalScore = (team: Team) => STAGES.reduce((total, stage) => total + stageTotal(team, stage.key), 0)
const cloneTeams = (teams: Team[]) => teams.map(team => ({ ...team, scores: Object.fromEntries(STAGES.map(stage => [stage.key, [...team.scores[stage.key]]])) as Scores }))
const normalizeTeams = (teams: Team[]) => teams.map((team, index) => ({ ...team, drawOrder: team.drawOrder ?? index + 1, scores: Object.fromEntries(STAGES.map(stage => [stage.key, Array.from({ length: stage.judges }, (_, scoreIndex) => normalizeScore(team.scores?.[stage.key]?.[scoreIndex] ?? 0))])) as Scores }))
const isArchive = (value: Partial<TournamentArchive>): value is TournamentArchive => Array.isArray(value.teams)
const readArchives = (): TournamentArchive[] => {
  try {
    const archives = JSON.parse(localStorage.getItem(ARCHIVE_STORE_KEY) ?? '[]')
    return Array.isArray(archives) ? archives : []
  } catch { return [] }
}
const downloadArchive = (archive: TournamentArchive) => {
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${archive.eventName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'spin-x-tournament'}-${archive.archivedAt.slice(0, 10)}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function useTournament() {
  const saved = localStorage.getItem(STORE_KEY)
  const parsed = saved ? JSON.parse(saved) : null
  const [teams, setTeams] = useState<Team[]>(() => normalizeTeams(parsed?.teams ?? initialTeams))
  const [publishedTeams, setPublishedTeams] = useState<Team[]>(() => normalizeTeams(parsed?.publishedTeams ?? initialTeams))
  const [announcement, setAnnouncement] = useState<Announcement>(parsed?.announcement ?? null)
  const [eventName, setEventName] = useState<string>(() => typeof parsed?.eventName === 'string' ? parsed.eventName : EVENT_NAME)
  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify({ teams, publishedTeams, announcement, eventName })) }, [teams, publishedTeams, announcement, eventName])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORE_KEY || !event.newValue) return
      const next = JSON.parse(event.newValue)
      setTeams(normalizeTeams(next.teams)); setPublishedTeams(normalizeTeams(next.publishedTeams ?? next.teams)); setAnnouncement(next.announcement ?? null); setEventName(typeof next.eventName === 'string' ? next.eventName : EVENT_NAME)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return { teams, setTeams, publishedTeams, setPublishedTeams, announcement, setAnnouncement, eventName, setEventName }
}

function useRepositoryArchives() {
  const [archives, setArchives] = useState<TournamentArchive[]>([])
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}archives/index.json`)
        const index = await response.json() as unknown
        if (!Array.isArray(index)) return
        const items = index.filter((item): item is ArchiveIndexItem => typeof item?.file === 'string')
        const loaded: Array<TournamentArchive | null> = await Promise.all(items.map(async (item): Promise<TournamentArchive | null> => {
          const archiveResponse = await fetch(`${import.meta.env.BASE_URL}archives/${encodeURIComponent(item.file)}`)
          if (!archiveResponse.ok) return null
          const archive = await archiveResponse.json() as Partial<TournamentArchive>
          if (!isArchive(archive)) return null
          return { version: 1, id: Number(archive.id) || Date.now(), eventName: typeof archive.eventName === 'string' ? archive.eventName : EVENT_NAME, archivedAt: typeof archive.archivedAt === 'string' ? archive.archivedAt : new Date().toISOString(), teams: normalizeTeams(archive.teams), publishedTeams: normalizeTeams(archive.publishedTeams ?? archive.teams) }
        }))
        if (active) setArchives(loaded.filter((archive): archive is TournamentArchive => archive !== null))
      } catch { if (active) setArchives([]) }
    }
    void load()
    return () => { active = false }
  }, [])
  return archives
}

function App() {
  const mode: ScreenMode = new URLSearchParams(window.location.search).get('view') === 'display' ? 'display' : 'control'
  const tournament = useTournament()
  const publishedRanked = useMemo(() => [...tournament.publishedTeams].sort((a, b) => totalScore(b) - totalScore(a)), [tournament.publishedTeams])
  const publish = () => {
    const changed = tournament.teams.filter(team => JSON.stringify(team.scores) !== JSON.stringify(tournament.publishedTeams.find(item => item.id === team.id)?.scores))
    const announced = [...changed].sort((left, right) => (right.submittedAt ?? 0) - (left.submittedAt ?? 0))[0]
    tournament.setPublishedTeams(cloneTeams(tournament.teams))
    if (announced) tournament.setAnnouncement({ teamId: announced.id, id: Date.now() })
  }
  return mode === 'display' ? <Display eventName={tournament.eventName} teams={publishedRanked} announcement={tournament.announcement} /> : <Control eventName={tournament.eventName} setEventName={tournament.setEventName} teams={tournament.teams} setTeams={tournament.setTeams} publishedTeams={tournament.publishedTeams} setPublishedTeams={tournament.setPublishedTeams} clearAnnouncement={() => tournament.setAnnouncement(null)} publish={publish} />
}

function Display({ eventName, teams, announcement }: { eventName: string, teams: Team[], announcement: Announcement }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const entries = useMemo<RankingEntry[]>(() => teams.map(team => ({ teamId: team.id, teamName: team.name, score: totalScore(team), submittedAt: team.submittedAt ?? team.drawOrder ?? team.id, color: team.color, stageScores: STAGES.map(stage => stageTotal(team, stage.key)) })), [teams])
  const { ranking, phase, change, announcedTeam, highlightedTeamId, applyUpdate, replaceRanking } = useRankingAnimation(entries)
  const entrySignature = JSON.stringify(entries)
  const latestEntries = useRef(entries)
  const handledAnnouncementId = useRef(announcement?.id ?? 0)
  latestEntries.current = entries
  useEffect(() => {
    if (announcement && announcement.id !== handledAnnouncementId.current) { handledAnnouncementId.current = announcement.id; void applyUpdate(latestEntries.current, announcement.teamId); return }
    replaceRanking(latestEntries.current)
  }, [entrySignature, announcement?.id])
  useSocketRankingEvents(replaceRanking, applyUpdate)
  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(document.fullscreenElement === document.documentElement)
    document.addEventListener('fullscreenchange', updateFullscreenState)
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState)
  }, [])
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }
  return <main className="display-screen team-display">
    <div className="display-grid" />
    <button className="fullscreen-button" type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? '退出全屏' : '全屏显示'} title={isFullscreen ? '退出全屏' : '全屏显示'}>{isFullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button>
    <RankingBoard eventName={eventName} ranking={ranking} phase={phase} change={change} highlightedTeamId={highlightedTeamId} />
    {phase === 'revealingScore' && announcedTeam && <ScoreReveal team={announcedTeam} />}
    <RankChangeOverlay phase={phase} change={change} />
  </main>
}

function Control({ eventName, setEventName, teams, setTeams, publishedTeams, setPublishedTeams, clearAnnouncement, publish }: { eventName: string, setEventName: Dispatch<SetStateAction<string>>, teams: Team[], setTeams: Dispatch<SetStateAction<Team[]>>, publishedTeams: Team[], setPublishedTeams: Dispatch<SetStateAction<Team[]>>, clearAnnouncement: () => void, publish: () => void }) {
  const [stageKey, setStageKey] = useState<StageKey>('women')
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [adding, setAdding] = useState(false)
  const [draggedTeamId, setDraggedTeamId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ teamId: number, position: 'before' | 'after' } | null>(null)
  const [archives, setArchives] = useState<TournamentArchive[]>(readArchives)
  const repositoryArchives = useRepositoryArchives()
  const importInputRef = useRef<HTMLInputElement>(null)
  const stage = STAGES.find(item => item.key === stageKey)!
  useEffect(() => { localStorage.setItem(ARCHIVE_STORE_KEY, JSON.stringify(archives)) }, [archives])
  const updateScore = (teamId: number, judgeIndex: number, next: number) => setTeams(current => current.map(team => team.id === teamId ? { ...team, submittedAt: Date.now(), scores: { ...team.scores, [stageKey]: team.scores[stageKey].map((score, index) => index === judgeIndex ? normalizeScore(next) : score) } } : team))
  const saveTeam = (form: TeamForm) => { setTeams(current => editingTeam ? current.map(team => team.id === editingTeam.id ? { ...team, ...form } : team) : [...current, { ...form, id: Date.now(), drawOrder: current.length + 1, scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } }]); setEditingTeam(null); setAdding(false) }
  const removeTeam = (team: Team) => { if (window.confirm(`确定删除“${team.name}”吗？`)) setTeams(current => current.filter(item => item.id !== team.id)) }
  const resetScores = () => {
    if (!window.confirm('确定重置所有团队、所有项目的评分吗？此操作会清空当前未发布的分数。')) return
    setTeams(current => current.map(team => ({ ...team, submittedAt: undefined, scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } })))
  }
  const startNewTournament = () => {
    const nextName = window.prompt('请输入下一届赛事名称', EVENT_NAME)
    if (nextName === null) return
    if (!window.confirm('确定开启下一届赛事吗？当前队伍资料与成绩都会重置为 8 个基础团队，请先保存本届成绩。')) return
    setEventName(nextName.trim() || EVENT_NAME)
    setTeams(cloneTeams(initialTeams))
    setPublishedTeams(cloneTeams(initialTeams))
    clearAnnouncement()
  }
  const archiveTournament = () => {
    const archiveName = window.prompt('请输入本届赛事名称', eventName)
    if (archiveName === null) return
    const archive: TournamentArchive = { version: 1, id: Date.now(), eventName: archiveName.trim() || EVENT_NAME, archivedAt: new Date().toISOString(), teams: cloneTeams(teams), publishedTeams: cloneTeams(publishedTeams) }
    setArchives(current => [archive, ...current])
    downloadArchive(archive)
  }
  const restoreArchive = (archive: TournamentArchive) => {
    if (!window.confirm(`恢复“${archive.eventName}”的成绩吗？当前未归档的分数会被覆盖。`)) return
    setTeams(normalizeTeams(archive.teams))
    setPublishedTeams(normalizeTeams(archive.publishedTeams))
    clearAnnouncement()
  }
  const removeArchive = (archive: TournamentArchive) => {
    if (!window.confirm(`确定删除本机中的“${archive.eventName}”归档吗？已下载的 JSON 文件不会受影响。`)) return
    setArchives(current => current.filter(item => item.id !== archive.id))
  }
  const importArchive = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const archive = JSON.parse(await file.text()) as Partial<TournamentArchive>
      if (!isArchive(archive)) throw new Error('invalid archive')
      const imported: TournamentArchive = { version: 1, id: Number(archive.id) || Date.now(), eventName: typeof archive.eventName === 'string' ? archive.eventName : EVENT_NAME, archivedAt: typeof archive.archivedAt === 'string' ? archive.archivedAt : new Date().toISOString(), teams: normalizeTeams(archive.teams), publishedTeams: normalizeTeams(Array.isArray(archive.publishedTeams) ? archive.publishedTeams : archive.teams) }
      if (!window.confirm(`导入“${imported.eventName}”的成绩吗？当前未归档的分数会被覆盖。`)) return
      setTeams(imported.teams)
      setPublishedTeams(imported.publishedTeams)
      setEventName(imported.eventName)
      clearAnnouncement()
      setArchives(current => current.some(item => item.id === imported.id) ? current : [imported, ...current])
    } catch { window.alert('无法读取该档案。请选择由本系统导出的 JSON 赛事档案。') }
  }
  const moveTeam = (teamId: number, targetTeamId: number, position: 'before' | 'after') => setTeams(current => {
    const from = current.findIndex(team => team.id === teamId)
    const to = current.findIndex(team => team.id === targetTeamId)
    if (from < 0 || to < 0 || from === to) return current
    const next = [...current]
    const [team] = next.splice(from, 1)
    let insertAt = to + (position === 'after' ? 1 : 0)
    if (from < insertAt) insertAt -= 1
    next.splice(insertAt, 0, team)
    return next.map((team, index) => ({ ...team, drawOrder: index + 1 }))
  })
  const repositoryArchiveIds = useMemo(() => new Set(repositoryArchives.map(archive => archive.id)), [repositoryArchives])
  const visibleArchives = useMemo(() => [...repositoryArchives, ...archives.filter(archive => !repositoryArchiveIds.has(archive.id))].sort((left, right) => right.archivedAt.localeCompare(left.archivedAt)), [archives, repositoryArchives, repositoryArchiveIds])
  return <main className="control-page"><section className="control-content team-control">
    <header className="control-header"><div><p>赛事控制台 · 团队总积分赛</p><label className="event-name-field"><span>赛事名称</span><input value={eventName} onChange={event => setEventName(event.target.value)} placeholder="输入赛事名称" /></label></div><button className="display-button" onClick={() => window.open(`${window.location.pathname}?view=display`, '_blank', 'noopener,noreferrer')}><ExternalLink size={18} />打开观赛大屏</button></header>
    <div className="format-note"><b>赛制说明</b><span>个人赛直接累计；双人赛总分 × 1.25；团体赛总分 ÷ 2 × 1.5，四个项目加总为团队总分。</span></div>
    <div className="stage-tabs" role="tablist">{STAGES.map(item => <button className={item.key === stageKey ? 'active' : ''} onClick={() => setStageKey(item.key)} key={item.key}><span>{item.name}</span><small>{item.judges} 位评审 · 自由输入分数</small></button>)}</div>
    <section className="panel info-panel publish-panel"><span className="eyebrow">当前录入 · {stage.name}</span><strong>草稿不会自动显示</strong><p>完成任一项目评分后，点击发布，观赛大屏会按四个项目的累计总分重新排名。</p><button className="publish-button" onClick={publish}>更新总积分至观赛大屏</button><button className="reset-button" onClick={resetScores}>重置所有分数</button></section>
    <section className="panel archive-panel"><div><span className="eyebrow">赛事归档</span><strong>保留完整成绩，供未来恢复或备份</strong><p>保存时会下载 JSON 备份；已推送到 GitHub 的档案会显示在下方。</p></div><div className="archive-actions"><button className="archive-button" onClick={archiveTournament}><Archive size={16} />保存本届成绩</button><button className="archive-button secondary" onClick={startNewTournament}><RotateCcw size={16} />开启下一届</button><button className="archive-button secondary" onClick={() => importInputRef.current?.click()}><Upload size={16} />导入成绩档案</button><input ref={importInputRef} className="archive-file-input" type="file" accept="application/json,.json" onChange={event => void importArchive(event)} /></div>{visibleArchives.length > 0 && <div className="archive-list">{visibleArchives.slice(0, 12).map(archive => { const isRepositoryArchive = repositoryArchiveIds.has(archive.id); return <div className="archive-item" key={archive.id}><div><strong>{archive.eventName}</strong><small>{new Date(archive.archivedAt).toLocaleString('zh-CN')} · {archive.publishedTeams.length} 支队伍 · {isRepositoryArchive ? 'GitHub 档案' : '本机档案'}</small></div><span><button onClick={() => restoreArchive(archive)} title="恢复此档案"><RotateCcw size={15} />恢复</button><button onClick={() => downloadArchive(archive)} title="下载 JSON 备份"><Download size={15} />下载</button>{!isRepositoryArchive && <button className="archive-delete" onClick={() => removeArchive(archive)} title="删除本机档案"><Trash2 size={15} />删除</button>}</span></div> })}</div>}</section>
    <section className="panel scoring-panel"><div className="panel-heading"><span>{stage.name} · 评分录入</span><div className="score-actions"><small>拖动团队左侧把手调整顺序；{stage.judges} 位评审，按该项目规则计算小计</small><button className="add-player" onClick={() => setAdding(true)}><UserPlus size={15} />添加团队</button></div></div><div className="stage-table"><div className="stage-head"><span>团队</span><span>{stageKey === 'team' ? '参赛团队' : '本项目参赛者'}</span><span>评审打分</span><span>本项目总分</span></div>{teams.map(team => <div className={`stage-row ${draggedTeamId === team.id ? 'dragging' : ''} ${dropTarget?.teamId === team.id ? `drop-${dropTarget.position}` : ''}`} key={team.id} draggable onDragStart={() => setDraggedTeamId(team.id)} onDragEnd={() => { setDraggedTeamId(null); setDropTarget(null) }} onDragOver={event => { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); setDropTarget({ teamId: team.id, position: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after' }) }} onDrop={() => { if (draggedTeamId && dropTarget) moveTeam(draggedTeamId, team.id, dropTarget.position); setDraggedTeamId(null); setDropTarget(null) }}><div className="team-mini"><span className="drag-handle" title="拖动调整团队顺序"><GripVertical size={17} /></span><i style={{ background: team.color }} /><strong>{team.name}</strong></div><div className="member-name">{team[stage.member]}</div><div className="judge-inputs">{team.scores[stageKey].map((score, index) => <div className="score-control" key={index}><button onClick={() => updateScore(team.id, index, score - 1)}><Minus size={13} /></button><ScoreInput score={score} label={`${team.name} 第 ${index + 1} 位评审`} onChange={value => updateScore(team.id, index, value)} /><button onClick={() => updateScore(team.id, index, score + 1)}><Plus size={13} /></button></div>)}</div><strong className="control-total">{formatScore(stageTotal(team, stageKey))}</strong><div className="team-row-actions"><button onClick={() => setEditingTeam(team)} aria-label="编辑团队"><Pencil size={14} /></button><button onClick={() => removeTeam(team)} aria-label="删除团队"><Trash2 size={14} /></button></div></div>)}</div></section>
  </section>{(adding || editingTeam) && <TeamModal team={editingTeam} onClose={() => { setAdding(false); setEditingTeam(null) }} onSave={saveTeam} />}</main>
}

function ScoreInput({ score, label, onChange }: { score: number, label: string, onChange: (value: number) => void }) {
  const [value, setValue] = useState(String(score))
  useEffect(() => setValue(String(score)), [score])
  const commit = (raw: string) => { const normalized = raw === '' ? 0 : normalizeScore(Number(raw)); setValue(String(normalized)); onChange(normalized) }
  return <input aria-label={label} type="number" step="any" value={value} onChange={event => { const next = event.target.value; setValue(next); if (next !== '' && Number.isFinite(Number(next))) onChange(normalizeScore(Number(next))) }} onBlur={event => commit(event.target.value)} />
}

function TeamModal({ team, onClose, onSave }: { team: Team | null, onClose: () => void, onSave: (form: TeamForm) => void }) {
  const [form, setForm] = useState<TeamForm>({ name: team?.name ?? '', color: team?.color ?? '#7250e8', female: team?.female ?? '', male: team?.male ?? '', duo: team?.duo ?? '' })
  const update = (key: keyof TeamForm, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = (event: FormEvent) => { event.preventDefault(); if (form.name.trim() && form.female.trim() && form.male.trim() && form.duo.trim()) onSave({ ...form, name: form.name.trim(), female: form.female.trim(), male: form.male.trim(), duo: form.duo.trim() }) }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="player-modal team-modal" onSubmit={submit} onMouseDown={event => event.stopPropagation()}><div className="modal-header"><div><p>{team ? '编辑团队' : '新增团队'}</p><h2>4 人参赛资料</h2></div><button type="button" onClick={onClose}><X size={19} /></button></div><label>团队名称<input autoFocus value={form.name} onChange={event => update('name', event.target.value)} required /></label><div className="member-form"><label>女子个人选手<input value={form.female} onChange={event => update('female', event.target.value)} required /></label><label>男子个人选手<input value={form.male} onChange={event => update('male', event.target.value)} required /></label></div><label>双人舞台组合<input value={form.duo} onChange={event => update('duo', event.target.value)} placeholder="例如：双人选手 A1 / A2" required /></label><label>团队标识色<input className="color-wheel" type="color" value={form.color} onChange={event => update('color', event.target.value)} /></label><div className="modal-footer"><button type="button" className="cancel-button" onClick={onClose}>取消</button><button className="save-button">{team ? '保存修改' : '添加团队'}</button></div></form></div>
}

export default App
