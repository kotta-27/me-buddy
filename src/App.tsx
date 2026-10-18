import { useEffect, useRef, useState } from 'preact/hooks'
import { Eyes, play, type Mood } from './Eyes'
import { isMorning } from './behaviors'
import { Settings } from './Settings'
import { Wordmark } from './Wordmark'
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
  const snoozes = useRef(0)
  const started = useRef(false)
  const audio = useRef<AudioContext | null>(null)
  const hiddenAt = useRef(0)
  const talkTimer = useRef(0)
  const lock = useRef<WakeLockSentinel | null>(null)

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
    // 画面から離れて戻った時。短い（8秒未満）なら通知を見たと判断して上を見る。長ければ「おかえり」
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return }
      if (mode === 'off') return
      wake()
      const gap = Date.now() - hiddenAt.current
      if (mode !== 'focus') return
      if (hiddenAt.current && gap < 8000) { play('glanceUp'); say(L.notice(), { ms: 4500 }) }
      else { play('sway'); say(L.welcomeBack(), { ms: 3000 }) }
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
    if (demo) return   // LP の埋め込みでは鳴らさない
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
    if (demo) { start(); return }   // デモ（LP の埋め込み）は自動で開始
    const s = loadSession()
    if (!s) return
    const valid = Number.isFinite(s.startAt) && s.startAt > 0 && s.startAt <= Date.now() && Number.isFinite(s.lastTick) && s.lastTick >= s.startAt
    if (!valid) { saveSession(null); return }
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
    if (demo) return   // デモでは復元用の保存をしない（本体と localStorage を共有するため）
    if (!startAt.current) { startAt.current = Date.now(); nextNudge.current = startAt.current + min(cfg.interval); nextNod.current = startAt.current + min(25); scheduleChatter() }
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

  // ---- session ----
  const scheduleChatter = () => {
    const [lo, hi] = { 1: [15, 30], 2: [8, 18], 3: [3, 7] }[cfg.pace]
    nextChatter.current = Date.now() + min(lo + Math.random() * (hi - lo))
  }
  const start = () => {
    startAt.current = Date.now()
    nextNudge.current = startAt.current + min(cfg.interval)
    scheduleChatter()
    nextNod.current = startAt.current + min(25)
    milestones.current.clear()
    if (cfg.sound && !demo && !audio.current) { try { audio.current = new AudioContext() } catch { /* no audio */ } }
    setMode('focus'); setPhase('quiet')
    say(L.back(), { happy: true, ms: 2500 })
    started.current = true
    setTimeout(() => play(isMorning() ? 'yawn' : 'determined'), 2800)
    snoozes.current = 0
    if (!demo) { wake(); fullscreen(); motionPermission() }
  }
  const motionPermission = () => {
    const D = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
    D.requestPermission?.().catch(() => {})
  }
  const snooze = () => {
    nextNudge.current = Date.now() + min(5)
    setPhase('quiet')
    snoozes.current++
    if (snoozes.current >= 3) { play('smirk'); say('ほんとに？ …5分だけね。', { ms: 2200 }) } else say(L.snoozed(), { ms: 1800 })
  }
  const startBreak = () => {
    const t = { day: today(), sec: total.sec + elapsed }
    setTotal(t); saveTotal(t)
    breakEnd.current = Date.now() + min(cfg.breakLen)
    setMode('break'); setPhase('quiet')
    say(L.breakStart(), { ms: 2000 })
  }
  const resume = () => { play('wakeOneEye'); setTimeout(() => { start(); setTimeout(() => say('ちゃんと休めた。えらい。', { happy: true, ms: 2500 }), 2600) }, 900) }
  const stop = () => {
    play('droop'); say(L.bye(), { ms: 2500 })
    const t = { day: today(), sec: total.sec + elapsed }
    setTotal(t); saveTotal(t)
    setMode('off'); setPhase('quiet'); hush()
    lock.current?.release().catch(() => {})
  }

  // ---- per-tick logic ----
  useEffect(() => {
    if (mode === 'focus' && phase === 'quiet') {
      if (now >= nextNudge.current) { setPhase('nudge'); nudgeAt.current = now; nextNag.current = now + min(3); say(L.nudge(Math.round(elapsed / 60)), { hold: true }); notify() }
      else for (const m of [60, 120, 180]) if (elapsed >= m * 60 && !milestones.current.has(m)) { milestones.current.add(m); play('impressed'); say(L.milestone(m), { ms: 3000 }) }
      else if (cfg.chatter && now >= nextChatter.current) { say(L.chatter()); scheduleChatter() }
      if (now >= nextNod.current) { nextNod.current = now + min(25); play('nod') }
    }
    if (mode === 'focus' && phase === 'nudge' && now >= nextNag.current) {
      nextNag.current = now + min(3); play('droop'); setTimeout(() => say(L.nag(), { hold: true }), 800)
    }
    if (mode === 'break' && phase === 'quiet' && breakLeft <= 0) {
      setPhase('breakOver'); say(L.breakEnd(), { happy: true, hold: true }); notify()
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
    <main class={`stage ${mode === 'off' ? 'off' : ''}`}>
      {mode === 'off' && !demo && <a class="brand" href="lp/" aria-label="pachi の紹介ページ"><Wordmark height={26} /></a>}
      <Eyes
        mood={mood}
        eyeSize={cfg.eyeSize}
        demo={demo}
        pace={cfg.pace}
        onPoke={() => { if (mode === 'focus' && phase === 'quiet') say(L.poke(), { ms: 1800 }) }}
        onApproach={() => say(L.curious(), { ms: 2500 })}
        onBuzz={() => { if (mode === 'focus') say(L.notice(), { ms: 4500 }) }}
      />
      <p class={`line ${line ? 'on' : ''}`} role="status" aria-live="polite">{line?.text ?? ''}</p>

      <div class="actions">
        {mode === 'off' && <button type="button" class="primary" onClick={start}>はじめる</button>}
        {mode === 'focus' && phase === 'nudge' && <>
          <button type="button" onClick={snooze}>あと5分つづける</button>
          <button type="button" class="primary" onClick={startBreak}>休憩する</button>
        </>}
        {mode === 'break' && <button type="button" class="primary" onClick={resume}>もどる</button>}
      </div>

      <footer class="foot">
        <span>{clock}</span>
        <span>{todaySec >= 60 ? `今日 ${fmtH(todaySec)}` : ''}</span>
      </footer>

      {!demo && (
        <button type="button" class="gear" aria-label="設定" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      )}

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
      {mode !== 'off' && !demo && (
        <button type="button" class="gear" style="right:auto;left:12px;font-size:14px;letter-spacing:.2em" onClick={stop}>終了</button>
      )}
    </main>
  )
}
