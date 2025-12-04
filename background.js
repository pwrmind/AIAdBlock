// background.js (Service Worker)

// Импортируем brain.js и нашу модель признаков
importScripts('brain-browser.min.js');
importScripts('featureExtractor.js');

let net;
let trainingData = [];
let ruleIdCounter = 1;
let sessionData = {}; // Хранение данных по сессиям
let isTraining = false; // Флаг для предотвращения одновременного обучения

// Инициализация сети или загрузка из хранилища
async function initializeNetwork() {
    net = new brain.NeuralNetwork();
    const storedData = await chrome.storage.local.get(['brainModel', 'trainingData', 'ruleIdCounter', 'sessionData']);
    
    if (storedData.brainModel) {
        net.fromJSON(storedData.brainModel);
    }

    if (storedData.trainingData) {
        trainingData = storedData.trainingData;
    }

    if (storedData.ruleIdCounter) {
        ruleIdCounter = storedData.ruleIdCounter;
    }

    if (storedData.sessionData) {
        sessionData = storedData.sessionData;
    }
    
    // Регистрируем слушатели для сбора данных
    registerRequestListeners();
    registerTabListeners();
}

// Регистрация слушателей для сбора данных о запросах
function registerRequestListeners() {
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
            // Пропускаем запросы к самим правилам расширения
            if (details.url.includes('chrome-extension://') || 
                details.url.includes('moz-extension://')) return;
            
            // Получаем текущую активную вкладку для определения mainDomain
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs.length > 0) {
                    const tab = tabs[0];
                    const tabId = tab.id;
                    const tabUrl = tab.url;
                    
                    if (!tabUrl || tabUrl.startsWith('chrome://')) return;
                    
                    const mainDomain = new URL(tabUrl).hostname;
                    const targetUrl = details.url;
                    const targetDomain = new URL(targetUrl).hostname;
                    
                    // Извлекаем признаки
                    const features = extractFeaturesFromUrl(targetUrl, mainDomain);
                    
                    // Проверяем, является ли запрос сторонним и имеет признаки рекламы
                    const thirdParty = targetDomain !== mainDomain;
                    const isAd = features[1] > 0.5; // Второй признак - hasBlockingKeyword
                    
                    // Сохраняем в сессионные данные только сторонние запросы с признаками рекламы
                    if (thirdParty && isAd) {
                        // Инициализируем данные сессии, если их еще нет
                        if (!sessionData[tabId]) {
                            sessionData[tabId] = {
                                mainDomain: mainDomain,
                                timestamp: Date.now(),
                                collectedData: []
                            };
                        }
                        
                        // Сохраняем данные о запросе
                        sessionData[tabId].collectedData.push({
                            url: targetUrl,
                            domain: targetDomain,
                            features: features,
                            timestamp: Date.now()
                        });
                        
                        // Сохраняем в хранилище для устойчивости к перезагрузкам
                        chrome.storage.local.set({ sessionData: sessionData });
                    }
                }
            });
        },
        {urls: ["<all_urls>"]},
        ["blocking"]
    );
}

// Регистрация слушателей вкладок для определения завершения сессий
function registerTabListeners() {
    // Отслеживаем закрытие вкладок
    chrome.tabs.onRemoved.addListener((tabId) => {
        if (sessionData[tabId]) {
            // Запускаем обучение после небольшой задержки, чтобы собрать все данные
            setTimeout(() => processSessionData(tabId), 1000);
        }
    });
    
    // Отслеживаем переход на другую страницу
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url && sessionData[tabId]) {
            // Старая сессия завершена, запускаем обучение
            setTimeout(() => processSessionData(tabId), 1000);
        }
    });
    
    // Обработка закрытия всего браузера (насколько это возможно)
    chrome.runtime.onSuspend.addListener(() => {
        Object.keys(sessionData).forEach(tabId => {
            processSessionData(tabId);
        });
    });
}

