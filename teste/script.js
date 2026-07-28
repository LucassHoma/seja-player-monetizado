const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const historyListEl = document.getElementById('history-list');

let shiftDownAt = null;
let animationFrame = null;
const history = [];
const MAX_HISTORY = 10;

function isShiftKey(event) {
  return event.key === 'Shift';
}

function formatSeconds(ms) {
  return (ms / 1000).toFixed(3) + ' s';
}

function updateLiveTimer() {
  if (shiftDownAt === null) return;

  const elapsed = performance.now() - shiftDownAt;
  timerEl.textContent = formatSeconds(elapsed);
  animationFrame = requestAnimationFrame(updateLiveTimer);
}

function startMeasuring() {
  if (shiftDownAt !== null) return;

  shiftDownAt = performance.now();
  statusEl.textContent = 'Shift pressionado...';
  statusEl.classList.add('active');
  timerEl.classList.add('holding');
  animationFrame = requestAnimationFrame(updateLiveTimer);
}

function stopMeasuring() {
  if (shiftDownAt === null) return;

  const duration = performance.now() - shiftDownAt;
  shiftDownAt = null;

  cancelAnimationFrame(animationFrame);
  animationFrame = null;

  timerEl.textContent = formatSeconds(duration);
  timerEl.classList.remove('holding');
  statusEl.textContent = 'Última medição concluída';
  statusEl.classList.remove('active');

  addToHistory(duration);
}

function addToHistory(duration) {
  history.unshift({
    duration,
    time: new Date().toLocaleTimeString('pt-BR'),
  });

  if (history.length > MAX_HISTORY) {
    history.pop();
  }

  renderHistory();
}

function renderHistory() {
  historyListEl.innerHTML = '';

  if (history.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nenhuma medição ainda';
    historyListEl.appendChild(li);
    return;
  }

  history.forEach((entry, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>#${history.length - index} — ${entry.time}</span>
      <strong>${formatSeconds(entry.duration)}</strong>
    `;
    historyListEl.appendChild(li);
  });
}

window.addEventListener('keydown', (event) => {
  if (!isShiftKey(event) || event.repeat) return;
  startMeasuring();
});

window.addEventListener('keyup', (event) => {
  if (!isShiftKey(event)) return;
  stopMeasuring();
});

window.addEventListener('blur', () => {
  if (shiftDownAt !== null) {
    stopMeasuring();
  }
});

renderHistory();
