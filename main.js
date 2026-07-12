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

function initNav(){
  const nav = qs('#page-nav')
  const backButton = qs('#nav-back-button')
  if(!nav || !backButton) return

  backButton.addEventListener('click', event => {
    event.stopPropagation()
    const params = new URLSearchParams(location.search)
    const story = params.get('story')
    if(document.body.classList.contains('read-page')){
      if(story){
        location.href = `story.html?story=${encodeURIComponent(story)}`
      } else {
        location.href = 'story.html'
      }
      return
    }

    if(document.body.classList.contains('story-details-page')){
      location.href = 'index.html'
      return
    }
  })

  if(document.body.classList.contains('read-page')){
    nav.classList.add('hidden')
    let navTimeout = null
    const showNav = () => {
      nav.classList.remove('hidden')
      if(navTimeout){
        window.clearTimeout(navTimeout)
      }
      navTimeout = window.setTimeout(() => nav.classList.add('hidden'), 5000)
    }

    const handleTopTap = event => {
      if(event.target.closest('#page-nav')) return
      const y = event.changedTouches?.[0]?.clientY ?? event.clientY
      if(y <= 50){
        showNav()
      }
    }

    document.addEventListener('click', handleTopTap)
    document.addEventListener('touchend', handleTopTap)
  }
}

// Index page: list stories
async function initIndex(){
  const grid = qs('#stories-grid')
  const stories = await loadJSON('history/stories.json')
  if(!stories || !stories.length){
    grid.innerHTML = '<p>Истории не найдены.</p>'
    return
  }

  // Render cards with cover and metadata (load per-story meta)
  for(const story of stories){
    const info = await loadJSON(`history/${encodeURIComponent(story.id)}/date.json`)
    const cover = buildStoryCoverPath(story.id, info?.cover)
    const title = info?.title || story.title || story.id
    const author = info?.author || ''

    const a = document.createElement('a')
    a.className = 'story-card'
    a.href = `story.html?story=${encodeURIComponent(story.id)}`

    a.innerHTML = `
      <div class="story-card-img-wrap"><img class="story-card-img" src="${cover}" alt="${escapeHtml(title)}"></div>
      <div class="story-card-body">
        <h3 class="story-card-title">${escapeHtml(title)}</h3>
        <div class="story-card-author">${escapeHtml(author)}</div>
      </div>
    `

    grid.appendChild(a)
  }
  // Always keep a placeholder card at the end so the grid layout remains consistent.
  const placeholder = document.createElement('div')
  placeholder.className = 'story-card story-card-empty'
  placeholder.setAttribute('data-placeholder', 'true')
  placeholder.setAttribute('aria-hidden', 'true')
  placeholder.textContent = 'Здесь может быть ваша история.'
  grid.appendChild(placeholder)
}

function buildStoryCoverPath(storyId, explicitCover){
  if(explicitCover) return explicitCover
  return `history/${encodeURIComponent(storyId)}/poze/fundal/coperta.png`
}

function escapeHtml(text){
  if(!text) return ''
  return String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch])
}

