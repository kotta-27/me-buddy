/**
 * インカメで様子を見る。映像は表示しない、送信しない。端末内で捨てる。
 *
 * level 'presence': 縮小フレームの差分と明るさだけ（ライブラリなし）
 * level 'face'    : 加えて MediaPipe Face Landmarker（WASM。初回ロード数秒）
 */
export type CameraLevel = 'off' | 'presence' | 'face'

export type Sense = {
  present: boolean      // 在席（動き or 顔）
  dark: boolean         // 部屋が暗い
  motion: number        // 0〜1 動きの量
  face: { x: number; y: number } | null  // 顔の位置 -1〜1（画面側から見た向き）
  eyesClosed: boolean   // 目を閉じている
  yawn: boolean         // 口が大きく開いている
  smile: boolean
  turned: boolean       // 顔が正面からそれている（うつむき・横向き）
}

type FaceLandmarker = import('@mediapipe/tasks-vision').FaceLandmarker

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export class Camera {
  private video = document.createElement('video')
  private canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
  private stream: MediaStream | null = null
  private prev: Uint8ClampedArray | null = null
  private timer = 0
  private raf = 0
  private landmarker: FaceLandmarker | null = null
  private lastMotionAt = Date.now()
  private lastFaceAt = 0
  private pitchBase: number[] = []
  level: CameraLevel = 'off'
  sense: Sense = { present: true, dark: false, motion: 0, face: null, eyesClosed: false, yawn: false, smile: false, turned: false }
  onSense: ((s: Sense) => void) | null = null
  onError: ((msg: string) => void) | null = null

  constructor() {
    this.video.playsInline = true; this.video.muted = true
    this.canvas.width = 32; this.canvas.height = 24
  }

  async start(level: CameraLevel) {
    if (level === 'off') { this.stop(); return }
    if (!this.stream) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false })
        this.video.srcObject = this.stream
        await this.video.play()
      } catch (e) {
        this.onError?.(e instanceof Error && e.name === 'NotAllowedError' ? 'カメラの許可がない' : 'カメラを開けない')
        this.stream = null
        return
      }
    }
    this.level = level
    clearInterval(this.timer)
    this.timer = window.setInterval(() => this.samplePresence(), 1000)
    if (level === 'face') this.loadFace()
    else { cancelAnimationFrame(this.raf); this.raf = 0 }
  }

  stop() {
    clearInterval(this.timer); cancelAnimationFrame(this.raf); this.raf = 0
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null; this.level = 'off'; this.prev = null
    this.landmarker?.close(); this.landmarker = null
  }

  get on() { return this.stream !== null }

  // ---- level 1: 動きと明るさ ----
  private samplePresence() {
    if (this.video.readyState < 2) return
    this.ctx.drawImage(this.video, 0, 0, 32, 24)
    const d = this.ctx.getImageData(0, 0, 32, 24).data
    let sum = 0, diff = 0
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3
      sum += l
      if (this.prev) diff += Math.abs(l - this.prev[i])
    }
    const n = d.length / 4
    const lum = sum / n
    const motion = this.prev ? Math.min(1, diff / n / 40) : 0
    this.prev = new Uint8ClampedArray(d)
    if (motion > 0.08) this.lastMotionAt = Date.now()
    const faceRecent = Date.now() - this.lastFaceAt < 5000
    const present = this.level === 'face' && this.landmarker ? faceRecent || Date.now() - this.lastMotionAt < 20_000 : Date.now() - this.lastMotionAt < 20_000
    this.emit({ dark: lum < 40, motion, present })
  }

  // ---- level 2: 顔 ----
  private async loadFace() {
    if (this.landmarker) { this.loopFace(); return }
    try {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')
      const files = await FilesetResolver.forVisionTasks(WASM)
      this.landmarker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO', numFaces: 1,
        outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      })
      if (this.level === 'face') this.loopFace()
    } catch {
      this.onError?.('顔検出を読み込めない。在席検知だけで続ける')
      this.level = 'presence'
    }
  }

  private lastTs = 0
  private loopFace() {
    const step = () => {
      if (this.level !== 'face' || !this.landmarker) return
      const now = performance.now()
      if (now - this.lastTs > 250 && this.video.readyState >= 2) {   // 4fps で十分
        this.lastTs = now
        try {
          const r = this.landmarker.detectForVideo(this.video, now)
          this.readFace(r)
        } catch { /* skip frame */ }
      }
      this.raf = requestAnimationFrame(step)
    }
    step()
  }

  private readFace(r: import('@mediapipe/tasks-vision').FaceLandmarkerResult) {
    const lm = r.faceLandmarks[0]
    if (!lm) { this.emit({ face: null, eyesClosed: false, yawn: false, smile: false, turned: false }); return }
    this.lastFaceAt = Date.now()
    const nose = lm[1]
    // インカメは鏡像。画面から見て右にいる人は x が小さい
    const face = { x: -(nose.x - 0.5) * 2, y: (nose.y - 0.5) * 2 }

    const bs = new Map(r.faceBlendshapes[0]?.categories.map((c) => [c.categoryName, c.score]) ?? [])
    const g = (k: string) => bs.get(k) ?? 0
    const eyesClosed = (g('eyeBlinkLeft') + g('eyeBlinkRight')) / 2 > 0.6
    const yawn = g('jawOpen') > 0.55
    const smile = (g('mouthSmileLeft') + g('mouthSmileRight')) / 2 > 0.55

    // 顔の向き：回転行列から pitch/yaw。起動直後の中央値を正面とみなす
    let turned = false
    const m = r.facialTransformationMatrixes[0]?.data
    if (m) {
      const pitch = Math.atan2(m[6], m[10]) * 180 / Math.PI
      const yaw = Math.atan2(-m[2], Math.hypot(m[6], m[10])) * 180 / Math.PI
      if (this.pitchBase.length < 20) this.pitchBase.push(pitch)
      const base = [...this.pitchBase].sort((a, b) => a - b)[Math.floor(this.pitchBase.length / 2)] ?? 0
      turned = Math.abs(pitch - base) > 22 || Math.abs(yaw) > 35
    }
    this.emit({ face, eyesClosed, yawn, smile, turned, present: true })
  }

  private emit(patch: Partial<Sense>) {
    this.sense = { ...this.sense, ...patch }
    this.onSense?.(this.sense)
  }
}
