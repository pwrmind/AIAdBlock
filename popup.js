document.addEventListener('DOMContentLoaded', function() {
  const statusElement = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const samplesCount = document.getElementById('samplesCount');
  const blockedCount = document.getElementById('blockedCount');
  const threshold = document.getElementById('threshold');
  const trainBtn = document.getElementById('trainBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const lastUpdate = document.getElementById('lastUpdate');
  
  // Обновление статуса
  function updateStatus() {
    chrome.runtime.sendMessage({action: "getSystemStatus"}, function(response) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }
      
      // Обновляем интерфейс
      const phase = response.trainingPhase;
      statusText.textContent = getPhaseText(phase);
      
      // Обновляем класс статуса
      statusElement.className = 'status ' + phase;
      
      // Обновляем статистику
      samplesCount.textContent = response.collectedSamples || 0;
      blockedCount.textContent = response.blockedDomainsCount || 0;
      
      if (response.autoencoderStats) {
        threshold.textContent = response.autoencoderStats.threshold ?
          response.autoencoderStats.threshold.toFixed(4) : '0.0000';
      }
      
      // Время обновления
      const now = new Date();
      lastUpdate.textContent = `Последнее обновление: ${now.toLocaleTimeString()}`;
    });
  }
  
  // Текст для фазы
  function getPhaseText(phase) {
    const phases = {
      'collecting': 'Сбор данных',
      'training': 'Обучение модели',
      'active': 'Активный мониторинг'
    };
    return phases[phase] || phase;
  }
  
  // Обработчики кнопок
  trainBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: "forceTraining"}, function(response) {
      if (response && response.success) {
        alert('Обучение запущено');
        updateStatus();
      } else {
        alert(response ? response.message : 'Неизвестная ошибка');
      }
    });
  });
  
  refreshBtn.addEventListener('click', updateStatus);
  
  // Автоматическое обновление каждые 5 секунд
  updateStatus();
  setInterval(updateStatus, 5000);
});