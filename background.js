// ====================================================================
// autoencoder.js - Класс автоэнкодера для детектирования аномалий
// ====================================================================

class AutoencoderAnomalyDetector {
  constructor(inputSize = 195) {
    this.inputSize = inputSize;
    this.network = null; // Инициализируем позже
    this.isNetworkInitialized = false;
    
    this.normalPatterns = [];
    this.reconstructionErrors = [];
    this.threshold = 0.1;
    this.isTrained = false;
    this.minTrainingSamples = 100;
    this.bufferSize = 2000;
    this.trainingStats = {
      totalSamples: 0,
      lastTrainingTime: null,
      trainingCycles: 0
    };
  }
  
  // Инициализация сети (ленивая инициализация)
  initializeNetwork() {
    if (!this.network || !this.isNetworkInitialized) {
      this.network = new brain.NeuralNetwork({
        hiddenLayers: [
          Math.floor(this.inputSize / 2), 
          Math.floor(this.inputSize / 4), 
          Math.floor(this.inputSize / 2)
        ],
        activation: 'sigmoid'
      });
      this.isNetworkInitialized = true;
    }
  }
  
  extractFeatures(url, mainDomain) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname + urlObj.search;
      
      // 1. Энтропия домена
      const entropy = this.calculateDomainEntropy(hostname);
      
      // 2. Частоты биграмм (100 признаков)
      const bigramFreqs = this.calculateBigramFrequencies(pathname.toLowerCase());
      
