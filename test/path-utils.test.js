'use strict'

const {
  stripFileProtocol,
  resolveAssetPath,
  normalizePath,
  buildOpenFileInFolderAction
} = require('../src/path-utils')

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg)
}

// --- stripFileProtocol ---
assert(stripFileProtocol('file:///home/user/file.pdf') === '/home/user/file.pdf',    'unix file://')
assert(stripFileProtocol('file:///C:/Users/me/file.pdf') === 'C:/Users/me/file.pdf', 'windows file://')
assert(stripFileProtocol('/already/absolute.pdf') === '/already/absolute.pdf',        'no-op non-file://')

// --- resolveAssetPath ---
// Relative paths
assert(
  resolveAssetPath('/home/user/notes', '../assets/doc.pdf') === '/home/user/notes/../assets/doc.pdf',
  'relative joined'
)
// Unix absolute
assert(
  resolveAssetPath('/home/user/notes', '/etc/file.pdf') === '/etc/file.pdf',
  'unix absolute passthrough'
)
// Windows absolute
assert(
  resolveAssetPath('/home/user/notes', 'C:/Users/me/file.pdf') === 'C:/Users/me/file.pdf',
  'windows absolute passthrough'
)
// Already absolute (as would be passed after stripFileProtocol)
assert(
  resolveAssetPath('/home/user/notes', '/home/user/file.pdf') === '/home/user/file.pdf',
  'already absolute'
)

// --- normalizePath ---
assert(normalizePath('/home/user/notes/../assets/doc.pdf') === '/home/user/assets/doc.pdf', 'resolve ..')
assert(normalizePath('/home/user/./notes/file.pdf') === '/home/user/notes/file.pdf',         'resolve .')
assert(normalizePath('/home/user/notes/file.pdf') === '/home/user/notes/file.pdf',           'no change')
// Windows-style (forward slashes after Logseq normalization)
assert(normalizePath('C:/Users/me/../docs/file.pdf') === 'C:/Users/docs/file.pdf', 'windows ..')
// Returns null for Unix root (empty stack)
assert(normalizePath('/..') === null, 'null for empty path')

// --- buildOpenFileInFolderAction ---
const action = buildOpenFileInFolderAction('/home/user/assets/doc.pdf')
assert(Array.isArray(action), 'action is array')
assert(action.length === 2, 'action has type and payload')
assert(action[0] === 'openFileInFolder', 'action uses openFileInFolder type')
assert(action[1] === '/home/user/assets/doc.pdf', 'action includes full file path')

console.log('path-utils: all assertions passed')
