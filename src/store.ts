export type Config = {
  interval: number  // 休憩を誘う間隔（分）
  pace: 1 | 2 | 3   // しぐさの多さ 1 少なめ / 2 ふつう / 3 多め
  breakLen: number  // 休憩の長さ（分）
  eyeSize: number   // 目の幅 px
  eyeGap: number    // 目の間隔 px
  chatter: boolean  // 独り言
  wake: boolean     // Wake Lock
  sound: boolean    // 声かけ時に音
  vibrate: boolean  // 声かけ時にバイブ
  brightness: number // 目の明るさ % (40〜100)
}

export const defaultConfig: Config = {
  interval: 50, breakLen: 5, eyeSize: 100, eyeGap: 80, chatter: true, wake: true, sound: false, vibrate: true, brightness: 100, pace: 3,
}

export type Total = { day: string; sec: number }

const get = <T,>(k: string, d: T): T => {
  try { const v = localStorage.getItem(k); return v == null ? d : { ...d, ...JSON.parse(v) } } catch { return d }
}
const set = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

export const today = () => new Date().toISOString().slice(0, 10)

export const loadConfig = (): Config => get('cfg', defaultConfig)
export const saveConfig = (c: Config) => set('cfg', c)

export const loadTotal = (): Total => {
  const t = get<Total>('total', { day: today(), sec: 0 })
  return t.day === today() ? t : { day: today(), sec: 0 }
}
export const saveTotal = (t: Total) => set('total', t)

/** 途中で閉じた時のため、集中中の開始時刻と最後の生存時刻を残す */
export type Session = { startAt: number; lastTick: number }
export const loadSession = (): Session | null => { try { const v = localStorage.getItem('session'); return v ? JSON.parse(v) : null } catch { return null } }
export const saveSession = (s: Session | null) => { try { s ? localStorage.setItem('session', JSON.stringify(s)) : localStorage.removeItem('session') } catch { /* ignore */ } }
