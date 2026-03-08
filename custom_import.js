// Custom Import Center (Unlocked)
// - Character card (.png/.json)
// - World book (.json)
// - Regex rules (.json)
// Stored in its own Dexie DB so you can test without touching the site's original data.

(function () {
  'use strict';

  const UI = {
    openBtnId: 'open-custom-import-center-btn',
    modalId: 'custom-import-modal',
    closeBtnId: 'custom-import-close-btn',
    libSelectId: 'custom-import-lib-select',
    newLibBtnId: 'custom-import-newlib-btn',
    resetLibBtnId: 'custom-import-resetlib-btn',

    charInputId: 'custom-import-char-input',
    worldInputId: 'custom-import-world-input',
    regexInputId: 'custom-import-regex-input',

    doCharBtnId: 'custom-import-do-char-btn',
    doWorldBtnId: 'custom-import-do-world-btn',
    doRegexBtnId: 'custom-import-do-regex-btn',

    statusId: 'custom-import-status',
    listId: 'custom-import-list'
  };

  const LS = {
    currentLib: 'customImport.currentLib.v1',
    libs: 'customImport.libs.v1'
  };

  function $(id) { return document.getElementById(id); }
  function setStatus(msg) {
    const el = $(UI.statusId);
    if (el) el.textContent = msg || '';
  }

  function getLibs() {
    try {
      const v = JSON.parse(localStorage.getItem(LS.libs) || '[]');
      if (Array.isArray(v) && v.length) return v;
    } catch {}
    return ['default'];
  }

  function setLibs(libs) {
    localStorage.setItem(LS.libs, JSON.stringify(libs));
  }

  function getCurrentLib() {
    return localStorage.getItem(LS.currentLib) || 'default';
  }

  function setCurrentLib(name) {
    localStorage.setItem(LS.currentLib, name);
  }

  function randomLibName() {
    const s = Math.random().toString(36).slice(2, 8);
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `test-${y}${m}${day}-${s}`;
  }

  function openModal() {
    const m = $(UI.modalId);
    if (m) m.style.display = 'block';
  }

  function closeModal() {
    const m = $(UI.modalId);
    if (m) m.style.display = 'none';
  }

  function hasDexie() { return typeof window.Dexie !== 'undefined'; }

  function makeDbName(lib) {
    return `ephone_custom_import_${lib}`;
  }

  let db = null;

  async function openDb(lib) {
    if (!hasDexie()) {
      db = null;
      return;
    }
    const name = makeDbName(lib);
    db = new Dexie(name);
    db.version(1).stores({
      chars: 'id, name, importedAt',
      worldbooks: 'id, name, importedAt',
      regexsets: 'id, name, importedAt',
      bindings: 'characterId, importedAt'
    });
    await db.open();
  }

  function uuid() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return String(Date.now()) + '_' + Math.random().toString(16).slice(2);
  }

  // ---------- PNG chunk parser (tEXt + iTXt uncompressed) ----------
  function readUint32BE(u8, off) {
    return (u8[off] << 24) | (u8[off + 1] << 16) | (u8[off + 2] << 8) | u8[off + 3];
  }
  function bytesToAscii(u8) { return new TextDecoder('latin1').decode(u8); }
  function bytesToUtf8(u8) { return new TextDecoder('utf-8', { fatal: false }).decode(u8); }

  function extractPngTextChunks(arrayBuffer) {
    const u8 = new Uint8Array(arrayBuffer);
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) throw new Error('Not a PNG');

    let off = 8;
    const texts = [];
    while (off + 8 <= u8.length) {
      const len = readUint32BE(u8, off); off += 4;
      const type = bytesToAscii(u8.slice(off, off + 4)); off += 4;
      const data = u8.slice(off, off + len); off += len;
      off += 4; // crc

      if (type === 'tEXt') {
        const zero = data.indexOf(0);
        const keyword = zero >= 0 ? bytesToAscii(data.slice(0, zero)) : '';
        const text = zero >= 0 ? bytesToAscii(data.slice(zero + 1)) : bytesToAscii(data);
        texts.push({ type, keyword, text });
      } else if (type === 'iTXt') {
        let p = 0;
        const z1 = data.indexOf(0, p);
        const keyword = bytesToAscii(data.slice(p, z1));
        p = z1 + 1;
        const compressionFlag = data[p]; p += 1;
        p += 1; // compressionMethod
        const z2 = data.indexOf(0, p); p = z2 + 1;
        const z3 = data.indexOf(0, p); p = z3 + 1;
        const textBytes = data.slice(p);
        if (compressionFlag === 0) {
          const text = bytesToUtf8(textBytes);
          texts.push({ type, keyword, text });
        }
      } else if (type === 'IEND') {
        break;
      }
    }
    return texts;
  }

  function tryParseJsonFromPngTexts(textChunks) {
    const candidates = [];
    for (const t of textChunks) {
      const s = (t.text || '').trim();
      if (!s) continue;
      if (s.startsWith('{') && s.endsWith('}')) candidates.push(s);
      if (/^[A-Za-z0-9+/=]{200,}$/.test(s)) {
        try {
          const decoded = atob(s);
          const trimmed = decoded.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) candidates.push(trimmed);
        } catch {}
      }
    }
    for (const c of candidates) {
      try {
        const obj = JSON.parse(c);
        if (obj) return obj;
      } catch {}
    }
    return null;
  }

  // ---------- Extractors ----------
  function getNameFromChar(obj, fallback) {
    return obj?.name || obj?.data?.name || obj?.char_name || obj?.data?.character?.name || fallback || 'Unnamed';
  }

  function getNameFromWorldBook(obj, fallback) {
    return obj?.name || obj?.title || obj?.world_book_name || fallback || 'WorldBook';
  }

  function getNameFromRegex(obj, fallback) {
    return obj?.name || obj?.title || obj?.regex_name || fallback || 'Regex';
  }

  // Heuristic: try to find embedded worldbook / regex inside a character json.
  function extractEmbeddedAssetsFromCharacter(charObj) {
    const res = { worldbooks: [], regexsets: [] };

    // common patterns seen in custom forks
    const maybeWorld = [
      charObj?.worldbook,
      charObj?.worldBook,
      charObj?.lorebook,
      charObj?.loreBook,
      charObj?.data?.worldbook,
      charObj?.data?.worldBook,
      charObj?.data?.lorebook,
      charObj?.data?.loreBook,
      charObj?.extensions?.worldbook,
      charObj?.extensions?.lorebook,
      charObj?.meta?.worldbook,
      charObj?.meta?.lorebook
    ].filter(Boolean);

    for (const w of maybeWorld) {
      if (Array.isArray(w)) res.worldbooks.push(...w);
      else res.worldbooks.push(w);
    }

    const maybeRegex = [
      charObj?.regex,
      charObj?.regexes,
      charObj?.regexRules,
      charObj?.data?.regex,
      charObj?.data?.regexes,
      charObj?.extensions?.regex,
      charObj?.extensions?.regexes,
      charObj?.meta?.regex
    ].filter(Boolean);

    for (const r of maybeRegex) {
      if (Array.isArray(r)) res.regexsets.push(...r);
      else res.regexsets.push(r);
    }

    // De-dup objects by JSON string
    const dedup = (arr) => {
      const seen = new Set();
      const out = [];
      for (const x of arr) {
        try {
          const k = JSON.stringify(x);
          if (!seen.has(k)) { seen.add(k); out.push(x); }
        } catch {
          out.push(x);
        }
      }
      return out;
    };

    res.worldbooks = dedup(res.worldbooks);
    res.regexsets = dedup(res.regexsets);
    return res;
  }

  // ---------- Storage ----------
  async function putChar(charObj, sourceName) {
    const rec = {
      id: uuid(),
      name: getNameFromChar(charObj, sourceName),
      importedAt: Date.now(),
      raw: charObj
    };
    if (db) {
      await db.chars.put(rec);
    } else {
      // localStorage fallback
      const key = `customImport.${getCurrentLib()}.chars`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push(rec);
      localStorage.setItem(key, JSON.stringify(list));
    }
    return rec;
  }

  async function putWorldBook(worldObj, sourceName) {
    const rec = {
      id: uuid(),
      name: getNameFromWorldBook(worldObj, sourceName),
      importedAt: Date.now(),
      raw: worldObj
    };
    if (db) {
      await db.worldbooks.put(rec);
    } else {
      const key = `customImport.${getCurrentLib()}.worldbooks`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push(rec);
      localStorage.setItem(key, JSON.stringify(list));
    }
    return rec;
  }

  async function putRegexSet(regexObj, sourceName) {
    const rec = {
      id: uuid(),
      name: getNameFromRegex(regexObj, sourceName),
      importedAt: Date.now(),
      raw: regexObj
    };
    if (db) {
      await db.regexsets.put(rec);
    } else {
      const key = `customImport.${getCurrentLib()}.regexsets`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push(rec);
      localStorage.setItem(key, JSON.stringify(list));
    }
    return rec;
  }

  async function putBinding(characterId, worldbookIds, regexSetIds) {
    const rec = {
      characterId,
      worldbookIds: worldbookIds || [],
      regexSetIds: regexSetIds || [],
      importedAt: Date.now()
    };
    if (db) {
      await db.bindings.put(rec);
    } else {
      const key = `customImport.${getCurrentLib()}.bindings`;
      const map = JSON.parse(localStorage.getItem(key) || '{}');
      map[characterId] = rec;
      localStorage.setItem(key, JSON.stringify(map));
    }
    return rec;
  }

  async function listAll() {
    if (db) {
      const [chars, worldbooks, regexsets, bindings] = await Promise.all([
        db.chars.orderBy('importedAt').reverse().toArray(),
        db.worldbooks.orderBy('importedAt').reverse().toArray(),
        db.regexsets.orderBy('importedAt').reverse().toArray(),
        db.bindings.toArray()
      ]);
      return { chars, worldbooks, regexsets, bindings };
    }
    const lib = getCurrentLib();
    const chars = JSON.parse(localStorage.getItem(`customImport.${lib}.chars`) || '[]');
    const worldbooks = JSON.parse(localStorage.getItem(`customImport.${lib}.worldbooks`) || '[]');
    const regexsets = JSON.parse(localStorage.getItem(`customImport.${lib}.regexsets`) || '[]');
    const bindingsMap = JSON.parse(localStorage.getItem(`customImport.${lib}.bindings`) || '{}');
    const bindings = Object.values(bindingsMap);
    chars.sort((a, b) => b.importedAt - a.importedAt);
    worldbooks.sort((a, b) => b.importedAt - a.importedAt);
    regexsets.sort((a, b) => b.importedAt - a.importedAt);
    return { chars, worldbooks, regexsets, bindings };
  }

  async function resetCurrentLib() {
    const lib = getCurrentLib();
    if (db) {
      await db.delete();
      await openDb(lib);
      return;
    }
    // localStorage fallback
    ['chars', 'worldbooks', 'regexsets', 'bindings'].forEach(k => {
      localStorage.removeItem(`customImport.${lib}.${k}`);
    });
  }

  // ---------- Importers ----------
  async function importCharacterFile(file) {
    const lower = (file.name || '').toLowerCase();
    if (lower.endsWith('.json')) {
      const text = await file.text();
      return JSON.parse(text);
    }
    if (lower.endsWith('.png')) {
      const buf = await file.arrayBuffer();
      const chunks = extractPngTextChunks(buf);
      const obj = tryParseJsonFromPngTexts(chunks);
      if (!obj) throw new Error('PNG 里没找到可解析的 JSON（可能是压缩 iTXt/zTXt 卡，后续可加增强解析）。');
      return obj;
    }
    throw new Error('仅支持 .png 或 .json');
  }

  async function importJsonFile(file) {
    const text = await file.text();
    return JSON.parse(text);
  }

  // ---------- Render ----------
  async function renderList() {
    const el = $(UI.listId);
    if (!el) return;
    const data = await listAll();

    const bindingByChar = new Map();
    for (const b of data.bindings) bindingByChar.set(b.characterId, b);

    const lines = [];
    lines.push(`当前测试库：${getCurrentLib()}  （Dexie: ${hasDexie() ? 'Yes' : 'No'}）`);
    lines.push('');

    lines.push(`角色：${data.chars.length}`);
    for (const c of data.chars.slice(0, 20)) {
      const b = bindingByChar.get(c.id);
      const wN = b?.worldbookIds?.length || 0;
      const rN = b?.regexSetIds?.length || 0;
      lines.push(`- ${c.name}  (世界书:${wN} 正则:${rN})`);
    }
    if (data.chars.length > 20) lines.push(`...（还有 ${data.chars.length - 20} 个角色未显示）`);

    lines.push('');
    lines.push(`世界书：${data.worldbooks.length}`);
    for (const w of data.worldbooks.slice(0, 10)) lines.push(`- ${w.name}`);
    if (data.worldbooks.length > 10) lines.push(`...（还有 ${data.worldbooks.length - 10} 个世界书未显示）`);

    lines.push('');
    lines.push(`正则：${data.regexsets.length}`);
    for (const r of data.regexsets.slice(0, 10)) lines.push(`- ${r.name}`);
    if (data.regexsets.length > 10) lines.push(`...（还有 ${data.regexsets.length - 10} 个正则未显示）`);

    el.textContent = lines.join('\n');
  }

  function renderLibSelect() {
    const sel = $(UI.libSelectId);
    if (!sel) return;
    const libs = getLibs();
    const cur = getCurrentLib();
    sel.innerHTML = '';
    for (const lib of libs) {
      const opt = document.createElement('option');
      opt.value = lib;
      opt.textContent = lib;
      if (lib === cur) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function switchLib(lib) {
    setCurrentLib(lib);
    if (db) {
      try { db.close(); } catch {}
    }
    await openDb(lib);
    renderLibSelect();
    await renderList();
  }

  // ---------- Wire ----------
  async function wire() {
    // Ensure libs exist
    const libs = getLibs();
    setLibs(libs);

    // open DB
    await openDb(getCurrentLib());

    const openBtn = $(UI.openBtnId);
    const closeBtn = $(UI.closeBtnId);
    const libSelect = $(UI.libSelectId);
    const newLibBtn = $(UI.newLibBtnId);
    const resetBtn = $(UI.resetLibBtnId);

    const doCharBtn = $(UI.doCharBtnId);
    const doWorldBtn = $(UI.doWorldBtnId);
    const doRegexBtn = $(UI.doRegexBtnId);

    if (openBtn) {
      openBtn.addEventListener('click', async () => {
        setStatus('');
        renderLibSelect();
        await renderList();
        openModal();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const modal = $(UI.modalId);
    if (modal) {
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) closeModal();
      });
    }

    if (libSelect) {
      libSelect.addEventListener('change', async () => {
        await switchLib(libSelect.value);
      });
    }

    if (newLibBtn) {
      newLibBtn.addEventListener('click', async () => {
        const name = randomLibName();
        const libs = getLibs();
        libs.unshift(name);
        const uniq = Array.from(new Set(libs));
        setLibs(uniq);
        await switchLib(name);
        setStatus(`已创建测试库：${name}`);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const ok = confirm(`确定清空测试库「${getCurrentLib()}」的导入数据吗？`);
        if (!ok) return;
        await resetCurrentLib();
        await renderList();
        setStatus('已清空当前测试库。');
      });
    }

    if (doCharBtn) {
      doCharBtn.addEventListener('click', async () => {
        try {
          setStatus('正在导入角色卡…');
          const input = $(UI.charInputId);
          const file = input?.files?.[0];
          if (!file) { setStatus('请选择一个角色卡文件（.png/.json）'); return; }

          const charObj = await importCharacterFile(file);
          const charRec = await putChar(charObj, file.name);

          // auto import embedded assets (best-effort)
          const embedded = extractEmbeddedAssetsFromCharacter(charObj);
          const worldIds = [];
          const regexIds = [];
          for (const w of embedded.worldbooks) {
            try {
              const wRec = await putWorldBook(w, `${charRec.name}-world`);
              worldIds.push(wRec.id);
            } catch {}
          }
          for (const r of embedded.regexsets) {
            try {
              const rRec = await putRegexSet(r, `${charRec.name}-regex`);
              regexIds.push(rRec.id);
            } catch {}
          }
          await putBinding(charRec.id, worldIds, regexIds);

          setStatus(`导入成功：${charRec.name}\n自动带入：世界书 ${worldIds.length}，正则 ${regexIds.length}`);
          await renderList();
        } catch (e) {
          setStatus('导入失败：\n' + (e?.message || String(e)));
        }
      });
    }

    if (doWorldBtn) {
      doWorldBtn.addEventListener('click', async () => {
        try {
          setStatus('正在导入世界书…');
          const input = $(UI.worldInputId);
          const file = input?.files?.[0];
          if (!file) { setStatus('请选择一个世界书 JSON 文件'); return; }
          const obj = await importJsonFile(file);
          const rec = await putWorldBook(obj, file.name);
          setStatus(`世界书导入成功：${rec.name}`);
          await renderList();
        } catch (e) {
          setStatus('导入失败：\n' + (e?.message || String(e)));
        }
      });
    }

    if (doRegexBtn) {
      doRegexBtn.addEventListener('click', async () => {
        try {
          setStatus('正在导入正则…');
          const input = $(UI.regexInputId);
          const file = input?.files?.[0];
          if (!file) { setStatus('请选择一个正则 JSON 文件'); return; }
          const obj = await importJsonFile(file);
          const rec = await putRegexSet(obj, file.name);
          setStatus(`正则导入成功：${rec.name}`);
          await renderList();
        } catch (e) {
          setStatus('导入失败：\n' + (e?.message || String(e)));
        }
      });
    }

    // initial
    renderLibSelect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { wire(); });
  } else {
    wire();
  }
})();
