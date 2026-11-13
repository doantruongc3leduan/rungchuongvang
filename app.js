(() => {
  const $ = s => document.querySelector(s);
  let token = sessionStorage.getItem("rcv_token") || "";
  let profile = JSON.parse(sessionStorage.getItem("rcv_profile") || "null");
  let latest = null, poll = null, selectedFor = null, sending = false;
  let soundEnabled = localStorage.getItem("rcv_sound") !== "false";

  const audio = (() => {
    let ctx;
    return (freq = 660, duration = 0.12, type = 'sine') => {
      if (!soundEnabled || !RCV_CONFIG.ENABLE_SOUND) return;
      try {
        ctx ||= new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.08, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        o.start(); o.stop(ctx.currentTime + duration);
      } catch (e) {}
    };
  })();

  function updateSoundBtn() {
    const btn = $("#soundToggle");
    if (btn) btn.textContent = soundEnabled ? "🔊" : "🔇";
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));
    $(id).classList.add("active");
  }

  function toast(s) {
    $("#toast").textContent = s;
    $("#toast").classList.add("show");
    setTimeout(() => $("#toast").classList.remove("show"), 2200);
  }

  function api(action, data = {}) {
    return new Promise((resolve, reject) => {
      if (!RCV_CONFIG.API_URL || RCV_CONFIG.API_URL.includes('DAN_URL')) {
        return reject(new Error('Chưa cấu hình URL Apps Script'));
      }
      const cb = 'rcv_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const u = new URL(RCV_CONFIG.API_URL);
      u.searchParams.set('action', action);
      u.searchParams.set('callback', cb);
      Object.entries(data).forEach(([k, v]) => u.searchParams.set(k, String(v)));
      const script = document.createElement('script');
      script.src = u.toString();
      const timer = setTimeout(() => { cleanup(); reject(new Error('Máy chủ không phản hồi')); }, 12000);
      function cleanup() { clearTimeout(timer); delete window[cb]; script.remove(); }
      window[cb] = d => { cleanup(); resolve(d); };
      script.onerror = () => { cleanup(); reject(new Error('Không thể kết nối Apps Script')); };
      document.body.appendChild(script);
    });
  }

  function setNet(ok) {
    $("#netState").textContent = ok ? "● Đang kết nối" : "● Mất kết nối";
    $("#netState").style.color = ok ? "#0d9b70" : "#dc4d63";
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

  function getDeviceId() {
    let d = localStorage.getItem("rcv_device");
    if (!d) {
      d = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
      localStorage.setItem("rcv_device", d);
    }
    return d;
  }

  function enterExam() {
    $("#playerName").textContent = profile.hoTen;
    $("#playerClass").textContent = profile.lop;
    show("#examView");
    startPolling();
    if (RCV_CONFIG.WARNING_BEFORE_LEAVE) installLeaveGuard();
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

  let violationLock = false;
  async function reportViolation(reason) {
    if (violationLock) return;
    violationLock = true;
    try { await api("violation", { token, reason }); } catch (e) {}
    finally { setTimeout(() => { violationLock = false; }, 5000); }
  }

  async function startPolling() {
    clearInterval(poll);
    await refresh();
    poll = setInterval(refresh, RCV_CONFIG.POLL_INTERVAL_MS || 2000);
  }

  async function refresh() {
    if (!token) return;
    try {
      const res = await api("state", { token });
      if (!res.ok) {
        if (res.message && res.message.includes("hết hạn")) {
          sessionStorage.removeItem("rcv_token");
          token = "";
          show("#loginView");
          $("#loginMsg").textContent = res.message;
        }
        return;
      }
      latest = res;
      setNet(true);
      render(latest);
    } catch (e) {
      setNet(false);
    }
  }

  function render(s) {
    const panels = ["#waiting", "#questionArea", "#eliminated", "#finished"];
    panels.forEach(p => $(p).classList.add("hidden"));
    if (s.score !== undefined) $("#playerScore").textContent = s.score;

    if (s.status === "WAITING") {
      document.body.classList.remove("disqualified");
      $("#waiting").classList.remove("hidden");
      $("#waitingInfo").textContent = s.message || "Đang chờ Ban tổ chức duyệt và MC bắt đầu.";
      return;
    }
    if (s.status === "ELIMINATED") {
      $("#eliminated").classList.remove("hidden");
      $("#eliminatedReason").textContent = s.reason || "Bạn đã bị loại.";
      document.body.classList.add("disqualified");
      return;
    }
    if (s.status === "FINISHED") {
      document.body.classList.remove("disqualified");
      $("#finished").classList.remove("hidden");
      $("#finalMessage").textContent = (s.message || "Cảm ơn bạn đã tham gia!") + ` Tổng điểm đạt được: ${s.score || 0} câu đúng.`;
      return;
    }
    if (s.status !== "RUNNING") return;

    document.body.classList.remove("disqualified");
    $("#questionArea").classList.remove("hidden");
    const q = s.question;
    $("#qNumber").textContent = q.no;
    $("#qTotal").textContent = "/ " + s.totalQuestions;
    $("#questionText").textContent = q.text;

    ["A", "B", "C", "D"].forEach(k => {
      const b = $(`#options button[data-choice="${k}"]`);
      b.querySelector("span").textContent = q[k];
      b.disabled = !!s.myChoice || s.remainingMs <= 0;
      b.classList.toggle("selected", s.myChoice === k);
    });

    const seconds = Math.max(0, Math.ceil(s.remainingMs / 1000));
    $("#timer").textContent = seconds;
    $("#timer").classList.toggle("urgent", seconds <= 3);
    if (seconds <= 3 && seconds > 0) audio(440, 0.06, 'triangle');

    if (s.myChoice) {
      $("#answerNotice").textContent = "Đã ghi nhận đáp án (" + s.myChoice + "). Chờ MC công bố câu tiếp theo.";
      selectedFor = q.no;
    } else if (s.remainingMs <= 0) {
      $("#answerNotice").textContent = "Đã hết thời gian trả lời!";
    } else {
      $("#answerNotice").textContent = "Chọn một đáp án trước khi đồng hồ về 0.";
    }
    if (s.myChoice && selectedFor !== q.no) selectedFor = q.no;
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
    if (RCV_CONFIG.API_URL.includes("DAN_URL")) {
      $("#loginMsg").textContent = "Quản trị viên cần cấu hình URL Apps Script trong config.js.";
    }
    if (token && profile) enterExam();
  });
})();