      // 3. Комбинируем в один вектор
      return [entropy, ...bigramFreqs];
    } catch (error) {
      console.debug('Ошибка извлечения признаков:', error.message);
      return null;
    }
  }
  
  calculateDomainEntropy(domain) {
    const name = domain.split('.').slice(0, -1).join('');
    if (name.length < 2) return 0;
    
    const frequencies = {};
    for (const char of name) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
    
    let entropy = 0;
    const totalChars = name.length;
    for (const char in frequencies) {
      const probability = frequencies[char] / totalChars;
      entropy -= probability * Math.log2(probability);
    }
    
    return Math.min(entropy / 6, 1);
  }
  
  calculateBigramFrequencies(text) {
    const commonBigrams = [
        'th', 'he', 'in', 'er', 'an', 're', 'nd', 'on', 'at', 'en',
        'es', 'ed', 'ou', 'to', 'it', 'st', 'nt', 'ha', 'ng', 'as',
        'or', 'se', 'hi', 'ea', 'is', 'ar', 've', 'ra', 'ld', 'ur',
        'al', 'le', 'ro', 'ri', 'el', 'la', 'ti', 'ne', 'co', 'de',
        'me', 'na', 'li', 'si', 'll', 'te', 'fo', 'ic', 'of', 'ac',
        'ta', 'ce', 'io', 'us', 'ul', 'et', 'ec', 'wh', 'om', 'ut',
        'ct', 'pr', 'be', 'tr', 'id', 'il', 'no', 'so', 'lo', 'pe',
        'ss', 'ho', 'ay', 'pl', 'ad', 'ch', 'un', 'ot', 'wa', 'ap',
        'po', 'ke', 'ow', 'we', 'am', 'go', 'ma', 'pa', 'ca', 'op',
        "'s", "'t", "'m", "'ll", "'re", "'ve", 'qu', 'gh', 'ck', 'bb',
        // ad n-grams
        "ab", "ac", "ad", "af", "ai", "al", "an", "at", "ba", "be", "bi", "bl", "bo", "br",
        "ca", "ck", "cl", "cr", "cs", "de", "di", "do", "ds", "dv", "ea", "eb", "ec", "ed",
        "ef", "ei", "er", "et", "fe", "ff", "ic", "id", "im", "in", "io", "is", "it", "iz",
        "ki", "la", "le", "li", "ly", "m_", "mo", "mp", "na", "nd", "ne", "ng", "nn", "ns",
        "ol", "on", "oo", "op", "or", "ou", "pi", "po", "pr", "pu", "ra", "re", "ri", "rr",
        "rt", "rv", "se", "si", "so", "sp", "sy", "ta", "tb", "te", "ti", "tm", "tr", "ub",
        "un", "up", "ur", "ut", "ve", "wh", "yn", "yt", "za", "zo"
    ];
    
    const features = new Array(194).fill(0);
    const totalPossible = Math.max(1, text.length - 1);
    
    for (let i = 0; i < commonBigrams.length; i++) {
      const bigram = commonBigrams[i];
      let count = 0;
      
      // Простой подсчет вхождений
      for (let j = 0; j <= text.length - 2; j++) {
        if (text.substring(j, j + 2) === bigram) {
          count++;
        }
      }
      
      features[i] = count / totalPossible;
    }
    
    return features;
  }
  
  async train() {
    if (this.normalPatterns.length < this.minTrainingSamples) {
      console.log(`Недостаточно данных для обучения. Нужно: ${this.minTrainingSamples}, есть: ${this.normalPatterns.length}`);
      return false;
    }
    
    try {
      // Инициализируем сеть, если еще не инициализирована
      this.initializeNetwork();
      
      const trainingData = this.normalPatterns.map(pattern => ({
        input: pattern,
        output: pattern // Автоэнкодер учится воспроизводить вход
      }));
      
      // Проверяем, что есть данные для обучения
      if (trainingData.length === 0) {
        console.log('Нет данных для обучения');
        return false;
      }
      
      const result = await this.network.train(trainingData, {
        iterations: 10000, // Уменьшим для скорости
        errorThresh: 0.005, // Увеличим порог ошибки
        log: false,
        learningRate: 0.01,
        //timeout: 100 // Таймаут 30 секунд
      });
      
      this.calculateThreshold();
      this.isTrained = true;
      this.trainingStats.lastTrainingTime = Date.now();
      this.trainingStats.trainingCycles++;
      
      console.log(`Автоэнкодер обучен на ${this.normalPatterns.length} образцах. Порог: ${this.threshold.toFixed(4)}`);
      return true;
    } catch (error) {
      console.error('Ошибка обучения автоэнкодера:', error);
      return false;
    }
  }
  
  detectAnomaly(features) {
    if (!this.isTrained || !features || !this.network) {
      return { 
        isAnomaly: false, 
        error: 0, 
        threshold: this.threshold,
        reconstructionError: 0
      };
    }
    
    try {
      const reconstruction = this.network.run(features);
      const error = this.calculateMSE(features, reconstruction);
      
      // Сохраняем ошибку для расчета порога
      this.reconstructionErrors.push(error);
      if (this.reconstructionErrors.length > 1000) {
        this.reconstructionErrors.shift();
      }
      
      // Периодически пересчитываем порог
      if (this.reconstructionErrors.length % 100 === 0 && this.reconstructionErrors.length >= 10) {
        this.calculateThreshold();
      }
      
      return {
        isAnomaly: error > this.threshold,
        error: error,
        threshold: this.threshold,
        reconstructionError: error
      };
    } catch (error) {
      console.debug('Ошибка детектирования аномалии:', error);
      return { 
        isAnomaly: false, 
        error: 0, 
        threshold: this.threshold,
        reconstructionError: 0
      };
    }
  }
  
  calculateMSE(original, reconstruction) {
    let sum = 0;
    for (let i = 0; i < original.length; i++) {
      sum += Math.pow(original[i] - reconstruction[i], 2);
    }
    return sum / original.length;
  }
  
  calculateThreshold() {
    if (this.reconstructionErrors.length < 10) {
      return;
    }
    
    try {
      // Среднее значение ошибок
      const mean = this.reconstructionErrors.reduce((a, b) => a + b, 0) / this.reconstructionErrors.length;
      
      // Стандартное отклонение
      const variance = this.reconstructionErrors.reduce((sum, error) => {
        return sum + Math.pow(error - mean, 2);
      }, 0) / this.reconstructionErrors.length;
      
      const std = Math.sqrt(variance);
      
      // Динамический порог: среднее + 3 стандартных отклонения
      this.threshold = mean + (3 * std);
      
      // Ограничиваем разумными пределами
      this.threshold = Math.max(0.05, Math.min(this.threshold, 0.5));
      
    } catch (error) {
      console.debug('Ошибка расчета порога:', error);
      this.threshold = 0.1; // Значение по умолчанию
    }
  }
  
  addNormalPattern(features) {
    if (!features || features.length !== this.inputSize) {
      return;
    }
    
    // Проверяем, что features содержит числа
    if (!features.every(f => typeof f === 'number' && !isNaN(f))) {
      console.debug('Некорректные признаки:', features);
      return;
    }
    
    this.normalPatterns.push(features);
    this.trainingStats.totalSamples++;
    
    // Ограничиваем размер буфера
    if (this.normalPatterns.length > this.bufferSize) {
      this.normalPatterns = this.normalPatterns.slice(-this.bufferSize);
    }
  }
  
  getStats() {
    return {
      isTrained: this.isTrained,
      threshold: this.threshold,
      normalPatterns: this.normalPatterns.length,
      reconstructionErrors: this.reconstructionErrors.length,
      trainingStats: { ...this.trainingStats },
      isNetworkInitialized: this.isNetworkInitialized
    };
  }
  
  toJSON() {
    const json = {
      normalPatterns: this.normalPatterns,
      reconstructionErrors: this.reconstructionErrors,
      threshold: this.threshold,
      isTrained: this.isTrained,
      inputSize: this.inputSize,
      trainingStats: this.trainingStats,
      isNetworkInitialized: this.isNetworkInitialized
    };
    
    // Сохраняем состояние сети только если она инициализирована и обучена
    if (this.isNetworkInitialized && this.network) {
      try {
        json.network = this.network.toJSON();
      } catch (error) {
        console.warn('Не удалось сериализовать сеть:', error.message);
        json.network = null;
      }
    } else {
      json.network = null;
    }
    
    return json;
  }
  
  fromJSON(json) {
    if (!json) return;
    
    // Восстанавливаем простые поля
    if (json.normalPatterns) {
      this.normalPatterns = json.normalPatterns;
    }
    if (json.reconstructionErrors) {
      this.reconstructionErrors = json.reconstructionErrors;
    }
    if (json.threshold !== undefined) {
      this.threshold = json.threshold;
    }
    if (json.isTrained !== undefined) {
      this.isTrained = json.isTrained;
    }
    if (json.inputSize) {
      this.inputSize = json.inputSize;
    }
    if (json.trainingStats) {
      this.trainingStats = json.trainingStats;
    }
    if (json.isNetworkInitialized !== undefined) {
      this.isNetworkInitialized = json.isNetworkInitialized;
    }
    
    // Восстанавливаем сеть только если она была сохранена
    if (json.network && json.isNetworkInitialized) {
      try {
        this.initializeNetwork();
        this.network.fromJSON(json.network);
      } catch (error) {
        console.warn('Не удалось восстановить сеть:', error.message);
        this.network = null;
        this.isNetworkInitialized = false;
      }
    }
  }
}

