import { useEffect, useRef } from 'preact/hooks'
import * as B from './behaviors'
import type { Performance, Pose } from './behaviors'

export type Mood = 'idle' | 'happy' | 'closed' | 'sleepy'

/** App → Eyes の合図。`eyesBus.dispatchEvent(new CustomEvent('play', { detail: 'welcome' }))` */
export const eyesBus = new EventTarget()
export const play = (name: Cue) => eyesBus.dispatchEvent(new CustomEvent('play', { detail: name }))
const cues = {
  ...B.idleSet,
  ...B.bodySet,
  welcome: B.welcome, yawn: B.yawn, nod: B.nod, wakeOneEye: B.wakeOneEye, dizzy: B.dizzy,
  ticklish: B.ticklish, petted: B.petted, sleepTalk: B.sleepTalk, awayWait: B.awayWait, glanceUp: B.glanceUp,
} satisfies Record<string, Performance>
export type Cue = keyof typeof cues
/** カメラが見つけた顔の方を見る。x,y は -1〜1。null で解除 */
export const lookAt = (p: { x: number; y: number } | null) => eyesBus.dispatchEvent(new CustomEvent('look', { detail: p }))

type Props = {
  mood: Mood
  eyeSize: number
  pace?: 1 | 2 | 3         // しぐさの多さ
  demo?: boolean           // 演目の間隔を短くする（確認用）
  onPoke?: () => void
  onApproach?: () => void  // 長押しで寄っていった時
}

/** 笑い目「^」。線幅一定、端丸め。ため息は 180° 回して「∪」 */
const Arc = () => (
  <svg class="arc" viewBox="0 0 100 60" aria-hidden="true">
    <path d="M12 48 Q50 2 88 48" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" />
  </svg>
)

/** 雲の吹き出し。円を重ねて外周だけ線を残す */
const Cloud = () => {
  const cs: [number, number, number][] = [[45, 58, 30], [76, 40, 32], [110, 46, 30], [132, 68, 24], [102, 84, 28], [66, 88, 26]]
  return (
    <svg viewBox="0 0 160 130" aria-hidden="true">
      <g fill="#000" stroke="currentColor" stroke-width="5">
        {cs.map(([x, y, r]) => <circle cx={x} cy={y} r={r} />)}
      </g>
      <g fill="#000">
        {cs.map(([x, y, r]) => <circle cx={x} cy={y} r={r - 2.5} />)}
      </g>
      <circle cx="30" cy="110" r="7" fill="#000" stroke="currentColor" stroke-width="5" />
      <circle cx="14" cy="123" r="4" fill="#000" stroke="currentColor" stroke-width="4" />
      <text x="88" y="70" text-anchor="middle" fill="currentColor" font-size="34" font-family="inherit" font-weight="500" letter-spacing="1">…</text>
    </svg>
  )
}

