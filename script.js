// Cache DOM elements for better performance
const elements = {
  secretEmoji: document.getElementById('secret-emoji'),
  slangFlyout: document.getElementById('slang-flyout'),
  closeFlyoutButton: document.getElementById('close-flyout'),
  goodHelloMessages: document.querySelectorAll('.good-hello .message'),
  mainTitle: document.querySelector('.main-title'),
  toast: document.getElementById('toast'),
  shareButtons: {
    twitter: document.querySelector('.share-btn.twitter'),
    copy: document.querySelector('.share-btn.copy')
  }
};

/**
 * Improved typing effect with better performance
 * @param {HTMLElement} element - DOM element to type text into
 * @param {string} text - Text to type
 * @param {number} index - Current index in text
 * @param {number} interval - Time between characters in ms
 */
function typeMessage(element, text, index, interval) {
  if (!element || index >= text.length) return;
  
  // Use requestAnimationFrame for smoother animations
  requestAnimationFrame(() => {
    element.textContent = text.substring(0, index + 1);
    setTimeout(() => typeMessage(element, text, index + 1, interval), interval);
  });
}

/**
 * Apply typing effect with delay between messages for more natural feel
 * @param {NodeList} messages - Messages to apply typing effect to
 */
function applyTypingEffectToMessages(messages) {
  if (!messages || !messages.length) return;
  
  messages.forEach((message, idx) => {
    const messageTextElement = message.querySelector('p');
    if (!messageTextElement) return;
    
    // Save original content including HTML
    const originalText = messageTextElement.textContent;
    const sender = messageTextElement.querySelector('.sender')?.outerHTML || '';
    
    // Clear text but preserve sender
    messageTextElement.innerHTML = sender;
    
    // Remove sender from text to type
    const textToType = originalText.replace(messageTextElement.querySelector('.sender')?.textContent || '', '');
    
    // Add delay between messages for more natural conversation feel
    setTimeout(() => {
      const startPos = sender ? sender.length : 0;
      messageTextElement.innerHTML = sender;
      
      // Start typing after the sender element
      let currentIndex = 0;
      const typeInterval = setInterval(() => {
        if (currentIndex >= textToType.length) {
          clearInterval(typeInterval);
          return;
        }
        messageTextElement.innerHTML = sender + textToType.substring(0, currentIndex + 1);
        currentIndex++;
      }, 50);
    }, idx * 1000); // 1 second delay between messages
  });
}

/**
 * Show toast notification
 * @param {string} message - Message to show in toast
 * @param {number} duration - Duration to show toast in ms
 */
function showToast(message, duration = 3000) {
  if (!elements.toast) return;
  
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, duration);
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Whether copy was successful
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Share on Twitter
 */
function shareOnTwitter() {
  const text = "Just say 'Hello' and make them wait. It's giving power move! Check out this site:";
  const url = window.location.href;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(twitterUrl, '_blank');
}

// Event listeners with error handling
if (elements.secretEmoji) {
  elements.secretEmoji.addEventListener('click', () => {
    if (elements.slangFlyout) elements.slangFlyout.classList.remove('hidden');
  });
  
  // Add keyboard support for accessibility
  elements.secretEmoji.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (elements.slangFlyout) elements.slangFlyout.classList.remove('hidden');
    }
  });
}

if (elements.closeFlyoutButton) {
  elements.closeFlyoutButton.addEventListener('click', () => {
    if (elements.slangFlyout) elements.slangFlyout.classList.add('hidden');
  });
}

// Share button event listeners
if (elements.shareButtons.twitter) {
  elements.shareButtons.twitter.addEventListener('click', shareOnTwitter);
}

if (elements.shareButtons.copy) {
  elements.shareButtons.copy.addEventListener('click', async () => {
    const success = await copyToClipboard(window.location.href);
    showToast(success ? 'Link copied to clipboard!' : 'Failed to copy link');
  });
}

// Apply typing effect to good hello messages only
applyTypingEffectToMessages(elements.goodHelloMessages);

// Typing animation for main title on page load with performance optimization
if (elements.mainTitle) {
  // Use DOMContentLoaded instead of load for faster execution
  document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
      elements.mainTitle.textContent = "Yes, Hello! Bet!";
      elements.mainTitle.classList.add('typing-animation');
    });
  });
}

// Add keyboard accessibility for ESC key to close flyout
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && 
      elements.slangFlyout && 
      !elements.slangFlyout.classList.contains('hidden')) {
    elements.slangFlyout.classList.add('hidden');
  }
});

// Add click outside to close flyout
document.addEventListener('click', (event) => {
  if (elements.slangFlyout && 
      !elements.slangFlyout.classList.contains('hidden') &&
      !elements.slangFlyout.contains(event.target) &&
      event.target !== elements.secretEmoji) {
    elements.slangFlyout.classList.add('hidden');
  }
});

// Save resources by using passive event listeners where appropriate
document.addEventListener('scroll', () => {}, { passive: true });
document.addEventListener('touchstart', () => {}, { passive: true });

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  // Skip animations for users who prefer reduced motion
  if (elements.mainTitle) {
    elements.mainTitle.textContent = "Yes, Hello! Bet!";
    elements.mainTitle.classList.remove('typing-animation');
  }
  
  // Skip typing animation for messages
  elements.goodHelloMessages.forEach(message => {
    const messageText = message.querySelector('p');
    if (messageText) messageText.style.opacity = 1;
  });
}
