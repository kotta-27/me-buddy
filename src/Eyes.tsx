import { useEffect, useRef } from 'preact/hooks'

export type Mood = 'idle' | 'happy' | 'closed' | 'sleepy'

type Props = {
  mood: Mood
  eyeSize: number
  onPoke?: () => void
}

/** 黒背景に目だけ。まばたき・視線の泳ぎ・ゆらぎ・指追い・タップでウインク。 */
export function Eyes({ mood, eyeSize, onPoke }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const pupils = useRef<HTMLDivElement[]>([])
  const followUntil = useRef(0)
  const moodRef = useRef(mood)
  moodRef.current = mood

  const look = (x: number, y: number) => {
    for (const p of pupils.current) p.style.transform = `translate(${x * eyeSize * 0.28}px, ${y * eyeSize * 0.4}px)`
  }
  const flash = (cls: string, ms: number) => {
    const el = root.current
    if (!el) return
    el.classList.add(cls)
    setTimeout(() => el.classList.remove(cls), ms)
  }

  useEffect(() => {
    let alive = true
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(() => alive && fn(), ms)) }

    // まばたき（たまに2連）
    const blink = () => {
      if (moodRef.current === 'idle' || moodRef.current === 'sleepy') {
        flash('blink', 120)
        if (Math.random() < 0.2) later(() => flash('blink', 110), 220)
      }
      later(blink, 2500 + Math.random() * 4500)
    }
    later(blink, 1500)

    // 視線が泳ぐ
    const wander = () => {
      if (Date.now() > followUntil.current) {
        if (Math.random() < 0.3) look(0, 0)
        else look((Math.random() * 2 - 1) * 0.9, (Math.random() * 2 - 1) * 0.6)
      }
      later(wander, 1800 + Math.random() * 4000)
    }
    wander()

    // ゆらぎ
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let t = 0, raf = 0
    const drift = () => {
      if (!alive) return
      t += 0.012
      if (root.current) root.current.style.transform = `translateY(${Math.sin(t) * 6}px)`
      raf = requestAnimationFrame(drift)
    }
    if (!reduce) drift()

    return () => { alive = false; timers.forEach(clearTimeout); cancelAnimationFrame(raf) }
  }, [eyeSize])

  useEffect(() => {
    // 指を追う（ステージ全体で）
    const onMove = (e: PointerEvent | TouchEvent) => {
      if ((e.target as Element).closest('button, dialog')) return
      const p = 'touches' in e ? e.touches[0] : e
      const r = root.current?.getBoundingClientRect()
      if (!r || !p) return
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const clamp = (v: number) => Math.max(-1, Math.min(1, v))
      look(clamp((p.clientX - cx) / (innerWidth / 2)), clamp((p.clientY - cy) / (innerHeight / 2)))
      followUntil.current = Date.now() + 2500
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('touchmove', onMove, { passive: true })
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('touchmove', onMove) }
  }, [eyeSize])

  const poke = () => {
    if (moodRef.current === 'closed') return
    flash('wink', 260)
    look(0, 0)
    followUntil.current = Date.now() + 1500
    onPoke?.()
  }

  return (
    <div ref={root} class={`eyes ${mood}`} aria-hidden="true" onPointerDown={poke}>
      <div class="eye"><div class="pupil" ref={(el) => { if (el) pupils.current[0] = el }} /><div class="lid" /></div>
      <div class="eye"><div class="pupil" ref={(el) => { if (el) pupils.current[1] = el }} /><div class="lid" /></div>
    </div>
  )
}
