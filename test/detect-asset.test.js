'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { isLocalAsset } = require('../index.js')

for (const href of [
  'file:///home/me/file.pdf', 'FILE:///C:/Users/me/a.pdf', '../assets/a.pdf', './a.png',
  'assets/audio.mp3', 'assets:///graph/image.png', '/graph/a.pdf', 'C:\\Users\\me\\a.pdf',
  '//server/share/a.pdf', 'file://server/share/a.pdf', '../assets/a.pdf#page=2',
  'file:///graph/a.pdf?download=1', '../assets/%C3%A9t%C3%A9.pdf'
]) test('recognizes local reference ' + href, () => assert.equal(isLocalAsset(href), true))

for (const href of [
  undefined, '', 'notes/meeting', '../pages/note.md', 'file:///graph/note.MD#section',
  '../pages/note.md?raw=1', 'file:///graph/note%2Emd', 'HTTP://example.com/a.pdf',
  'https://example.com/a.pdf', 'HTTPS://example.com/a.pdf', 'mailto:audit@example.com',
  'FTP://example.com/a.zip', 'logseq://graph/note.pdf', 'LoGsEq://graph/note.pdf',
  'zotero://open-pdf/library/a.pdf', 'data:image/png;base64,a.png', 'blob:file:///a.pdf',
  'javascript:alert(1)//a.pdf', 'lsp://logseq.io/plugin/index.html', 'C:relative.pdf',
  'file:///graph/', 'file:///graph/%00.pdf', '../assets/a%2Fb.pdf', '../assets/a%ZZ.pdf'
]) test('ignores non-assets or malformed references: ' + href, () => assert.equal(isLocalAsset(href), false))
