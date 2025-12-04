// popup.js

document.getElementById('blockBtn').addEventListener('click', () => {
    sendFeedback(true);
});

document.getElementById('allowBtn').addEventListener('click', () => {
    sendFeedback(false);
});

async function sendFeedback(block) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Обучаю модель...';

    // Получаем текущий активный URL
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Отправляем сообщение в service worker (background.js)
    chrome.runtime.sendMessage({
        action: "userFeedback",
        url: tab.url,
        block: block
    }, (response) => {
        statusEl.textContent = response.status;
    });
}
