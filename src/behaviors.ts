/**
 * 目の演技。ポーズ（CSS変数）を時間順に並べた「演目」を再生する。
 *
 * ポーズの軸
 *  lid / lidL / lidR  上まぶた 0(開)〜1(閉)
 *  lidb               下まぶた 0〜1（じとっ）
 *  px / py            瞳の位置 -1〜1
 *  ps                 瞳の大きさ倍率
 *  sx / sy            目全体の伸縮
 *  shape              'idle' | 'happy' | 'sad'
 *  text               目の上に小さく出す独り言
 *  bubble             雲の吹き出しの中身（考え中・寝息）。null で消す
 *  t                  このポーズへ移る時間 ms
 *  hold               このポーズで待つ時間 ms
 */
export type Pose = {
  lid?: number; lidL?: number; lidR?: number; lidb?: number
  px?: number; py?: number; ps?: number
  sx?: number; sy?: number
  shape?: 'idle' | 'happy' | 'sad'
  text?: string | null
  bubble?: string | null
  t?: number
  hold: number
}
export type Performance = Pose[]
export type Base = { lid: number; shape: 'idle' | 'happy' }
/** 「閉じた目」。完全に隠さず、下にひと筋残す */
export const CLOSED = 0.93

const R = { lid: 0, lidb: 0, px: 0, py: 0, ps: 1, sx: 1, sy: 1, shape: 'idle', text: null, bubble: null } as const
const reset = (t = 400, hold = 300): Pose => ({ ...R, t, hold })
const jitter = (n: number, amp: number, key: 'px' | 'sx' | 'sy', t = 70): Performance =>
  Array.from({ length: n }, (_, i) => ({ [key]: (i % 2 ? 1 : -1) * amp + (key === 'px' ? 0 : 1), t, hold: t }))

// ---- 1〜9: ひとりで勝手にやる ----
export const think: Performance = [
  { px: .6, py: -.7, t: 500, hold: 600 },
  { px: .6, py: -.7, bubble: '・', t: 0, hold: 600 },
  { px: .6, py: -.7, bubble: '・・', t: 0, hold: 600 },
  { px: .6, py: -.7, bubble: '・・・', t: 0, hold: 700 },
  ...jitter(4, .12, 'px').map((p) => ({ ...p, px: .6 + (p.px ?? 0), py: -.7, bubble: '・・・' })),
  { px: .6, py: -.7, bubble: '？', t: 200, hold: 1400 },
  reset(),
]
export const doze: Performance = [
  { lid: .3, t: 1500, hold: 1200 },
  { lid: .15, t: 300, hold: 800 },            // 持ち直す
  { lid: .55, t: 2000, hold: 1500 },
  { lid: .8, py: .3, t: 1500, hold: 700 },
  { lid: 0, py: 0, sx: 1.08, sy: 1.12, t: 80, hold: 2000 },  // ハッ
  reset(300),
]
export const lookAround: Performance = [
  { px: -.9, t: 150, hold: 400 },
  { px: .9, t: 150, hold: 400 },
  { px: -.9, t: 150, hold: 400 },
  { px: 0, py: 0, t: 250, hold: 1000 },
  reset(),
]
export const doubleTake: Performance = [
  { px: .7, t: 200, hold: 300 },
  { px: 0, t: 200, hold: 300 },
  { px: 1, sx: 1.05, sy: 1.08, bubble: '！', t: 100, hold: 900 },
  reset(),
]
export const spaceOut: Performance = [
  { ps: 1.15, px: .3, py: .2, t: 2500, hold: 2500 },
  { ps: 1.15, px: -.2, py: .3, bubble: '…', t: 3000, hold: 3000 },
  reset(1000),
]
export const rubEyes: Performance = [
  { lid: CLOSED, sy: .92, t: 150, hold: 100 },
  ...jitter(6, .05, 'sx', 60).map((p) => ({ ...p, lid: CLOSED, sy: .92 })),
  { lid: 0, sy: 1, sx: 1, t: 250, hold: 600 },
  reset(),
]
export const sigh: Performance = [
  { shape: 'sad', t: 200, hold: 1100 },
  reset(300),
]
export const stretch: Performance = [
  { sy: 1.25, t: 500, hold: 400 },
  ...jitter(5, .03, 'sx', 50).map((p) => ({ ...p, sy: 1.25 })),
  reset(300),
]
// 9 呼吸は Eyes.tsx のゆらぎ側（振幅＋微小な縦伸縮）

