const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export const chatter = () => pick([
  '水、飲んだ？', 'いいペース。', '肩、上がってない？', '見てるよ。',
  '一回、遠くを見よう。', '息、ゆっくり。', 'ちゃんと座れてる？',
])

export const nudge = (min: number) => pick([
  `もう${min}分。そろそろ休憩しない？`,
  `${min}分たったよ。ひと息いれよう。`,
  `${min}分、続いてる。目を休めよう。`,
])

export const back = () => pick(['おかえり。', 'いこうか。', 'つづき、やろう。'])
export const poke = () => pick(['なに？', 'がんばってるね。', 'ここにいるよ。'])
export const breakStart = () => 'ゆっくり。'
export const breakEnd = () => 'そろそろ、もどろうか。'
export const snoozed = () => '5分ね。'
export const asleep = () => pick(['寝てる？', 'おーい。', '目、閉じてるよ。'])
export const yawned = () => pick(['つられた。', 'ふぁ…', '眠い？'])
export const away = () => pick(['どこ行った？', '…', 'いってらっしゃい。'])
export const distracted = () => pick(['スマホ見てる？', 'こっち。', '戻っておいで。'])
export const dark = () => pick(['暗くない？', '電気つけよ。'])
