'use strict'

// Protocols that are never local assets (remote, internal, or inline data)
const EXCLUDED_PROTOCOLS = ['http://', 'https://', 'logseq://', 'data:']
// Matches the trailing file extension (e.g. ".pdf", ".png")
const EXT_RE = /\.\w+$/

function isLocalAsset(href) {
  if (!href) return false

  // file:// URIs are local — but exclude .md
  if (href.startsWith('file://')) {
    return !href.toLowerCase().endsWith('.md')
  }

  // Exclude remote / internal protocols
  for (const proto of EXCLUDED_PROTOCOLS) {
    if (href.startsWith(proto)) return false
  }

  // Must have a file extension, and it must not be .md
  const match = href.match(EXT_RE)
  if (!match) return false
  if (match[0].toLowerCase() === '.md') return false

  return true
}

module.exports = { isLocalAsset }
