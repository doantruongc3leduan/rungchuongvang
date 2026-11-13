(() => {
  const $ = s => document.querySelector(s);
  let adminToken = sessionStorage.getItem("rcv_admin_token") || "";
  let poll = null, latestData = null;

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = "rcv_adm_cb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      const script = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("Quá thời gian phản hồi từ Apps Script.")); }, 15000);
      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        script.remove();
      }
      window[cb] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error("Lỗi kết nối Apps Script (kiểm tra Deploy -> Anyone).")); };
      script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
      document.body.appendChild(script);
    });
  }

  async function api(action, params = {}) {
    if (!window.RCV_CONFIG || !RCV_CONFIG.API_URL) {
      throw new Error("Thiếu cấu hình API_URL trong config.js");
    }
    const url = new URL(RCV_CONFIG.API_URL);
    url.searchParams.set("action", action);
    if (adminToken) url.searchParams.set("token", adminToken);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    try {
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
      setConn(true);
      return await res.json();
    } catch (_) {
      const data = await jsonp(url.toString());
      setConn(true);
      return data;
    }
  }

  function setConn(ok) {
    const el = $("#connection");
    el.textContent = ok ? "● Đã kết nối" : "● Mất kết nối";
    el.style.color = ok ? "#059669" : "#dc2626";
  }

  async function login() {
    const username = $("#adminUser").value.trim();
    const password = $("#adminPass").value.trim();
    const msg = $("#adminMsg");
    if (!username || !password) {
      msg.textContent = "Vui lòng nhập đầy đủ tài khoản và mật khẩu.";
      return;
    }
    $("#loginAdmin").disabled = true;
    msg.className = "notice ok";
    msg.textContent = "Đang xác thực quản trị viên...";
    try {
      const res = await api("adminLogin", { username, password });
      if (!res || !res.ok) throw new Error((res && res.message) || "Đăng nhập thất bại");
      adminToken = res.token;
      sessionStorage.setItem("rcv_admin_token", adminToken);
      msg.textContent = "";
      enterAdmin();
    } catch (e) {
      msg.className = "notice";
      msg.textContent = e.message;
    } finally {
      $("#loginAdmin").disabled = false;
    }
  }

  function enterAdmin() {
    $("#loginPanel").classList.add("hidden");
    $("#controls").classList.remove("hidden");
    $("#logoutAdmin").classList.remove("hidden");
    refreshDashboard();
    clearInterval(poll);
    poll = setInterval(refreshDashboard, RCV_CONFIG.POLL_INTERVAL_MS || 2000);
  }

  function logout() {
    adminToken = "";
    sessionStorage.removeItem("rcv_admin_token");
    clearInterval(poll);
    $("#controls").classList.add("hidden");
    $("#logoutAdmin").classList.add("hidden");
    $("#loginPanel").classList.remove("hidden");
  }

  async function refreshDashboard() {
    if (!adminToken) return;
    try {
      const res = await api("dashboard");
      if (!res.ok) {
        if (res.message && res.message.includes("hết hạn")) {
          toast("Phiên quản trị hết hạn, vui lòng đăng nhập lại.");
          logout();
        }
        return;
      }
      latestData = res;
      renderDashboard(res);
    } catch (_) {
      setConn(false);
    }
  }

  function renderDashboard(d) {
    $("#mTotal").textContent = d.total;
    $("#mActive").textContent = d.active + d.approved;
    $("#mPending").textContent = d.pending;
    $("#mEliminated").textContent = d.eliminated;

    const stBadge = $("#statusBadge");
    const mapStatus = {
      WAITING: ["badge-amber", "ĐANG CHỜ"],
      RUNNING: ["badge-green", "ĐANG DIỄN RA"],
      PAUSED: ["badge-amber", "TẠM DỪNG"],
      FINISHED: ["badge-blue", "ĐÃ KẾT THÚC"]
    };
    const [cls, label] = mapStatus[d.status] || ["badge-amber", d.status];
    stBadge.className = "badge " + cls;
    stBadge.textContent = label;

    $("#adminTimer").textContent = Math.ceil((d.remainingMs || 0) / 1000) + "s";

    if (document.activeElement !== $("#cfgQuestions")) $("#cfgQuestions").value = d.totalQuestions || 20;
    if (document.activeElement !== $("#cfgSeconds")) $("#cfgSeconds").value = d.secondsPerQuestion || 10;
    if (document.activeElement !== $("#cfgPool")) $("#cfgPool").value = d.poolSize || 100;

    if (d.question) {
      $("#liveQMeta").textContent = `CÂU ${d.question.no} / ${d.totalQuestions} · ĐÃ TRẢ LỜI: ${d.answered}/${d.active}`;
      $("#liveQText").textContent = d.question.text;
      $("#liveQAns").textContent = `Đáp án đúng: ${d.question.correct} (${d.question[d.question.correct] || ""})`;
    } else {
      $("#liveQMeta").textContent = label;
      $("#liveQText").textContent = d.status === "FINISHED" ? "Cuộc thi đã kết thúc." : "Chưa phát câu hỏi.";
      $("#liveQAns").textContent = "";
    }

    renderStudents(d.students || []);
  }

  function renderStudents(list) {
    const q = ($("#searchStudent").value || "").toLowerCase().trim();
    const filtered = q ? list.filter(s => s.hoTen.toLowerCase().includes(q) || s.lop.toLowerCase().includes(q)) : list;
    const tbody = $("#studentRows");
    tbody.innerHTML = filtered.map(s => {
      let badge = `<span class="badge badge-amber">Chờ duyệt</span>`;
      if (s.status === "APPROVED") badge = `<span class="badge badge-blue">Đã duyệt</span>`;
      if (s.status === "ACTIVE") badge = `<span class="badge badge-green">Đang thi</span>`;
      if (s.status === "ELIMINATED") badge = `<span class="badge badge-red">Bị loại</span>`;

      let btns = "";
      if (s.status === "READY") {
        btns += `<button class="action-btn success-btn sm-btn" onclick="window._rcvApprove('${s.studentId}')">Duyệt</button> `;
      }
      if (s.status === "ELIMINATED") {
        btns += `<button class="action-btn soft-btn sm-btn" onclick="window._rcvReinstate('${s.studentId}')">Cứu trợ</button>`;
      } else {
        btns += `<button class="action-btn outline-btn sm-btn" style="color:#dc2626" onclick="window._rcvElim('${s.studentId}')">Loại</button>`;
      }
      return `<tr>
        <td><b>${s.studentId}</b></td>
        <td>${s.hoTen}</td>
        <td>${s.lop}</td>
        <td>${badge}</td>
        <td>${s.reason || "-"}</td>
        <td>${btns}</td>
      </tr>`;
    }).join("");
  }

  async function runCmd(action, params = {}, confirmText = "") {
    if (confirmText && !confirm(confirmText)) return;
    try {
      const res = await api(action, params);
      if (!res.ok) throw new Error(res.message || "Thao tác thất bại");
      if (res.message) toast(res.message);
      refreshDashboard();
    } catch (e) {
      toast(e.message);
    }
  }

  window._rcvApprove = id => runCmd("approveStudent", { studentId: id });
  window._rcvReinstate = id => runCmd("reinstateStudent", { studentId: id });
  window._rcvElim = id => runCmd("eliminateStudent", { studentId: id, reason: "BTC LOẠI" }, "Xác nhận loại thí sinh này?");

  // Ngân hàng câu hỏi
  async function loadQBank() {
    $("#qBankModal").classList.remove("hidden");
    try {
      const res = await api("getQuestions");
      if (!res.ok) throw new Error(res.message);
      $("#qBankRows").innerHTML = res.questions.map(q => `<tr>
        <td><b>${q.id}</b></td>
        <td>${q.noiDung}<br><small style="color:var(--muted)">A: ${q.A} | B: ${q.B} | C: ${q.C} | D: ${q.D}</small></td>
        <td><span class="badge badge-green">${q.dapAn}</span></td>
        <td>${q.hoatDong ? '<span class="badge badge-blue">Bật</span>' : '<span class="badge badge-amber">Ẩn</span>'}</td>
        <td>
          <button class="action-btn soft-btn sm-btn" onclick='window._rcvEditQ(${JSON.stringify(q)})'>Sửa</button>
          <button class="action-btn outline-btn sm-btn" style="color:#dc2626" onclick="window._rcvDelQ('${q.id}')">Xóa</button>
        </td>
      </tr>`).join("");
    } catch (e) {
      toast(e.message);
    }
  }

  window._rcvEditQ = q => {
    $("#qEditId").value = q.id;
    $("#qInputText").value = q.noiDung;
    $("#qInputA").value = q.A;
    $("#qInputB").value = q.B;
    $("#qInputC").value = q.C;
    $("#qInputD").value = q.D;
    $("#qInputCorrect").value = q.dapAn;
    $("#qInputTopic").value = q.chuDe || "Chung";
    $("#qInputActive").value = q.hoatDong ? "TRUE" : "FALSE";
  };

  window._rcvDelQ = async id => {
    if (!confirm("Xóa vĩnh viễn câu hỏi " + id + "?")) return;
    await runCmd("deleteQuestion", { id });
    loadQBank();
  };

  async function saveQuestion() {
    const payload = {
      id: $("#qEditId").value.trim(),
      noiDung: $("#qInputText").value.trim(),
      A: $("#qInputA").value.trim(),
      B: $("#qInputB").value.trim(),
      C: $("#qInputC").value.trim(),
      D: $("#qInputD").value.trim(),
      dapAn: $("#qInputCorrect").value,
      chuDe: $("#qInputTopic").value.trim(),
      hoatDong: $("#qInputActive").value
    };
    if (!payload.noiDung || !payload.A || !payload.B) {
      toast("Vui lòng nhập nội dung câu hỏi và các đáp án.");
      return;
    }
    await runCmd("saveQuestion", payload);
    $("#qEditId").value = "";
    $("#qInputText").value = "";
    $("#qInputA").value = "";
    $("#qInputB").value = "";
    $("#qInputC").value = "";
    $("#qInputD").value = "";
    loadQBank();
  }

  function exportCsv() {
    if (!latestData || !latestData.students) return;
    const rows = [["MaTS", "HoTen", "Lop", "TrangThai", "GhiChu"]];
    latestData.students.forEach(s => rows.push([s.studentId, s.hoTen, s.lop, s.status, s.reason || ""]));
    const csv = "\uFEFF" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "danh_sach_rung_chuong_vang.csv";
    a.click();
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#loginAdmin").addEventListener("click", login);
    $("#adminPass").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
    $("#logoutAdmin").addEventListener("click", logout);
    $("#start").addEventListener("click", () => runCmd("startGame", {}, "Bắt đầu cuộc thi ngay bây giờ?"));
    $("#next").addEventListener("click", () => runCmd("nextQuestion"));
    $("#pause").addEventListener("click", () => runCmd("pauseGame"));
    $("#resume").addEventListener("click", () => runCmd("resumeGame"));
    $("#finish").addEventListener("click", () => runCmd("finishGame", {}, "Xác nhận kết thúc cuộc thi?"));
    $("#resetGame").addEventListener("click", () => runCmd("resetGame", {}, "CẢNH BÁO: Xóa toàn bộ lịch sử trả lời và reset về đầu?"));
    $("#approveAll").addEventListener("click", () => runCmd("approveAllStudents"));
    $("#reinstateAll").addEventListener("click", () => runCmd("reinstateAllStudents", {}, "Cứu trợ tất cả thí sinh đã bị loại?"));
    $("#saveSettings").addEventListener("click", () => runCmd("saveSettings", {
      totalQuestions: $("#cfgQuestions").value,
      secondsPerQuestion: $("#cfgSeconds").value,
      poolSize: $("#cfgPool").value
    }));
    $("#searchStudent").addEventListener("input", () => latestData && renderStudents(latestData.students || []));
    $("#btnOpenQBank").addEventListener("click", loadQBank);
    $("#btnCloseQBank").addEventListener("click", () => $("#qBankModal").classList.add("hidden"));
    $("#btnSaveQuestion").addEventListener("click", saveQuestion);
    $("#btnResetQuestionForm").addEventListener("click", () => {
      $("#qEditId").value = ""; $("#qInputText").value = "";
      $("#qInputA").value = ""; $("#qInputB").value = ""; $("#qInputC").value = ""; $("#qInputD").value = "";
    });
    $("#btnExportCsv").addEventListener("click", exportCsv);

    if (adminToken) enterAdmin();
  });
})();
