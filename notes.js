const STORAGE_KEY = 'minimal_notes';
const SESSION_KEY = 'pending_note';
const MAX_SIZE = 4 * 1024 * 1024;

const editor = document.getElementById('editor');
const statusEl = document.getElementById('status');

let saveTimeout;
let lastContent = '';
let isSaving = false;

const msg = {
    saving: 'Сохранение...',
    saved: 'Сохранено',
    loaded: 'Загружено',
    restored: 'Восстановлено из черновика',
    sizeErr: 'Превышен лимит',
    saveErr: 'Ошибка сохранения',
    loadErr: 'Ошибка загрузки',
    syncErr: 'Ошибка синхронизации'
};

function showStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.classList.add('show');
    setTimeout(() => statusEl.classList.remove('show'), isError ? 3000 : 1500);
}

function saveToSession(text) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ text, ts: Date.now() })); } catch (e) {}
}

function saveNotes(show) {
    const text = editor.value;
    if (text === lastContent || isSaving) return;
    if (new Blob([text]).size > MAX_SIZE) {
        showStatus(msg.sizeErr + ' 4 МБ', true);
        return;
    }
    isSaving = true;
    if (show) showStatus(msg.saving);
    saveToSession(text);
    chrome.storage.local.set({ [STORAGE_KEY]: text }, () => {
        isSaving = false;
        if (chrome.runtime.lastError) {
            if (show) showStatus(msg.saveErr, true);
            return;
        }
        lastContent = text;
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
        if (show) showStatus(msg.saved);
    });
}

function loadNotes() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        let saved = '';
        if (!chrome.runtime.lastError && result[STORAGE_KEY]) saved = result[STORAGE_KEY];
        else if (chrome.runtime.lastError) showStatus(msg.loadErr, true);

        let backup = null;
        try { const r = sessionStorage.getItem(SESSION_KEY); if (r) backup = JSON.parse(r); } catch (e) {}

        let text = saved;
        let fromBackup = false;
        if (backup && backup.text && backup.text !== saved) {
            text = backup.text;
            fromBackup = true;
            try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
        }

        editor.value = text;
        lastContent = text;
        if (text) showStatus(fromBackup ? msg.restored : msg.loaded);
        if (fromBackup) chrome.storage.local.set({ [STORAGE_KEY]: text }, () => {
            if (chrome.runtime.lastError) showStatus(msg.syncErr, true);
        });
    });
}

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNotes(true); }
});

editor.addEventListener('input', () => {
    saveToSession(editor.value);
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveNotes(true), 200);
});

editor.addEventListener('blur', () => { clearTimeout(saveTimeout); saveNotes(true); });
window.addEventListener('beforeunload', () => { saveToSession(editor.value); saveNotes(false); });

loadNotes();
editor.focus();