function qs(sel){return document.querySelector(sel)}

async function loadJSON(path){
  try {
    const response = await fetch(path)
    if(!response.ok) throw new Error(response.status)
    return await response.json()
  } catch (error) {
    console.error('Failed to load', path, error)
    return null
  }
}

async function loadJSONWithFallback(paths){
  for (const path of paths){
    const data = await loadJSON(path)
    if(data) return data
  }
  return null
}

function isNarrationName(name){
  return !name || name.trim().toLowerCase() === 'no'
}

function normalizeTextEntries(data){
  const raw = Array.isArray(data?.text) ? data.text : []
  if(raw.length) return raw
  if(data?.content || data?.text){
    return [{
      name: data.characterName || data.name || '',
      content: data.content || data.text || '',
      image: data.characterImage || data.image || ''
    }]
  }
  return []
}

function getSceneEntries(data){
  if(Array.isArray(data)) return data
  if(Array.isArray(data?.scenes)) return data.scenes

  const sceneKeys = Object.keys(data || {})
    .filter(key => /^scena\d+$/i.test(key))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/), 10) || 0
      const nb = parseInt(b.match(/\d+/), 10) || 0
      return na - nb
    })

  if(sceneKeys.length){
    return sceneKeys.flatMap(key => Array.isArray(data[key]) ? data[key] : [])
  }

  return [data]
}

// Index page: list stories
async function initIndex(){
  const list = qs('#stories-list')
  const stories = await loadJSON('history/stories.json')
  if(!stories || !stories.length){
    list.innerHTML = '<li>Истории не найдены.</li>'
    return
  }

  stories.forEach(story => {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = `story.html?story=${encodeURIComponent(story.id)}`
    a.textContent = story.title
    li.appendChild(a)
    list.appendChild(li)
  })
}

// Story details page: show metadata and chapters
async function initStoryDetails(){
  const params = new URLSearchParams(location.search)
  const story = params.get('story')
  if(!story){
    document.body.innerHTML = '<p>История не указана.</p>'
    return
  }

  const info = await loadJSON(`history/${encodeURIComponent(story)}/date.json`)
  const chapters = await loadJSON(`history/${encodeURIComponent(story)}/chapters.json`)
  const titleEl = qs('#story-title')
  const authorEl = qs('#story-author')
  const descEl = qs('#story-description')
  const coverEl = qs('#story-cover')
  const listEl = qs('#chapters-list')
  const readButton = qs('#read-button')

  if(!info){
    document.body.innerHTML = '<p>Детали истории не найдены.</p>'
    return
  }

  titleEl.textContent = info.title || story
  authorEl.textContent = info.author ? `Автор: ${info.author}` : ''
  descEl.textContent = info.description || 'Описание для этой истории отсутствует.'
  if(coverEl){
    coverEl.src = info.cover || 'images/fundal/coperta.png'
    coverEl.alt = info.title || story
  }

  if(!chapters || !chapters.length){
    listEl.innerHTML = '<li>Главы не найдены.</li>'
    readButton.disabled = true
    readButton.textContent = 'Главы недоступны'
    return
  }

  chapters.forEach((chapter, index) => {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = `read.html?story=${encodeURIComponent(story)}&chapter=${encodeURIComponent(chapter.id)}`
    a.textContent = chapter.title || `Глава ${index + 1}`
    li.appendChild(a)
    listEl.appendChild(li)
  })

  readButton.addEventListener('click', () => {
    location.href = `read.html?story=${encodeURIComponent(story)}&chapter=${encodeURIComponent(chapters[0].id)}`
  })
}

