export async function parseApiResponse(response, fallbackMessage) {
  const rawText = await response.text()
  const contentType = response.headers.get('content-type') || ''
  const isJsonLike = contentType.includes('application/json') || contentType.includes('text/json')

  let payload = null

  if (rawText) {
    if (isJsonLike) {
      try {
        payload = JSON.parse(rawText)
      } catch {
        payload = null
      }
    } else {
      try {
        payload = JSON.parse(rawText)
      } catch {
        payload = null
      }
    }
  }

  if (!response.ok) {
    const messageFromPayload = payload?.message || payload?.error
    const normalizedText = rawText.trim()
    const looksLikeHtml = normalizedText.startsWith('<')
    const looksLikeGenericServerError = /^A server error has occurred/i.test(normalizedText)
    const messageFromText = normalizedText && !looksLikeHtml && !looksLikeGenericServerError
      ? normalizedText
      : ''

    throw new Error(messageFromPayload || messageFromText || fallbackMessage)
  }

  if (!payload) {
    throw new Error(fallbackMessage)
  }

  return payload
}
