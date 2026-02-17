chrome.contextMenus.create({
  id: 'startTypingPractice',
  title: 'Start Typing Practice',
  contexts: ['selection'],
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'startTypingPractice' && tab?.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['dist/content.js'],
    })
  }
})

chrome.commands.onCommand.addListener((command) => {
  if (command === 'start-typing-practice') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['dist/content.js'],
        })
      }
    })
  }
})
