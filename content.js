// Normalize interchangeable characters
function normalizeChar(char) {
  const map = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-' };
  return map[char] || char;
}

// Find the closest block-level ancestor
function getClosestBlockAncestor(node) {
  let current = node;
  while (current && current.nodeType === 1) {
    if (window.getComputedStyle(current).display === 'block') return current;
    current = current.parentNode;
  }
  return document.body;
}

// Get all text nodes within a range, filtering out empty ones
function getTextNodesInRange(range) {
  const textNodes = [];
  const startNode = range.startContainer;
  const endNode = range.endContainer;

  // If selection is within a single text node
  if (startNode === endNode && startNode.nodeType === Node.TEXT_NODE) {
    if (startNode.textContent.substring(range.startOffset, range.endOffset).trim()) {
      textNodes.push(startNode);
    }
    return textNodes;
  }

  // For multi-element selections
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }
  return textNodes;
}

// Get start and end indices of the selection within a text node
function getSelectedIndices(textNode, range) {
  let start = 0, end = textNode.length;
  if (textNode === range.startContainer) start = range.startOffset;
  if (textNode === range.endContainer) end = range.endOffset;
  return { start, end };
}

function startTypingPractice() {
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    alert("Please select some text first.");
    return;
  }
  const range = selection.getRangeAt(0);
  const textNodes = getTextNodesInRange(range);
  if (!textNodes.length) {
    alert("No text content found in selection.");
    return;
  }

  const modifications = [];
  const blockSpanMap = new Map(); // Track spans by block for Tab skipping
  for (const textNode of textNodes) {
    const { start, end } = getSelectedIndices(textNode, range);
    const originalContent = textNode.textContent;
    const selectedText = originalContent.substring(start, end);

    const wrapper = document.createElement('span');
    wrapper.innerHTML = selectedText.split('').map(char => `<span class="typing-char">${char}</span>`).join('');

    const beforeText = start > 0 ? originalContent.substring(0, start) : null;
    const afterText = end < originalContent.length ? originalContent.substring(end) : null;
    let beforeNode = beforeText ? document.createTextNode(beforeText) : null;
    let afterNode = afterText ? document.createTextNode(afterText) : null;

    const parent = textNode.parentNode;
    const nextSibling = textNode.nextSibling;
    if (beforeNode) parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(wrapper, textNode);
    if (afterNode) parent.insertBefore(afterNode, textNode);
    parent.removeChild(textNode);

    const block = getClosestBlockAncestor(wrapper);
    if (!blockSpanMap.has(block)) blockSpanMap.set(block, []);
    blockSpanMap.get(block).push(...wrapper.children);

    modifications.push({ beforeNode, wrapper, afterNode, originalContent, parent, nextSibling });
  }

  // Insert enter-required spans
  const allTypingSpans = document.querySelectorAll('.typing-char');
  const blockToLastSpan = new Map();
  allTypingSpans.forEach(span => {
    const block = getClosestBlockAncestor(span);
    if (!blockToLastSpan.has(block) || 
        span.compareDocumentPosition(blockToLastSpan.get(block)) & Node.DOCUMENT_POSITION_PRECEDING) {
      blockToLastSpan.set(block, span);
    }
  });

  blockToLastSpan.forEach((lastSpan) => {
    const enterSpan = document.createElement('span');
    enterSpan.className = 'typing-char enter-required';
    enterSpan.textContent = '⏎';
    lastSpan.parentNode.insertBefore(enterSpan, lastSpan.nextSibling);
    const block = getClosestBlockAncestor(lastSpan);
    if (blockSpanMap.has(block)) blockSpanMap.get(block).push(enterSpan);
  });

  const allTypingChars = Array.from(document.querySelectorAll('.typing-char'));
  selection.removeAllRanges();
  startTyping(allTypingChars, modifications, blockSpanMap);
}

