'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { Element, fixture } = require('./fixtures.cjs')
const a = (href, attrs = {}) => new Element('a', { 'data-href': href, ...attrs })
const revealed = f => f.calls.filter(call => call[0] === 'openFileInFolder').map(call => call[1])

for (const tag of ['img', 'audio', 'video']) test('modified click reveals embedded ' + tag, async () => {
  const f = fixture()
  const event = f.click(new Element(tag, { src: 'assets:///graph/assets/media%20one.' + (tag === 'img' ? 'png' : 'mp4') }))
  await f.plugin.whenIdle()
  assert.equal(event.defaultPrevented, true)
  assert.deepEqual(revealed(f), ['/graph/assets/media one.' + (tag === 'img' ? 'png' : 'mp4')])
})

test('image overlays reveal the image; action buttons retain their behavior', async () => {
  const image = new Element('img', { src: 'file:///graph/a.png' })
  const overlay = new Element('div', { class: 'asset-overlay' })
  const button = new Element('button', {}, [new Element('span')])
  new Element('div', { class: 'asset-container' }, [image, overlay, button])
  const f = fixture()
  assert.equal(f.click(overlay).defaultPrevented, true)
  assert.equal(f.click(button.children[0]).defaultPrevented, undefined)
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), ['/graph/a.png'])
})

test('media currentSrc and source children are supported', async () => {
  const f = fixture()
  const video = new Element('video', {}, [new Element('source', { src: 'file:///graph/video.mp4' })])
  f.click(video)
  const audio = new Element('audio', { src: 'blob:invalid' })
  audio.currentSrc = 'file:///graph/sound.wav'
  f.click(audio)
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), ['/graph/video.mp4', '/graph/sound.wav'])
})

test('external links take precedence over a nested local image', async () => {
  const image = new Element('img', { src: 'file:///graph/a.png' })
  new Element('a', { href: 'HTTPS://example.com/a.pdf' }, [image])
  const f = fixture()
  assert.equal(f.click(image).defaultPrevented, undefined)
  assert.equal(f.click(a('mailto:audit@example.com')).defaultPrevented, undefined)
  await f.plugin.whenIdle()
  assert.deepEqual(f.calls, [])
})

test('unmodified clicks, remote media, markdown pages, and non-primary clicks are untouched', async () => {
  const f = fixture()
  for (const [target, modifiers] of [
    [a('../assets/a.pdf'), { ctrlKey: false }],
    [new Element('audio', { src: 'file:///graph/a.wav' }), { ctrlKey: false }],
    [new Element('img', { src: 'https://example.com/a.png' }), {}],
    [a('file:///graph/note.md#section'), {}], [a('/graph/a.pdf'), { button: 1 }],
    [{}, {}]
  ]) assert.equal(f.click(target, modifiers).defaultPrevented, undefined)
  await f.plugin.whenIdle()
  assert.deepEqual(f.calls, [])
})

test('nested and text-node targets and Cmd-click reach the correct PDF', async () => {
  const span = new Element('span')
  const anchor = a('../assets/a%20b.pdf', { class: 'asset-ref is-pdf' })
  span.parentElement = anchor
  const f = fixture()
  const event = f.click({ parentElement: span }, { ctrlKey: false, metaKey: true })
  await f.plugin.whenIdle()
  assert.equal(event.defaultPrevented, true)
  assert.deepEqual(revealed(f), ['/graph/assets/a b.pdf'])
})

for (const reference of ['../assets/a.pdf', './assets/a.pdf', 'assets/a.pdf', 'a.pdf']) test('PDF embed resolution: ' + reference, async () => {
  const f = fixture()
  f.click(a(reference, { class: 'is-pdf' }))
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), ['/graph/assets/a.pdf'])
})

