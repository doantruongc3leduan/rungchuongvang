(() => {
  const $ = s => document.querySelector(s);
  let token = sessionStorage.getItem("rcv_token") || "";
  let profile = JSON.parse(sessionStorage.getItem("rcv_profile") || "null");
  let latest = null, poll = null, tick = null, sending = false, lastQNo = 0;
  let soundEnabled = localStorage.getItem("rcv_sound") !== "false";

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function audio(freq, dur) {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; o.type = "sine";
      o.connect(g); g.connect(ctx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch (_) {}
  }

  function updateSoundBtn() {
    const b = $("#soundToggle");
    if (b) b.textContent = soundEnabled ? "🔊 Âm thanh: Bật" : "🔇 Âm thanh: Tắt";
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = "rcv_cb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      const script = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("Quá thời gian kết nối máy chủ.")); }, 15000);
      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        script.remove();
      }
      window[cb] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error("Không thể kết nối đến Apps Script.")); };
      script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
      document.body.appendChild(script);
    });
  }

  async function api(action, params = {}) {
    const url = new URL(RCV_CONFIG.API_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, String(v)); });
    try {
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
      setNet(true);
      return await res.json();
    } catch (_) {
      const data = await jsonp(url.toString());
      setNet(true);
      return data;
    }
  }

  function setNet(ok) {
    $("#netState").textContent = ok ? "● Trực tuyến" : "● Mất kết nối";
    $("#netState").style.color = ok ? "#059669" : "#dc2626";
  }

  function getDeviceId() {
    let d = localStorage.getItem("rcv_device");
    if (!d) {
      d = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
      localStorage.setItem("rcv_device", d);
    }
    return d;
  }

  async function join() {
    const hoTen = $("#fullName").value.trim(), lop = $("#className").value.trim();
    if (!hoTen || !lop) { $("#loginMsg").textContent = "Vui lòng nhập đầy đủ họ tên và lớp."; return; }
    $("#joinBtn").disabled = true; $("#loginMsg").textContent = "Đang đăng ký thí sinh...";
    try {
      const r = await api("join", { hoTen, lop, deviceId: getDeviceId() });
      if (!r.ok) throw new Error(r.message || "Không thể đăng ký");
      token = r.token; profile = r.student;
      sessionStorage.setItem("rcv_token", token);
      sessionStorage.setItem("rcv_profile", JSON.stringify(profile));
      audio(880, 0.15);
      enterExam();
    } catch (e) {
      $("#loginMsg").textContent = e.message;
    } finally {
      $("#joinBtn").disabled = false;
    }
  }

  function enterExam() {
    $("#loginView").classList.add("hidden");
    $("#examView").classList.remove("hidden");
    $("#playerName").textContent = profile.hoTen;
    $("#playerClass").textContent = profile.lop;
    startPolling();
    if (RCV_CONFIG.WARNING_BEFORE_LEAVE) installLeaveGuard();
  }

  let violationLock = false;
  async function reportViolation(reason) {
    if (violationLock) return;
    violationLock = true;
    try { await api("violation", { token, reason }); } catch (_) {}
    finally { setTimeout(() => { violationLock = false; }, 5000); }
  }

  function installLeaveGuard() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && token && latest?.status === "RUNNING") reportViolation("RỜI MÀN HÌNH THI");
    });
    const leave = () => {
      if (token && latest?.status === "RUNNING") {
        navigator.sendBeacon?.(RCV_CONFIG.API_URL + "?action=violation&token=" + encodeURIComponent(token) + "&reason=THOAT_TRANG");
      }
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);
  }

  function startPolling() {
    clearInterval(poll);
    refresh();
    poll = setInterval(refresh, RCV_CONFIG.POLL_INTERVAL_MS || 2000);
  }

  async function refresh() {
    if (!token) return;
    try {
      const res = await api("state", { token });
      if (!res.ok) {
        if (res.message && res.message.includes("hết hạn")) {
          sessionStorage.clear();
          location.reload();
        }
        return;
      }
      latest = res;
      render(res);
    } catch (_) {
      setNet(false);
    }
  }

  function render(st) {
    $("#playerScore").textContent = st.score ?? 0;
    ["#waitingBox", "#eliminatedBox", "#finishedBox", "#questionBox"].forEach(id => $(id).classList.add("hidden"));
    const badge = $("#playerStateBadge");

    if (st.status === "ELIMINATED") {
      badge.className = "badge badge-red"; badge.textContent = "Đã bị loại";
      $("#eliminatedBox").classList.remove("hidden");
      $("#elimReason").textContent = "Lý do: " + (st.reason || "Không hợp lệ");
      clearInterval(tick);
      return;
    }
    if (st.status === "FINISHED") {
      badge.className = "badge badge-blue"; badge.textContent = "Hoàn thành";
      $("#finishedBox").classList.remove("hidden");
      clearInterval(tick);
      return;
    }
    if (st.status !== "RUNNING" || !st.question) {
      badge.className = "badge badge-amber"; badge.textContent = "Đang chờ";
      $("#waitingBox").classList.remove("hidden");
      $("#waitTitle").textContent = st.message || "Đang chờ Ban tổ chức...";
      clearInterval(tick);
      return;
    }

    badge.className = "badge badge-green"; badge.textContent = "Đang thi";
    $("#questionBox").classList.remove("hidden");
    const q = st.question;
    $("#qCounter").textContent = `Câu ${q.no} / ${st.totalQuestions}`;
    $("#qText").textContent = q.text;
    $("#optA").textContent = q.A;
    $("#optB").textContent = q.B;
    $("#optC").textContent = q.C;
    $("#optD").textContent = q.D;

    if (lastQNo !== q.no) {
      lastQNo = q.no;
      audio(660, 0.14);
      $("#answerNotice").textContent = "";
    }

    document.querySelectorAll("#options button").forEach(b => {
      const c = b.dataset.choice;
      b.classList.toggle("selected", st.myChoice === c);
      b.disabled = Boolean(st.myChoice) || st.remainingMs <= 0;
    });
    if (st.myChoice) $("#answerNotice").textContent = `Bạn đã chốt đáp án ${st.myChoice}.`;

    startCountdown(st.remainingMs);
  }

  function startCountdown(ms) {
    clearInterval(tick);
    const end = Date.now() + ms;
    const update = () => {
      const rem = Math.max(0, end - Date.now());
      const sec = Math.ceil(rem / 1000);
      const el = $("#timerDisplay");
      el.textContent = sec + "s";
      el.classList.toggle("urgent", sec <= 3 && rem > 0);
      if (rem <= 0) {
        clearInterval(tick);
        document.querySelectorAll("#options button").forEach(b => b.disabled = true);
      }
    };
    update();
    tick = setInterval(update, 250);
  }

  async function choose(choice) {
    if (!latest || latest.status !== "RUNNING" || latest.myChoice || sending) return;
    sending = true;
    document.querySelectorAll("#options button").forEach(b => b.disabled = true);
    $(`#options button[data-choice="${choice}"]`).classList.add("selected");
    audio(780, 0.1);
    try {
      const res = await api("answer", { token, questionNo: latest.question.no, choice });
      if (!res.ok) throw new Error(res.message || "Lỗi gửi đáp án");
      $("#answerNotice").textContent = "Đã gửi đáp án thành công.";
    } catch (e) {
      toast(e.message);
      document.querySelectorAll("#options button").forEach(b => b.disabled = false);
    } finally {
      sending = false;
      refresh();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateSoundBtn();
    $("#soundToggle")?.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      localStorage.setItem("rcv_sound", String(soundEnabled));
      updateSoundBtn();
      if (soundEnabled) audio(660, 0.1);
    });
    $("#joinBtn").addEventListener("click", join);
    $("#className").addEventListener("keydown", e => { if (e.key === "Enter") join(); });
    document.querySelectorAll("#options button").forEach(b => b.addEventListener("click", () => choose(b.dataset.choice)));
    if (token && profile) enterExam();
  });
})();
