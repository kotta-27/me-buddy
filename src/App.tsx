import { useEffect, useRef, useState } from 'preact/hooks'
import { Eyes, play, type Mood } from './Eyes'
import { isMorning } from './behaviors'
import { Settings } from './Settings'
import * as L from './lines'
import { loadConfig, loadTotal, saveConfig, saveTotal, today, type Config, type Total } from './store'

type Mode = 'off' | 'focus' | 'break'
type Phase = 'quiet' | 'nudge' | 'breakOver'

const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s))
  const m = Math.floor(s / 60), r = s % 60
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0')
}
const fmtH = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}時間${m}分` : `${m}分`
}
const min = (n: number) => n * 60_000
const demo = new URLSearchParams(location.search).has('demo')

export function App() {
  const [cfg, setCfg] = useState<Config>(loadConfig)
  const [total, setTotal] = useState<Total>(loadTotal)
  const [mode, setMode] = useState<Mode>('off')
  const [phase, setPhase] = useState<Phase>('quiet')
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [line, setLine] = useState<{ text: string; happy: boolean } | null>(null)

  const startAt = useRef(0)
  const breakEnd = useRef(0)
  const nextNudge = useRef(0)
  const nextChatter = useRef(0)
  const nextNod = useRef(0)
  const talkTimer = useRef(0)
  const lock = useRef<WakeLockSentinel | null>(null)

  // ---- config -> css vars + storage ----
  useEffect(() => {
    const s = document.documentElement.style
    s.setProperty('--eye-w', `${cfg.eyeSize}px`)
    s.setProperty('--eye-h', `${cfg.eyeSize * 1.6}px`)
    s.setProperty('--eye-gap', `${cfg.eyeGap}px`)
    saveConfig(cfg)
  }, [cfg])

  // ---- clock ----
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id) }, [])

  const elapsed = mode === 'focus' ? (now - startAt.current) / 1000 : 0
  const breakLeft = mode === 'break' ? (breakEnd.current - now) / 1000 : 0

  // ---- speech ----
  const say = (text: string, o: { happy?: boolean; hold?: boolean; ms?: number } = {}) => {
    setLine({ text, happy: !!o.happy })
    clearTimeout(talkTimer.current)
    if (!o.hold) talkTimer.current = window.setTimeout(() => setLine(null), o.ms ?? 4000)
  }
  const hush = () => { clearTimeout(talkTimer.current); setLine(null) }

  // ---- device ----
  const wake = async () => {
    if (!cfg.wake || !('wakeLock' in navigator)) return
    try { lock.current = await navigator.wakeLock.request('screen') } catch { /* denied */ }
  }
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || mode === 'off') return
      wake()
      if (mode === 'focus') play('welcome')
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [mode, cfg.wake])
  const fullscreen = () => {
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {})
    const o = screen.orientation as ScreenOrientation & { lock?: (t: string) => Promise<void> }
    o.lock?.('landscape').catch(() => {})
  }

  // ---- session ----
  const scheduleChatter = () => { nextChatter.current = Date.now() + min(8 + Math.random() * 10) }
  const start = () => {
    startAt.current = Date.now()
    nextNudge.current = startAt.current + min(cfg.interval)
    scheduleChatter()
    nextNod.current = startAt.current + min(25)
    setMode('focus'); setPhase('quiet')
    say(L.back(), { happy: true, ms: 2500 })
    if (isMorning()) setTimeout(() => play('yawn'), 3000)
    wake(); fullscreen(); motionPermission()
  }
  const motionPermission = () => {
    const D = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
    D.requestPermission?.().catch(() => {})
  }
  const snooze = () => {
    nextNudge.current = Date.now() + min(5)
    setPhase('quiet')
    say(L.snoozed(), { ms: 1800 })
  }
  const startBreak = () => {
    const t = { day: today(), sec: total.sec + elapsed }
    setTotal(t); saveTotal(t)
    breakEnd.current = Date.now() + min(cfg.breakLen)
    setMode('break'); setPhase('quiet')
    say(L.breakStart(), { ms: 2000 })
  }
  const resume = () => { play('wakeOneEye'); setTimeout(start, 900) }
  const stop = () => {
    const t = { day: today(), sec: total.sec + elapsed }
    setTotal(t); saveTotal(t)
    setMode('off'); setPhase('quiet'); hush()
    lock.current?.release().catch(() => {})
  }

  // ---- per-tick logic ----
  useEffect(() => {
    if (mode === 'focus' && phase === 'quiet') {
      if (now >= nextNudge.current) { setPhase('nudge'); say(L.nudge(Math.round(elapsed / 60)), { happy: true, hold: true }) }
      else if (cfg.chatter && now >= nextChatter.current) { say(L.chatter()); scheduleChatter() }
      if (now >= nextNod.current) { nextNod.current = now + min(25); play('nod') }
    }
    if (mode === 'break' && phase === 'quiet' && breakLeft <= 0) {
      setPhase('breakOver'); say(L.breakEnd(), { happy: true, hold: true })
    }
  }, [now])

  const mood: Mood =
    line?.happy ? 'happy'
    : mode === 'break' && phase === 'quiet' ? 'closed'
    : mode === 'focus' && elapsed > 90 * 60 && !line ? 'sleepy'
    : 'idle'

  const todaySec = total.sec + elapsed
  const clock = mode === 'focus' ? fmt(elapsed) : mode === 'break' ? fmt(breakLeft) : '00:00'

  return (
    <main class="stage">
      <Eyes
        mood={mood}
        eyeSize={cfg.eyeSize}
        demo={demo}
        onPoke={() => { if (mode === 'focus' && phase === 'quiet') say(L.poke(), { ms: 1800 }) }}
      />
      <p class={`line ${line ? 'on' : ''}`} role="status" aria-live="polite">{line?.text ?? ''}</p>

      <div class="actions">
        {mode === 'off' && <button type="button" class="primary" onClick={start}>はじめる</button>}
        {mode === 'focus' && phase === 'nudge' && <>
          <button type="button" onClick={snooze}>あと5分</button>
          <button type="button" class="primary" onClick={startBreak}>休憩する</button>
        </>}
        {mode === 'break' && <button type="button" class="primary" onClick={resume}>もどる</button>}
      </div>

      <footer class="foot">
        <span>{clock}</span>
        <span>{todaySec >= 60 ? `今日 ${fmtH(todaySec)}` : ''}</span>
      </footer>

      <button type="button" class="gear" aria-label="設定" onClick={() => setOpen(true)}>·</button>

      <Settings
        open={open}
        cfg={cfg}
        onChange={(c) => {
          setCfg(c)
          if (mode === 'focus' && phase === 'quiet') nextNudge.current = startAt.current + min(c.interval)
        }}
        onClose={() => setOpen(false)}
        onReset={() => { const t = { day: today(), sec: 0 }; setTotal(t); saveTotal(t) }}
      />
      {mode !== 'off' && (
        <button type="button" class="gear" style="right:auto;left:12px;font-size:14px;letter-spacing:.2em" onClick={stop}>終了</button>
      )}
    </main>
  )
}