// ====================================================================
// background.js - Основной сервис-воркер расширения
// ====================================================================

// Импортируем brain.js
importScripts('brain-browser.min.js');

let autoencoder = null;
let ruleIdCounter = 1;
let trainingPhase = 'collecting'; // collecting, training, active
let collectedSamples = 0;
let blockedDomains = new Set();
let isInitialized = false;
let pendingRequests = [];
let isProcessing = false;

// Инициализация системы
async function initializeSystem() {
  if (isInitialized) return;
  
  console.log('Инициализация автономной системы детектирования аномалий');
  
  // Создаем автоэнкодер
  autoencoder = new AutoencoderAnomalyDetector();
  
  // Загружаем сохраненное состояние
  const stored = await chrome.storage.local.get([
    'autoencoderState', 
    'ruleIdCounter',
    'trainingPhase',
    'collectedSamples',
    'blockedDomains',
    'systemReports'
  ]);
  
  if (stored.autoencoderState) {
    try {
      autoencoder.fromJSON(stored.autoencoderState);
      console.log('Автоэнкодер загружен из хранилища');
    } catch (error) {
      console.error('Ошибка загрузки автоэнкодера:', error);
      autoencoder = new AutoencoderAnomalyDetector();
    }
  }
  
  if (stored.ruleIdCounter) {
    ruleIdCounter = stored.ruleIdCounter;
  }
  
  if (stored.trainingPhase) {
    trainingPhase = stored.trainingPhase;
  }
  
  if (stored.collectedSamples) {
    collectedSamples = stored.collectedSamples;
  }
  
  if (stored.blockedDomains) {
    blockedDomains = new Set(stored.blockedDomains);
  }
  
  // Определяем текущую фазу
  determineTrainingPhase();
  
  // Регистрируем слушатели
  registerRequestListeners();
  
  // Запускаем периодические задачи
  registerPeriodicTasks();
  
  console.log(`Система инициализирована. Фаза: ${trainingPhase}, образцов: ${collectedSamples}`);
  
  isInitialized = true;
  
  // Если в фазе обучения, запускаем обучение
  if (trainingPhase === 'training') {
    setTimeout(async () => {
      await handleTrainingPhase();
    }, 1000);
  }
}

