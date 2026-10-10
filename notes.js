const STORAGE_KEY = 'minimal_notes';
const BACKUP_KEY = 'pending_note_backup';
const MAX_SIZE = (chrome.storage.local.QUOTA_BYTES || 5 * 1024 * 1024) - 4096;
const BACKUP_DEBOUNCE_MS = 300;
const SAVE_DEBOUNCE_MS = 200;
const RETRY_DELAY_MS = 1000;

const editor = document.getElementById('editor');
const statusEl = document.getElementById('status');
const srStatusEl = document.getElementById('srStatus');

let saveTimeout;
let backupTimeout;
let lastContent = '';
let isSaving = false;
let pendingSave = false;
let statusTimeout;

const msg = {
    saving: 'Сохранение...',
    saved: 'Сохранено',
    loaded: 'Загружено',
    restored: 'Восстановлено из черновика',
    external: 'Обновлено из другой вкладки',
    conflict: 'В другой вкладке есть изменения',
    sizeErr: 'Превышен лимит',
    quotaErr: 'Хранилище заполнено',
    saveErr: 'Ошибка сохранения',
    loadErr: 'Ошибка загрузки',
    syncErr: 'Ошибка синхронизации'
};

function showStatus(text, isError, announce) {
    clearTimeout(statusTimeout);
    statusEl.textContent = text;
    statusEl.classList.add('show');

    if (announce) {
        srStatusEl.textContent = '';
        requestAnimationFrame(() => { srStatusEl.textContent = text; });
    }

    statusTimeout = setTimeout(
        () => statusEl.classList.remove('show'),
        isError ? 3000 : 1500
    );
}

function clearBackup() {
    try { localStorage.removeItem(BACKUP_KEY); } catch (e) {}
}

function saveToBackup(text) {
    try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ text, ts: Date.now() }));
    } catch (e) {}
}

function saveToBackupDebounced(text) {
    clearTimeout(backupTimeout);
    backupTimeout = setTimeout(() => saveToBackup(text), BACKUP_DEBOUNCE_MS);
}

function byteSize(text) {
    return new Blob([text]).size;
}

function formatSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function isQuotaError(e) {
    const m = (e && e.message) || '';
    return /quota/i.test(m) || /QUOTA_BYTES/.test(m);
}

async function saveNotes(show) {
    clearTimeout(backupTimeout);
    const text = editor.value;

    if (text === lastContent) {
        clearBackup();
        return;
    }

    if (byteSize(text) > MAX_SIZE) {
        showStatus(msg.sizeErr + ' ' + formatSize(MAX_SIZE), true, true);
        return;
    }

    if (isSaving) {
        pendingSave = true;
        return;
    }

    isSaving = true;
    if (show) showStatus(msg.saving);
    saveToBackup(text);

    try {
        await chrome.storage.local.set({ [STORAGE_KEY]: text });
        lastContent = text;
        clearBackup();
        if (show) showStatus(msg.saved);
    } catch (e) {
        if (isQuotaError(e)) {
            showStatus(msg.quotaErr, true, true);
        } else {
            showStatus(msg.saveErr, true, true);
        }
    } finally {
        isSaving = false;
        if (pendingSave) {
            pendingSave = false;
            setTimeout(() => saveNotes(show), RETRY_DELAY_MS);
        }
    }
}

async function loadNotes() {
    let saved = '';
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        if (result && typeof result[STORAGE_KEY] === 'string') {
            saved = result[STORAGE_KEY];
        }
    } catch (e) {
        showStatus(msg.loadErr, true, true);
    }

    let backup = null;
    try {
        const r = localStorage.getItem(BACKUP_KEY);
        if (r) backup = JSON.parse(r);
    } catch (e) {}

    let text = saved;
    let fromBackup = false;

    if (backup && typeof backup.text === 'string' && backup.text !== saved) {
        text = backup.text;
        fromBackup = true;
    }

    editor.value = text;
    lastContent = text;

    if (text) showStatus(fromBackup ? msg.restored : msg.loaded, false, true);

    if (fromBackup) {
        try {
            await chrome.storage.local.set({ [STORAGE_KEY]: text });
            clearBackup();
        } catch (e) {
            showStatus(msg.syncErr, true, true);
        }
    } else {
        clearBackup();
    }

    editor.focus();
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;

    const newValue = changes[STORAGE_KEY].newValue;
    if (typeof newValue !== 'string') return;
    if (newValue === lastContent) return;

    if (editor.value !== lastContent) {
        showStatus(msg.conflict, true, true);
        return;
    }

    editor.value = newValue;
    lastContent = newValue;
    showStatus(msg.external, false, true);
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        saveNotes(true);
    }
});

editor.addEventListener('input', () => {
    saveToBackupDebounced(editor.value);
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveNotes(true), SAVE_DEBOUNCE_MS);
});

editor.addEventListener('blur', () => {
    clearTimeout(saveTimeout);
    saveNotes(true);
});

window.addEventListener('beforeunload', () => {
    clearTimeout(backupTimeout);
    saveToBackup(editor.value);
    saveNotes(false);
});

loadNotes();