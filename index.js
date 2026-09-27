'use strict'

// This is both the browser entry and the module exercised by the Node tests.
;(() => {
  const DRIVE = /^[A-Za-z]:[\\/]/
  const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/

  function isAbsolutePath(path) {
    return path.startsWith('/') || path.startsWith('\\\\') || DRIVE.test(path)
  }

  function normalizePath(path) {
    if (typeof path !== 'string' || /[\0\r\n]/.test(path)) return null
    if (DRIVE.test(path) || path.startsWith('\\\\')) path = path.replace(/\\/g, '/')
    let root
    let rest
    if (DRIVE.test(path)) {
      root = path.slice(0, 2) + '/'
      rest = path.slice(3)
    } else if (/^\/\/[^/]/.test(path)) {
      const match = path.match(/^\/\/([^/]+)\/([^/]+)(?:\/(.*))?$/)
      if (!match || [match[1], match[2]].some(part => part === '.' || part === '..')) return null
      root = '//' + match[1] + '/' + match[2] + '/'
      rest = match[3] || ''
    } else if (path.startsWith('/')) {
      root = '/'
      rest = path.slice(1)
    } else {
      return null
    }
    const parts = []
    for (const part of rest.split('/')) {
      if (part === '..') parts.pop()
      else if (part && part !== '.') parts.push(part)
    }
    return root + parts.join('/')
  }

  function parseReference(value, rawPath = false) {
    if (typeof value !== 'string' || !value || /[\0\r\n]/.test(value)) return null
    const scheme = !DRIVE.test(value) && value.match(SCHEME)
    if (scheme && !/^(file|assets)$/i.test(scheme[1])) return null

    let path = value
    if (scheme) {
      // Logseq's assets: URLs use the same filesystem roots as file: URLs.
      const fileUrl = value.replace(/^(?:file|assets):/i, 'file:')
        .replace(/^file:\/\/([A-Za-z]:\/)/, 'file:///$1')
      try {
        const url = new URL(fileUrl)
        if (/%2f|%5c/i.test(url.pathname)) return null
        path = decodeURIComponent(url.pathname)
        if (url.hostname && url.hostname.toLowerCase() !== 'localhost') {
          path = '//' + url.hostname + path
        } else if (/^\/[A-Za-z]:\//.test(path)) {
          path = path.slice(1)
        }
      } catch (_) {
        return null
      }
    } else if (!rawPath) {
      path = value.split(/[?#]/, 1)[0]
      if (/%2f|%5c/i.test(path)) return null
      try {
        path = decodeURIComponent(path)
      } catch (_) {
        return null
      }
    }
    if (!path || /[\0\r\n]/.test(path) || /[\\/]$/.test(path)) return null
    const extension = path.match(/\.([\w-]+)$/)
    if (extension && extension[1].toLowerCase() === 'md') return null
    if (!extension && !scheme) return null
    return { path, absolute: isAbsolutePath(path) }
  }

  function isLocalAsset(value) {
    return parseReference(value) !== null
  }

  function resolveAssetPath(graphRoot, path, assetRelative = false) {
    if (isAbsolutePath(path)) return normalizePath(path)
    if (!graphRoot || !isAbsolutePath(graphRoot)) return null
    // Logseq accepts ../assets, ./assets and assets against the graph root.
    let relative = path.replace(/\\/g, '/').replace(/^(?:\.\.?\/)+/, '')
    // PDF embeds also accept a filename relative to the assets directory.
    if (assetRelative && !relative.startsWith('assets/')) relative = 'assets/' + relative
    return normalizePath(graphRoot + '/' + relative)
  }

  function containingDirectory(path) {
    const dir = path.slice(0, path.lastIndexOf('/'))
    return !dir ? '/' : /^[A-Za-z]:$/.test(dir) ? dir + '/' : dir
  }

  function toFileUrl(path) {
    const normalized = normalizePath(path)
    if (!normalized) throw new Error('Could not resolve local file path')
    const encode = value => value.split('/').map(encodeURIComponent).join('/')
    if (normalized.startsWith('//')) {
      const slash = normalized.indexOf('/', 2)
      return 'file://' + normalized.slice(2, slash) + encode(normalized.slice(slash))
    }
    if (DRIVE.test(normalized)) return 'file:///' + normalized.slice(0, 2) + encode(normalized.slice(2))
    return 'file://' + encode(normalized)
  }

  function getAssetReference(event) {
    const target = event.target?.closest ? event.target : event.target?.parentElement
    if (!target?.closest) return null
    const anchor = target.closest('a')
    let value
    let rawPath = false
    let assetRelative = false
    let sourceFileUri
    if (anchor) {
      // A linked image belongs to its link, including an external link.
      value = anchor.getAttribute('data-href') || anchor.getAttribute('href')
      rawPath = !!anchor.getAttribute('data-href') && !!value && isAbsolutePath(value)
      assetRelative = anchor.classList.contains('is-pdf')
      // Logseq can strip file:// from an authority URL while rendering it.
      // Keep the block identity so we can confirm the original URI, rather
      // than guessing that an ordinary relative path names a file server.
      if (value && !isAbsolutePath(value) && !SCHEME.test(value) && /^[^./\\][^/\\]*\//.test(value)) {
        const blockId = anchor.closest('.ls-block')?.getAttribute('blockid')
        if (blockId) sourceFileUri = { blockId, value }
      }
    } else {
      let media = target.closest('img, audio, video')
      if (!media && !target.closest('button, input, select, textarea, [role="button"]')) {
        // Logseq puts a clickable overlay over rendered images.
        media = target.closest('.asset-container')?.querySelector('img, audio, video')
      }
      if (!media) return null
      value = media.currentSrc || media.getAttribute('src') || media.querySelector('source')?.getAttribute('src')
    }
    const candidates = []
    const primary = parseReference(value, rawPath)
    if (primary) candidates.push(primary)
    if (rawPath) {
      // Some Logseq anchors retain encoded references in data-href. Prefer an
      // existing literal filename; only try decoding if that path is missing.
      const decoded = parseReference(value)
      if (decoded && decoded.path !== primary?.path) candidates.push(decoded)
    } else if (/^assets:/i.test(value) && primary && /%[0-9a-f]{2}/i.test(primary.path) && !/%2f|%5c/i.test(primary.path)) {
      // Logseq may escape an already-encoded image reference a second time.
      // Only use this alternative after stat confirms the literal path is absent.
      try {
        const decoded = parseReference(decodeURIComponent(primary.path), true)
        if (decoded && decoded.path !== primary.path) candidates.push(decoded)
      } catch (_) { /* Keep the valid literal filename. */ }
    }
    return candidates.length ? { candidates, assetRelative, sourceFileUri } : null
  }

  function findHost(window, document) {
    for (const candidate of [window.top, window.parent, window]) {
      try {
        if (candidate?.document) return { document: candidate.document, window: candidate, apis: candidate.apis }
      } catch (_) { /* Try the accessible parent if the top frame is isolated. */ }
    }
    return { document, window }
  }

  function createPlugin({ logseq, window, document, logger = console }) {
    let host
    let active = false
    let generation = 0
    const pending = new Set()
    const mediaControls = new Set()
    let controlsStyle
    const current = token => active && token === generation

    function updateMediaControls(event) {
      for (const media of mediaControls) media.removeAttribute('data-open-file-location-controls')
      mediaControls.clear()
      if (!active || (!event?.ctrlKey && !event?.metaKey)) return
      // Chromium's native player controls swallow mouse events inside their
      // closed shadow tree. While the modifier is held, let local-media clicks
      // reach the audio/video element. Remote players and normal controls stay
      // interactive, and releasing the modifier or losing focus restores them.
      for (const media of host.document.querySelectorAll('audio[controls], video[controls]')) {
        if (!getAssetReference({ target: media })) continue
        media.setAttribute('data-open-file-location-controls', '')
        mediaControls.add(media)
      }
    }

    function stop() {
      active = false
      generation++
      host?.document.removeEventListener('click', handleClick, true)
      host?.document.removeEventListener('keydown', updateMediaControls, true)
      host?.document.removeEventListener('keyup', updateMediaControls, true)
      host?.window.removeEventListener('blur', updateMediaControls)
      updateMediaControls()
      controlsStyle?.remove()
      controlsStyle = null
      window.removeEventListener('unload', stop)
    }

    async function reportError(error, token) {
      if (!current(token)) return
      logger.warn('[open-file-location]', error)
      try {
        await logseq.UI?.showMsg(error.message || 'Could not open file location', 'warning')
      } catch (_) { /* The console still contains the original error. */ }
    }

    async function openFileLocation(reference, token) {
      const { apis } = host
      const candidates = [...reference.candidates]
      if (reference.sourceFileUri && logseq.Editor?.getBlock) {
        const { blockId, value } = reference.sourceFileUri
        try {
          const block = await logseq.Editor.getBlock(blockId)
          if (!current(token)) return
          const uri = 'file://' + value
          const escaped = uri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          if (new RegExp('(?:^|[\\s(\\[])' + escaped + '(?=$|[\\s)\\]>])').test(block?.content || '')) {
            const original = parseReference(uri)
            if (original) candidates.splice(0, candidates.length, original)
          }
        } catch (_) { /* The rendered reference is still usable if the block is unavailable. */ }
        if (!current(token)) return
      }
      async function doAction(action) {
        const result = await apis.doAction(action)
        // Some Logseq IPC handlers return Error objects instead of rejecting.
        // They belong to another frame, so instanceof Error is not reliable.
        if (result && typeof result.message === 'string') throw new Error(result.message)
        return result
      }
      let graph
      if (candidates.some(candidate => !candidate.absolute)) {
        graph = await logseq.App.getCurrentGraph()
        if (!current(token)) return
        if (!graph?.path) throw new Error('Could not resolve local file path: no graph is open')
      }

      let path
      for (const candidate of candidates) {
        path = resolveAssetPath(graph?.path, candidate.path, reference.assetRelative)
        if (!path) throw new Error('Could not resolve local file path')
        if (typeof apis?.doAction !== 'function') break
        try {
          await doAction(['stat', path])
          if (!current(token)) return
          break
        } catch (error) {
          if (!current(token)) return
          if (/ENOENT|ENOTDIR|no such file/i.test(String(error))) {
            path = null
            continue
          }
          if (/EACCES|EPERM/i.test(String(error))) throw new Error('Could not access local file')
          // Older or unavailable bridges may not support stat. The independent
          // reveal/folder fallbacks below must still get a chance to run.
          break
        }
      }
      if (!path) throw new Error('File not found')
      if (!current(token)) return

      if (typeof apis?.doAction === 'function') {
        try {
          await doAction(['openFileInFolder', path])
          return
        } catch (error) {
          if (!current(token)) return
          logger.warn('[open-file-location] Reveal failed:', error)
        }
      }
      const dir = containingDirectory(path)
      if (typeof apis?.openPath === 'function') {
        try {
          const error = await apis.openPath(dir)
          if (!error) return
          logger.warn('[open-file-location] Open directory failed:', error)
        } catch (error) {
          if (!current(token)) return
          logger.warn('[open-file-location] Open directory failed:', error)
        }
      }
      if (!current(token)) return
      await logseq.App.openExternalLink(toFileUrl(dir))
    }

    function handleClick(event) {
      if (!active || (!event.ctrlKey && !event.metaKey) || (event.button != null && event.button !== 0)) return
      const reference = getAssetReference(event)
      if (!reference) return
      event.preventDefault()
      event.stopPropagation()
      const token = generation
      const operation = openFileLocation(reference, token).catch(error => reportError(error, token))
      pending.add(operation)
      operation.finally(() => pending.delete(operation))
    }

    function start() {
      stop()
      host = findHost(window, document)
      active = true
      controlsStyle = host.document.createElement('style')
      controlsStyle.textContent = 'audio[data-open-file-location-controls]::-webkit-media-controls, video[data-open-file-location-controls]::-webkit-media-controls { pointer-events: none !important; }'
      host.document.head.appendChild(controlsStyle)
      logseq.beforeunload(async () => stop())
      window.addEventListener('unload', stop)
      host.document.addEventListener('click', handleClick, true)
      host.document.addEventListener('keydown', updateMediaControls, true)
      host.document.addEventListener('keyup', updateMediaControls, true)
      host.window.addEventListener('blur', updateMediaControls)
    }

    return { start, stop, handleClick, whenIdle: () => Promise.all([...pending]) }
  }

  const api = { normalizePath, parseReference, isLocalAsset, resolveAssetPath, containingDirectory, toFileUrl, getAssetReference, createPlugin }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  } else {
    const plugin = createPlugin({ logseq, window, document })
    logseq.ready(plugin.start).catch(console.error)
  }
})()