// Определение текущей фазы обучения
function determineTrainingPhase() {
  if (!autoencoder) return;
  
  const stats = autoencoder.getStats();
  
  if (!stats.isTrained && stats.normalPatterns < autoencoder.minTrainingSamples) {
    trainingPhase = 'collecting';
  } else if (!stats.isTrained && stats.normalPatterns >= autoencoder.minTrainingSamples) {
    trainingPhase = 'training';
  } else if (stats.isTrained) {
    trainingPhase = 'active';
  }
}

// Регистрация слушателей запросов
function registerRequestListeners() {
  // Пассивное прослушивание запросов (без блокировки)
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (shouldSkipRequest(details.url)) return;
      
      // Добавляем в очередь для асинхронной обработки
      pendingRequests.push(details);
      
      // Запускаем обработку, если не активна
      if (!isProcessing) {
        processPendingRequests();
      }
    },
    { urls: ["<all_urls>"] }
  );
}

// Обработка очереди запросов
async function processPendingRequests() {
  if (isProcessing || pendingRequests.length === 0) return;
  
  isProcessing = true;
  
  try {
    // Обрабатываем до 10 запросов за раз для производительности
    const batch = pendingRequests.splice(0, 10);
    
    for (const details of batch) {
      await processRequestForAnomalyDetection(details);
    }
  } catch (error) {
    console.error('Ошибка обработки запросов:', error);
  } finally {
    isProcessing = false;
    
    // Если есть еще запросы, обрабатываем дальше
    if (pendingRequests.length > 0) {
      setTimeout(processPendingRequests, 0);
    }
  }
}

// Проверка, нужно ли пропускать запрос
function shouldSkipRequest(url) {
  const skipPatterns = [
    'chrome-extension://',
    'moz-extension://',
    'chrome://',
    'about:',
    'data:',
    'blob:',
    'localhost',
    '127.0.0.1',
    '::1',
    'file://'
  ];
  
  return skipPatterns.some(pattern => url.includes(pattern));
}

// Обработка запроса для детектирования аномалий
async function processRequestForAnomalyDetection(details) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;
    
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;
    
    const mainDomain = extractDomain(tab.url);
    const targetUrl = details.url;
    const targetDomain = extractDomain(targetUrl);
    
    if (!mainDomain || !targetDomain) return;
    
    const features = autoencoder.extractFeatures(targetUrl, mainDomain);
    if (!features) return;
    
    const isFirstParty = targetDomain === mainDomain;
    
    switch (trainingPhase) {
      case 'collecting':
        await handleCollectingPhase(features, isFirstParty, targetDomain);
        break;
        
      case 'training':
        // В фазе обучения продолжаем собирать данные
        await handleCollectingPhase(features, isFirstParty, targetDomain);
        break;
        
      case 'active':
        await handleActivePhase(features, isFirstParty, targetDomain, targetUrl);
        break;
    }
    
  } catch (error) {
    // Игнорируем ошибки парсинга URL
    if (!error.message.includes('Invalid URL') && 
        !error.message.includes('No tab') &&
        !error.message.includes('URL constructor')) {
      console.debug('Ошибка обработки запроса:', error.message);
    }
  }
}

// Извлечение домена из URL
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return null;
  }
}

// Фаза сбора данных
async function handleCollectingPhase(features, isFirstParty, targetDomain) {
  if (!isFirstParty) return;
  
  autoencoder.addNormalPattern(features);
  collectedSamples++;
  
  // Сохраняем прогресс каждые 50 образцов
  if (collectedSamples % 50 === 0) {
    await saveSystemState();
    
    const stats = autoencoder.getStats();
    console.log(`Собрано ${collectedSamples} образцов. Буфер: ${stats.normalPatterns}`);
    
    // Проверяем, набрали ли достаточно данных для обучения
    if (stats.normalPatterns >= autoencoder.minTrainingSamples && trainingPhase === 'collecting') {
      trainingPhase = 'training';
      await saveSystemState();
      console.log('Достаточно данных для обучения. Переход в фазу обучения');
      
      // Запускаем обучение
      setTimeout(async () => {
        await handleTrainingPhase();
      }, 1000);
    }
  }
}

