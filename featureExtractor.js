// featureExtractor.js

function extractFeaturesFromUrl(url, mainDomain) {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;
    
    // --- Извлечение сырых признаков (RAW Features) ---
    const isThirdParty_raw = hostname !== mainDomain ? 1 : 0;
    
    // 1. Ключевые слова для блокировки
    const blockingKeywords = [
        'ad', 'ads', 'advert', 'banner', 'track', 'analytics', 
        'popup', 'popunder', 'syndication', 'doubleclick', 'taboola',
        'taboola', 'outbrain', 'criteo', 'taboola', 'aff', 'referral',
        'utm_', 'zoneid', 'clickid', 'impid', 'adserver', 'advertising',
        'monetization', 'sponsored', 'taboola', 'teads', 'prebid'
    ];
    const hasBlockingKeyword_raw = blockingKeywords.some(keyword => 
        url.toLowerCase().includes(keyword.toLowerCase())) ? 1 : 0;
    
    // 2. Признаки активов
    const mediaExtensions = ['.js', '.png', '.gif', '.jpg', '.jpeg', '.css', '.mp4', '.webm', '.swf'];
    const isAsset_raw = mediaExtensions.some(ext => pathname.toLowerCase().endsWith(ext)) ? 1 : 0;
    
    // 3. Глубина пути
    const pathDepth_raw = pathname.split('/').filter(part => part.length > 0).length;
    
    // 4. Длина домена
    const domainLength_raw = hostname.length;
    
    // 5. Специфические рекламные параметры в URL
    const adParams = ['zoneid', 'clickid', 'ad_id', 'adset', 'aff', 'ref', 'utm_source', 
                     'utm_medium', 'utm_campaign', 'bannerid', 'placement', 'pubid', 'pid',
                     'tid', 'sid', 'adslot', 'adv', 'suid', 'wuid', 'cb', 'clicktag'];
    const hasAdParams_raw = adParams.some(param => searchParams.has(param.toLowerCase()) || 
        url.toLowerCase().includes(`${param.toLowerCase()}=`)) ? 1 : 0;
    
    // 6. Паттерн домена (рекламные сети)
    const adNetworks = ['doubleclick', 'googleads', 'googleadservices', 'googlesyndication', 
                       'adservice', 'adserver', 'adnxs', 'taboola', 'outbrain', 'criteo',
                       'rubicon', 'openx', 'pubmatic', 'indexexchange', 'adtech', 'spotx'];
    const isAdNetwork_raw = adNetworks.some(network => hostname.toLowerCase().includes(network.toLowerCase())) ? 1 : 0;
    
    // 7. Отношение цифр в домене
    const digitCount = (hostname.match(/\d/g) || []).length;
    const numericRatio_raw = digitCount / hostname.length;
    
    // 8. Количество дефисов и подчеркиваний в домене
    const separatorCount = (hostname.match(/[-_]/g) || []).length;
    const separatorRatio_raw = separatorCount / Math.max(hostname.length, 1);
    
    // 9. Количество параметров в URL
    const paramCount_raw = searchParams.size;
    
    // 10. Подозрительные паттерны домена
    const suspiciousPatterns = [
        /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // IP адреса
        /\d{5,}/, // длинные последовательности цифр
        /^[a-z0-9]{8,12}\.(com|net|xyz|org|top|bid|site|info|club|sbs|cfd|rocks|xyz)$/, // случайные домены
        /track[0-9a-z-]+\.com$/,
        /ad[0-9a-z-]+\.com$/,
        /click[0-9a-z-]+\.com$/
    ];
    const hasSuspiciousPattern_raw = suspiciousPatterns.some(pattern => pattern.test(hostname)) ? 1 : 0;
    
    // 11. Путь содержит ключевые слова, связанные с рекламой
    const pathKeywords = blockingKeywords.concat(['serve', 'delivery', 'creative', 'render']);
    const pathContainsAdsKeyword_raw = pathKeywords.some(keyword => 
        pathname.toLowerCase().includes(keyword.toLowerCase())) ? 1 : 0;
    
    // --- Нормализация признаков (Normalization) ---
    const isThirdParty_norm = isThirdParty_raw;
    const hasBlockingKeyword_norm = hasBlockingKeyword_raw;
    const isAsset_norm = isAsset_raw;
    const pathDepth_norm = Math.min(pathDepth_raw / 10, 1.0);
    const domainLength_norm = Math.min(domainLength_raw / 63, 1.0);
    const hasAdParams_norm = hasAdParams_raw;
    const isAdNetwork_norm = isAdNetwork_raw;
    const numericRatio_norm = Math.min(numericRatio_raw, 1.0);
    const separatorRatio_norm = Math.min(separatorRatio_raw, 1.0);
    const paramCount_norm = Math.min(paramCount_raw / 10, 1.0); // Нормализация до 10 параметров
    const hasSuspiciousPattern_norm = hasSuspiciousPattern_raw;
    const pathContainsAdsKeyword_norm = pathContainsAdsKeyword_raw;

    // Возвращаем НОРМАЛИЗОВАННЫЙ числовой массив
    return [
        isThirdParty_norm,
        hasBlockingKeyword_norm,
        isAsset_norm,
        pathDepth_norm,
        domainLength_norm,
        hasAdParams_norm,
        isAdNetwork_norm,
        numericRatio_norm,
        separatorRatio_norm,
        paramCount_norm,
        hasSuspiciousPattern_norm,
        pathContainsAdsKeyword_norm
    ];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractFeaturesFromUrl };
}