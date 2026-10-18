/**
 * 目の演技。ポーズ（CSS変数）を時間順に並べた「演目」を再生する。
 *
 * ポーズの軸
 *  lid / lidL / lidR  上まぶた 0(開)〜1(閉)
 *  lidb               下まぶた 0〜1（じとっ）
 *  px / py            瞳の位置 -1〜1
 *  ps                 瞳の大きさ倍率
 *  sx / sy            目全体の伸縮
 *  ox / oy            目のペアの移動 px（体ごと動く）
 *  rot                ペアの回転 deg（首かしげ）
 *  gap                目と目の間隔の倍率（1 が通常。小さいとコンパクト）
 *  tiltL / tiltR      左右それぞれの目の傾き deg（眉の代わり。内側に倒すと怒り、外側で悲しみ）
 *  shape              'idle' | 'happy' | 'sad' | 'cross'（×目） | 'smirk'（左だけ弧） | 'sparkle'（キラキラ） | 'heart'
 *  swirl              頭上の渦巻き
 *  spin               瞳が円を描いて回る（CSS アニメ）
 *  text               目の上に小さく出す独り言
 *  bubble             雲の吹き出しの中身（考え中・寝息）。null で消す
 *  t                  このポーズへ移る時間 ms
 *  hold               このポーズで待つ時間 ms
 */
export type Pose = {
  lid?: number; lidL?: number; lidR?: number; lidb?: number
  px?: number; py?: number; ps?: number
  sx?: number; sy?: number
  ox?: number; oy?: number; rot?: number
  tiltL?: number; tiltR?: number; gap?: number
  shape?: 'idle' | 'happy' | 'sad' | 'cross' | 'smirk' | 'sparkle' | 'heart'
  swirl?: boolean
  spin?: boolean
  text?: string | null
  bubble?: string | null
  t?: number
  hold: number
}
export type Performance = Pose[]
export type Base = { lid: number; shape: 'idle' | 'happy' }
/** 「閉じた目」。完全に隠さず、下にひと筋残す */
export const CLOSED = 0.93