// Фаза обучения
async function handleTrainingPhase() {
  console.log('Начало обучения автоэнкодера...');
  
  const trained = await autoencoder.train();
  
  if (trained) {
    trainingPhase = 'active';
    await saveSystemState();
    console.log('Обучение завершено. Переход в активную фазу');
    
    const stats = autoencoder.getStats();
    console.log(`Порог установлен: ${stats.threshold.toFixed(4)}`);
  } else {
    console.log('Обучение не удалось. Остаемся в фазе сбора данных');
    trainingPhase = 'collecting';
    await saveSystemState();
  }
}

// Активная фаза - детектирование аномалий
async function handleActivePhase(features, isFirstParty, targetDomain, targetUrl) {
  if (isFirstParty) {
    // Продолжаем собирать нормальные данные для адаптации
    autoencoder.addNormalPattern(features);
    
    // Периодическое дообучение (раз в 500 новых образцов)
    const stats = autoencoder.getStats();
    if (stats.normalPatterns % 500 === 0 && stats.normalPatterns > 0) {
      console.log('Периодическое дообучение...');
      await autoencoder.train();
      await saveSystemState();
    }
  } else {
    // Проверяем third-party запросы на аномалии
    if (blockedDomains.has(targetDomain)) {
      return; // Уже заблокирован
    }
    
    const anomaly = autoencoder.detectAnomaly(features);
    
    if (anomaly.isAnomaly) {
      console.log(`Обнаружена аномалия: ${targetDomain}, ошибка: ${anomaly.error.toFixed(4)}`);
      
      // Принимаем решение о блокировке
      const shouldBlock = await evaluateBlockingDecision(anomaly, targetDomain, targetUrl);
      
      if (shouldBlock) {
        const blocked = await updateBlockingRules(targetDomain);
        if (blocked) {
          await logAnomalyDetection({
            domain: targetDomain,
            url: targetUrl,
            error: anomaly.error,
            threshold: anomaly.threshold,
            decision: 'blocked',
            timestamp: Date.now()
          });
        }
      } else {
        await logAnomalyDetection({
          domain: targetDomain,
          url: targetUrl,
          error: anomaly.error,
          threshold: anomaly.threshold,
          decision: 'ignored',
          timestamp: Date.now()
        });
      }
    }
  }
}

// Оценка решения о блокировке
async function evaluateBlockingDecision(anomaly, domain, url) {
  const error = anomaly.error;
  const threshold = anomaly.threshold;
  
  // Простая эвристика для принятия решения
  if (error > threshold * 1.5) {
    return true; // Сильная аномалия
  }
  
  // Проверяем домен на подозрительные паттерны
  const domainLower = domain.toLowerCase();
  const suspiciousPatterns = [
    'ad', 'ads', 'advert', 'track', 'analytics', 'click',
    'banner', 'popup', 'doubleclick', 'googleadservices',
    'googlesyndication', 'outbrain', 'taboola', 'criteo'
  ];
  
  if (suspiciousPatterns.some(pattern => domainLower.includes(pattern)) && error > threshold) {
    return true;
  }
  
  // Проверяем TLD
  const domainParts = domainLower.split('.');
  const tld = domainParts[domainParts.length - 1];
  const suspiciousTLDs = ['xyz', 'top', 'bid', 'site', 'club', 'online', 'stream', 'download'];
  
  if (suspiciousTLDs.includes(tld) && error > threshold * 1.2) {
    return true;
  }
  
  return false;
}

