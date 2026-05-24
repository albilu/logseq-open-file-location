'use strict'

/**
 * Strip the file:// protocol prefix.
 * On Windows, file:///C:/... becomes C:/... (remove leading slash before drive letter).
 * Only strips the leading '/' when the remaining string matches ^/[A-Za-z]: (Windows drive path).
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
 * Note: file:// URIs must be stripped by the caller before passing here.
 * Note: graphRoot should not have a trailing slash; if it does, normalizePath
 *       will clean up the resulting double-slash via empty-segment filtering.
 */
function resolveAssetPath(graphRoot, href) {
  // Unix absolute
  if (href.startsWith('/')) return href
  // Windows absolute
  if (/^[A-Za-z]:/.test(href)) return href
  // Relative: join with graph root
  return graphRoot + '/' + href
}

/**
 * Normalize a path by resolving .. and . segments.
 * Works with forward-slash paths (as returned by Logseq on all platforms).
 *
 * Excess '..' segments at the root level are silently clamped (dropped),
 * not treated as errors.
 *
 * Returns null only for the Unix root path '/' (empty stack after normalization).
 * Windows drive root (e.g. 'C:/') is not treated as null — it is a valid path.
 *
 * Note: Logseq.App.getCurrentGraph().path is assumed to return POSIX-style
 * forward-slash paths on all platforms — this is an empirical assumption.
 */
function normalizePath(absPath) {
  // Preserve Windows drive prefix if present
  let prefix = ''
  let rest = absPath
  const winDrive = absPath.match(/^([A-Za-z]:)(.*)/)
  if (winDrive) {
    prefix = winDrive[1]
    rest = winDrive[2]
  }

  const parts = rest.split('/')
  const stack = []
  for (const part of parts) {
    if (part === '..') {
      if (stack.length > 0) stack.pop()
      // else: navigating above root — ignore silently
    } else if (part !== '.' && part !== '') {
      stack.push(part)
    }
  }

  const normalized = prefix + '/' + stack.join('/')
  if (normalized === '/') return null  // empty result — caller should abort
  return normalized
}

function buildOpenFileInFolderAction(absPath) {
  return ['openFileInFolder', absPath]
}

module.exports = {
  stripFileProtocol,
  resolveAssetPath,
  normalizePath,
  buildOpenFileInFolderAction
}
