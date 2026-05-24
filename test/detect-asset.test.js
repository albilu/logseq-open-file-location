'use strict'

const { isLocalAsset } = require('../src/detect-asset')

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg)
}

// file:// URIs
assert(isLocalAsset('file:///home/user/notes/assets/doc.pdf') === true,  'file:// pdf')
assert(isLocalAsset('file:///C:/Users/me/doc.pdf') === true,             'file:// windows pdf')

// Relative paths with extensions
assert(isLocalAsset('../assets/file.pdf') === true,  'relative pdf')
assert(isLocalAsset('./img.png') === true,           'relative png')
assert(isLocalAsset('assets/audio.mp3') === true,   'bare relative mp3')

// .md files are excluded
assert(isLocalAsset('../pages/note.md') === false,  'md excluded')
assert(isLocalAsset('file:///home/user/note.md') === false, 'file:// md excluded')

// Remote / internal protocols
assert(isLocalAsset('http://example.com/file.pdf') === false,  'http excluded')
assert(isLocalAsset('https://example.com/f.png') === false,    'https excluded')
assert(isLocalAsset('logseq://graph/mypage') === false,        'logseq excluded')

// No extension
assert(isLocalAsset('notes/meeting') === false, 'no extension')

console.log('detect-asset: all assertions passed')
