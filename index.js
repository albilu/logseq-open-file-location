'use strict'

// ---------------------------------------------------------------------------
// Local asset detection
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------

/**
 * Strip the file:// protocol prefix.
 * On Windows, file:///C:/... becomes C:/... (remove leading slash before drive letter).
 */
function stripFileProtocol(href) {
  if (!href.startsWith('file://')) return href
  let path = href.slice('file://'.length)
  // Windows: /C:/... -> C:/...
  if (/^\/[A-Za-z]:/.test(path)) {
    path = path.slice(1)
  }
  return path
}

/**
 * Given a graph root and an href, return the joined path (unnormalized).
 * If the href is already absolute, return it as-is.
 */
function resolveAssetPath(graphRoot, href) {
  if (href.startsWith('/')) return href            // Unix absolute
  if (/^[A-Za-z]:/.test(href)) return href        // Windows absolute
  return graphRoot + '/' + href                    // Relative
}

/**
 * Normalize a path by resolving .. and . segments.
 */
function normalizePath(absPath) {
  let prefix = ''
  let rest = absPath
  const winDrive = absPath.match(/^([A-Za-z]:)(.*)/)
  if (winDrive) {
    prefix = winDrive[1]
    rest = winDrive[2]
  }

  const stack = []
  for (const part of rest.split('/')) {
    if (part === '..') {
      if (stack.length > 0) stack.pop()
    } else if (part !== '.' && part !== '') {
      stack.push(part)
    }
  }

  const normalized = prefix + '/' + stack.join('/')
  if (normalized === '/') return null
  return normalized
}

function buildOpenFileInFolderAction(absPath) {
  return ['openFileInFolder', absPath]
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

async function openFileLocation(href) {
  let resolvedPath

  if (href.startsWith('file://')) {
    resolvedPath = stripFileProtocol(href)
  } else {
    const graph = await logseq.App.getCurrentGraph()
    if (!graph || !graph.path) {
      console.warn('[open-file-location] Could not get graph path — aborting')
      return
    }
    // data-href uses paths relative to the page file's directory (e.g. pages/ or journals/),
    // which is one level below graph.path.  Resolve from graph.path/pages so that
    // ../assets/... correctly expands to <graph-root>/assets/...
    resolvedPath = resolveAssetPath(graph.path + '/pages', href)
  }

  const normalizedPath = normalizePath(resolvedPath)
  if (!normalizedPath) {
    console.warn('[open-file-location] Path normalized to empty — aborting:', resolvedPath)
    return
  }

  // Derive the containing directory
  const dir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'))

  try {
    const apis = window.top && window.top.apis
    if (apis && typeof apis.doAction === 'function') {
      await apis.doAction(buildOpenFileInFolderAction(normalizedPath))
      return
    }
    // Fall back to opening the containing directory
    if (apis && typeof apis.openPath === 'function') {
      await apis.openPath(dir)
      return
    }
  } catch (e) {
    console.warn('[open-file-location] apis call failed:', e.message)
  }

  // Fallback: file:// URI via openExternalLink
  const uri = 'file:///' + (dir.startsWith('/') ? dir.slice(1) : dir)
  await logseq.App.openExternalLink(uri)
}

function handleClick(event) {
  if (!event.ctrlKey && !event.metaKey) return

  const anchor = event.target.closest('a')
  if (!anchor) return

  // Logseq stores the path in data-href, not href
  const href = anchor.getAttribute('data-href') || anchor.getAttribute('href')
  if (!href) return
  if (!isLocalAsset(href)) return

  event.preventDefault()
  event.stopPropagation()

  openFileLocation(href).catch((err) => {
    console.error('[open-file-location] Unexpected error:', err)
  })
}

async function main() {
  // Plugins run inside a sandboxed iframe; attach to window.top.document so
  // capture-phase listeners fire before Logseq's own handlers.
  let target = document
  const candidates = [window.top, window.parent]
  for (const w of candidates) {
    try {
      if (w && w !== window && w.document) {
        target = w.document
        break
      }
    } catch (e) { /* sandboxed, skip */ }
  }

  target.addEventListener('click', handleClick, true)
}

logseq.ready(main).catch(console.error)