/** ×目 */
const Cross = () => (
  <svg class="cross" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M22 22 L78 78 M78 22 L22 78" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" />
  </svg>
)
/** 頭上の渦巻き */
const Swirl = () => {
  // アルキメデス螺旋 3 周
  const pts: string[] = []
  for (let i = 0; i <= 120; i++) {
    const th = (i / 120) * Math.PI * 6, r = 3 + th * 2.3
    pts.push(`${(50 + r * Math.cos(th)).toFixed(1)},${(50 + r * Math.sin(th)).toFixed(1)}`)
  }
  return (
    <svg class="swirl-mark" viewBox="0 0 100 100" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 黒背景に目だけ。まばたき・視線の泳ぎ・ゆらぎ・指追い・演技。 */
export function Eyes({ mood, eyeSize, pace = 3, demo, onPoke, onApproach }: Props) {
  const paceRef = useRef(pace); paceRef.current = pace
  const root = useRef<HTMLDivElement>(null)
  const pair = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const moodRef = useRef(mood); moodRef.current = mood
  const followUntil = useRef(0)
  const followStart = useRef(0)
  const perf = useRef<{ token: number; interruptible: boolean } | null>(null)
  const lastIdle = useRef<B.IdleName | null>(null)
  const taps = useRef<number[]>([])
  const approach = useRef<{ on: boolean; onEyes: boolean; x: number; y: number; timer: number }>({ on: false, onEyes: false, x: 0, y: 0, timer: 0 })
  const spin = useRef({ angle: 0, acc: 0, at: 0, last: 0 })  // 指が目の周りを回った量

  // ---- ポーズを DOM に書く ----
  const set = (p: Partial<Pose>) => {
    const el = root.current
    if (!el) return
    const v = (k: string, val: number | undefined) => { if (val !== undefined) el.style.setProperty(k, String(val)) }
    el.style.setProperty('--t', `${p.t ?? 400}ms`)
    if (p.lid !== undefined) { v('--lidL', p.lid); v('--lidR', p.lid) }
    v('--lidL', p.lidL); v('--lidR', p.lidR); v('--lidb', p.lidb)
    v('--px', p.px); v('--py', p.py); v('--ps', p.ps); v('--sx', p.sx); v('--sy', p.sy)
    if (p.ox !== undefined) el.style.setProperty('--ox', `${p.ox}px`)
    if (p.oy !== undefined) el.style.setProperty('--oy', `${p.oy}px`)
    if (p.rot !== undefined) el.style.setProperty('--rot', `${p.rot}deg`)
    if (p.tiltL !== undefined) el.style.setProperty('--tiltL', `${p.tiltL}deg`)
    if (p.tiltR !== undefined) el.style.setProperty('--tiltR', `${p.tiltR}deg`)
    if (p.gap !== undefined) el.style.setProperty('--gapk', String(p.gap))
    if (p.shape) { el.classList.toggle('shape-happy', p.shape === 'happy'); el.classList.toggle('shape-sad', p.shape === 'sad'); el.classList.toggle('shape-cross', p.shape === 'cross') }
    if (p.swirl !== undefined) el.classList.toggle('swirl', p.swirl)
    if (p.spin !== undefined) el.classList.toggle('spin', p.spin)
    if (p.text !== undefined && text.current) {
      text.current.textContent = p.text ?? ''
      text.current.classList.toggle('on', !!p.text)
    }
    if (p.bubble !== undefined && bubble.current) {
      const t = bubble.current.querySelector('text')
      if (t) t.textContent = p.bubble ?? ''
      bubble.current.classList.toggle('on', !!p.bubble)
    }
  }
  const base = (): Pose => {
    const m = moodRef.current
    return { lid: m === 'closed' ? B.CLOSED : m === 'sleepy' ? .45 : 0, lidb: 0, px: 0, py: 0, ps: 1, sx: 1, sy: 1, ox: 0, oy: 0, rot: 0, tiltL: 0, tiltR: 0, gap: 1, shape: m === 'happy' ? 'happy' : 'idle', text: null, bubble: null, t: 400, hold: 0 }
  }

  // ---- 演目再生 ----
  const perform = async (seq: Performance, interruptible = false) => {
    const token = Math.random()
    perf.current = { token, interruptible }
    for (const pose of seq) {
      if (perf.current?.token !== token) return false
      set(pose)
      await sleep((pose.t ?? 400) + pose.hold)
    }
    if (perf.current?.token === token) { perf.current = null; set(base()) }
    return true
  }
  const cancel = () => { if (perf.current) { perf.current = null; set(base()) } }
  const busy = () => perf.current !== null

  // mood が変わったら演技を止めて基本姿勢へ
  useEffect(() => { perf.current = null; set(base()) }, [mood])

  // App からの合図
  useEffect(() => {
    const on = (e: Event) => { const name = (e as CustomEvent<Cue>).detail; if (cues[name]) perform(cues[name]) }
    eyesBus.addEventListener('play', on)
    const onLook = (e: Event) => {
      const p = (e as CustomEvent<{ x: number; y: number } | null>).detail
      if (!p || busy() || moodRef.current === 'closed') return
      set({ px: Math.max(-1, Math.min(1, p.x)), py: Math.max(-1, Math.min(1, p.y * .6)), t: 600, hold: 0 })
      followUntil.current = Date.now() + 1500
    }
    eyesBus.addEventListener('look', onLook)
    return () => { eyesBus.removeEventListener('play', on); eyesBus.removeEventListener('look', onLook) }
  }, [])

  useEffect(() => {
    let alive = true
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(() => alive && fn(), ms)) }
    const flash = (cls: string, ms: number) => { root.current?.classList.add(cls); later(() => root.current?.classList.remove(cls), ms) }

    // まばたき。深夜は重く、たまに2連
    const blink = () => {
      const m = moodRef.current
      if (!busy() && (m === 'idle' || m === 'sleepy')) {
        if (B.isNight() || m === 'sleepy') perform(B.sleepyBlink, true)
        else { flash('blink', 120); if (Math.random() < .2) later(() => flash('blink', 110), 220) }
      }
      later(blink, (B.isNight() ? 4000 : 2500) + Math.random() * 4500)
    }
    later(blink, 1500)

    // 視線が泳ぐ
    const wander = () => {
      if (!busy() && Date.now() > followUntil.current && moodRef.current !== 'closed') {
        if (Math.random() < .3) set({ px: 0, py: 0, t: 500, hold: 0 })
        else set({ px: (Math.random() * 2 - 1) * .9, py: (Math.random() * 2 - 1) * .6, t: 500, hold: 0 })
      }
      later(wander, 1800 + Math.random() * 4000)
    }
    wander()

    // 待機中の演目。多さ: 少なめ 2〜5分 / ふつう 40〜100秒 / 多め 12〜30秒（demo は 6〜12秒）
    const gap = () => {
      if (demo) return 6000 + Math.random() * 6000
      const [lo, hi] = { 1: [120, 300], 2: [40, 100], 3: [12, 30] }[paceRef.current]
      return (lo + Math.random() * (hi - lo)) * 1000
    }
    const idle = () => {
      const m = moodRef.current
      if (!busy() && (m === 'idle' || m === 'sleepy') && Date.now() > followUntil.current) {
        const name = B.pickIdle({ sleepy: m === 'sleepy', night: B.isNight(), last: lastIdle.current })
        lastIdle.current = name
        const seq = name === 'rubEyes' && Math.random() < .5 ? [...B.rubEyes, ...B.doze] : B.idleSet[name]
        perform(seq, true)
      }
      later(idle, gap())
    }
    later(idle, demo ? 3000 : Math.min(gap(), 20_000))

    // 休憩中の寝言
    const mumble = () => {
      if (moodRef.current === 'closed' && !busy()) perform(B.sleepTalk, true)
      later(mumble, demo ? 6000 : 20_000 + Math.random() * 20_000)
    }
    later(mumble, demo ? 4000 : 20_000)

    // ゆらぎ＋呼吸
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let t = 0, raf = 0
    const drift = () => {
      if (!alive) return
      t += moodRef.current === 'closed' ? .02 : .012
      const amp = moodRef.current === 'closed' ? 5 : 8
      if (pair.current) pair.current.style.transform = `translateY(${Math.sin(t) * amp}px) scaleY(${1 + Math.sin(t) * .012})`
      raf = requestAnimationFrame(drift)
    }
    if (!reduce) drift()

    return () => { alive = false; timers.forEach(clearTimeout); cancelAnimationFrame(raf) }
  }, [demo])

  // 指を追う。5秒なで続けると喜ぶ
  useEffect(() => {
    const onMove = (e: PointerEvent | TouchEvent) => {
      if ((e.target as Element).closest('button, dialog')) return
      if (moodRef.current === 'closed' || approach.current.on) return
      const p = 'touches' in e ? e.touches[0] : e
      const r = root.current?.getBoundingClientRect()
      if (!r || !p) return
      if (perf.current?.interruptible) cancel()
      if (busy()) return
      const clamp = (v: number) => Math.max(-1, Math.min(1, v))
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      set({ px: clamp((p.clientX - cx) / (innerWidth / 2)), py: clamp((p.clientY - cy) / (innerHeight / 2)), t: 300, hold: 0 })
      const now = Date.now()
      // 目の周りをぐるぐる回されたら目が回る（3秒以内に2周）
      const sp = spin.current
      const ang = Math.atan2(p.clientY - cy, p.clientX - cx)
      if (now - sp.at > 3000 || now - sp.last > 600) { sp.acc = 0; sp.at = now }
      else {
        let d = ang - sp.angle
        if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI
        if (Math.hypot(p.clientX - cx, p.clientY - cy) > r.width * .35) sp.acc += d
      }
      sp.angle = ang; sp.last = now
      if (Math.abs(sp.acc) > Math.PI * 4 && now - sp.last < 1000) {
        sp.acc = 0; sp.at = 0
        if (perf.current?.interruptible) cancel()
        if (!busy()) { perf.current = null; perform(B.dizzy); followUntil.current = now + 4000; return }
      }
      if (now > followUntil.current) followStart.current = now
      followUntil.current = now + 2500
      if (now - followStart.current > 5000) { followStart.current = now; perform(B.dreamy) }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('touchmove', onMove, { passive: true })
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('touchmove', onMove) }
  }, [eyeSize])

  // どこでも長押し → 目が指の方へ寄っていく。指が目の上なら寄って ^ ^。離すと中央へ戻る
  useEffect(() => {
    const a = approach.current
    let rest = { cx: 0, cy: 0, w: 0, h: 0 }   // 静止位置（長押し開始時に測る）
    let t0 = 0, raf = 0
    // 長押しが続くほどゆっくり寄る（7秒で最大）。ただし指に近づきすぎない
    const moveTo = (x: number, y: number) => {
      const { cx, cy, w, h } = rest
      const u = Math.min(1, (Date.now() - t0) / 7000)
      const k = .1 + .35 * (1 - Math.pow(1 - u, 2))           // 10% → 45%
      let dx = (x - cx) * k, dy = (y - cy) * k
      // 指との距離は「目の幅の半分 + 70px」を下回らない
      const dist = Math.hypot(x - cx - dx, y - cy - dy), minD = w / 2 + 70
      if (dist < minD) { const full = Math.hypot(x - cx, y - cy); const r = Math.max(0, full - minD) / (full || 1); dx = (x - cx) * r; dy = (y - cy) * r }
      const ox = Math.max(w / 2 + 12 - cx, Math.min(innerWidth - w / 2 - 12 - cx, dx))
      const oy = Math.max(h / 2 + 12 - cy, Math.min(innerHeight - h / 2 - 12 - cy, Math.max(-60, Math.min(36, dy))))
      const ang = Math.atan2(y - cy, x - cx)
      set({ ox, oy, gap: 1 - .4 * u, sx: 1 - .06 * u, sy: 1 - .06 * u, rot: Math.cos(ang) * 6 * u, px: Math.max(-1, Math.min(1, (x - cx - ox) / 160)), py: Math.max(-1, Math.min(1, (y - cy - oy) / 120)), shape: a.onEyes ? 'happy' : 'idle', t: 160, hold: 0 })
    }
    const loop = () => { if (!a.on) return; moveTo(a.x, a.y); raf = requestAnimationFrame(loop) }
    const pos = (e: PointerEvent | TouchEvent) => { const p = 'touches' in e ? e.touches[0] : e; return p ? [p.clientX, p.clientY] as const : null }
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('button, dialog, .gear')) return
      if (moodRef.current === 'closed') return
      a.x = e.clientX; a.y = e.clientY
      a.onEyes = !!(e.target as Element).closest('.eye')
      clearTimeout(a.timer)
      a.timer = window.setTimeout(() => {
        const r = root.current?.getBoundingClientRect()
        if (!r) return
        rest = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height }
        a.on = true
        if (perf.current?.interruptible) cancel()
        if (busy()) { a.on = false; return }
        perf.current = { token: -1, interruptible: false }   // 他の演技をブロック
        t0 = Date.now(); loop()
        if (!a.onEyes) onApproach?.()
      }, 420)
    }
    const move = (e: PointerEvent | TouchEvent) => {
      const p = pos(e); if (!p) return
      a.x = p[0]; a.y = p[1]
      if (a.on) a.onEyes = !!(document.elementFromPoint(p[0], p[1])?.closest('.eye'))
      else if (a.timer && Math.hypot(p[0] - a.x, p[1] - a.y) > 12) { /* 動きすぎたら長押し扱いにしない */ }
    }
    const up = () => {
      clearTimeout(a.timer); a.timer = 0
      if (!a.on) return
      a.on = false; perf.current = null; cancelAnimationFrame(raf)
      set({ ox: 0, oy: 0, gap: 1, sx: 1, sy: 1, rot: 0, px: 0, py: 0, shape: 'idle', t: 700, hold: 0 })
      followUntil.current = Date.now() + 1200
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('touchmove', move)
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('touchend', up)
    }
  }, [])

  // 振ると目が回る
  useEffect(() => {
    let last = 0
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (!a) return
      const g = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0)
      if (g > 25 && Date.now() - last > 4000 && moodRef.current !== 'closed') { last = Date.now(); perform(B.dizzy) }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  // タップ：ウインク。連打：じとっ。長押し：とろん→？
  const onDown = (e: PointerEvent) => {
    if (moodRef.current === 'closed') return
    e.preventDefault()
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < 1500), now]
    if (taps.current.length >= 3) { taps.current = []; perform(B.ticklish); return }
    if (perf.current?.interruptible) cancel()
    if (!busy()) {
      root.current?.classList.add('wink'); setTimeout(() => root.current?.classList.remove('wink'), 260)
      set({ px: 0, py: 0, t: 200, hold: 0 })
      followUntil.current = now + 1500
      onPoke?.()
    }
  }
  const onUp = () => { /* 長押しの解除は window 側で */ }

  return (
    <div ref={root} class={`eyes ${mood}`} aria-hidden="true" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
      <div ref={text} class="mumble"></div>
      <div ref={bubble} class="bubble"><Cloud /></div>
      <Swirl />
      <div ref={pair} class="pair">
        <div class="eye"><div class="pupil" /><Arc /><Cross /></div>
        <div class="eye"><div class="pupil" /><Arc /><Cross /></div>
      </div>
    </div>
  )
}