function startTyping(allTypingChars, modifications, blockSpanMap) {
  let currentIndex = 0;
  let totalKeystrokes = 0;
  let correctKeystrokes = 0;
  let startTime = null;
  let lastKeyTime = null;
  let totalPausedTime = 0;
  let isPaused = false;
  let pauseStartTime = null;
  let typingStarted = false;

  if (allTypingChars.length) allTypingChars[0].classList.add('current');

  const meterDiv = document.createElement('div');
  meterDiv.id = 'typing-meter';
  meterDiv.style.position = 'fixed';
  meterDiv.style.bottom = '10px';
  meterDiv.style.right = '10px';
  meterDiv.style.backgroundColor = 'white';
  meterDiv.style.border = '1px solid black';
  meterDiv.style.padding = '5px';
  document.body.appendChild(meterDiv);

  const updateInterval = setInterval(() => {
    if (typingStarted && startTime) {
      const currentTime = Date.now();
      if (!isPaused && lastKeyTime && (currentTime - lastKeyTime > 5000)) {
        isPaused = true;
        pauseStartTime = lastKeyTime + 5000;
      }
      let elapsedTime = currentTime - startTime - totalPausedTime;
      if (isPaused) elapsedTime -= (currentTime - pauseStartTime);
      const elapsedMinutes = elapsedTime / 60000;
      const wpm = elapsedMinutes > 0 ? Math.round((correctKeystrokes / 5) / elapsedMinutes) : 0;
      const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 100;
      meterDiv.textContent = `WPM: ${wpm} | Accuracy: ${accuracy}%`;
    }
  }, 1000);

  const keyHandler = (event) => {
    if (event.key === 'Escape') {
      restoreOriginal();
      return;
    }

    const currentSpan = allTypingChars[currentIndex];
    if (!currentSpan) return;

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (currentIndex > 0) {
        currentSpan.classList.remove('current');
        currentIndex--;
        if (allTypingChars[currentIndex].classList.contains('incorrect')) {
          allTypingChars[currentIndex].classList.add('was-incorrect');
        }
        allTypingChars[currentIndex].classList.remove('correct', 'incorrect', 'corrected');
        allTypingChars[currentIndex].classList.add('current');
        scrollToCurrent();
      }
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      skipToNextBlock();
      return;
    }

    if (event.key.length === 1 || event.key === 'Enter') {
      event.preventDefault();
      if (!typingStarted) {
        typingStarted = true;
        startTime = Date.now();
        lastKeyTime = startTime;
      } else if (isPaused && !currentSpan.classList.contains('enter-required')) {
        totalPausedTime += (Date.now() - pauseStartTime);
        isPaused = false;
      }
      lastKeyTime = Date.now();
      totalKeystrokes++;

      if (currentSpan.classList.contains('enter-required')) {
        if (event.key === 'Enter') {
          if (currentSpan.classList.contains('was-incorrect')) {
            currentSpan.classList.add('corrected');
          } else {
            currentSpan.classList.add('correct');
          }
          correctKeystrokes++;
          advanceCursor(true);
          isPaused = true;
          pauseStartTime = Date.now();
        } else {
          currentSpan.classList.add('incorrect');
          advanceCursor();
        }
      } else {
        const expectedChar = normalizeChar(currentSpan.textContent);
        const typedChar = normalizeChar(event.key);
        if (typedChar === expectedChar) {
          if (currentSpan.classList.contains('was-incorrect')) {
            currentSpan.classList.add('corrected');
          } else {
            currentSpan.classList.add('correct');
          }
          correctKeystrokes++;
          advanceCursor();
        } else {
          currentSpan.classList.add('incorrect');
          advanceCursor();
        }
      }
    }
  };

  function advanceCursor(skipToText = false) {
    allTypingChars[currentIndex].classList.remove('current');
    currentIndex++;
    while (skipToText && currentIndex < allTypingChars.length && 
           allTypingChars[currentIndex].classList.contains('enter-required')) {
      allTypingChars[currentIndex].classList.add('correct');
      correctKeystrokes++;
      totalKeystrokes++;
      currentIndex++;
    }
    if (currentIndex < allTypingChars.length) {
      allTypingChars[currentIndex].classList.add('current');
      scrollToCurrent();
    } else {
      alert("Typing practice completed!");
      restoreOriginal();
    }
  }

  function skipToNextBlock() {
    const currentBlock = getClosestBlockAncestor(allTypingChars[currentIndex]);
    let nextBlockIndex = currentIndex;
    let foundNextBlock = false;

    while (nextBlockIndex < allTypingChars.length) {
      const nextSpan = allTypingChars[nextBlockIndex];
      const nextBlock = getClosestBlockAncestor(nextSpan);
      if (nextBlock !== currentBlock) {
        foundNextBlock = true;
        break;
      }
      nextBlockIndex++;
    }

    if (foundNextBlock) {
      allTypingChars[currentIndex].classList.remove('current');
      currentIndex = nextBlockIndex;
      allTypingChars[currentIndex].classList.add('current');
      scrollToCurrent();
      if (typingStarted && !isPaused) {
        isPaused = true;
        pauseStartTime = Date.now();
      }
    }
  }

  function scrollToCurrent() {
    const currentSpan = allTypingChars[currentIndex];
    if (currentSpan) {
      currentSpan.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  document.addEventListener('keydown', keyHandler, true);

  function restoreOriginal() {
    modifications.forEach(mod => {
      const { beforeNode, wrapper, afterNode, originalContent, parent, nextSibling } = mod;
      if (parent && parent.isConnected) {
        if (beforeNode && parent.contains(beforeNode)) parent.removeChild(beforeNode);
        if (wrapper && parent.contains(wrapper)) parent.removeChild(wrapper);
        if (afterNode && parent.contains(afterNode)) parent.removeChild(afterNode);
        const newTextNode = document.createTextNode(originalContent);
        parent.insertBefore(newTextNode, nextSibling);
      }
    });
    document.removeEventListener('keydown', keyHandler, true);
    clearInterval(updateInterval);
    meterDiv.remove();
    style.remove();
  }

  const style = document.createElement('style');
  style.textContent = `
    .typing-char.current { outline: 1px solid lightgray; }
    .typing-char.correct { background-color: #dcfce7; color: #052e16; }
    .typing-char.incorrect { background-color: #fee2e2; color: #450a0a; }
    .typing-char.corrected { background-color: #fef9c3; color: #422006; }
    .enter-required { color: #888; }
  `;
  document.head.appendChild(style);
}

startTypingPractice();