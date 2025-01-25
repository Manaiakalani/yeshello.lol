const secretEmoji = document.getElementById('secret-emoji');
const slangFlyout = document.getElementById('slang-flyout');
const closeFlyoutButton = document.getElementById('close-flyout');
const goodHelloMessages = document.querySelectorAll('.good-hello .message');
const mainTitle = document.querySelector('.main-title');

// Function to simulate typing effect
function typeMessage(element, text, index, interval) {
  if (index < text.length) {
    element.innerHTML += text.charAt(index);
    index++;
    setTimeout(() => typeMessage(element, text, index, interval), interval);
  }
}

// Function to apply typing effect to messages
function applyTypingEffectToMessages(messages) {
  messages.forEach(message => {
    const messageTextElement = message.querySelector('p');
    const originalText = messageTextElement.textContent;
    messageTextElement.textContent = ''; // Clear original text
    typeMessage(messageTextElement, originalText, 0, 50); // 50ms interval
  });
}

secretEmoji.addEventListener('click', () => {
  slangFlyout.classList.remove('hidden');
});

closeFlyoutButton.addEventListener('click', () => {
  slangFlyout.classList.add('hidden');
});

// Apply typing effect to good hello messages only
applyTypingEffectToMessages(goodHelloMessages);

// Typing animation for "Yes, Hello!" on page load
window.addEventListener('load', () => {
    mainTitle.textContent = "Yes, Hello! Bet!";
    mainTitle.classList.add('typing-animation');
});