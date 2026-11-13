(() => {
  const $ = s => document.querySelector(s);
  let soundOn = false, lastSec = -1, lastStatus = '';

  const playTone = (freq = 520, dur = 0.12, type = 'sine') => {
    if (!soundOn) return;
    try {
      window._actx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (window._actx.state === 'suspended') window._actx.resume();
      const o = window._actx.createOscillator(), g = window._actx.createGain();
      o.type = type; o.frequency.value = freq;
      o.connect(g); g.connect(window._actx.destination);
      g.gain.setValueAtTime(0.15, window._actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, window._actx.currentTime + dur);
      o.start(); o.stop(window._actx.currentTime + dur);
    } catch (e) {}
  };

  $('#stageSoundBtn').onclick = () => {
    soundOn = !soundOn;
    $('#stageSoundBtn').textContent = soundOn ? '🔊 Đang bật âm thanh' : '🔇 Bật âm thanh';
    if (soundOn) playTone(660, 0.15);
  };

  function api(action) {
    return new Promise((resolve, reject) => {
      const cb = 'screen_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const u = new URL(RCV_CONFIG.API_URL);
      u.searchParams.set('action', action);
      u.searchParams.set('callback', cb);
      const s = document.createElement('script');
      s.src = u.toString();
      const tm = setTimeout(() => { delete window[cb]; s.remove(); reject(Error('timeout')); }, 8000);
      window[cb] = d => { clearTimeout(tm); delete window[cb]; s.remove(); resolve(d); };
      s.onerror = () => { clearTimeout(tm); delete window[cb]; s.remove(); reject(Error('err')); };
      document.body.appendChild(s);
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  async function tick() {
    try {
      const d = await api('publicState');
      if (!d.ok) return;

      if (d.status === 'RUNNING' && lastStatus !== 'RUNNING') playTone(880, 0.25);
      if (d.status === 'FINISHED' && lastStatus !== 'FINISHED') {
        playTone(523, 0.15);
        setTimeout(() => playTone(659, 0.15), 160);
        setTimeout(() => playTone(784, 0.35), 320);
      }
      lastStatus = d.status;

      const stateLabel = d.status === 'RUNNING'
        ? `CÂU HỎI ${d.question?.no || d.currentQuestion} / ${d.totalQuestions}`
        : d.status === 'PAUSED'
        ? 'CUỘC THI ĐANG TẠM DỪNG'
        : d.status === 'FINISHED'
        ? 'CUỘC THI ĐÃ KẾT THÚC'
        : 'CHỜ MC BẮT ĐẦU';

      $('#stageState').textContent = stateLabel;

      const timerEl = $('#stageTimer');
      if (d.status === 'RUNNING' || d.status === 'PAUSED') {
        const sec = Math.max(0, Math.ceil((d.remainingMs || 0) / 1000));
        timerEl.textContent = sec;
        timerEl.classList.toggle('urgent', sec <= 3 && d.status === 'RUNNING');
        if (d.status === 'RUNNING' && sec !== lastSec) {
          if (sec <= 3 && sec > 0) playTone(440, 0.08, 'triangle');
          else if (sec === 0 && lastSec > 0) playTone(220, 0.3, 'sawtooth');
          lastSec = sec;
        }
      } else {
        timerEl.textContent = d.status === 'FINISHED' ? '🏆' : '🔔';
        timerEl.classList.remove('urgent');
        lastSec = -1;
      }

      $('#stageQuestion').textContent = d.question?.text || (d.status === 'FINISHED' ? 'Chúc mừng các thí sinh xuất sắc nhất!' : 'Chào mừng đến với sân chơi Rung Chuông Vàng');
      $('#stageOptions').innerHTML = d.question
        ? ['A', 'B', 'C', 'D'].map(k => `<div class="stage-opt-card"><b>${k}</b><span>${escapeHtml(d.question[k])}</span></div>`).join('')
        : '';

      const playingCount = d.status === 'WAITING' ? (d.approved || 0) : (d.active || 0);
      $('#stageStats').innerHTML = `
        <span>👥 Tổng đăng ký: <b>${d.total || 0}</b></span>
        <span>🟢 Sẵn sàng / Đang thi: <b>${playingCount}</b></span>
        <span>🔴 Đã loại: <b>${d.eliminated || 0}</b></span>
        ${d.status === 'RUNNING' ? `<span>✍️ Đã nộp bài: <b>${d.answered || 0}/${d.active || 0}</b></span>` : ''}
      `;
    } catch (e) {}
  }

  tick();
  setInterval(tick, 1000);
})();
