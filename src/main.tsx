import { render } from 'preact'
import { App } from './App'
import { play } from './Eyes'
import './style.css'

// 確認用: me.play('doze') などで演目を再生
;(window as unknown as { me: unknown }).me = { play }

// デモ（LP 埋め込み）: 指カーソルと、押した場所に波紋
if (new URLSearchParams(location.search).has('demo')) {
  document.body.classList.add('demo')
  let held: HTMLDivElement | null = null
  const at = (el: HTMLDivElement, e: PointerEvent) => { el.style.left = `${e.clientX}px`; el.style.top = `${e.clientY}px` }
  window.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button, dialog')) return
    const r = document.createElement('div'); r.className = 'ripple'; at(r, e); document.body.appendChild(r)
    setTimeout(() => r.remove(), 600)
    held = document.createElement('div'); held.className = 'ripple hold'; at(held, e); document.body.appendChild(held)
    const h = held; requestAnimationFrame(() => h.classList.add('on'))
  })
  window.addEventListener('pointermove', (e) => { if (held) at(held, e) })
  const end = () => { held?.remove(); held = null }
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
}

render(<App />, document.getElementById('app')!)
