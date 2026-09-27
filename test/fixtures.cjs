'use strict'
const { createPlugin } = require('../index.js')

class Element {
  constructor(tag, attrs = {}, children = []) {
    this.tagName = tag.toUpperCase()
    this.attrs = attrs
    this.children = children
    for (const child of children) child.parentElement = this
    this.classList = { contains: name => (attrs.class || '').split(' ').includes(name) }
  }
  getAttribute(name) { return this.attrs[name] || null }
  setAttribute(name, value) { this.attrs[name] = value }
  removeAttribute(name) { delete this.attrs[name] }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim()
      if (part[0] === '.') return this.classList.contains(part.slice(1))
      if (part === '[role="button"]') return this.attrs.role === 'button'
      return this.tagName.toLowerCase() === part
    })
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child
      const result = child.querySelector(selector)
      if (result) return result
    }
    return null
  }
}

function events() {
  const listeners = new Map()
  return {
    listeners,
    addEventListener(type, callback, capture) {
      if (!listeners.has(type)) listeners.set(type, new Map())
      listeners.get(type).set(callback, capture)
    },
    removeEventListener(type, callback, capture) {
      if (listeners.get(type)?.has(callback) && listeners.get(type).get(callback) === capture) listeners.get(type).delete(callback)
    }
  }
}

function fixture(options = {}) {
  const calls = [], warnings = [], messages = []
  const document = events()
  document.media = []
  document.styles = new Set()
  document.querySelectorAll = () => document.media
  document.createElement = tag => {
    const element = new Element(tag)
    element.remove = () => document.styles.delete(element)
    return element
  }
  document.head = { appendChild(element) { document.styles.add(element) } }
  const apis = options.apis || {
    async doAction(action) {
      calls.push(action)
      if (action[0] === 'stat' && options.exists && !options.exists(action[1])) throw new Error('ENOENT: no such file')
    }
  }
  const window = { ...events(), document, apis }
  window.top = window.parent = window
  let unload
  let graphCalls = 0
  const logseq = {
    beforeunload(callback) { unload = callback },
    ready: async callback => callback(),
    App: {
      async getCurrentGraph() { graphCalls++; return options.graph ? options.graph() : { path: '/graph' } },
      async openExternalLink(uri) { calls.push(['external', uri]) }
    },
    Editor: { async getBlock(id) { return options.block?.(id) } },
    UI: { async showMsg(message) { messages.push(message) } }
  }
  const logger = { warn: (...args) => warnings.push(args), error: (...args) => warnings.push(args) }
  const environment = { logseq, window, document, logger }
  const plugin = createPlugin(environment)
  plugin.start()
  function click(target, modifiers = {}) {
    const event = {
      target, ctrlKey: true, metaKey: false, button: 0, ...modifiers,
      preventDefault() { this.defaultPrevented = true }, stopPropagation() { this.stopped = true }
    }
    for (const listener of [...(document.listeners.get('click')?.keys() || [])]) listener(event)
    return event
  }
  return { plugin, click, calls, messages, warnings, environment, document, window, unload: () => unload(), graphCalls: () => graphCalls }
}

module.exports = { Element, fixture }
