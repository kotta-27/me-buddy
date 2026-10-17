import { useEffect, useRef, useState } from 'preact/hooks'
import { Eyes, play, lookAt, type Mood } from './Eyes'
import { Camera, type Sense } from './camera'
import { isMorning } from './behaviors'
import { Settings } from './Settings'
import * as L from './lines'
import { loadConfig, loadSession, loadTotal, saveConfig, saveSession, saveTotal, today, type Config, type Total } from './store'

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
  const nudgeAt = useRef(0)
  const nextNag = useRef(0)
  const milestones = useRef<Set<number>>(new Set())
  const audio = useRef<AudioContext | null>(null)
  const talkTimer = useRef(0)
  const lock = useRef<WakeLockSentinel | null>(null)
  const cam = useRef<Camera | null>(null)
  const [camOn, setCamOn] = useState(false)
  const [dark, setDark] = useState(false)
  const seen = useRef({ present: true, closedSince: 0, turnedSince: 0, lastYawn: 0, lastSmile: 0, lastDark: 0, lastAsleep: 0, lastDistract: 0 })

  // ---- config -> css vars + storage ----
  useEffect(() => {
    const s = document.documentElement.style
    s.setProperty('--eye-w', `${cfg.eyeSize}px`)
    s.setProperty('--eye-h', `${cfg.eyeSize * 1.6}px`)
    s.setProperty('--eye-gap', `${cfg.eyeGap}px`)
    s.setProperty('--fg', `hsl(0 0% ${cfg.brightness}%)`)
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

  // ---- 知らせる（音・バイブ）----
  const notify = () => {
    if (cfg.vibrate) navigator.vibrate?.([30, 60, 30])
    if (!cfg.sound) return
    try {
      const ac = audio.current ?? (audio.current = new AudioContext())
      const t0 = ac.currentTime
      for (const [f, at] of [[880, 0], [1175, .18]] as const) {
        const o = ac.createOscillator(), g = ac.createGain()
        o.type = 'sine'; o.frequency.value = f
        g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(.08, t0 + at + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + at + .5)
        o.connect(g).connect(ac.destination); o.start(t0 + at); o.stop(t0 + at + .55)
      }
    } catch { /* no audio */ }
  }

  // ---- 途中で閉じた分を復元 ----
  useEffect(() => {
    const s = loadSession()
    if (!s) return
    const gap = Date.now() - s.lastTick
    if (gap < min(10)) {
      startAt.current = s.startAt
      nextNudge.current = Math.max(Date.now() + min(1), s.startAt + min(cfg.interval))
      nextNod.current = Date.now() + min(25); scheduleChatter()
      setMode('focus'); setPhase('quiet')
      say(L.resumed(), { happy: true, ms: 2500 })
    } else {
      const t = { day: today(), sec: total.sec + (s.lastTick - s.startAt) / 1000 }
      setTotal(t); saveTotal(t); saveSession(null)
    }
  }, [])
  useEffect(() => {
    if (mode !== 'focus') { saveSession(null); return }
    const id = setInterval(() => saveSession({ startAt: startAt.current, lastTick: Date.now() }), 5000)
    saveSession({ startAt: startAt.current, lastTick: Date.now() })
    return () => clearInterval(id)
  }, [mode])

  // ---- PC キー ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || open || (e.target as Element).closest('input, select, button')) return
      e.preventDefault()
      if (mode === 'off') start()
      else if (mode === 'focus' && phase === 'nudge') startBreak()
      else if (mode === 'break') resume()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- camera ----
  const camera = () => {
    if (!cam.current) {
      cam.current = new Camera()
      cam.current.onError = (m) => say(m, { ms: 3000 })
      cam.current.onSense = onSense
    }
    return cam.current
  }
  useEffect(() => {
    if (mode === 'off' || cfg.camera === 'off') { cam.current?.stop(); setCamOn(false); setDark(false); return }
    camera().start(cfg.camera).then(() => setCamOn(camera().on))
  }, [cfg.camera, mode])
  const onSense = (s: Sense) => {
    const v = seen.current, now = Date.now()
    setDark(s.dark)
    // 離席 / 帰席
    if (v.present && !s.present) { v.present = false; say(L.away(), { ms: 2500 }); play('awayWait') }
    else if (!v.present && s.present) { v.present = true; play('welcome') }
    if (s.dark && now - v.lastDark > min(10)) { v.lastDark = now; say(L.dark()) }
    if (s.face) lookAt(s.face)
    // 居眠り：2秒以上目を閉じたまま
    if (s.eyesClosed) { if (!v.closedSince) v.closedSince = now; else if (now - v.closedSince > 2000 && now - v.lastAsleep > 30_000) { v.lastAsleep = now; v.closedSince = 0; say(L.asleep(), { ms: 3000 }); play('doubleTake') } }
    else v.closedSince = 0
    if (s.yawn && now - v.lastYawn > 20_000) { v.lastYawn = now; play('yawn'); say(L.yawned(), { ms: 2500 }) }
    if (s.smile && now - v.lastSmile > 15_000) { v.lastSmile = now; play('petted') }
    // よそ見 30 秒
    if (s.turned) { if (!v.turnedSince) v.turnedSince = now; else if (now - v.turnedSince > 30_000 && now - v.lastDistract > 60_000) { v.lastDistract = now; v.turnedSince = 0; play('ticklish'); say(L.distracted(), { ms: 3000 }) } }
    else v.turnedSince = 0
  }
  useEffect(() => () => cam.current?.stop(), [])

  // ---- session ----
  const scheduleChatter = () => { nextChatter.current = Date.now() + min(8 + Math.random() * 10) }
  const start = () => {
    startAt.current = Date.now()
    nextNudge.current = startAt.current + min(cfg.interval)
    scheduleChatter()
    nextNod.current = startAt.current + min(25)
    milestones.current.clear()
    if (cfg.sound && !audio.current) { try { audio.current = new AudioContext() } catch { /* no audio */ } }
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
      if (now >= nextNudge.current) { setPhase('nudge'); nudgeAt.current = now; nextNag.current = now + min(3); say(L.nudge(Math.round(elapsed / 60)), { happy: true, hold: true }); notify() }
      else for (const m of [60, 120, 180]) if (elapsed >= m * 60 && !milestones.current.has(m)) { milestones.current.add(m); say(L.milestone(m), { happy: true, ms: 3000 }) }
      else if (cfg.chatter && now >= nextChatter.current) { say(L.chatter()); scheduleChatter() }
      if (now >= nextNod.current) { nextNod.current = now + min(25); play('nod') }
    }
    if (mode === 'focus' && phase === 'nudge' && now >= nextNag.current) {
      nextNag.current = now + min(3); play('sigh'); setTimeout(() => say(L.nag(), { hold: true }), 1500)
    }
    if (mode === 'break' && phase === 'quiet' && breakLeft <= 0) {
      setPhase('breakOver'); say(L.breakEnd(), { happy: true, hold: true }); notify()
    }
  }, [now])

  const mood: Mood =
    line?.happy ? 'happy'
    : mode === 'break' && phase === 'quiet' ? 'closed'
    : mode === 'focus' && (elapsed > 90 * 60 || dark) && !line ? 'sleepy'
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
        <span><span class={`cam ${camOn ? 'on' : ''}`} aria-label={camOn ? 'カメラ使用中' : ''}></span>{clock}</span>
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
