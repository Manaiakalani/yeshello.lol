/**
 * YesHello.lol - The Gen Z Communication Power Move
 *
 * @author Maximilian Stein
 * @version 2.0.0
 */

(function () {
  'use strict';

  // ── Theme Management ──────────────────────────────────────
  const THEME_KEY = 'yeshello-theme';

  function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#121212' : '#f8f8f8');
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  // Apply theme immediately to prevent flash
  applyTheme(getPreferredTheme());

  // Listen for OS theme changes (only if user hasn't set manual preference)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // ── DOM Ready ─────────────────────────────────────────────
  function onReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  onReady(function () {
    // Cache DOM elements
    const els = {
      secretEmoji: document.getElementById('secret-emoji'),
      slangFlyout: document.getElementById('slang-flyout'),
      closeFlyoutBtn: document.getElementById('close-flyout'),
      goodMessages: document.querySelectorAll('.good-hello .message'),
      mainTitle: document.querySelector('.main-title'),
      toast: document.getElementById('toast'),
      themeToggle: document.getElementById('theme-toggle'),
      twitterBtn: document.querySelector('.share-btn.x-share'),
      copyBtn: document.querySelector('.share-btn.copy'),
      nativeShareBtn: document.querySelector('.share-btn.native-share'),
      terms: document.querySelectorAll('.term[data-term]'),
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Theme Toggle Button ───────────────────────────────
    if (els.themeToggle) {
      els.themeToggle.addEventListener('click', toggleTheme);
    }

    // ── Typing Effect ─────────────────────────────────────
    function typeText(element, text, speed, callback) {
      if (!element) return;
      let i = 0;
      element.textContent = '';
      function tick() {
        if (i < text.length) {
          element.textContent = text.substring(0, ++i);
          setTimeout(tick, speed);
        } else if (callback) {
          callback();
        }
      }
      tick();
    }

    // Title animation
    if (els.mainTitle) {
      if (prefersReducedMotion) {
        els.mainTitle.textContent = 'Yes, Hello! Bet!';
      } else {
        typeText(els.mainTitle, 'Yes, Hello! Bet!', 100, function () {
          els.mainTitle.classList.add('typing-animation');
        });
      }
    }

    // Message typing effect (triggered by IntersectionObserver)
    function animateMessages(messages) {
      if (!messages || !messages.length || prefersReducedMotion) return;

      messages.forEach(function (msg, idx) {
        const p = msg.querySelector('p');
        if (!p) return;

        // Preserve the full innerHTML so we can restore it
        const fullHTML = p.innerHTML;
        const senderEl = p.querySelector('.sender');
        const senderHTML = senderEl ? senderEl.outerHTML + ' ' : '';
        const senderText = senderEl ? senderEl.textContent : '';

        // Extract just the text portion after the sender
        const fullText = p.textContent;
        const bodyText = senderText ? fullText.substring(fullText.indexOf(senderText) + senderText.length).trim() : fullText;

        // Clear and prepare for animation
        p.innerHTML = senderHTML;

        const delay = idx === 0 ? 200 : idx * 1200;
        const charSpeed = idx === 0 ? 40 : 55;

        setTimeout(function () {
          let ci = 0;
          const interval = setInterval(function () {
            if (ci >= bodyText.length) {
              clearInterval(interval);
              // Restore full HTML (with any .term spans, etc.) after animation
              p.innerHTML = fullHTML;
              return;
            }
            p.innerHTML = senderHTML + bodyText.substring(0, ++ci);
          }, charSpeed);
        }, delay);
      });
    }

    // Use IntersectionObserver to trigger animations when scrolled into view
    const goodConversation = document.querySelector('.good-hello');
    if (goodConversation && 'IntersectionObserver' in window && !prefersReducedMotion) {
      let animated = false;
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !animated) {
            animated = true;
            animateMessages(els.goodMessages);
            observer.disconnect();
          }
        });
      }, { threshold: 0.3 });
      observer.observe(goodConversation);
    } else {
      animateMessages(els.goodMessages);
    }

    // ── Toast ─────────────────────────────────────────────
    function showToast(message, duration) {
      if (!els.toast) return;
      duration = duration || 3000;
      els.toast.textContent = message;
      els.toast.classList.remove('hidden');
      setTimeout(function () {
        els.toast.classList.add('hidden');
      }, duration);
    }

    // ── Clipboard ─────────────────────────────────────────
    function copyLink() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).then(function () {
          showToast('Link copied! Slay! 🔗');
        }, function () {
          showToast('Copy failed - not the vibe 😔');
        });
      } else {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = window.location.href;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          showToast('Link copied! Slay! 🔗');
        } catch (_) {
          showToast('Copy failed - not the vibe 😔');
        }
        document.body.removeChild(ta);
      }
    }

    // ── X (Twitter) Share ────────────────────────────────
    function shareOnX() {
      const phrases = [
        "This 'Hello' technique is giving power move!",
        "No cap, just say 'Hello' and make them wait.",
        "The way Gen Z texts is actually genius, bestie!",
        "I finally understood the assignment with this Hello method.",
        "This is literally the most iconic texting strat ever.",
      ];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const url = 'https://x.com/intent/post?text=' +
        encodeURIComponent(phrase + ' Check it:') +
        '&url=' + encodeURIComponent(window.location.href);
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    // ── Term Tooltips ─────────────────────────────────────
    const descriptions = {
      'filler': 'A phrase used to fill space in conversation',
      'periodt': 'Period with a T - statement is final',
      'no-cap': 'Not lying, telling the truth',
      'tea': 'The truth, gossip, or inside info',
      'giving': 'Resembling or evoking a certain vibe',
      'lowkey': 'Subtle, understated, or secretly',
      'fr': 'For real - emphasize sincerity',
      'mad': 'Very or extremely',
      'why': 'Expressing exasperation or disbelief',
      'silence': 'Strategic pause for effect',
      'deadass': 'Seriously or genuinely',
      'uup': 'Checking if someone is awake/online',
      'bruh': 'Surprise, disbelief, or disappointment',
      'yikes': 'Shock, embarrassment or disgust',
      'cringe': 'Awkward, embarrassing or uncomfortable',
      'nobody': 'Information wasn\'t requested',
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
      'main-character': 'Acting like you\'re the protagonist',
    };

    els.terms.forEach(function (term) {
      const key = term.getAttribute('data-term');
      term.setAttribute('tabindex', '0');
      term.setAttribute('role', 'button');
      if (key && descriptions[key]) {
        term.setAttribute('aria-label', term.textContent + ' - ' + descriptions[key]);
        term.setAttribute('title', descriptions[key]);
      }

      function highlight() {
        term.classList.add('term-highlight');
        setTimeout(function () { term.classList.remove('term-highlight'); }, 1000);
      }

      term.addEventListener('click', function (e) { e.preventDefault(); highlight(); });
      term.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); highlight(); }
      });
    });

    // ── Flyout ────────────────────────────────────────────
    const backdrop = document.getElementById('flyout-backdrop');

    function openFlyout() {
      if (!els.slangFlyout) return;
      els.slangFlyout.classList.remove('hidden');
      els.slangFlyout.setAttribute('aria-hidden', 'false');
      if (backdrop) {
        backdrop.classList.remove('hidden');
        backdrop.setAttribute('aria-hidden', 'false');
      }
      document.body.style.overflow = 'hidden';
      if (els.closeFlyoutBtn) els.closeFlyoutBtn.focus();
    }

    function closeFlyout() {
      if (!els.slangFlyout) return;
      els.slangFlyout.classList.add('hidden');
      els.slangFlyout.setAttribute('aria-hidden', 'true');
      if (backdrop) {
        backdrop.classList.add('hidden');
        backdrop.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
      if (els.secretEmoji) els.secretEmoji.focus();
    }

    // Focus trap - keep Tab/Shift+Tab inside the flyout when open
    function trapFocus(e) {
      if (!els.slangFlyout || els.slangFlyout.classList.contains('hidden')) return;
      if (e.key !== 'Tab') return;

      const focusable = els.slangFlyout.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    if (els.secretEmoji) {
      els.secretEmoji.addEventListener('click', openFlyout);
      els.secretEmoji.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFlyout(); }
      });
    }

    if (els.closeFlyoutBtn) {
      els.closeFlyoutBtn.addEventListener('click', closeFlyout);
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeFlyout);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.slangFlyout && !els.slangFlyout.classList.contains('hidden')) {
        closeFlyout();
      }
      trapFocus(e);
    });

    // ── Share Buttons ─────────────────────────────────────
    if (els.twitterBtn) els.twitterBtn.addEventListener('click', shareOnX);
    if (els.copyBtn) els.copyBtn.addEventListener('click', copyLink);

    // Native Web Share API
    if (els.nativeShareBtn && navigator.share) {
      els.nativeShareBtn.hidden = false;
      els.nativeShareBtn.addEventListener('click', function () {
        navigator.share({
          title: 'Yes, Hello! Bet! - The Gen Z Power Move',
          text: "Just say 'Hello' and make them wait - the Gen Z communication power move.",
          url: window.location.href,
        }).catch(function () {});
      });
    }

    // ── Dynamic Copyright Year ────────────────────────────
    const yearEl = document.getElementById('copyright-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });
})();
