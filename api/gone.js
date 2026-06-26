export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  res.status(410).send('Gone')
}
