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
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const num = (k: 'interval' | 'breakLen' | 'eyeSize' | 'eyeGap', min: number) =>
    (e: Event) => onChange({ ...cfg, [k]: Math.max(min, Number((e.target as HTMLInputElement).value) || min) })
  const bool = (k: 'chatter' | 'wake') =>
    (e: Event) => onChange({ ...cfg, [k]: (e.target as HTMLInputElement).checked })

  return (
    <dialog ref={ref} onClose={onClose}>
      <form method="dialog">
        <h2>設定</h2>
        <label>声をかける間隔（分）
          <input id="s-interval" type="number" min={5} max={180} step={5} value={cfg.interval} onChange={num('interval', 5)} />
        </label>
        <label>休憩の長さ（分）
          <input id="s-break" type="number" min={1} max={60} step={1} value={cfg.breakLen} onChange={num('breakLen', 1)} />
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
