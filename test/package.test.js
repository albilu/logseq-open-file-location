'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { preparePackage } = require('../scripts/package.cjs')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')

test('release payload contains a complete offline entry and its documentation assets', () => {
  // Build from an isolated copy so tests do not overwrite a developer's dist/.
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'open-file-location-package-'))
  try {
    for (const name of ['index.html', 'index.js', 'package.json', 'manifest.json', 'README.md', 'LICENSE', '24-05-2026 21-46.gif', 'vendor', 'scripts']) {
      fs.cpSync(path.join(root, name), path.join(copy, name), { recursive: true })
    }
    const payload = preparePackage(copy)
    const pkg = JSON.parse(fs.readFileSync(path.join(payload, 'package.json')))
    assert.equal(pkg.main, 'index.html')
    const html = fs.readFileSync(path.join(payload, pkg.main), 'utf8')
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1])
    assert.deepEqual(scripts, ['vendor/lsplugin.user.js', 'index.js'])
    for (const script of scripts) assert.ok(fs.existsSync(path.join(payload, script)), script)
    assert.ok(fs.readFileSync(path.join(payload, 'index.js')).equals(fs.readFileSync(path.join(root, 'index.js'))))
    const provenance = JSON.parse(fs.readFileSync(path.join(payload, 'vendor/sdk.json')))
    assert.equal(provenance.version, pkg.devDependencies['@logseq/libs'])
    for (const [name, expected] of Object.entries(provenance.sha256)) {
      const actual = createHash('sha256').update(fs.readFileSync(path.join(payload, 'vendor', name))).digest('hex')
      assert.equal(actual, expected, name)
    }
    const readme = fs.readFileSync(path.join(payload, 'README.md'), 'utf8')
    for (const match of readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(payload, decodeURIComponent(match[1]))))
    assert.ok(fs.existsSync(path.join(payload, 'vendor/lsplugin.user.js.LICENSE.txt')))
    assert.ok(fs.readFileSync(path.join(payload, 'LICENSE')).equals(fs.readFileSync(path.join(root, 'LICENSE'))))
    assert.equal(fs.existsSync(path.join(payload, 'node_modules')), false)
  } finally {
    fs.rmSync(copy, { recursive: true, force: true })
  }
})
