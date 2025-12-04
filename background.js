// background.js (Service Worker) - без использования blocking webRequest

// Импортируем brain.js и нашу модель признаков
importScripts('brain-browser.min.js');
importScripts('featureExtractor.js');

let net;
let trainingData = [];
let ruleIdCounter = 1;
let sessionData = {};
let isTraining = false;

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
    
    // Регистрируем слушатели для сбора данных (без blocking!)
    registerRequestListeners();
    registerTabListeners();
}

// Регистрация слушателей для сбора данных о запросах
// ТОЛЬКО пассивное прослушивание без blocking
function registerRequestListeners() {
    // Используем только passive listener для сбора данных
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
            // Пропускаем запросы к самим правилам расширения
            if (details.url.includes('chrome-extension://') || 
                details.url.includes('moz-extension://')) return;
            
            // Асинхронно обрабатываем запрос
            setTimeout(() => {
                processRequestData(details);
            }, 0);
        },
        { urls: ["<all_urls>"] }
        // НЕ ИСПОЛЬЗУЕМ ["blocking"] - это доступно только для policy-installed extensions
    );
    
    // Также можно слушать completed запросы для более полной информации
    chrome.webRequest.onCompleted.addListener(
        (details) => {
            if (details.url.includes('chrome-extension://') || 
                details.url.includes('moz-extension://')) return;
            
            // Можно собирать дополнительную информацию о завершенных запросах
            logRequestInfo(details);
        },
        { urls: ["<all_urls>"] }
    );
}

// Обработка данных запроса асинхронно
async function processRequestData(details) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;
        
        const mainDomain = new URL(tab.url).hostname;
        const targetUrl = details.url;
        const targetDomain = new URL(targetUrl).hostname;
        
        // Извлекаем признаки
        const features = extractFeaturesFromUrl(targetUrl, mainDomain);
        
        // Проверяем, является ли запрос сторонним и имеет признаки рекламы
        const thirdParty = targetDomain !== mainDomain;
        const isAd = features[1] > 0.5; // Второй признак - hasBlockingKeyword
        
        // Сохраняем в сессионные данные только сторонние запросы с признаками рекламы
        if (thirdParty && isAd) {
            const tabId = tab.id;
            
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
                timestamp: Date.now(),
                requestId: details.requestId
            });
            
            // Сохраняем в хранилище для устойчивости к перезагрузкам
            await chrome.storage.local.set({ sessionData: sessionData });
            
            // Проверяем модель для потенциальной блокировки
            await checkAndBlockRequest(targetDomain, targetUrl, mainDomain, features);
        }
    } catch (error) {
        // Игнорируем ошибки, связанные с недоступностью вкладки или URL
        if (!error.message.includes('Invalid URL') && !error.message.includes('No tab')) {
            console.debug('Ошибка обработки запроса:', error.message);
        }
    }
}

// Логирование информации о запросе
function logRequestInfo(details) {
    // Можно собирать статистику или логировать для отладки
    const logEntry = {
        url: details.url,
        method: details.method,
        type: details.type,
        statusCode: details.statusCode,
        timestamp: Date.now()
    };
    
    // Сохраняем ограниченное количество логов
    chrome.storage.local.get(['requestLogs'], (result) => {
        const logs = result.requestLogs || [];
        logs.push(logEntry);
        if (logs.length > 1000) logs.shift(); // Ограничиваем размер
        chrome.storage.local.set({ requestLogs: logs });
    });
}

// Проверка и блокировка запросов через declarativeNetRequest
async function checkAndBlockRequest(domain, url, mainDomain, features) {
    try {
        // Предсказание модели
        const prediction = net.run(features);
        console.log("[checkAndBlockRequest]", prediction[0]);
        // Если вероятность рекламы высокая
        if (prediction[0] > 0.9) {
            console.log(`Высокая вероятность рекламы: ${domain} (${prediction[0].toFixed(2)})`);
            
            // Добавляем в обучающую выборку
            await trainModel(features, 1);
            
            // Добавляем правило блокировки для этого домена
            await updateBlockingRules(domain);
            
            return true;
        }
    } catch (error) {
        console.debug('Ошибка при проверке запроса:', error.message);
    }
    return false;
}

// Регистрация слушателей вкладок для определения завершения сессий
function registerTabListeners() {
    // Отслеживаем закрытие вкладок
    chrome.tabs.onRemoved.addListener((tabId) => {
        if (sessionData[tabId]) {
            // Запускаем обучение после небольшой задержки
            setTimeout(() => processSessionData(tabId), 1000);
        }
    });
    
    // Отслеживаем переход на другую страницу
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && sessionData[tabId]) {
            // Страница загружена полностью, можно обработать данные сессии
            setTimeout(() => processSessionData(tabId), 2000);
        }
    });
}