// Обработка данных сессии и обучение модели
async function processSessionData(tabId) {
    if (isTraining || !sessionData[tabId]) return;
    
    isTraining = true;
    
    try {
        const session = sessionData[tabId];
        const collectedData = session.collectedData;
        
        // Обучаем модель только для самых подозрительных запросов
        const suspiciousRequests = collectedData.filter(item => {
            // Отбираем запросы с высокой вероятностью рекламы
            const [isThirdParty, hasBlockingKeyword, isAsset] = item.features;
            return hasBlockingKeyword > 0.5 && isThirdParty > 0.5;
        });
        
        // Ограничиваем количество запросов для обучения в одной сессии
        const limitedRequests = suspiciousRequests.slice(0, 10);
        
        console.log(`Обработка сессии для домена ${session.mainDomain}. Всего собрано: ${collectedData.length}, Будет обучено на: ${limitedRequests.length} запросах`);
        
        for (const item of limitedRequests) {
            // Предсказание модели
            const prediction = net.run(item.features);
            
            // Если вероятность рекламы > 0.6, добавляем в обучающую выборку с меткой 1
            if (prediction > 0.6) {
                await trainModel(item.features, 1);
                
                // Добавляем правило блокировки для этого домена
                await updateBlockingRules(item.domain);
                console.log(`Добавлено правило блокировки для домена: ${item.domain}`);
            }
        }
        
        // Очищаем данные сессии
        delete sessionData[tabId];
        await chrome.storage.local.set({ sessionData: sessionData });
        
    } catch (error) {
        console.error('Ошибка при обработке сессии:', error);
    } finally {
        isTraining = false;
    }
}

// Функция для обучения модели на новых данных
async function trainModel(features, label) {
    trainingData.push({
        input: features,
        output: [label]
    });
    
    // Ограничиваем размер обучающей выборки для производительности
    if (trainingData.length > 1000) {
        trainingData = trainingData.slice(-1000);
    }

    net.train(trainingData, { iterations: 100, log: false, errorThresh: 0.01 });
    
    // Сохраняем модель и данные
    await chrome.storage.local.set({ 
        brainModel: net.toJSON(),
        trainingData: trainingData
    });
}

// Обновление динамических правил dNR
async function updateBlockingRules(domainToBlock) {
    // Проверяем, нет ли уже правила для этого домена
    const existingRules = await new Promise(resolve => {
        chrome.declarativeNetRequest.getDynamicRules(resolve);
    });
    
    const alreadyBlocked = existingRules.some(rule => 
        rule.condition && rule.condition.urlFilter && rule.condition.urlFilter.includes(domainToBlock)
    );
    
    if (alreadyBlocked) {
        console.log(`Домен ${domainToBlock} уже заблокирован`);
        return;
    }

    const currentId = ruleIdCounter++;
    
    const newRule = {
        id: currentId,
        priority: 1,
        action: { type: "block" },
        condition: { 
            urlFilter: `||${domainToBlock}^`, 
            resourceTypes: ["script", "image", "sub_frame", "xmlhttprequest", "other", "media"]
        }
    };

    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [newRule]
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Ошибка при добавлении правила:", chrome.runtime.lastError);
            // Возвращаем счетчик, если правило не добавлено
            ruleIdCounter--;
        } else {
            console.log(`Dynamic rule added for: ${domainToBlock} with ID: ${currentId}`);
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
        if (!tab.url || tab.url.startsWith('chrome://')) {
            sendResponse({ status: "Cannot process internal pages" });
            return;
        }
        
        const mainDomain = new URL(tab.url).hostname;
        const targetDomain = new URL(url).hostname;
        const features = extractFeaturesFromUrl(url, mainDomain);
        const label = block ? 1 : 0;
        
        // Добавляем данные в обучающую выборку
        await trainModel(features, label);

        // Если пользователь решил заблокировать, добавляем правило
        if (block) {
            await updateBlockingRules(targetDomain);
        } else {
            // TODO: Реализовать удаление правил для разрешенных доменов
            console.log(`Пользователь разрешил ресурс: ${url}`);
        }

        sendResponse({ status: "Model updated and rules applied." });
    } else if (request.action === "getPrediction") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.url || tab.url.startsWith('chrome://')) {
            sendResponse({ prediction: 0 });
            return;
        }
        
        const mainDomain = new URL(tab.url).hostname;
        const features = extractFeaturesFromUrl(request.url, mainDomain);
        const prediction = net.run(features);
        
        sendResponse({ prediction: prediction });
    }
});

// Инициализация при запуске
initializeNetwork();

// Очистка старых правил при обновлении
chrome.runtime.onUpdateAvailable.addListener(() => {
    console.log("Обновление доступно, очистка старых правил...");
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({length: ruleIdCounter}, (_, i) => i + 1)
    });
});