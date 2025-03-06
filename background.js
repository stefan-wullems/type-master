// Create context menu option
chrome.contextMenus.create({
    id: "startTypingPractice",
    title: "Start Typing Practice",
    contexts: ["selection"]
  });
  
  // Handle context menu click
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "startTypingPractice") {
      // Inject content.js into the active tab
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    }
  });
  
  chrome.commands.onCommand.addListener((command) => {
    if (command === "start-typing-practice") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"]
        });
      });
    }
  });