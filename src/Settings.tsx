import { useEffect, useRef } from 'preact/hooks'
import type { Config } from './store'
import type { CameraLevel } from './camera'

type Props = {
  open: boolean
  cfg: Config
  onChange: (c: Config) => void
  onClose: () => void
  onReset: () => void
}

export function Settings({ open, cfg, onChange, onClose, onReset }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const intervalRef = useRef<HTMLInputElement>(null)
  const breakRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (intervalRef.current) intervalRef.current.value = String(cfg.interval)
      if (breakRef.current) breakRef.current.value = String(cfg.breakLen)
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open])

  // 数値欄は閉じる時にまとめて反映（親が毎秒再描画するので、入力中に値を縛らない）
  const commit = () => {
    const n = (el: HTMLInputElement | null, d: number, lo: number, hi: number) => {
      const v = Number(el?.value)
      return Number.isFinite(v) && el?.value !== '' ? Math.min(hi, Math.max(lo, v)) : d
    }
    const next = { ...cfg, interval: n(intervalRef.current, cfg.interval, 5, 180), breakLen: n(breakRef.current, cfg.breakLen, 1, 60) }
    if (next.interval !== cfg.interval || next.breakLen !== cfg.breakLen) onChange(next)
    onClose()
  }
  const num = (k: 'eyeSize' | 'eyeGap', min: number) =>
    (e: Event) => onChange({ ...cfg, [k]: Math.max(min, Number((e.target as HTMLInputElement).value) || min) })
  const bool = (k: 'chatter' | 'wake') =>
    (e: Event) => onChange({ ...cfg, [k]: (e.target as HTMLInputElement).checked })

  return (
    <dialog ref={ref} onClose={commit}>
      <form method="dialog">
        <h2>設定</h2>
        <label>声をかける間隔（分）
          <input id="s-interval" ref={intervalRef} type="number" inputMode="numeric" min={5} max={180} step={5} />
        </label>
        <label>休憩の長さ（分）
          <input id="s-break" ref={breakRef} type="number" inputMode="numeric" min={1} max={60} step={1} />
        </label>
        <label>目の大きさ
          <input id="s-size" type="range" min={50} max={160} step={5} value={cfg.eyeSize} onInput={num('eyeSize', 50)} />
        </label>
        <label>目の間隔
          <input id="s-gap" type="range" min={20} max={220} step={5} value={cfg.eyeGap} onInput={num('eyeGap', 20)} />
        </label>
        <label class="inline"><input id="s-chatter" type="checkbox" checked={cfg.chatter} onChange={bool('chatter')} />ときどき独り言を言う</label>
        <label class="inline"><input id="s-wake" type="checkbox" checked={cfg.wake} onChange={bool('wake')} />画面を消さない</label>
        <label>カメラで様子を見る（映像は表示も送信もしない）
          <select id="s-camera" value={cfg.camera} onChange={(e) => onChange({ ...cfg, camera: (e.target as HTMLSelectElement).value as CameraLevel })}>
            <option value="off">使わない</option>
            <option value="presence">在席と明るさだけ（軽い）</option>
            <option value="face">顔も見る（目で追う・居眠り・あくび）</option>
          </select>
        </label>
        <p class="hint">目をタップで反応。画面をなでると目で追う。</p>
        <div class="row">
          <button type="button" onClick={onReset}>今日の合計をリセット</button>
          <button type="submit" class="primary">閉じる</button>
        </div>
      </form>
    </dialog>
  )
}