// Обработка данных сессии и обучение модели
async function processSessionData(tabId) {
    if (isTraining || !sessionData[tabId]) return;
    
    isTraining = true;
    
    try {
        const session = sessionData[tabId];
        const collectedData = session.collectedData;
        
        if (collectedData.length === 0) {
            delete sessionData[tabId];
            return;
        }
        
        console.log(`Обработка сессии для домена ${session.mainDomain}. Записей: ${collectedData.length}`);
        
        // Обучаем модель на части данных
        const sampleSize = Math.min(collectedData.length, 20);
        const sampleData = collectedData.slice(0, sampleSize);
        
        for (const item of sampleData) {
            try {
                const prediction = net.run(item.features);
                
                // Если модель уверена, что это реклама, добавляем в обучение
                if (prediction > 0.6) {
                    await trainModel(item.features, 1);
                }
            } catch (error) {
                console.debug('Ошибка при обучении на элементе:', error.message);
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
    try {
        trainingData.push({
            input: features,
            output: [label]
        });
        
        // Ограничиваем размер обучающей выборки
        if (trainingData.length > 500) {
            trainingData = trainingData.slice(-500);
        }

        // Обучение с ограничениями для производительности
        net.train(trainingData, { 
            iterations: 1000, 
            log: false, 
            errorThresh: 0.005,
            learningRate: 0.3
        });
        
        // Сохраняем модель и данные
        await chrome.storage.local.set({ 
            brainModel: net.toJSON(),
            trainingData: trainingData
        });
        
        console.log(`Модель обучена. Размер выборки: ${trainingData.length}`);
    } catch (error) {
        console.error('Ошибка при обучении модели:', error);
    }
}

// Обновление динамических правил через declarativeNetRequest API
async function updateBlockingRules(domainToBlock) {
    console.log("[updateBlockingRules] ", domainToBlock);
    try {
        // Проверяем, нет ли уже правила для этого домена
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        
        const alreadyBlocked = existingRules.some(rule => 
            rule.condition && rule.condition.urlFilter && 
            rule.condition.urlFilter.includes(domainToBlock)
        );
        
        if (alreadyBlocked) {
            console.log(`Домен ${domainToBlock} уже заблокирован`);
            return;
        }

        // Генерируем ID правила
        const currentId = ruleIdCounter++;
        
        // Создаем правило для безопасной блокировки
        const newRule = {
            id: currentId,
            priority: 1,
            action: { type: "block" },
            condition: { 
                urlFilter: `||${domainToBlock}^`,
                resourceTypes: ["script", "image", "sub_frame", "xmlhttprequest", "other", "media"]
            }
        };

        // Добавляем правило
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [newRule]
        });
        
        console.log(`Добавлено правило блокировки для домена: ${domainToBlock} (ID: ${currentId})`);
        
        // Сохраняем счетчик правил
        await chrome.storage.local.set({ ruleIdCounter: ruleIdCounter });
        
        // Проверяем лимиты
        const rules = await chrome.declarativeNetRequest.getDynamicRules();
        if (rules.length >= 29000) {
            console.warn('Приближаемся к лимиту динамических правил (30,000)');
        }
        
    } catch (error) {
        console.error("Ошибка при добавлении правила:", error);
        ruleIdCounter--; // Откатываем счетчик при ошибке
    }
}

// Удаление правил блокировки
async function removeBlockingRules(domainToRemove) {
    try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        
        const rulesToRemove = existingRules.filter(rule => 
            rule.condition && rule.condition.urlFilter && 
            rule.condition.urlFilter.includes(domainToRemove)
        );
        
        if (rulesToRemove.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: rulesToRemove.map(rule => rule.id)
            });
            console.log(`Удалены правила для домена: ${domainToRemove}`);
        }
    } catch (error) {
        console.error('Ошибка при удалении правил:', error);
    }
}

// Обработка пользовательского фидбека
async function handleUserFeedback(url, block) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
            return { status: "Cannot process internal pages" };
        }
        
        const mainDomain = new URL(tab.url).hostname;
        const targetDomain = new URL(url).hostname;
        const features = extractFeaturesFromUrl(url, mainDomain);
        const label = block ? 1 : 0;
        
        // Обновляем модель
        await trainModel(features, label);

        // Управляем правилами
        if (block) {
            await updateBlockingRules(targetDomain);
        } else {
            await removeBlockingRules(targetDomain);
        }

        return { status: "success", message: "Model updated and rules applied." };
    } catch (error) {
        console.error('Ошибка при обработке фидбека:', error);
        return { status: "error", message: error.message };
    }
}

// Слушаем сообщения
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "userFeedback") {
        const { url, block } = request;
        handleUserFeedback(url, block).then(sendResponse);
        return true; // Для асинхронного ответа
    } else if (request.action === "getPrediction") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                const tab = tabs[0];
                if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
                    sendResponse({ prediction: 0 });
                    return;
                }
                
                const mainDomain = new URL(tab.url).hostname;
                const features = extractFeaturesFromUrl(request.url, mainDomain);
                const prediction = net.run(features);
                
                sendResponse({ prediction: prediction });
            } catch (error) {
                console.error('Ошибка при получении предсказания:', error);
                sendResponse({ prediction: 0 });
            }
        });
        return true;
    } else if (request.action === "getStats") {
        chrome.storage.local.get(['brainModel', 'trainingData'], (result) => {
            const stats = {
                modelExists: !!result.brainModel,
                trainingDataSize: result.trainingData ? result.trainingData.length : 0,
                sessionDataSize: Object.keys(sessionData).length
            };
            sendResponse(stats);
        });
        return true;
    }
});

// Инициализация при запуске
initializeNetwork();

// Очистка при обновлении расширения
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'update') {
        console.log("Обновление расширения...");
        
        // Можно добавить миграцию данных при обновлении
        try {
            const rules = await chrome.declarativeNetRequest.getDynamicRules();
            console.log(`Текущее количество правил: ${rules.length}`);
            
            // Сбрасываем счетчик правил на максимальный существующий ID
            if (rules.length > 0) {
                const maxId = Math.max(...rules.map(r => r.id));
                ruleIdCounter = maxId + 1;
                await chrome.storage.local.set({ ruleIdCounter: ruleIdCounter });
            }
        } catch (error) {
            console.error('Ошибка при инициализации после обновления:', error);
        }
    }
});

// Экспорт для тестирования (если нужно)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeNetwork,
        updateBlockingRules,
        removeBlockingRules,
        handleUserFeedback
    };
}