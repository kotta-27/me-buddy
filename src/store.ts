import type { CameraLevel } from './camera'

export type Config = {
  camera: CameraLevel // カメラで様子を見る
  interval: number  // 声をかける間隔（分）
  breakLen: number  // 休憩の長さ（分）
  eyeSize: number   // 目の幅 px
  eyeGap: number    // 目の間隔 px
  chatter: boolean  // 独り言
  wake: boolean     // Wake Lock
}

export const defaultConfig: Config = {
  interval: 50, breakLen: 5, eyeSize: 100, eyeGap: 80, chatter: true, wake: true, camera: 'off',
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
