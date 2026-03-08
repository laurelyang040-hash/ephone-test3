// Expose a minimal global API expected by inline onclick handlers in index.html.
// The main logic lives in script.js (obfuscated). In some builds, the original
// global helpers (showScreen/openWorldBookScreen/...) are not attached to window,
// which makes app icons "not clickable".
//
// We map them to the internal screen switcher if present, otherwise fall back
// to a simple DOM-based show/hide.
(function () {
  function domShowScreen(screenId) {
    try {
      const screens = document.querySelectorAll('.screen');
      screens.forEach((el) => el.classList.remove('active'));
      const target = document.getElementById(screenId);
      if (target) target.classList.add('active');
    } catch (e) {
      console.error('[inline_api] domShowScreen failed:', e);
    }
  }

  function getInternalShowScreen() {
    // In this build, the internal screen switcher is a global function named _0x37434a.
    // (script.js calls it to open the home screen.)
    if (typeof window._0x37434a === 'function') return window._0x37434a;
    return null;
  }

  function ensureGlobals() {
    const internalShow = getInternalShowScreen();
    const show = internalShow
      ? function (id) {
          try {
            return internalShow(id);
          } catch (e) {
            console.error('[inline_api] internal showScreen failed, fallback to DOM:', e);
            return domShowScreen(id);
          }
        }
      : domShowScreen;

    // Inline handlers in index.html
    window.showScreen = window.showScreen || show;
    window.openWorldBookScreen = window.openWorldBookScreen || function () {
      return show('worldbook-screen');
    };
    window.openRenderingRulesScreen = window.openRenderingRulesScreen || function () {
      return show('rendering-rules-screen');
    };
    window.openCharacterSelector = window.openCharacterSelector || function () {
      return show('character-selection-screen');
    };

    // Optional
    window.openCharacterBrowser = window.openCharacterBrowser || function () {
      return show('char-browser-screen');
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureGlobals);
  } else {
    ensureGlobals();
  }
})();

// ------------------------------
// Mobile-friendly import buttons
// ------------------------------
// Some mobile browsers block programmatic clicks on <input type=file>
// when the input is display:none. We keep inputs off-screen (not display:none)
// and bind both click and touchend to the visible toolbar buttons.
(function () {
  function triggerFileInput(id) {
    const inp = document.getElementById(id);
    if (!inp) {
      console.warn('[IMPORT] input not found:', id);
      return;
    }
    inp.value = '';
    inp.click();
  }

  window.triggerImportCharacterCard = () => triggerFileInput('import-card-input');
  window.triggerImportWorldBook = () => triggerFileInput('import-world-book-input');

  document.addEventListener('DOMContentLoaded', () => {
    const bind = (btnId, fn) => {
      const el = document.getElementById(btnId);
      if (!el || el.__importBound) return;
      el.__importBound = true;
      el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
    };

    bind('import-card-btn', window.triggerImportCharacterCard);
    bind('import-world-book-btn', window.triggerImportWorldBook);
  });
})();
