import { makeStore } from './kv'
import { diffDays, todayStr, uid } from './util'
import { getState, setState } from './store'

export const STUDY_TYPES = ['French', 'CELPIP Listening', 'CELPIP Reading', 'CELPIP Writing', 'CELPIP Speaking'] as const
export type StudyType = (typeof STUDY_TYPES)[number]
export interface Session {
  id: string
  date: string
  type: StudyType
  min: number
  note?: string
}
export interface StudyState {
  v: 1
  goalMin: number
  frenchDate: string
  /** user-set CELPIP test date ('' until booked) */
  celpipDate: string
  sessions: Session[]
  checklist: { id: string; text: string; done: boolean }[]
}
const SEED_CHECK = [
  'Read the CELPIP General test format (4 skills)',
  'Take one free full practice test and note your weakest skill',
  'Book the CELPIP General test (aim for December 2026)',
  'Writing: practise Task 1 (email) and Task 2 (survey) with a timer',
  'Speaking: record yourself on 2 tasks and listen back',
  'Listening + Reading: do 3 timed practice sets each',
  'Check test-day ID and arrival requirements',
]
export const study = makeStore<StudyState>('healthy-study.v1', () => ({
  v: 1,
  goalMin: 30,
  frenchDate: '2027-01-31',
  celpipDate: '',
  sessions: [],
  checklist: SEED_CHECK.map((text, i) => ({ id: 'c' + i, text, done: false })),
}))

/** Sessions + any "Study" time-tracker entries that were not created by a session (so nothing is counted twice). */
export function studyMin(date: string): number {
  const st = study.get()
  const a = st.sessions.filter((x) => x.date === date).reduce((n, x) => n + x.min, 0)
  const b = getState().timeEntries.filter((e) => e.date === date && e.category === 'Study' && !e.id.startsWith('ts-')).reduce((n, e) => n + e.seconds / 60, 0)
  return Math.round(a + b)
}
export function logSession(type: StudyType, min: number, date = todayStr(), note?: string) {
  const id = uid('ss')
  study.set((s) => ({ ...s, sessions: [...s.sessions, { id, date, type, min, note }] }))
  setState((s) => ({ ...s, timeEntries: [...s.timeEntries, { id: 'ts-' + id, date, label: type, category: 'Study', seconds: Math.round(min * 60) }] }))
}
export function deleteSession(id: string) {
  study.set((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }))
  setState((s) => ({ ...s, timeEntries: s.timeEntries.filter((e) => e.id !== 'ts-' + id) }))
}
export const daysTo = (iso: string) => (iso ? diffDays(iso, todayStr()) : null)
