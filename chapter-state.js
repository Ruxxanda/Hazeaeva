(function(root, factory){
  const api = factory()
  if(typeof module !== 'undefined' && module.exports){
    module.exports = api
  }
  root.ChapterState = api
  root.getReadChapters = api.getReadChapters
  root.isChapterRead = api.isChapterRead
  root.markChapterAsRead = api.markChapterAsRead
  root.clearReadChapters = api.clearReadChapters
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  const STORAGE_KEY = 'hazeaeva-read-chapters'

  function getStorage(){
    try {
      const storage = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : (typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null)
      return storage || null
    } catch (error) {
      return null
    }
  }

  function getReadChapters(){
    const storage = getStorage()
    if(!storage) return {}
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if(!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
      return {}
    }
  }

  function isChapterRead(storyId, chapterId){
    if(!storyId || !chapterId) return false
    const readChapters = getReadChapters()
    const storyData = readChapters[storyId]
    return !!(storyData && storyData[chapterId])
  }

  function markChapterAsRead(storyId, chapterId){
    if(!storyId || !chapterId) return false
    const storage = getStorage()
    if(!storage) return false
    const readChapters = getReadChapters()
    const storyData = readChapters[storyId] && typeof readChapters[storyId] === 'object'
      ? readChapters[storyId]
      : {}
    storyData[chapterId] = true
    readChapters[storyId] = storyData
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(readChapters))
      return true
    } catch (error) {
      return false
    }
  }

  function clearReadChapters(){
    const storage = getStorage()
    if(!storage) return false
    try {
      storage.removeItem(STORAGE_KEY)
      return true
    } catch (error) {
      return false
    }
  }

  return {
    getReadChapters,
    isChapterRead,
    markChapterAsRead,
    clearReadChapters
  }
})
