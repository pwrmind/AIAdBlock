// featureExtractor.js

function extractFeaturesFromUrl(url, mainDomain) {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    // Признак 1: Является ли сторонним (Third-party request)
    const isThirdParty = hostname !== mainDomain ? 1 : 0;

    // Признак 2: Наличие ключевых слов блокировки (как в EasyList)
    const blockingKeywords = ['ad', 'banner', 'track', 'analytics', 'popup', 'syndication'];
    const hasBlockingKeyword = blockingKeywords.some(keyword => url.includes(keyword)) ? 1 : 0;

    // Признак 3: Является ли скриптом или изображением
    const isAsset = pathname.endsWith('.js') || pathname.endsWith('.png') || pathname.endsWith('.gif') ? 1 : 0;
    
    // Признак 4: Глубина пути URL
    const pathDepth = pathname.split('/').length - 1;

    return [
        isThirdParty,
        hasBlockingKeyword,
        isAsset,
        pathDepth
    ];
}

// Экспортируем функцию, чтобы ее мог использовать background.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractFeaturesFromUrl };
}