// Read page: show chapter with background, character, name, and text
async function initRead(){
  const params = new URLSearchParams(location.search)
  const story = params.get('story')
  const chapter = params.get('chapter')
  if(!story || !chapter){
    document.body.innerHTML = '<p>История или глава не указаны.</p>'
    return
  }

  const loadingOverlay = qs('#loading-overlay')
  const background = qs('#background')
  const character = qs('#character')
  const charName = qs('#char-name')
  const textEl = qs('#text')
  const dialogue = qs('#dialogue')
  const phonePanel = qs('#phone-panel')
  const phoneMessages = qs('#phone-messages')
  const phoneNextButton = qs('#phone-next-button')
  const scene = qs('#scene')
  const endButton = qs('#end-button')

  if(loadingOverlay) loadingOverlay.style.display = 'flex'

  const chapters = await loadJSON(`history/${encodeURIComponent(story)}/chapters.json`)
  const chapterSegments = chapter.split('/').filter(Boolean)
  const chapterPath = chapterSegments.map(segment => encodeURIComponent(segment)).join('/')
  const data = await loadJSONWithFallback([
    `history/${encodeURIComponent(story)}/${chapterPath}.json`,
    `history/${encodeURIComponent(story)}/${chapterPath}/data.json`,
    `history/${encodeURIComponent(story)}/${encodeURIComponent(chapter)}/data.json`
  ])

  if(!data){
    document.body.innerHTML = '<p>Данные главы не найдены.</p>'
    return
  }

  const scenes = getSceneEntries(data)
  let currentSceneIndex = 0
  let currentSceneTextEntries = []
  let currentEntryIndex = 0

  function preloadImage(src){
    if(!src) return Promise.resolve()
    return new Promise((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = src
    })
  }

  async function preloadChapterAssets(){
    const imageUrls = new Set()

    scenes.forEach(sceneItem => {
      const sceneBackground = sceneItem?.background || sceneItem?.backgroundImage || ''
      if(sceneBackground) imageUrls.add(sceneBackground)

      const entries = normalizeTextEntries(sceneItem)
      entries.forEach(entry => {
        const img = entry.image || entry.characterImage || data.characterImage || ''
        if(img) imageUrls.add(img)
      })
    })

    await Promise.all(Array.from(imageUrls).map(url => preloadImage(url)))
  }

  function setBackground(src, onReady){
    if(!src){
      background.style.opacity = '0'
      background.style.display = 'none'
      if(onReady) onReady()
      return
    }

    background.style.transition = 'opacity 0.6s ease, filter 0.6s ease'
    background.style.opacity = '0'
    background.style.filter = 'blur(4px)'
    background.onload = () => {
      background.style.display = 'block'
      requestAnimationFrame(() => {
        background.style.opacity = '1'
        background.style.filter = 'blur(0)'
        if(onReady) onReady()
      })
    }
    background.onerror = () => {
      background.style.display = 'none'
      background.style.opacity = '0'
      if(onReady) onReady()
    }
    background.src = src
  }

  function showEntry(index, entries = currentSceneTextEntries){
    const entry = entries[index]
    if(!entry){
      textEl.textContent = ''
      return
    }

    currentEntryIndex = index
    const entryName = entry.name || ''
    const isNarration = isNarrationName(entryName)
    const isPhoneEntry = entryName.trim().toLowerCase() === 'telefon' || Array.isArray(entry.mesaje)
    const position = (entry.position || data.position || 'center').toLowerCase()

    const hidePhonePanel = () => {
      phonePanel.classList.remove('visible')
      phonePanel.hidden = true
      phoneNextButton.hidden = true
    }

    const fadeOut = () => {
      dialogue.classList.remove('visible')
      character.classList.remove('visible')
      dialogue.style.filter = 'blur(6px)'
      character.style.filter = 'blur(6px)'
      hidePhonePanel()
    }

    const fadeIn = () => {
      dialogue.style.filter = 'blur(0)'
      character.style.filter = 'blur(0)'
      window.setTimeout(() => {
        dialogue.classList.add('visible')
        if(!isNarration){
          character.classList.add('visible')
        }
      }, 10)
    }

    const showNarration = () => {
      character.src = ''
      character.style.display = 'none'
      character.className = 'character'
      charName.textContent = ''
      charName.style.display = 'none'
      dialogue.classList.remove('dialogue-center')
      dialogue.classList.add('dialogue-center')
      textEl.textContent = entry.content || entry.text || ''
      fadeIn()
    }

    const showPhoneMessages = () => {
      const messages = Array.isArray(entry.mesaje) ? entry.mesaje : []
      phoneMessages.innerHTML = ''

      messages.forEach(message => {
        const row = document.createElement('div')
        row.className = `phone-message-row ${message.position === 'right' ? 'right' : 'left'}`

        const name = document.createElement('div')
        name.className = 'phone-message-name'
        name.textContent = message.name || ''

        const bubble = document.createElement('div')
        bubble.className = 'phone-message-bubble'
        bubble.textContent = message.content || ''

        row.appendChild(name)
        row.appendChild(bubble)
        phoneMessages.appendChild(row)
      })

      phonePanel.hidden = false
      phoneNextButton.hidden = false
      requestAnimationFrame(() => {
        phonePanel.classList.add('visible')
      })

      dialogue.classList.remove('visible')
      character.classList.remove('visible')
      charName.textContent = ''
      charName.style.display = 'none'
      textEl.textContent = ''
      dialogue.classList.remove('dialogue-center')
    }

    const applyEntry = () => {
      if(isPhoneEntry){
        showPhoneMessages()
        return
      }

      if(isNarration){
        showNarration()
        return
      }

      const imageSrc = entry.image || data.characterImage || ''
      character.className = `character ${position}`
      character.style.display = 'block'
      character.src = imageSrc

      character.onload = () => {
        fadeIn()
      }
      character.onerror = () => {
        character.style.display = 'none'
        character.classList.remove('visible')
      }

      charName.textContent = entryName
      charName.style.display = 'block'
      dialogue.classList.remove('dialogue-center')
      textEl.textContent = entry.content || entry.text || ''
      fadeIn()
    }

    fadeOut()
    const delay = 450
    window.setTimeout(applyEntry, delay)
  }

  function showScene(index){
    const scene = scenes[index]
    if(!scene) return

    currentSceneIndex = index
    currentSceneTextEntries = normalizeTextEntries(scene)
    currentEntryIndex = 0

    setBackground(scene.background || scene.backgroundImage || '', () => {
      if(currentSceneTextEntries.length){
        showEntry(0, currentSceneTextEntries)
      } else {
        textEl.textContent = scene.text || scene.content || ''
      }
    })
  }

  preloadChapterAssets()
    .then(() => {
      if(loadingOverlay) loadingOverlay.style.display = 'none'
      if(scenes.length){
        showScene(0)
      } else {
        textEl.textContent = data.text || data.content || ''
      }
    })
    .catch(() => {
      if(loadingOverlay) loadingOverlay.style.display = 'none'
      if(scenes.length){
        showScene(0)
      } else {
        textEl.textContent = data.text || data.content || ''
      }
    })

  const showEndButton = () => {
    endButton.hidden = false
  }

  const hideEndButton = () => {
    endButton.hidden = true
  }

  endButton.addEventListener('click', (event) => {
    event.stopPropagation()
    location.href = `story.html?story=${encodeURIComponent(story)}`
  })

  const goToNext = () => {
    const entries = currentSceneTextEntries
    if(entries.length > 1 && currentEntryIndex < entries.length - 1){
      hideEndButton()
      showEntry(currentEntryIndex + 1, entries)
      return
    }

    if(currentSceneIndex < scenes.length - 1){
      hideEndButton()
      showScene(currentSceneIndex + 1)
      return
    }

    if(!chapters || !chapters.length){
      showEndButton()
      return
    }

    // After finishing a chapter, always go back to the story page.
    showEndButton()
  }

  scene.addEventListener('click', (event) => {
    const target = event.target
    if(target.closest('#phone-panel') || target.closest('#phone-next-button')){
      return
    }
    goToNext()
  })

  scene.addEventListener('touchend', (event) => {
    const target = event.target
    if(target.closest('#phone-panel') || target.closest('#phone-next-button')){
      return
    }
    goToNext()
  })

  phoneNextButton.addEventListener('click', (event) => {
    event.stopPropagation()
    goToNext()
  })

  hideEndButton()
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(document.body.classList.contains('index-page')) initIndex()
  if(document.body.classList.contains('story-details-page')) initStoryDetails()
  if(document.body.classList.contains('read-page')) initRead()
})
