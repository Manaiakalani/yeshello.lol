/**
 * YesHello.lol - The Gen Z Communication Power Move
 * 
 * This script handles:
 * - Interactive UI elements
 * - Gen Z slang glossary display
 * - Typing animation effects for that authentic "make them wait" experience
 * - Accessibility features
 * - Share functionality for viral spreading 
 * 
 * @author Maximilian Stein
 * @version 1.0.0
 */

// Cache DOM elements for better performance (we stan efficiency)
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
  },
  // Gen Z related terms that can be highlighted
  genZTerms: document.querySelectorAll('.term[data-term]')
};

/**
 * Improved typing effect to simulate the classic Gen Z "Hello...then wait" approach
 * @param {HTMLElement} element - DOM element to type text into
 * @param {string} text - Text to type
 * @param {number} index - Current index in text
 * @param {number} interval - Time between characters in ms
 * @param {Function} [callback] - Optional callback function to run after completion
 */
function typeMessage(element, text, index = 0, interval = 50, callback = null) {
  // Safety check for element existence
  if (!element) return;
  
  // Stop condition
  if (index >= text.length) {
    if (typeof callback === 'function') callback();
    return;
  }
  
  // Use requestAnimationFrame for smoother animations
  requestAnimationFrame(() => {
    element.textContent = text.substring(0, index + 1);
    setTimeout(() => typeMessage(element, text, index + 1, interval, callback), interval);
  });
}

/**
 * Apply typing effect with delay between messages for that authentic Gen Z texting feel
 * Intentionally making people wait because that's the power move
 * @param {NodeList} messages - Messages to apply typing effect to
 */
function applyTypingEffectToMessages(messages) {
  if (!messages || !messages.length) return;
  
  // Store animation timers for potential cleanup
  const animationTimers = [];
  
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
    
    // Add strategic delays between messages for authentic Gen Z texting experience
    // First message is "Hello" - make it appear fast
    // Later messages have extra waiting time - that's the power move!
    const delayMultiplier = idx === 0 ? 0.5 : idx; // Shorter delay for first message, longer for others
    
    const timer = setTimeout(() => {
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
      }, idx === 0 ? 40 : 60); // First message types faster (just "Hello")
      
      // Store interval for potential cleanup
      animationTimers.push(typeInterval);
      
    }, idx * 1200 * delayMultiplier); // Strategic delay between messages
    
    // Store timer for potential cleanup
    animationTimers.push(timer);
  });
  
  // Add cleanup function to window object for potential manual cleanup
  window._cleanupAnimations = () => {
    animationTimers.forEach(timer => {
      clearTimeout(timer);
      clearInterval(timer);
    });
  };
}

/**
 * Show toast notification with Gen Z flair
 * @param {string} message - Message to show in toast
 * @param {number} duration - Duration to show toast in ms
 */
function showToast(message, duration = 3000) {
  if (!elements.toast) return;
  
  // Add Gen Z flair to generic messages
  if (message === 'Link copied to clipboard!') {
    message = 'Link copied! Slay!';
  } else if (message === 'Failed to copy link') {
    message = 'Not the vibe... copy failed :(';
  }
  
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  elements.toast.setAttribute('aria-hidden', 'false');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
    elements.toast.setAttribute('aria-hidden', 'true');
  }, duration);
}

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Whether copy was successful
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = 0;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr);
      return false;
    }
  }
}

/**
 * Share on Twitter with Gen Z slang
 */
function shareOnTwitter() {
  try {
    // Create a Gen Z themed share message
    const genZPhrases = [
      "This 'Hello' technique is giving power move!",
      "No cap, just say 'Hello' and make them wait.",
      "The way Gen Z texts is actually genius, bestie!",
      "I finally understood the assignment with this Hello method.",
      "This is literally the most iconic texting strat ever."
    ];
    
    // Pick a random Gen Z phrase
    const randomPhrase = genZPhrases[Math.floor(Math.random() * genZPhrases.length)];
    
    const text = `${randomPhrase} Check it:`;
    const url = window.location.href;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Error sharing to Twitter:', error);
    showToast('Not the vibe... Twitter share failed.');
  }
}

/**
 * Add tooltips to Gen Z terms
 */
