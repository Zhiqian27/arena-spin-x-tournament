import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { ExternalLink, GripVertical, Minus, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
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

const STAGES: { key: StageKey, name: string, judges: number, member: keyof Pick<Team, 'name' | 'female' | 'male' | 'duo'> }[] = [
  { key: 'women', name: '女子个人舞台赛', judges: 3, member: 'female' },
  { key: 'men', name: '男子个人舞台赛', judges: 3, member: 'male' },
  { key: 'duo', name: '双人舞台赛', judges: 3, member: 'duo' },
  { key: 'team', name: '团体舞台赛', judges: 6, member: 'name' },
]
const STORE_KEY = 'spinx-team-tournament-v2'
const scoreSet = (count: number) => Array.from({ length: count }, () => 0)
const initialTeams: Team[] = [
  { id: 1, drawOrder: 1, name: '格蕾西亚', color: '#8a68ff', female: '杨靖熙', male: '闵维钲', duo: '许凯泽 / 曾科杰', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 2, drawOrder: 2, name: '循人中学B队', color: '#26d9bd', female: '邝芊心', male: '彭浩境', duo: '黄健盛 / 周骏彬', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 3, drawOrder: 3, name: '梳邦校友队', color: '#ffbc4d', female: '曾依玲', male: '吴子轩', duo: '游凯竣 / 林汇勇', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 4, drawOrder: 4, name: 'King Minions', color: '#f264b6', female: '张乐儿', male: '李治颖', duo: '梁乐瑶 / 张艾嘉', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 5, drawOrder: 5, name: '可不可以', color: '#5caaff', female: '蔡宝琪', male: '陈展晖', duo: '吴芷芊 / 蔡惠亦', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 6, drawOrder: 6, name: '乐圣华小', color: '#fa7c57', female: '林妍霓', male: '黃俊翔', duo: '林宸名 / 陈志堂', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 7, drawOrder: 7, name: '循人中学A队', color: '#8bc34a', female: '钟伟乔', male: '王浩熙', duo: '叶倬宇 / 刘铠滕', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 8, drawOrder: 8, name: 'Team Up Diabolo', color: '#e46dc8', female: '林侣廷', male: '陈祉邑', duo: '陈祉佑 / 温俊腾', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 9, drawOrder: 9, name: '锡米山校友队', color: '#6fd6ff', female: '官妤玹', male: '余星俊', duo: '曾宇森 / 彭政晖', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
  { id: 10, drawOrder: 10, name: 'Fanta Stick 4', color: '#d6a1ff', female: '刘洆沁', male: '林苡庸', duo: '戴宗礼 / 孙子惞', scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } },
]

const oldExampleNames = ['A Infinite', 'B Infinite', 'C Infinite', 'D Infinite', 'E Infinite', 'F Infinite', 'G Infinite', 'H Infinite']
const isOldExampleRoster = (teams?: Team[]) => teams?.length === oldExampleNames.length && teams.every((team, index) => team.name === oldExampleNames[index])

const normalizeScore = (value: number) => Number.isFinite(value) ? value : 0
const stageTotal = (team: Team, stage: StageKey) => calculateStageScore(team.scores[stage], stage)
const totalScore = (team: Team) => STAGES.reduce((total, stage) => total + stageTotal(team, stage.key), 0)
const cloneTeams = (teams: Team[]) => teams.map(team => ({ ...team, scores: Object.fromEntries(STAGES.map(stage => [stage.key, [...team.scores[stage.key]]])) as Scores }))
const normalizeTeams = (teams: Team[]) => teams.map((team, index) => ({ ...team, drawOrder: team.drawOrder ?? index + 1, scores: Object.fromEntries(STAGES.map(stage => [stage.key, Array.from({ length: stage.judges }, (_, scoreIndex) => normalizeScore(team.scores?.[stage.key]?.[scoreIndex] ?? 0))])) as Scores }))

function useTournament() {
  const saved = localStorage.getItem(STORE_KEY)
  const parsed = saved ? JSON.parse(saved) : null
  const [teams, setTeams] = useState<Team[]>(() => normalizeTeams(isOldExampleRoster(parsed?.teams) ? initialTeams : parsed?.teams ?? initialTeams))
  const [publishedTeams, setPublishedTeams] = useState<Team[]>(() => normalizeTeams(isOldExampleRoster(parsed?.publishedTeams) ? initialTeams : parsed?.publishedTeams ?? initialTeams))
  const [announcement, setAnnouncement] = useState<Announcement>(parsed?.announcement ?? null)
  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify({ teams, publishedTeams, announcement })) }, [teams, publishedTeams, announcement])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORE_KEY || !event.newValue) return
      const next = JSON.parse(event.newValue)
      setTeams(normalizeTeams(next.teams)); setPublishedTeams(normalizeTeams(next.publishedTeams ?? next.teams)); setAnnouncement(next.announcement ?? null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return { teams, setTeams, publishedTeams, setPublishedTeams, announcement, setAnnouncement }
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
  return mode === 'display' ? <Display teams={publishedRanked} announcement={tournament.announcement} /> : <Control teams={tournament.teams} setTeams={tournament.setTeams} publish={publish} />
}

