import { useEffect } from 'react'

const DEFAULT_ORIGIN = 'https://rentcar00.com'
const DEFAULT_IMAGE = `${DEFAULT_ORIGIN}/bbang-logo-square.png`

function upsertMeta(selector, createAttributes, content) {
  let element = document.head.querySelector(selector)

  if (!element) {
    element = document.createElement('meta')
    Object.entries(createAttributes).forEach(([key, value]) => {
      element.setAttribute(key, value)
    })
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

function upsertCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]')

  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }

  element.setAttribute('href', href)
}

export default function SeoHead({
  title,
  description,
  canonicalPath = '/',
  robots = 'index, follow, max-image-preview:large',
  ogTitle = title,
  ogDescription = description,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
}) {
  useEffect(() => {
    const canonicalUrl = new URL(canonicalPath, DEFAULT_ORIGIN).toString()

    document.documentElement.setAttribute('lang', 'ko')
    document.title = title

    upsertMeta('meta[name="description"]', { name: 'description' }, description)
    upsertMeta('meta[name="robots"]', { name: 'robots' }, robots)
    upsertCanonical(canonicalUrl)

    upsertMeta('meta[property="og:type"]', { property: 'og:type' }, ogType)
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, '빵빵카')
    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, ogTitle)
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, ogDescription)
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl)
    upsertMeta('meta[property="og:image"]', { property: 'og:image' }, ogImage)
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' }, '빵빵카 렌터카 예약 서비스')
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale' }, 'ko_KR')

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, ogTitle)
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, ogDescription)
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, ogImage)
  }, [canonicalPath, description, ogDescription, ogImage, ogTitle, ogType, robots, title])

  return null
}