const R = { lid: 0, lidb: 0, px: 0, py: 0, ps: 1, sx: 1, sy: 1, ox: 0, oy: 0, rot: 0, tiltL: 0, tiltR: 0, gap: 1, shape: 'idle', swirl: false, spin: false, text: null, bubble: null } as const
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
/** 目が回る：瞳がぐるぐる → ×目＋頭上に渦巻き、ふらふら → 戻る */
export const dizzy: Performance = [
  { spin: true, px: 0, py: 0, t: 0, hold: 1300 },
  { spin: false, px: 0, py: 0, shape: 'cross', swirl: true, t: 100, hold: 400 },
  ...jitter(6, .04, 'sx', 160).map((p) => ({ ...p, shape: 'cross' as const, swirl: true })),
  { shape: 'cross', swirl: true, sx: 1, t: 150, hold: 900 },
  { shape: 'idle', swirl: false, sx: 1.06, sy: 1.08, t: 120, hold: 500 },
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

// ---- 体ごと動く・表情（候補）----
/** びっくり：跳ね上がって見開き、瞳が小さく「！」 */
export const startle: Performance = [
  { oy: -46, sx: 1.18, sy: 1.22, ps: .55, px: 0, py: 0, bubble: '！', t: 90, hold: 500 },
  { oy: -30, sx: 1.1, sy: 1.12, ps: .7, bubble: '！', t: 200, hold: 500 },
  { oy: 0, sx: 1, sy: 1, ps: 1, bubble: null, t: 350, hold: 800 },
  reset(),
]
/** むっ：目が内側に傾いて細まり、瞳が寄る */
export const grumpy: Performance = [
  { tiltL: 16, tiltR: -16, sy: .72, ps: .85, px: 0, py: .1, t: 250, hold: 1600 },
  { tiltL: 16, tiltR: -16, sy: .72, ps: .85, px: .4, py: .1, t: 200, hold: 900 },
  reset(400),
]
/** しょんぼり：外側に傾いて沈み、瞳が下を向く。「…」 */
export const droop: Performance = [
  { tiltL: -14, tiltR: 14, oy: 22, py: .7, lid: .25, t: 600, hold: 1200 },
  { tiltL: -14, tiltR: 14, oy: 22, py: .7, lid: .25, bubble: '…', t: 0, hold: 1600 },
  reset(500),
]
/** ぴょんぴょん：ゼリーみたいに弾む */
export const bounce: Performance = [
  { oy: 10, sx: 1.12, sy: .86, t: 120, hold: 0 },
  { oy: -42, sx: .92, sy: 1.14, t: 220, hold: 60 },
  { oy: 8, sx: 1.12, sy: .86, t: 240, hold: 0 },
  { oy: -30, sx: .95, sy: 1.08, t: 200, hold: 40 },
  { oy: 6, sx: 1.08, sy: .9, t: 220, hold: 0 },
  { oy: -14, sx: 1, sy: 1.02, t: 180, hold: 40 },
  { oy: 0, sx: 1, sy: 1, shape: 'happy', t: 160, hold: 900 },
  reset(300),
]
/** 首かしげ：ペアごと傾いて「？」 */
export const headTilt: Performance = [
  { rot: 14, ox: 10, px: .5, py: -.3, t: 450, hold: 900 },
  { rot: 14, ox: 10, px: .5, py: -.3, bubble: '？', t: 0, hold: 1300 },
  { rot: -6, ox: -4, px: -.3, py: 0, t: 400, hold: 500 },
  reset(400),
]
/** 体ごと見回す：ペアが左右にスライド、瞳が先行 */
export const lean: Performance = [
  { px: -.9, t: 150, hold: 80 },
  { ox: -70, rot: -6, px: -.9, t: 450, hold: 700 },
  { px: .9, t: 150, hold: 80 },
  { ox: 70, rot: 6, px: .9, t: 600, hold: 700 },
  { ox: 0, rot: 0, px: 0, py: 0, t: 450, hold: 400 },
  reset(),
]
/** うっとり：半目で沈んで、ゆらゆら */
export const dreamy: Performance = [
  { lid: .45, oy: 8, rot: 4, py: .2, t: 700, hold: 900 },
  { lid: .45, oy: 8, rot: -4, py: .2, t: 1200, hold: 900 },
  { lid: .45, oy: 8, rot: 4, py: .2, t: 1200, hold: 900 },
  reset(600),
]
/** 寝落ち：まぶたが落ちながら傾いて沈む → ガクッと戻る */
export const noddingOff: Performance = [
  { lid: .4, oy: 6, rot: 3, t: 1200, hold: 400 },
  { lid: .75, oy: 20, rot: 9, t: 1500, hold: 300 },
  { lid: .9, oy: 34, rot: 14, t: 1200, hold: 200 },
  { lid: 0, oy: -10, rot: -2, sx: 1.05, sy: 1.1, t: 90, hold: 700 },
  { lid: 0, oy: 0, rot: 0, sx: 1, sy: 1, px: .6, t: 250, hold: 500 },
  { px: -.5, t: 200, hold: 500 },
  reset(),
]
/** いやいや：ペアが小刻みに横に振れる、目は「∪」 */
export const headShake: Performance = [
  { shape: 'sad', t: 120, hold: 60 },
  ...Array.from({ length: 6 }, (_, i) => ({ shape: 'sad' as const, ox: (i % 2 ? -1 : 1) * 16, t: 110, hold: 20 })),
  { shape: 'sad', ox: 0, t: 150, hold: 500 },
  reset(300),
]
/** のぞきこむ：伸び上がって大きくなり、上から見下ろす */
export const peek: Performance = [
  { oy: -36, sx: 1.14, sy: 1.14, py: .9, t: 500, hold: 900 },
  { oy: -36, sx: 1.14, sy: 1.14, py: .9, px: .5, t: 300, hold: 600 },
  { oy: -36, sx: 1.14, sy: 1.14, py: .9, px: -.5, t: 400, hold: 600 },
  { oy: 0, sx: 1, sy: 1, px: 0, py: 0, t: 400, hold: 300 },
  reset(),
]
// ---- 笑い方いろいろ（候補）----
const H = { shape: 'happy' as const }
/** 満面：弧が横に広がって「♪」 */
export const grin: Performance = [
  { ...H, sx: 1.18, sy: 1.05, bubble: '♪', t: 200, hold: 2200 },
  reset(300),
]
/** くすくす：小刻みに揺れながら「ふふ」 */
export const giggle: Performance = [
  { ...H, text: 'ふふ', t: 150, hold: 100 },
  ...Array.from({ length: 8 }, (_, i) => ({ ...H, oy: i % 2 ? 3 : -3, sx: i % 2 ? 1.02 : .98, text: 'ふふ', t: 90, hold: 10 })),
  { ...H, oy: 0, sx: 1, text: null, t: 200, hold: 900 },
  reset(300),
]
/** にこにこ：笑ったままゆらゆら */
export const sway: Performance = [
  { ...H, rot: 6, t: 500, hold: 300 },
  { ...H, rot: -6, t: 900, hold: 300 },
  { ...H, rot: 6, t: 900, hold: 300 },
  { ...H, rot: 0, t: 600, hold: 400 },
  reset(300),
]
/** 照れ笑い：笑って縮こまってから、目をそらす */
export const shy: Performance = [
  { ...H, oy: 10, sx: .92, sy: .9, rot: 5, t: 300, hold: 1200 },
  { shape: 'idle', oy: 6, sx: .96, sy: .96, rot: 3, px: -.8, py: .5, t: 350, hold: 1100 },
  { px: -.8, py: .5, t: 200, hold: 300 },
  reset(400),
]
/** にやり：左は弧、右は半目で横を見る */
export const smirk: Performance = [
  { shape: 'smirk', lidR: .45, px: .6, py: .1, t: 250, hold: 2000 },
  reset(300),
]
/** ウインク笑い：左は弧、右はぱっちり */
export const winkSmile: Performance = [
  { shape: 'smirk', lidR: 0, sx: 1.05, px: 0, py: 0, t: 150, hold: 1600 },
  reset(300),
]
/** キラキラ：目が星になって脈打つ */
export const sparkle: Performance = [
  { shape: 'sparkle', sx: 1.05, sy: 1.05, t: 150, hold: 300 },
  { shape: 'sparkle', sx: .95, sy: .95, t: 300, hold: 200 },
  { shape: 'sparkle', sx: 1.08, sy: 1.08, t: 300, hold: 200 },
  { shape: 'sparkle', sx: 1, sy: 1, t: 300, hold: 900 },
  reset(300),
]
/** ハート目：ハートになって跳ねる */
export const hearts: Performance = [
  { shape: 'heart', oy: -14, sx: 1.08, sy: 1.08, t: 200, hold: 200 },
  { shape: 'heart', oy: 0, sx: 1, sy: 1, t: 250, hold: 200 },
  { shape: 'heart', oy: -8, sx: 1.04, sy: 1.04, t: 200, hold: 200 },
  { shape: 'heart', oy: 0, sx: 1, sy: 1, t: 250, hold: 1000 },
  reset(300),
]
/** ドヤ：両目半分、外側に少し傾けて「♪」 */
export const smug: Performance = [
  { lid: .45, tiltL: -6, tiltR: 6, px: 0, py: 0, bubble: '♪', t: 300, hold: 2200 },
  reset(300),
]
/** 笑い転げ：大きく揺れて跳ねる */
export const rolling: Performance = [
  { ...H, rot: -14, oy: -10, t: 220, hold: 60 },
  { ...H, rot: 14, oy: 6, t: 260, hold: 60 },
  { ...H, rot: -12, oy: -8, t: 260, hold: 60 },
  { ...H, rot: 12, oy: 4, t: 260, hold: 60 },
  { ...H, rot: 0, oy: 0, t: 300, hold: 700 },
  reset(300),
]
/** ぷっ：吹き出して震える */
export const snort: Performance = [
  { ...H, sx: 1.1, sy: .9, t: 80, hold: 60 },
  ...jitter(8, .04, 'sx', 45).map((p) => ({ ...p, ...H })),
  { ...H, sx: 1, sy: 1, t: 150, hold: 800 },
  reset(300),
]

// ---- 集中・感情（候補）----
/** 集中：少し細めて瞳が小さく中央、ほんの少し前のめり。まばたきしない */
export const focus: Performance = [
  { sy: .8, ps: .8, px: 0, py: 0, sx: 1.04, t: 400, hold: 3200 },
  reset(500),
]
/** やる気：内側に少し傾けて細め「…！」 */
export const determined: Performance = [
  { tiltL: 8, tiltR: -8, sy: .85, ps: .85, px: 0, py: 0, t: 250, hold: 600 },
  { tiltL: 8, tiltR: -8, sy: .85, ps: .85, px: 0, py: 0, bubble: '…！', t: 0, hold: 1600 },
  reset(300),
]
/** 感心：見開いて瞳が大きく「ほー」 */
export const impressed: Performance = [
  { sx: 1.1, sy: 1.1, ps: 1.3, px: 0, py: -.1, t: 200, hold: 300 },
  { sx: 1.1, sy: 1.1, ps: 1.3, px: 0, py: -.1, text: 'ほー', t: 0, hold: 1600 },
  reset(300),
]
/** 休憩中の演目（癒し系）。目は閉じ気味のまま、ゆったり */
export const breakSet = { sway, dreamy, sleepTalk, shy, hearts }
export type BreakName = keyof typeof breakSet
export function pickBreak(last: BreakName | null): BreakName {
  const w: Record<BreakName, number> = { sway: 3, dreamy: 3, sleepTalk: 3, shy: 1, hearts: 1 }
  if (last) w[last] = 0
  const total = Object.values(w).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (const k of Object.keys(w) as BreakName[]) { r -= w[k]; if (r <= 0) return k }
  return 'sway'
}
export const smileSet = { grin, giggle, sway, shy, smirk, winkSmile, sparkle, hearts, smug, rolling, snort, focus, determined, impressed }

export const bodySet = { startle, grumpy, droop, bounce, headTilt, lean, dreamy, noddingOff, headShake, peek }

export const idleSet = { think, doze, lookAround, doubleTake, spaceOut, rubEyes, sigh, stretch, headTilt, lean, dreamy, noddingOff, focus }
export type IdleName = keyof typeof idleSet

/**
 * 作業中の待機演目（集中系）。静かで、一緒に集中している感じ。
 * 眠い時間帯だけウトウト系が混ざる。直前と同じものは避ける。
 */
export function pickIdle(opts: { sleepy: boolean; night: boolean; last: IdleName | null }): IdleName {
  const drowsy = opts.sleepy || opts.night
  const w: Record<IdleName, number> = {
    focus: 5, think: 3, spaceOut: 2, headTilt: 1, lookAround: 1,
    doubleTake: 0, sigh: 0, lean: 0, dreamy: 0,
    doze: drowsy ? 4 : 0, rubEyes: drowsy ? 2 : 0, stretch: opts.sleepy ? 2 : 0, noddingOff: drowsy ? 4 : 0,
  }
  if (opts.last) w[opts.last] = 0
  const total = Object.values(w).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (const k of Object.keys(w) as IdleName[]) { r -= w[k]; if (r <= 0) return k }
  return 'think'
}

export const isNight = (d = new Date()) => d.getHours() < 5
export const isMorning = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 10 }