// Блокировка через declarativeNetRequest
async function updateBlockingRules(domainToBlock) {
  try {
    // Проверяем существующие правила
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const alreadyBlocked = existingRules.some(rule => {
      if (!rule.condition || !rule.condition.urlFilter) return false;
      return rule.condition.urlFilter.includes(domainToBlock);
    });
    
    if (alreadyBlocked) {
      console.log(`Домен ${domainToBlock} уже заблокирован`);
      return false;
    }

    // Создаем новое правило
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

    // Добавляем правило
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [newRule]
    });
    
    blockedDomains.add(domainToBlock);
    
    console.log(`Добавлено правило блокировки для домена: ${domainToBlock} (ID: ${currentId})`);
    
    // Сохраняем состояние
    await chrome.storage.local.set({ 
      ruleIdCounter: ruleIdCounter,
      blockedDomains: Array.from(blockedDomains)
    });
    
    // Проверяем лимиты
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    if (rules.length >= 29000) {
      console.warn('Приближаемся к лимиту динамических правил (30,000)');
      await cleanupOldRules();
    }
    
    return true;
    
  } catch (error) {
    console.error("Ошибка при добавлении правила:", error);
    ruleIdCounter--; // Откатываем счетчик
    return false;
  }
}

// Очистка старых правил
async function cleanupOldRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    if (rules.length > 1000) {
      const rulesToRemove = rules.slice(0, rules.length - 1000).map(r => r.id);
      
      if (rulesToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: rulesToRemove
        });
        
        // Обновляем список заблокированных доменов
        const removedDomains = new Set();
        rulesToRemove.forEach(id => {
          const rule = rules.find(r => r.id === id);
          if (rule && rule.condition && rule.condition.urlFilter) {
            const match = rule.condition.urlFilter.match(/\|\|([^*]+)\^/);
            if (match && match[1]) {
              removedDomains.add(match[1]);
            }
          }
        });
        
        removedDomains.forEach(domain => blockedDomains.delete(domain));
        
        console.log(`Удалено ${rulesToRemove.length} старых правил`);
        
        await chrome.storage.local.set({ 
          blockedDomains: Array.from(blockedDomains)
        });
      }
    }
  } catch (error) {
    console.error('Ошибка очистки правил:', error);
  }
}

// Логирование обнаруженных аномалий
async function logAnomalyDetection(data) {
  try {
    const result = await chrome.storage.local.get(['anomalyLogs']);
    const logs = result.anomalyLogs || [];
    
    logs.push(data);
    
    // Ограничиваем размер логов
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    await chrome.storage.local.set({ anomalyLogs: logs });
  } catch (error) {
    console.debug('Ошибка логирования аномалии:', error);
  }
}

// Регистрация периодических задач
function registerPeriodicTasks() {
  // Сохранение состояния каждые 2 минуты
  setInterval(async () => {
    await saveSystemState();
  }, 2 * 60 * 1000);
  
  // Проверка необходимости обучения в фазе обучения
  setInterval(async () => {
    if (trainingPhase === 'training') {
      await handleTrainingPhase();
    }
  }, 30 * 1000);
  
  // Очистка старых правил раз в день
  setInterval(async () => {
    await cleanupOldRules();
  }, 24 * 60 * 60 * 1000);
}

// Сохранение состояния системы
async function saveSystemState() {
  try {
    if (!autoencoder) return;
    
    const state = {
      autoencoderState: autoencoder.toJSON(),
      ruleIdCounter: ruleIdCounter,
      trainingPhase: trainingPhase,
      collectedSamples: collectedSamples,
      blockedDomains: Array.from(blockedDomains),
      lastSave: Date.now()
    };
    
    await chrome.storage.local.set(state);
    
  } catch (error) {
    console.error('Ошибка сохранения состояния:', error);
    
    // Пытаемся сохранить хотя бы основные данные
    try {
      await chrome.storage.local.set({
        ruleIdCounter: ruleIdCounter,
        trainingPhase: trainingPhase,
        collectedSamples: collectedSamples,
        blockedDomains: Array.from(blockedDomains),
        lastSave: Date.now(),
        saveError: error.message
      });
    } catch (e) {
      console.error('Критическая ошибка сохранения:', e);
    }
  }
}

// ====================================================================
// Обработчики событий расширения
// ====================================================================

// Инициализация при запуске
chrome.runtime.onStartup.addListener(() => {
  console.log('Расширение запущено');
  initializeSystem();
});

