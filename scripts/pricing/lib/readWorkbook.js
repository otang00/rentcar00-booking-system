'use strict'

const { execFileSync } = require('child_process')

function readZipEntry(filePath, entryName) {
  try {
    return execFileSync('unzip', ['-p', filePath, entryName], { encoding: 'utf8' })
  } catch (error) {
    return ''
  }
}

function extractAll(regex, text) {
  return Array.from(String(text || '').matchAll(regex), (match) => match)
}

function decodeXml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function readSharedStrings(filePath) {
  const xml = readZipEntry(filePath, 'xl/sharedStrings.xml')
  if (!xml) return []

  return extractAll(/<si>([\s\S]*?)<\/si>/g, xml).map((match) => {
    const inner = match[1]
    const texts = extractAll(/<t[^>]*>([\s\S]*?)<\/t>/g, inner).map((part) => decodeXml(part[1]))
    return texts.join('')
  })
}

function readWorkbookSheets(filePath) {
  const workbookXml = readZipEntry(filePath, 'xl/workbook.xml')
  const relsXml = readZipEntry(filePath, 'xl/_rels/workbook.xml.rels')
  const relMap = new Map(
    extractAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g, relsXml)
      .map((match) => [match[1], match[2]]),
  )

  return extractAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g, workbookXml)
    .map((match) => ({
      name: decodeXml(match[1]),
      target: `xl/${relMap.get(match[2])}`,
    }))
}

function columnFromRef(ref = '') {
  const match = String(ref).match(/^[A-Z]+/)
  return match ? match[0] : ''
}

function readCellValue(cellXml, sharedStrings) {
  const type = (cellXml.match(/\st="([^"]+)"/) || [])[1] || ''
  const sharedIndex = (cellXml.match(/<v>(\d+)<\/v>/) || [])[1]
  if (type === 's' && sharedIndex != null) {
    return sharedStrings[Number(sharedIndex)] || ''
  }

  const inlineTexts = extractAll(/<t[^>]*>([\s\S]*?)<\/t>/g, cellXml).map((match) => decodeXml(match[1]))
  if (inlineTexts.length > 0) {
    return inlineTexts.join('')
  }

  const rawValue = (cellXml.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
  return decodeXml(rawValue || '')
}

function readSheetRows(filePath, target, sharedStrings) {
  const xml = readZipEntry(filePath, target)
  const rows = []

  for (const rowMatch of extractAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g, xml)) {
    const rowXml = rowMatch[1]
    const row = {}

    for (const cellMatch of extractAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g, rowXml)) {
      const attrs = cellMatch[1]
      const cellInner = cellMatch[2]
      const ref = (attrs.match(/\sr="([^"]+)"/) || [])[1] || ''
      const col = columnFromRef(ref)
      row[col] = String(readCellValue(`<c ${attrs}>${cellInner}</c>`, sharedStrings)).trim()
    }

    rows.push(row)
  }

  return rows
}

function readWorkbook(filePath) {
  const sharedStrings = readSharedStrings(filePath)
  const sheets = readWorkbookSheets(filePath)

  return sheets.map((sheet) => ({
    name: sheet.name,
    rows: readSheetRows(filePath, sheet.target, sharedStrings),
  }))
}

module.exports = {
  readWorkbook,
}
