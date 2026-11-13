(() => {
  const $ = s => document.querySelector(s);
  let sound = true, lastNo = 0, lastSec = -1;

  function beep(freq, dur) {
    if (!sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch (_) {}
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = "rcv_scr_" + Date.now();
      const s = document.createElement("script");
      window[cb] = d => { delete window[cb]; s.remove(); resolve(d); };
      s.onerror = () => { delete window[cb]; s.remove(); reject(); };
      s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
      document.body.appendChild(s);
    });
  }

  async function refresh() {
    try {
      const url = RCV_CONFIG.API_URL + "?action=publicState";
      let d;
      try {
        const r = await fetch(url);
        d = await r.json();
      } catch (_) {
        d = await jsonp(url);
      }
      if (!d || !d.ok) return;
      $("#stTotal").textContent = d.total;
      $("#stActive").textContent = d.active + d.approved;
      $("#stElim").textContent = d.eliminated;

      ["#stageWaiting", "#stageQuestion", "#stageFinished"].forEach(id => $(id).classList.add("hidden"));
      if (d.status === "FINISHED") {
        $("#stageFinished").classList.remove("hidden");
        return;
      }
      if ((d.status === "RUNNING" || d.status === "PAUSED") && d.question) {
        $("#stageQuestion").classList.remove("hidden");
        const q = d.question;
        $("#stQNo").textContent = `CÂU ${q.no} / ${d.totalQuestions}`;
        $("#stAnswered").textContent = `Đã trả lời: ${d.answered} / ${d.active}`;
        $("#stQText").textContent = q.text;
        $("#stA").textContent = q.A;
        $("#stB").textContent = q.B;
        $("#stC").textContent = q.C;
        $("#stD").textContent = q.D;
        const sec = Math.ceil((d.remainingMs || 0) / 1000);
        $("#stTimer").textContent = sec + "s";
        if (lastNo !== q.no) { lastNo = q.no; beep(880, 0.2); }
        if (d.status === "RUNNING" && sec <= 3 && sec > 0 && sec !== lastSec) { lastSec = sec; beep(520, 0.12); }
      } else {
        $("#stageWaiting").classList.remove("hidden");
      }
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#stageSound").addEventListener("click", () => {
      sound = !sound;
      $("#stageSound").textContent = sound ? "🔊 Âm thanh: Bật" : "🔇 Âm thanh: Tắt";
    });
    refresh();
    setInterval(refresh, RCV_CONFIG.POLL_INTERVAL_MS || 2000);
  });
})();
