'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '..')
const pkg = require('../package.json')
const lock = require('../package-lock.json')
const installed = require('@logseq/libs/package.json')
const expected = pkg.devDependencies['@logseq/libs']
if (installed.version !== expected) throw new Error('Installed SDK does not match the pinned version')
const source = path.dirname(require.resolve('@logseq/libs'))
const dest = path.join(root, 'vendor')
const check = process.argv.includes('--check')
const hashes = {}
for (const name of ['lsplugin.user.js', 'lsplugin.user.js.LICENSE.txt']) {
  const content = fs.readFileSync(path.join(source, name))
  hashes[name] = crypto.createHash('sha256').update(content).digest('hex')
  if (check) {
    if (!fs.readFileSync(path.join(dest, name)).equals(content)) throw new Error('Vendored SDK differs: ' + name)
  } else {
    fs.mkdirSync(dest, { recursive: true })
    fs.writeFileSync(path.join(dest, name), content)
  }
}
const provenance = JSON.stringify({
  package: '@logseq/libs', version: expected,
  tarball: lock.packages['node_modules/@logseq/libs'].resolved,
  integrity: lock.packages['node_modules/@logseq/libs'].integrity,
  sha256: hashes
}, null, 2) + '\n'
if (check) {
  if (fs.readFileSync(path.join(dest, 'sdk.json'), 'utf8') !== provenance) throw new Error('SDK provenance differs')
} else {
  fs.writeFileSync(path.join(dest, 'sdk.json'), provenance)
}
console.log('Logseq SDK ' + expected + ': ' + (check ? 'verified' : 'vendored'))