// Story details page: show metadata and chapters
async function initStoryDetails(){
  const params = new URLSearchParams(location.search)
  const story = params.get('story')
  if(!story){
    document.body.innerHTML = '<p>История не указана.</p>'
    return
  }

  function applyReadStateToChapterItem(chapter, li){
    const chapterId = chapter?.id
    if(!chapterId) return
    const isRead = isChapterRead(story, chapterId)
    li.classList.toggle('chapter-read', isRead)
    li.setAttribute('data-read', isRead ? 'true' : 'false')
    const link = li.querySelector('a')
    if(link){
      link.classList.toggle('chapter-link-read', isRead)
    }
  }

  const info = await loadJSON(`history/${encodeURIComponent(story)}/date.json`)
  const chapters = await loadJSON(`history/${encodeURIComponent(story)}/chapters.json`)
  const titleEl = qs('#story-title')
  const authorEl = qs('#story-author')
  const descEl = qs('#story-description')
  const coverEl = qs('#story-cover')
  const listEl = qs('#chapters-list')
  const readButton = qs('#read-button')
  const storyLinkEl = qs('#story-link')

  if(!info){
    document.body.innerHTML = '<p>Детали истории не найдены.</p>'
    return
  }

  titleEl.textContent = info.title || story
  authorEl.textContent = info.author ? `Автор: ${info.author}` : ''
  descEl.textContent = info.description || 'Описание для этой истории отсутствует.'
  if(coverEl){
    coverEl.src = buildStoryCoverPath(story, info?.cover)
    coverEl.alt = info.title || story
  }

  if(storyLinkEl){
    const storyLink = info?.link?.trim()
    if(storyLink){
      storyLinkEl.href = storyLink
      storyLinkEl.hidden = false
    } else {
      storyLinkEl.hidden = true
      storyLinkEl.removeAttribute('href')
    }
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
    applyReadStateToChapterItem(chapter, li)
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
  const sceneOverlay = qs('#scene-overlay')
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
  const sceneKeys = Object.keys(data || {})
    .filter(key => /^scena\d+$/i.test(key))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/), 10) || 0
      const nb = parseInt(b.match(/\d+/), 10) || 0
      return na - nb
    })
  let currentSceneIndex = 0
  let currentSceneTextEntries = []
  let currentEntryIndex = 0
  let currentEntryText = ''
  let entryState = 'idle'
  let revealInterval = null
  let nextSceneOnComplete = false

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
        const img = entry.image || entry.characterImage || ''
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

  function applySceneMood(sceneData){
    const color = String(sceneData?.color || '').trim().toLowerCase()
    const isNightScene = color === '#000000' || color === 'black'

    if(sceneOverlay){
      sceneOverlay.classList.toggle('visible', isNightScene)
    }

    if(background){
      const currentFilter = background.style.filter || ''
      if(isNightScene){
        background.style.filter = currentFilter.includes('brightness') ? currentFilter : 'brightness(0.74) saturate(0.9)'
      } else {
        background.style.filter = currentFilter.includes('brightness') ? 'blur(0)' : 'blur(0)'
      }
    }
  }

  function stopReveal(){
    if(revealInterval){
      window.clearInterval(revealInterval)
      revealInterval = null
    }
  }

  function hidePhonePanel(){
    phonePanel.classList.remove('visible')
    phonePanel.hidden = true
    phoneNextButton.hidden = true
  }

  function resetDisplay(){
    dialogue.classList.remove('visible')
    character.classList.remove('visible')
    dialogue.classList.remove('dialogue-center')
    dialogue.style.filter = 'blur(6px)'
    character.style.filter = 'blur(6px)'
    character.style.display = 'none'
    charName.style.display = 'none'
    textEl.textContent = ''
    hidePhonePanel()
  }

  function finishReveal(){
    if(entryState !== 'revealing') return
    stopReveal()
    entryState = 'complete'
    textEl.textContent = currentEntryText
    dialogue.classList.add('visible')
    character.classList.add('visible')
    dialogue.style.filter = ''
    character.style.filter = ''
  }

  function typeDialogueText(fullText){
    stopReveal()
    currentEntryText = fullText
    textEl.textContent = ''
    entryState = 'revealing'
    dialogue.classList.add('visible')
    character.classList.add('visible')
    dialogue.style.filter = ''
    character.style.filter = ''
    const delay = 24
    let index = 0
    revealInterval = window.setInterval(() => {
      index += 1
      textEl.textContent = fullText.slice(0, index)
      if(index >= fullText.length){
        stopReveal()
        entryState = 'complete'
      }
    }, delay)
  }

  function showPhoneEntry(entry){
    const messages = Array.isArray(entry.mesaje) ? entry.mesaje : []
    const phoneContact = qs('.phone-contact')
    phoneMessages.innerHTML = ''

    if(phoneContact){
      phoneContact.textContent = entry?.nikname || 'Kontakt'
    }

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

    hidePhonePanel()
    phonePanel.hidden = false
    requestAnimationFrame(() => {
      phonePanel.classList.add('visible')
    })
    entryState = 'complete'
  }

  function showEntry(index){
    const entry = currentSceneTextEntries[index]
    if(!entry) return

    currentEntryIndex = index
    entryState = 'exiting'
    resetDisplay()

    window.setTimeout(() => {
      const entryName = entry.name || ''
      const isNarration = isNarrationName(entryName)
      const isPhoneEntry = entryName.trim().toLowerCase() === 'telefon' || Array.isArray(entry.mesaje)
      const position = (entry.position || data.position || 'center').toLowerCase()
      const entryText = entry.content ?? entry.text ?? ''
      const imageSrc = (entry.image || entry.characterImage || '').toString()
      const resolvedImageSrc = imageSrc ? new URL(imageSrc, location.href).href : ''

      if(isPhoneEntry){
        charName.textContent = ''
        textEl.textContent = ''
        showPhoneEntry(entry)
        return
      }

      if(isNarration){
        charName.textContent = ''
        charName.style.display = 'none'
        dialogue.classList.add('dialogue-center')
        dialogue.classList.remove('name-left', 'name-right')
        character.style.display = 'none'
        character.src = ''
        typeDialogueText(entryText)
        return
      }

      charName.textContent = entryName
      charName.style.display = 'block'
      dialogue.classList.remove('dialogue-center')
      textEl.textContent = ''

      character.className = `character ${position}`
      dialogue.classList.remove('name-left', 'name-right')
      if(position === 'left'){
        dialogue.classList.add('name-left')
        charName.style.right = 'auto'
        charName.style.left = '24px'
      } else if(position === 'right'){
        dialogue.classList.add('name-right')
        charName.style.left = 'auto'
        charName.style.right = '24px'
      } else {
        charName.style.right = '24px'
        charName.style.left = 'auto'
      }

      if(imageSrc){
        character.style.display = 'block'
        character.onload = () => {
          if(character.src === resolvedImageSrc || character.currentSrc === resolvedImageSrc){
            character.classList.add('visible')
          }
        }
        character.onerror = () => {
          character.style.display = 'none'
          character.classList.remove('visible')
        }
        character.src = resolvedImageSrc
      } else {
        character.style.display = 'none'
        character.classList.remove('visible')
        character.src = ''
      }

      typeDialogueText(entryText)
    }, 10)
  }

  function updateEndButtonVisibility(index){
    if(!endButton) return
    const sceneKey = sceneKeys[index] || ''
    const isFinalScene = /^scena100$/i.test(sceneKey) || /^scene100$/i.test(sceneKey)
    endButton.hidden = !isFinalScene
  }

  function showScene(index){
    const sceneData = scenes[index]
    if(!sceneData) return

    currentSceneIndex = index
    currentSceneTextEntries = normalizeTextEntries(sceneData)
    currentEntryIndex = 0
    updateEndButtonVisibility(index)

    setBackground(sceneData.background || sceneData.backgroundImage || '', () => {
      applySceneMood(sceneData)
      if(currentSceneTextEntries.length){
        showEntry(0)
      } else {
        resetDisplay()
        textEl.textContent = sceneData.text || sceneData.content || ''
        dialogue.classList.add('visible')
      }
    })
  }

  let chapterTransitioned = false

  function navigateBackToStory(){
    if(chapterTransitioned) return
    chapterTransitioned = true
    markCurrentChapterAsRead()
    location.href = `story.html?story=${encodeURIComponent(story)}`
  }

  function goToNext(){
    if(entryState === 'revealing'){
      finishReveal()
      return
    }

    if(entryState !== 'complete'){
      return
    }

    const entries = currentSceneTextEntries
    if(entries.length > 1 && currentEntryIndex < entries.length - 1){
      showEntry(currentEntryIndex + 1)
      return
    }

    if(currentSceneIndex < scenes.length - 1){
      showScene(currentSceneIndex + 1)
      return
    }
  }

  let lastTouchTime = 0

  function handleSceneTap(event){
    const target = event.target
    const targetElement = target && typeof target.closest === 'function'
      ? target
      : (target && target.parentElement ? target.parentElement : null)

    if(targetElement && (targetElement.closest('#phone-panel') || targetElement.closest('#phone-next-button') || targetElement.closest('#end-button'))){
      return
    }

    if(event.type === 'touchend'){
      const y = event.changedTouches?.[0]?.clientY
      // If touch is within the top 50px, allow propagation so nav handler can run
      if(typeof y === 'number' && y <= 50){
        return
      }
      event.preventDefault()
      event.stopPropagation()
      lastTouchTime = Date.now()
      goToNext()
      return
    }

    if(event.type === 'click' && Date.now() - lastTouchTime < 500){
      return
    }

    goToNext()
  }

  function markCurrentChapterAsRead(){
    if(!story || !chapter) return
    markChapterAsRead(story, chapter)
  }

  if(endButton){
    endButton.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      navigateBackToStory()
    })
  }

  scene.addEventListener('click', handleSceneTap)
  scene.addEventListener('touchend', handleSceneTap)

  preloadChapterAssets()
    .then(() => {
      if(loadingOverlay) loadingOverlay.style.display = 'none'
      if(scenes.length){
        showScene(0)
      } else {
        resetDisplay()
        textEl.textContent = data.text || data.content || ''
        dialogue.classList.add('visible')
      }
    })
    .catch(() => {
      if(loadingOverlay) loadingOverlay.style.display = 'none'
      if(scenes.length){
        showScene(0)
      } else {
        resetDisplay()
        textEl.textContent = data.text || data.content || ''
        dialogue.classList.add('visible')
      }
    })
}

document.addEventListener('DOMContentLoaded', ()=>{
  initNav()
  if(document.body.classList.contains('index-page')) initIndex()
  if(document.body.classList.contains('story-details-page')) initStoryDetails()
  if(document.body.classList.contains('read-page')) initRead()
})