function initGenZTermTooltips() {
  if (!elements.genZTerms || !elements.genZTerms.length) return;
  
  // Define Gen Z term descriptions
  const termDescriptions = {
    'filler': 'A phrase used to fill space in conversation',
    'periodt': 'Period with a T - emphasizes that a statement is final',
    'no-cap': 'Not lying, telling the truth',
    'tea': 'The truth, gossip, or inside information',
    'giving': 'Resembling or evoking a certain vibe',
    'lowkey': 'Subtle, understated, or secretly',
    'fr': 'For real - to emphasize sincerity',
    'mad': 'Very or extremely',
    'why': 'Expressing exasperation or disbelief',
    'silence': 'Strategic pause for effect',
    'deadass': 'Seriously or genuinely',
    'uup': 'Checking if someone is awake/online',
    'bruh': 'Expression of surprise, disbelief, or disappointment',
    'yikes': 'Expression of shock, embarrassment or disgust',
    'cringe': 'Awkward, embarrassing or uncomfortable',
    'nobody': 'Pointing out information wasn\'t requested',
    'bestie': 'Term of endearment for friend',
    'squad': 'Close group of friends',
    'sus': 'Suspicious or questionable',
    'mood': 'Relatable or captures a feeling',
    'og': 'Original gangster - authentic or the first',
    'iconic': 'Memorable, influential, or impressive',
    'bet': 'Agreement or confirmation',
    'slay': 'To do something exceptionally well',
    'rizz': 'Charm or ability to attract someone',
    'bussin': 'Really good or amazing',
    'main-character': 'Acting like you\'re the protagonist'
  };
  
  elements.genZTerms.forEach(term => {
    const termType = term.getAttribute('data-term');
    
    // Make terms interactive
    term.setAttribute('tabindex', '0');
    term.setAttribute('role', 'button');
    term.setAttribute('aria-label', termType ? `${term.textContent} - ${termDescriptions[termType] || ''}` : term.textContent);
    
    // Highlight term on click
    term.addEventListener('click', (e) => {
      e.preventDefault();
      term.classList.add('term-highlight');
      setTimeout(() => term.classList.remove('term-highlight'), 1000);
    });
    
    // Accessibility
    term.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        term.classList.add('term-highlight');
        setTimeout(() => term.classList.remove('term-highlight'), 1000);
      }
    });
  });
}

/**
 * Initialize all event listeners
 */
function initEventListeners() {
  // Slang glossary popup
  if (elements.secretEmoji) {
    elements.secretEmoji.addEventListener('click', () => {
      if (elements.slangFlyout) {
        elements.slangFlyout.classList.remove('hidden');
        elements.slangFlyout.setAttribute('aria-hidden', 'false');
      }
    });
    
    // Add keyboard support for accessibility
    elements.secretEmoji.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (elements.slangFlyout) {
          elements.slangFlyout.classList.remove('hidden');
          elements.slangFlyout.setAttribute('aria-hidden', 'false');
        }
      }
    });
  }

  // Close flyout button
  if (elements.closeFlyoutButton) {
    elements.closeFlyoutButton.addEventListener('click', () => {
      if (elements.slangFlyout) {
        elements.slangFlyout.classList.add('hidden');
        elements.slangFlyout.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Share button event listeners
  if (elements.shareButtons.twitter) {
    elements.shareButtons.twitter.addEventListener('click', shareOnTwitter);
  }

  if (elements.shareButtons.copy) {
    elements.shareButtons.copy.addEventListener('click', async () => {
      const success = await copyToClipboard(window.location.href);
      showToast(success ? 'Link copied to clipboard! Slay!' : 'Failed to copy link');
    });
  }

  // Add keyboard accessibility for ESC key to close flyout
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && 
        elements.slangFlyout && 
        !elements.slangFlyout.classList.contains('hidden')) {
      elements.slangFlyout.classList.add('hidden');
      elements.slangFlyout.setAttribute('aria-hidden', 'true');
    }
  });

  // Add click outside to close flyout
  document.addEventListener('click', (event) => {
    if (elements.slangFlyout && 
        !elements.slangFlyout.classList.contains('hidden') &&
        !elements.slangFlyout.contains(event.target) &&
        event.target !== elements.secretEmoji) {
      elements.slangFlyout.classList.add('hidden');
      elements.slangFlyout.setAttribute('aria-hidden', 'true');
    }
  });

  // Save resources by using passive event listeners where appropriate
  document.addEventListener('scroll', () => {}, { passive: true });
  document.addEventListener('touchstart', () => {}, { passive: true });
}

/**
 * Initialize the application
 */
function init() {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Init tooltips
  initGenZTermTooltips();
  
  // Set up event listeners
  initEventListeners();
  
  // Apply typing animation to main title
  if (elements.mainTitle) {
    if (prefersReducedMotion) {
      // Skip animation for users who prefer reduced motion
      elements.mainTitle.textContent = "Yes, Hello! Bet!";
    } else {
      // Use DOMContentLoaded for faster execution
      document.addEventListener('DOMContentLoaded', () => {
        requestAnimationFrame(() => {
          elements.mainTitle.textContent = "";
          typeMessage(elements.mainTitle, "Yes, Hello! Bet!", 0, 100, () => {
            elements.mainTitle.classList.add('typing-animation');
          });
        });
      });
    }
  }
  
  // Apply typing effect to good hello messages
  if (!prefersReducedMotion) {
    applyTypingEffectToMessages(elements.goodHelloMessages);
  } else {
    // Skip typing animation for messages when reduced motion is preferred
    elements.goodHelloMessages.forEach(message => {
      const messageText = message.querySelector('p');
      if (messageText) messageText.style.opacity = 1;
    });
  }
}

// Initialize the app (let's go bestie!)
init();
