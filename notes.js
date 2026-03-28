const STORAGE_KEY = 'minimal_notes';
const editor = document.getElementById('editor');
const statusEl = document.getElementById('status');

let saveTimeout;
let lastContent = '';

const showStatus = (text = 'Сохранено') => {
    statusEl.textContent = text;
    statusEl.classList.add('show');
    setTimeout(() => statusEl.classList.remove('show'), 1500);
};

const saveNotes = (showFeedback = true) => {
    const content = editor.value;
    if (content === lastContent) return;
    chrome.storage.local.set({ [STORAGE_KEY]: content }, () => {
        if (!chrome.runtime.lastError) {
            lastContent = content;
            if (showFeedback) showStatus();
        } else if (showFeedback) showStatus('⚠️ Ошибка');
    });
};

const loadNotes = () => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        const saved = result[STORAGE_KEY] || '';
        editor.value = saved;
        lastContent = saved;
        if (saved) showStatus('Загружено');
    });
};

editor.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveNotes(true), 300);
});
editor.addEventListener('blur', () => {
    clearTimeout(saveTimeout);
    saveNotes(true);
});
window.addEventListener('beforeunload', () => saveNotes(false));

loadNotes();
setTimeout(() => editor.focus(), 50);