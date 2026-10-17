// 使い方: npm run release -- <patch|minor|major> "<一行の要約>"
// package.json の version を上げ、CHANGELOG.md に見出しを足し、コミットしてタグを打つ。push は手動。
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const [kind, summary] = process.argv.slice(2)
if (!['patch', 'minor', 'major'].includes(kind) || !summary) {
  console.error('usage: npm run release -- <patch|minor|major> "<summary>"'); process.exit(1)
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const [a, b, c] = pkg.version.split('.').map(Number)
const next = kind === 'major' ? `${a + 1}.0.0` : kind === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`
pkg.version = next
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

const today = new Date().toISOString().slice(0, 10)
const log = readFileSync('CHANGELOG.md', 'utf8')
const entry = `## ${next} — ${today}\n\n- ${summary}\n\n`
writeFileSync('CHANGELOG.md', log.replace(/^(# [^\n]*\n\n)/, `$1${entry}`))

execSync('git add package.json CHANGELOG.md', { stdio: 'inherit' })
execSync(`git commit -q -m "v${next}: ${summary}"`, { stdio: 'inherit' })
execSync(`git tag -a v${next} -m "${summary}"`, { stdio: 'inherit' })
console.log(`v${next} committed and tagged. push with: git push && git push --tags`)
