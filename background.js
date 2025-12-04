// background.js (Service Worker)

// Импортируем brain.js и нашу модель признаков
importScripts('brain-browser.min.js');
importScripts('featureExtractor.js');

let net;
let trainingData = [];
const mainDomainCache = {}; // Кэш доменов для определения third-party

// Инициализация сети или загрузка из хранилища
async function initializeNetwork() {
    net = new brain.NeuralNetwork();
    const storedModelJson = await chrome.storage.local.get(['brainModel', 'trainingData']);
    
    if (storedModelJson.brainModel) {
        net.fromJSON(storedModelJson.brainModel); // Возобновляем обучение
    } else {
        // Начальная пустая модель
        console.log("Initializing new brain.js model.");
    }

    if (storedModelJson.trainingData) {
        trainingData = storedModelJson.trainingData;
    }
}

initializeNetwork();

// Функция для обучения модели на новых данных
async function trainModel(features, label) {
    trainingData.push({
        input: features,
        output: [label]
    });

    // Обучаем модель на всем наборе данных (простой пример)
    net.train(trainingData, { iterations: 200, log: true, errorThresh: 0.005 });
    
    // Сохраняем модель и данные
    await chrome.storage.local.set({ 
        brainModel: net.toJSON(),
        trainingData: trainingData
    });
}

// Функция для обновления динамических правил dNR
async function updateBlockingRules() {
    // В реальном приложении вы бы здесь предсказали тысячи доменов
    // и сгенерировали правила. Для примера мы просто добавим
    // статическое правило, чтобы показать механику обновления.

    // В более сложном случае: генерируете список из 1000 "плохих" доменов 
    // используя обученную модель и сохраняете их как правила.

    const newRules = [{
        id: 1, // Правила должны иметь уникальные ID
        priority: 1,
        action: { type: "block" },
        condition: { 
            urlFilter: "doubleclick.net", // Пример домена для блокировки
            resourceTypes: ["script", "image", "sub_frame"]
        }
    }];

    // Удаляем старые правила и добавляем новые динамически
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1], // ID существующих правил, которые нужно удалить
        addRules: newRules
    }, () => console.log("Dynamic rules updated."));
}


// Слушаем сообщения из popup.js (обратная связь от пользователя)
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "userFeedback") {
        const { url, block } = request;
        
        // Получаем основной домен страницы для извлечения признаков third-party
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const mainDomain = new URL(tab.url).hostname;

        const features = extractFeaturesFromUrl(url, mainDomain);
        const label = block ? 1 : 0;

        console.log(`Training model with features for ${url}, label: ${label}`);
        await trainModel(features, label);
        await updateBlockingRules(); // Обновляем правила после обучения

        sendResponse({ status: "Model updated and rules applied." });
    }
});
