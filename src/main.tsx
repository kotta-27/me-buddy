import { render } from 'preact'
import { App } from './App'
import { play } from './Eyes'
import './style.css'

// 確認用: me.play('doze') などで演目を再生
;(window as unknown as { me: unknown }).me = { play }

render(<App />, document.getElementById('app')!)
