const assert = require('assert')

const storage = (() => {
  const data = {}
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      data[key] = String(value)
    },
    removeItem(key) {
      delete data[key]
    },
    clear() {
      Object.keys(data).forEach(key => delete data[key])
    }
  }
})()

globalThis.localStorage = storage

const { getReadChapters, isChapterRead, markChapterAsRead } = require('../chapter-state')

assert.deepStrictEqual(getReadChapters(), {})
assert.strictEqual(isChapterRead('story-a', 'cap1'), false)
assert.strictEqual(markChapterAsRead('story-a', 'cap1'), true)
assert.strictEqual(isChapterRead('story-a', 'cap1'), true)
assert.deepStrictEqual(getReadChapters(), { 'story-a': { cap1: true } })

console.log('chapter-state tests passed')
