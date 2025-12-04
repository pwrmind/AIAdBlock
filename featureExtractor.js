// featureExtractor.js

function extractFeaturesFromUrl(url, mainDomain) {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    // --- Извлечение сырых признаков (RAW Features) ---
    const isThirdParty_raw = hostname !== mainDomain ? 1 : 0;
    const blockingKeywords = ['ad', 'banner', 'track', 'analytics', 'popup', 'syndication'];
    const hasBlockingKeyword_raw = blockingKeywords.some(keyword => url.includes(keyword)) ? 1 : 0;
    const isAsset_raw = pathname.endsWith('.js') || pathname.endsWith('.png') || pathname.endsWith('.gif') ? 1 : 0;
    const pathDepth_raw = pathname.split('/').length - 1;
    const domainLength_raw = hostname.length; // Добавим длину домена как пример масштабирования

    // --- Нормализация признаков (Normalization) ---

    // Признаки 1-3 уже находятся в диапазоне [0, 1], так как они бинарные.
    const isThirdParty_norm = isThirdParty_raw;
    const hasBlockingKeyword_norm = hasBlockingKeyword_raw;
    const isAsset_norm = isAsset_raw;

    // Признак 4: Глубина пути. 
    // Максимальное значение может варьироваться, но 10 — разумный верхний предел для большинства URL.
    const pathDepth_norm = Math.min(pathDepth_raw / 10, 1.0); 

    // Признак 5: Длина домена. 
    // Максимальная длина домена около 63 символов.
    const domainLength_norm = Math.min(domainLength_raw / 63, 1.0);


    // Возвращаем НОРМАЛИЗОВАННЫЙ числовой массив
    return [
        isThirdParty_norm,
        hasBlockingKeyword_norm,
        isAsset_norm,
        pathDepth_norm,
        domainLength_norm
    ];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractFeaturesFromUrl };
}
