const toggle = document.getElementById('debug-toggle') as HTMLInputElement

chrome.storage.local.get('debug', ({ debug }) => {
  toggle.checked = !!debug
})

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ debug: toggle.checked })
})