function Display({ teams, announcement }: { teams: Team[], announcement: Announcement }) {
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
  return <main className="display-screen team-display">
    <div className="display-grid" />
    <RankingBoard ranking={ranking} phase={phase} change={change} highlightedTeamId={highlightedTeamId} />
    {phase === 'revealingScore' && announcedTeam && <ScoreReveal team={announcedTeam} />}
    <RankChangeOverlay phase={phase} change={change} />
  </main>
}

function Control({ teams, setTeams, publish }: { teams: Team[], setTeams: Dispatch<SetStateAction<Team[]>>, publish: () => void }) {
  const [stageKey, setStageKey] = useState<StageKey>('women')
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [adding, setAdding] = useState(false)
  const [draggedTeamId, setDraggedTeamId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ teamId: number, position: 'before' | 'after' } | null>(null)
  const stage = STAGES.find(item => item.key === stageKey)!
  const updateScore = (teamId: number, judgeIndex: number, next: number) => setTeams(current => current.map(team => team.id === teamId ? { ...team, submittedAt: Date.now(), scores: { ...team.scores, [stageKey]: team.scores[stageKey].map((score, index) => index === judgeIndex ? normalizeScore(next) : score) } } : team))
  const saveTeam = (form: TeamForm) => { setTeams(current => editingTeam ? current.map(team => team.id === editingTeam.id ? { ...team, ...form } : team) : [...current, { ...form, id: Date.now(), drawOrder: current.length + 1, scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } }]); setEditingTeam(null); setAdding(false) }
  const removeTeam = (team: Team) => { if (window.confirm(`确定删除“${team.name}”吗？`)) setTeams(current => current.filter(item => item.id !== team.id)) }
  const resetScores = () => {
    if (!window.confirm('确定重置所有团队、所有项目的评分吗？此操作会清空当前未发布的分数。')) return
    setTeams(current => current.map(team => ({ ...team, submittedAt: undefined, scores: { women: scoreSet(3), men: scoreSet(3), duo: scoreSet(3), team: scoreSet(6) } })))
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
  return <main className="control-page"><section className="control-content team-control">
    <header className="control-header"><div><p>赛事控制台 · 团队总积分赛</p><h1>2026 Spin-X Tournament</h1></div><button className="display-button" onClick={() => window.open(`${window.location.pathname}?view=display`, '_blank', 'noopener,noreferrer')}><ExternalLink size={18} />打开观赛大屏</button></header>
    <div className="format-note"><b>赛制说明</b><span>个人赛直接累计；双人赛总分 × 1.25；团体赛总分 ÷ 2 × 1.5，四个项目加总为团队总分。</span></div>
    <div className="stage-tabs" role="tablist">{STAGES.map(item => <button className={item.key === stageKey ? 'active' : ''} onClick={() => setStageKey(item.key)} key={item.key}><span>{item.name}</span><small>{item.judges} 位评审 · 自由输入分数</small></button>)}</div>
    <section className="panel info-panel publish-panel"><span className="eyebrow">当前录入 · {stage.name}</span><strong>草稿不会自动显示</strong><p>完成任一项目评分后，点击发布，观赛大屏会按四个项目的累计总分重新排名。</p><button className="publish-button" onClick={publish}>更新总积分至观赛大屏</button><button className="reset-button" onClick={resetScores}>重置所有分数</button></section>
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
