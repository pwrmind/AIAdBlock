// background.js (Service Worker)

// Импортируем brain.js и нашу модель признаков
importScripts('brain-browser.min.js');
importScripts('featureExtractor.js');

let net;
let trainingData = [];
// Инициализация счетчика правил по умолчанию (если еще не сохранен в storage)
let ruleIdCounter = 1; 

// Инициализация сети или загрузка из хранилища
async function initializeNetwork() {
    net = new brain.NeuralNetwork();
    const storedData = await chrome.storage.local.get(['brainModel', 'trainingData', 'ruleIdCounter']);
    
    if (storedData.brainModel) {
        net.fromJSON(storedData.brainModel);
    }

    if (storedData.trainingData) {
        trainingData = storedData.trainingData;
    }

    if (storedData.ruleIdCounter) {
        ruleIdCounter = storedData.ruleIdCounter;
    }
}

initializeNetwork();

// Функция для обучения модели на новых данных
async function trainModel(features, label) {
    trainingData.push({
        input: features,
        output: [label]
    });

    net.train(trainingData, { iterations: 200, log: false, errorThresh: 0.005 });
    
    // Сохраняем модель и данные
    await chrome.storage.local.set({ 
        brainModel: net.toJSON(),
        trainingData: trainingData
    });
}

// НОВАЯ ФУНКЦИЯ: Обновление динамических правил dNR
// Принимает домен для добавления в список блокировки
async function updateBlockingRules(domainToBlock) {
    // Получаем текущее максимальное ID из хранилища и инкрементируем его
    const currentId = ruleIdCounter++; 
    
    const newRule = {
        id: currentId, // Используем уникальный ID
        priority: 1,
        action: { type: "block" },
        condition: { 
            // Фильтр для блокировки всего трафика на этот домен и поддомены
            urlFilter: `||${domainToBlock}^`, 
            resourceTypes: ["script", "image", "sub_frame", "main_frame", "xmlhttprequest", "other"]
        }
    };

    // Обновляем правила: добавляем новое правило
    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [newRule]
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Ошибка при добавлении правила:", chrome.runtime.lastError);
        } else {
            console.log(`Dynamic rule added for: ${domainToBlock} with ID: ${currentId}`);
            // Сохраняем обновленный счетчик ID после успешного добавления
            chrome.storage.local.set({ ruleIdCounter: ruleIdCounter });
        }
    });
}


// Слушаем сообщения из popup.js (обратная связь от пользователя)
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "userFeedback") {
        const { url, block } = request;
        
        // Получаем основной домен страницы для извлечения признаков third-party
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const mainDomain = new URL(tab.url).hostname;
        const targetDomain = new URL(url).hostname; // Домен, который нужно заблокировать/разрешить

        const features = extractFeaturesFromUrl(url, mainDomain);
        const label = block ? 1 : 0;

        console.log(`Training model with features for ${url}, label: ${label}`);
        await trainModel(features, label);

        // Если пользователь решил заблокировать, вызываем новую функцию с доменом
        if (block) {
            await updateBlockingRules(targetDomain);
        }
        // TODO: Реализовать логику удаления правил, если пользователь нажал "Разрешить"

        sendResponse({ status: "Model updated and rules applied." });
    }
});
