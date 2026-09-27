'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { fileURLToPath } = require('node:url')
const path = require('node:path')
const { parseReference, normalizePath, resolveAssetPath, containingDirectory, toFileUrl } = require('../index.js')

for (const [name, reference, expected] of [
  ['Unix URI', 'file:///home/me/file.pdf', '/home/me/file.pdf'],
  ['Windows URI', 'file:///C:/Users/me/file.pdf', 'C:/Users/me/file.pdf'],
  ['Windows assets URI', 'assets://C:/Users/me/file.pdf', 'C:/Users/me/file.pdf'],
  ['localhost authority', 'file://localhost/home/me/file.pdf', '/home/me/file.pdf'],
  ['UNC authority', 'file://server/share/file.pdf', '//server/share/file.pdf'],
  ['Logseq media URI', 'assets:///graph/assets/image.png', '/graph/assets/image.png'],
  ['encoded space', '../assets/report%20one.pdf', '../assets/report one.pdf'],
  ['encoded Unicode', '../assets/%C3%A9t%C3%A9.pdf', '../assets/été.pdf'],
  ['decode exactly once', 'file:///graph/percent%2520.pdf', '/graph/percent%20.pdf'],
  ['encoded filename punctuation', 'file:///graph/a%23b%3Fc%25.pdf', '/graph/a#b?c%.pdf'],
  ['fragment and query', '../assets/a.pdf?download=1#page=2', '../assets/a.pdf'],
  ['URI fragment', 'file:///graph/a.pdf#page=2', '/graph/a.pdf']
]) test(name, () => assert.equal(parseReference(reference).path, expected))

test('raw filesystem names retain literal percent, hash, and query characters', () => {
  assert.equal(parseReference('/graph/a%20#b?c.pdf', true).path, '/graph/a%20#b?c.pdf')
})

for (const prefix of ['../assets/', './assets/', 'assets/']) {
  test('graph asset reference ' + prefix, () => {
    assert.equal(resolveAssetPath('/graph', prefix + 'a.pdf', true), '/graph/assets/a.pdf')
    assert.equal(resolveAssetPath('/graph', prefix + 'a.pdf'), '/graph/assets/a.pdf')
  })
}

test('bare PDF embed uses assets while a generic relative link uses graph root', () => {
  assert.equal(resolveAssetPath('/graph', 'a.pdf', true), '/graph/assets/a.pdf')
  assert.equal(resolveAssetPath('/graph', 'docs/a.zip'), '/graph/docs/a.zip')
})

test('absolute paths need no graph', () => {
  assert.equal(resolveAssetPath(null, '/outside/a.pdf'), '/outside/a.pdf')
  assert.equal(resolveAssetPath(null, 'C:\\Users\\me\\a.pdf'), 'C:/Users/me/a.pdf')
  assert.equal(resolveAssetPath(null, '../assets/a.pdf'), null)
})

for (const input of ['C:\\Users\\me\\..\\a.pdf', '//server/share/graph/pages/../assets/a.pdf', '//server/share/../../a.pdf']) {
  test('Windows normalization agrees with node:path for ' + input, () => {
    assert.equal(normalizePath(input), path.win32.normalize(input).replace(/\\/g, '/'))
  })
}

test('network graph retains its server and share', () => {
  assert.equal(resolveAssetPath('//server/share/graph', '../assets/a.pdf'), '//server/share/graph/assets/a.pdf')
})

for (const input of ['/graph/A #?%/été.pdf', '/file.pdf', 'C:/A #?%/file.pdf', '//server/share/A #?%/file.pdf']) {
  test('fallback URL round trips the filename: ' + input, () => {
    const windows = !input.startsWith('/') || input.startsWith('//')
    const decoded = fileURLToPath(toFileUrl(input), { windows })
    assert.equal(windows ? decoded.replace(/\\/g, '/') : decoded, input)
  })
}

test('containing directories preserve filesystem roots', () => {
  assert.equal(containingDirectory('/a.pdf'), '/')
  assert.equal(containingDirectory('C:/a.pdf'), 'C:/')
  assert.equal(containingDirectory('//server/share/a.pdf'), '//server/share')
  assert.equal(normalizePath('/../'), '/')
  assert.equal(normalizePath('C:relative.pdf'), null)
})