// Инициализация при установке/обновлении
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Расширение установлено');
    await chrome.storage.local.set({
      installedTime: Date.now(),
      version: chrome.runtime.getManifest().version
    });
  } else if (details.reason === 'update') {
    console.log('Расширение обновлено');
    
    try {
      // Восстанавливаем счетчик правил
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      if (rules.length > 0) {
        const maxId = Math.max(...rules.map(r => r.id));
        ruleIdCounter = maxId + 1;
        await chrome.storage.local.set({ ruleIdCounter: ruleIdCounter });
      }
    } catch (error) {
      console.error('Ошибка при обновлении:', error);
    }
  }
  
  initializeSystem();
});

// Обработка сообщений от других частей расширения
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSystemStatus") {
    const status = {
      trainingPhase: trainingPhase,
      collectedSamples: collectedSamples,
      blockedDomainsCount: blockedDomains.size,
      isInitialized: isInitialized,
      autoencoderStats: autoencoder ? autoencoder.getStats() : null,
      timestamp: Date.now()
    };
    sendResponse(status);
    return true;
  } else if (request.action === "getTrainingStatus") {
    const stats = autoencoder ? autoencoder.getStats() : null;
    sendResponse({
      trainingPhase: trainingPhase,
      collectedSamples: collectedSamples,
      autoencoderStats: stats,
      blockedDomainsCount: blockedDomains.size
    });
    return true;
  } else if (request.action === "forceTraining") {
    if (trainingPhase === 'collecting' && autoencoder) {
      const stats = autoencoder.getStats();
      if (stats.normalPatterns >= 100) {
        trainingPhase = 'training';
        handleTrainingPhase().then(() => {
          sendResponse({ success: true, message: 'Обучение запущено' });
        });
      } else {
        sendResponse({ 
          success: false, 
          message: `Недостаточно данных для обучения (нужно минимум 100, есть ${stats.normalPatterns})` 
        });
      }
    } else {
      sendResponse({ 
        success: false, 
        message: `Невозможно запустить обучение. Текущая фаза: ${trainingPhase}` 
      });
    }
    return true;
  } else if (request.action === "resetSystem") {
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      sendResponse({ success: true, message: 'Система сброшена' });
    });
    return true;
  } else if (request.action === "getBlockedDomains") {
    sendResponse({
      blockedDomains: Array.from(blockedDomains),
      count: blockedDomains.size
    });
    return true;
  } else if (request.action === "unblockDomain") {
    const domain = request.domain;
    if (domain && blockedDomains.has(domain)) {
      // Удаляем правило блокировки
      removeBlockingRule(domain).then(success => {
        if (success) {
          blockedDomains.delete(domain);
          sendResponse({ success: true, message: `Домен ${domain} разблокирован` });
        } else {
          sendResponse({ success: false, message: 'Не удалось разблокировать домен' });
        }
      });
    } else {
      sendResponse({ success: false, message: 'Домен не найден в списке блокировок' });
    }
    return true;
  }
});

// Удаление правила блокировки
async function removeBlockingRule(domainToRemove) {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    
    const rulesToRemove = existingRules.filter(rule => {
      if (!rule.condition || !rule.condition.urlFilter) return false;
      return rule.condition.urlFilter.includes(domainToRemove);
    }).map(rule => rule.id);
    
    if (rulesToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rulesToRemove
      });
      
      console.log(`Удалены правила для домена: ${domainToRemove}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Ошибка при удалении правил:', error);
    return false;
  }
}

// ====================================================================
// Вспомогательные функции для отладки
// ====================================================================

// Функция для тестирования извлечения признаков
function testFeatureExtraction() {
  const testUrls = [
    'https://example.com/path/to/resource?param=value',
    'https://google.com/search?q=test',
    'https://doubleclick.net/advert/banner.js',
    'https://tracking-domain-12345.xyz/pixel.gif'
  ];
  
  testUrls.forEach(url => {
    const features = autoencoder.extractFeatures(url, 'example.com');
    console.log(`URL: ${url}`);
    console.log(`Features length: ${features ? features.length : 0}`);
    console.log(`Features: ${features ? features.slice(0, 5).map(f => f.toFixed(3)).join(', ') : 'null'}`);
    console.log('---');
  });
}

// Экспорт для тестирования
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AutoencoderAnomalyDetector,
    initializeSystem,
    processRequestForAnomalyDetection,
    testFeatureExtraction
  };
}