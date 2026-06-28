import fs from 'node:fs'
import process from 'node:process'

const REQUIRED_KAKAO_CSP_ORIGINS = [
  'https://developers.kakao.com',
  'https://dapi.kakao.com',
  'https://t1.daumcdn.net',
  'https://*.daumcdn.net',
  'https://*.kakaocdn.net',
]

const errors = []

const landingSource = fs.readFileSync('src/data/landing.js', 'utf8')
if (!/javascriptKey:\s*['"][^'"]+['"]/.test(landingSource)) {
  errors.push('Kakao JavaScript key is required in src/data/landing.js or must be migrated to a checked env variable.')
}

const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
const cspHeader = (vercelConfig.headers || [])
  .flatMap((entry) => entry.headers || [])
  .find((header) => header.key === 'Content-Security-Policy')

const csp = cspHeader?.value || ''
for (const origin of REQUIRED_KAKAO_CSP_ORIGINS) {
  if (!csp.includes(origin)) {
    errors.push(`Content-Security-Policy must allow Kakao Maps origin: ${origin}`)
  }
}

if (errors.length) {
  console.error('External integration check failed:')
  for (const message of errors) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

console.log('External integration check passed. Kakao Developers domain registration still requires runtime/browser verification.')
