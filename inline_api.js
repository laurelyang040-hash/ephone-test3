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

    // ------------------------------------------------------------
    // Mobile-friendly fallbacks for buttons that rely on JS bindings.
    // Some builds keep critical handlers inside closures; on Pages/mobile
    // that can leave buttons "clickable" but doing nothing.
    // ------------------------------------------------------------

    function clickFileInput(id) {
      const input = document.getElementById(id);
      if (!input) return;
      try {
        input.value = '';
      } catch (e) {}
      // Must be triggered from a user gesture; we call this from click handlers.
      input.click();
    }

    // Chat list header
    const addChatBtn = document.getElementById('add-chat-btn');
    if (addChatBtn && !addChatBtn.__bound) {
      addChatBtn.__bound = true;
      addChatBtn.addEventListener('click', function () {
        if (typeof window.createNewChat === 'function') return window.createNewChat();
        // Fallback: open character selector
        return window.openCharacterSelector();
      });
    }

    const addGroupChatBtn = document.getElementById('add-group-chat-btn');
    if (addGroupChatBtn && !addGroupChatBtn.__bound) {
      addGroupChatBtn.__bound = true;
      addGroupChatBtn.addEventListener('click', function () {
        return window.openCharacterSelector();
      });
    }

    // Character import
    const importDataBtn = document.getElementById('import-data-btn');
    if (importDataBtn && !importDataBtn.__bound) {
      importDataBtn.__bound = true;
      importDataBtn.addEventListener('click', function () {
        clickFileInput('import-data-input');
      });
    }

    // Worldbook: if "new" does nothing, fall back to import
    const addWorldBookBtn = document.getElementById('add-world-book-btn');
    if (addWorldBookBtn && !addWorldBookBtn.__bound) {
      addWorldBookBtn.__bound = true;
      addWorldBookBtn.addEventListener('click', function () {
        if (typeof window.createWorldBook === 'function') return window.createWorldBook();
        clickFileInput('book-upload-input');
      });
    }

    // Rendering rules import
    const importRulesBtn = document.getElementById('import-rules-btn');
    if (importRulesBtn && !importRulesBtn.__bound) {
      importRulesBtn.__bound = true;
      importRulesBtn.addEventListener('click', function () {
        clickFileInput('import-rules-input');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureGlobals);
  } else {
    ensureGlobals();
  }
})();
