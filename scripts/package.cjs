'use strict'

const fs = require('node:fs')
const path = require('node:path')
function preparePackage(root = path.resolve(__dirname, '..')) {
  const target = path.join(root, 'dist', 'logseq-open-file-location')
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  for (const name of ['index.html', 'index.js', 'package.json', 'manifest.json', 'README.md', 'LICENSE', '24-05-2026 21-46.gif', 'vendor']) {
    fs.cpSync(path.join(root, name), path.join(target, name), { recursive: true })
  }
  return target
}
module.exports = { preparePackage }
if (require.main === module) console.log('Prepared ' + preparePackage())