test('data-href prefers an existing literal filename over decoding it', async () => {
  const f = fixture({ exists: () => true })
  f.click(a('/graph/A%20#B?.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), ['/graph/A%20#B?.pdf'])
})

test('encoded absolute data-href falls back to the decoded path when the literal file does not exist', async () => {
  const f = fixture({ exists: path => path === '/graph/a b.pdf' })
  f.click(a('/graph/a%20b.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), ['/graph/a b.pdf'])
})

test('href URI punctuation decodes once and a fragment is not part of the file', async () => {
  const f = fixture()
  f.click(new Element('a', { href: 'file:///graph/a%2520%23b.pdf#page=2' }))
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), ['/graph/a%20#b.pdf'])
})

test('absolute file links work without querying the graph', async () => {
  const f = fixture({ graph: () => { throw new Error('no graph') } })
  f.click(a('/graph/a.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), ['/graph/a.pdf'])
  assert.equal(f.graphCalls(), 0)
})

for (const [href, expected] of [['localhost/graph/a.pdf', '/graph/a.pdf'], ['server/share/a.pdf', '//server/share/a.pdf'], ['server.example/share/a.pdf', '//server.example/share/a.pdf']]) {
  test('recovers a file authority stripped by Logseq only from the original block: ' + href, async () => {
    const link = new Element('a', { href, class: 'external-link' })
    new Element('div', { class: 'ls-block', blockid: 'block-1' }, [link])
    const f = fixture({ block: id => {
      assert.equal(id, 'block-1')
      return { content: '[Attachment](file://' + href + ')' }
    } })
    f.click(link)
    await f.plugin.whenIdle()
    assert.deepEqual(revealed(f), [expected])
    assert.equal(f.graphCalls(), 0)
  })
}

for (const content of ['[Local](localhost/graph/a.pdf)', '[Other](file://localhost/graph/a.pdf.backup)']) {
  test('does not invent file authorities for relative links: ' + content, async () => {
    const link = new Element('a', { href: 'localhost/graph/a.pdf' })
    new Element('div', { class: 'ls-block', blockid: 'block-1' }, [link])
    const f = fixture({ block: () => ({ content }) })
    f.click(link)
    await f.plugin.whenIdle()
    assert.deepEqual(revealed(f), ['/graph/localhost/graph/a.pdf'])
  })
}

test('unloading while looking up the original block cancels the click', async () => {
  let finish
  const link = new Element('a', { href: 'localhost/graph/a.pdf' })
  new Element('div', { class: 'ls-block', blockid: 'block-1' }, [link])
  const f = fixture({ block: () => new Promise(resolve => { finish = resolve }) })
  f.click(link)
  await f.unload()
  finish({ content: '[Attachment](file://localhost/graph/a.pdf)' })
  await f.plugin.whenIdle()
  assert.deepEqual(f.calls, [])
})

test('missing files produce a user message and never invoke reveal', async () => {
  const f = fixture({ exists: () => false })
  f.click(a('/graph/missing.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), [])
  assert.deepEqual(f.messages, ['File not found'])
})

test('Logseq Error return values from another realm are handled as failures', async () => {
  const calls = []
  const f = fixture({ apis: { async doAction(action) {
    calls.push(action)
    return vm.runInNewContext('new Error("ENOENT: no such file")')
  } } })
  f.click(a('/graph/missing.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(calls, [['stat', '/graph/missing.pdf']])
  assert.deepEqual(f.messages, ['File not found'])
})

for (const literalExists of [true, false]) test('doubly encoded Logseq media keeps an existing literal path: ' + literalExists, async () => {
  const f = fixture({ exists: path => path === '/graph/image one.png' || (literalExists && path === '/graph/image%20one.png') })
  f.click(new Element('img', { src: 'assets:///graph/image%2520one.png' }))
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), [literalExists ? '/graph/image%20one.png' : '/graph/image one.png'])
})

test('returned reveal errors use the folder fallback', async () => {
  const calls = []
  const f = fixture({ apis: {
    async doAction(action) { return action[0] === 'stat' ? {size:1} : new Error('reveal unavailable') },
    async openPath(dir) { calls.push(dir) }
  } })
  f.click(a('/graph/a.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(calls, ['/graph'])
})

test('unavailable graph produces a message without a native action', async () => {
  const f = fixture({ graph: () => null })
  f.click(a('../assets/a.pdf'))
  await f.plugin.whenIdle()
  assert.equal(f.messages.length, 1)
  assert.match(f.messages[0], /no graph/)
  assert.deepEqual(f.calls, [])
})

test('reveal rejection tries openPath before any external fallback', async () => {
  const calls = []
  const f = fixture({ apis: {
    async doAction(action) { calls.push(action); if (action[0] === 'openFileInFolder') throw new Error('reveal failed') },
    async openPath(dir) { calls.push(['openPath', dir]) }
  } })
  f.click(a('/graph/A#B/file.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(calls, [['stat', '/graph/A#B/file.pdf'], ['openFileInFolder', '/graph/A#B/file.pdf'], ['openPath', '/graph/A#B']])
  assert.deepEqual(f.calls, [])
})

test('both native fallbacks failing produces an encoded external folder URI', async () => {
  const f = fixture({ apis: {
    async doAction() { throw new Error('bridge unavailable') },
    async openPath() { return 'could not open' }
  } })
  f.click(a('/graph/A #?%/file.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(f.calls, [['external', 'file:///graph/A%20%23%3F%25']])
})

test('starting twice is idempotent and unloading restores click behavior', async () => {
  const f = fixture()
  f.plugin.start()
  assert.equal(f.document.listeners.get('click').size, 1)
  assert.equal(f.document.styles.size, 1)
  await f.unload()
  assert.equal(f.document.listeners.get('click').size, 0)
  assert.equal(f.document.listeners.get('keydown').size, 0)
  assert.equal(f.document.listeners.get('keyup').size, 0)
  assert.equal(f.document.styles.size, 0)
  assert.equal(f.window.listeners.get('blur').size, 0)
  assert.equal(f.window.listeners.get('unload').size, 0)
  assert.equal(f.click(a('/graph/a.pdf')).defaultPrevented, undefined)
  f.plugin.start()
  f.click(a('/graph/a.pdf'))
  await f.plugin.whenIdle()
  assert.deepEqual(revealed(f), ['/graph/a.pdf'])
})

test('native media controls bypass interception only while Ctrl/Cmd is held for local media', async () => {
  const local = new Element('audio', { src: 'file:///graph/sound.wav', controls: '' })
  const remote = new Element('video', { src: 'https://example.com/movie.mp4', controls: '' })
  const linked = new Element('video', { src: 'file:///graph/movie.mp4', controls: '' })
  new Element('a', { href: 'https://example.com/movie.mp4' }, [linked])
  const f = fixture()
  f.document.media = [local, remote, linked]
  const emit = (owner, name, event) => { for (const listener of owner.listeners.get(name).keys()) listener(event) }
  for (const modifier of ['ctrlKey', 'metaKey']) {
    emit(f.document, 'keydown', { [modifier]: true })
    assert.ok('data-open-file-location-controls' in local.attrs)
    assert.equal('data-open-file-location-controls' in remote.attrs, false)
    assert.equal('data-open-file-location-controls' in linked.attrs, false)
    emit(f.document, 'keyup', {})
    assert.equal('data-open-file-location-controls' in local.attrs, false)
  }
  emit(f.document, 'keydown', { ctrlKey: true })
  emit(f.window, 'blur', {})
  assert.equal('data-open-file-location-controls' in local.attrs, false)
  emit(f.document, 'keydown', { ctrlKey: true })
  await f.unload()
  assert.equal('data-open-file-location-controls' in local.attrs, false)
})

test('unloading cancels a pending graph lookup before native work', async () => {
  let finish
  const f = fixture({ graph: () => new Promise(resolve => { finish = resolve }) })
  f.click(a('../assets/a.pdf'))
  await f.unload()
  finish({ path: '/graph' })
  await f.plugin.whenIdle()
  assert.deepEqual(f.calls, [])
  assert.deepEqual(f.messages, [])
})

test('unloading cancels a pending stat and prevents fallbacks', async () => {
  let finish
  const calls = []
  const f = fixture({ apis: { doAction: action => { calls.push(action); return new Promise(resolve => { finish = resolve }) } } })
  f.click(a('/graph/a.pdf'))
  await f.unload()
  finish({ size: 1 })
  await f.plugin.whenIdle()
  assert.deepEqual(calls, [['stat', '/graph/a.pdf']])
})

test('the browser entry actually boots and registers SDK teardown', async () => {
  const f = fixture()
  await f.unload()
  const { logseq, window, document } = f.environment
  vm.runInNewContext(fs.readFileSync(require.resolve('../index.js'), 'utf8'), { logseq, window, document, URL, console })
  await Promise.resolve()
  assert.equal(document.listeners.get('click').size, 1)
  await f.unload()
  assert.equal(document.listeners.get('click').size, 0)
})