// ---- 10〜14: ユーザーの行動に反応 ----
export const welcome: Performance = [
  { lid: CLOSED, t: 0, hold: 60 },
  { lid: 0, shape: 'happy', t: 120, hold: 1500 },
  reset(300),
]
// じとっ：目ごと縦に潰して細める（楕円のまま）
export const ticklish: Performance = [
  { sy: .42, px: 0, py: 0, t: 200, hold: 500 },
  { sy: .42, px: 0, py: 0, text: 'くすぐったい', t: 0, hold: 1300 },
  reset(300),
]
export const drowsyHold: Performance = [
  { lid: .4, ps: 1.1, t: 600, hold: 60_000 },  // 離すまで
]
export const drowsyRelease: Performance = [
  { lid: 0, ps: 1, px: .5, py: -.5, text: '？', t: 150, hold: 1200 },
  reset(),
]
export const dizzy: Performance = [
  ...Array.from({ length: 10 }, (_, i) => {
    const a = (i / 5) * Math.PI
    return { px: Math.cos(a) * .9, py: Math.sin(a) * .8, t: 70, hold: 70 }
  }),
  { px: 0, py: 0, sx: 1.05, sy: 1.05, t: 200, hold: 600 },
  reset(),
]
export const petted: Performance = [
  { shape: 'happy', t: 200, hold: 1600 },
  reset(300),
]

// ---- 15〜19: 時間帯・状態 ----
export const yawn: Performance = [
  { lid: .6, t: 400, hold: 500 },
  { lid: 0, sy: 1.15, bubble: 'ふぁ', t: 300, hold: 900 },
  reset(300),
]
/** 通知が来た？：上を見上げて少し首をかしげる */
export const glanceUp: Performance = [
  { px: 0, py: -1, sy: 1.04, t: 250, hold: 900 },
  { px: .35, py: -1, t: 200, hold: 700 },
  { px: 0, py: 0, t: 400, hold: 1500 },
  reset(),
]
/** 離席中：キョロキョロしてから「…？」 */
export const awayWait: Performance = [
  ...lookAround.slice(0, 3),
  { px: 0, py: -.3, bubble: '…？', t: 300, hold: 3000 },
  reset(),
]
export const nod: Performance = [
  { py: .6, sy: .9, t: 200, hold: 250 },
  reset(250, 0),
]
export const sleepTalk: Performance = [
  { lid: CLOSED, bubble: 'z', t: 0, hold: 900 },
  { lid: CLOSED, bubble: 'z z', t: 0, hold: 900 },
  { lid: CLOSED, bubble: 'z z z', t: 0, hold: 1400 },
  { lid: CLOSED, bubble: null, text: '…ん', t: 0, hold: 1200 },
  { lid: CLOSED, text: null, t: 0, hold: 0 },
]
export const wakeOneEye: Performance = [
  { lid: CLOSED, t: 0, hold: 100 },
  { lidL: CLOSED, lidR: 0, t: 200, hold: 450 },
  { lidL: 0, lidR: 0, t: 200, hold: 300 },
]
export const sleepyBlink: Performance = [
  { lid: CLOSED, t: 260, hold: 180 },
  { lid: 0, t: 320, hold: 0 },
]

export const idleSet = { think, doze, lookAround, doubleTake, spaceOut, rubEyes, sigh, stretch }
export type IdleName = keyof typeof idleSet

/** 待機演目を重み付きで選ぶ。直前と同じものは避ける。 */
export function pickIdle(opts: { sleepy: boolean; night: boolean; last: IdleName | null }): IdleName {
  const w: Record<IdleName, number> = {
    think: 3, lookAround: 3, doubleTake: 2, spaceOut: 2, sigh: 2,
    doze: opts.night ? 6 : opts.sleepy ? 4 : 2,
    rubEyes: opts.sleepy || opts.night ? 3 : 1,
    stretch: opts.sleepy ? 3 : 0,
  }
  if (opts.last) w[opts.last] = 0
  const total = Object.values(w).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (const k of Object.keys(w) as IdleName[]) { r -= w[k]; if (r <= 0) return k }
  return 'think'
}

export const isNight = (d = new Date()) => d.getHours() < 5
export const isMorning = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 10 }
