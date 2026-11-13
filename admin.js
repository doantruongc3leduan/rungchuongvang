(() => {
  let adminToken = sessionStorage.getItem('rcv_admin_token') || '';
  let snapshot = null, filter = 'ALL', busy = false, pollTimer = null, qBankList = [];
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(s, bad = false) {
    const el = $('#toast');
    el.textContent = s;
    el.classList.toggle('bad', bad);
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
  }

  function api(action, data = {}) {
    return new Promise((resolve, reject) => {
      if (!window.RCV_CONFIG?.API_URL || RCV_CONFIG.API_URL.includes('DAN_URL')) {
        return reject(Error('Chưa cấu hình URL Apps Script trong config.js'));
      }
      const cb = 'adm_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const u = new URL(RCV_CONFIG.API_URL);
      u.searchParams.set('action', action);
      u.searchParams.set('callback', cb);
      Object.entries(data).forEach(([k, v]) => u.searchParams.set(k, String(v)));
      const sc = document.createElement('script');
      const tm = setTimeout(() => { clean(); reject(Error('Máy chủ phản hồi chậm. Vui lòng thử lại.')); }, 15000);
      function clean() { clearTimeout(tm); delete window[cb]; sc.remove(); }
      window[cb] = d => { clean(); resolve(d); };
      sc.onerror = () => { clean(); reject(Error('Không thể kết nối máy chủ')); };
      sc.src = u.toString();
      document.body.appendChild(sc);
    });
  }

  async function call(action, data = {}) {
    const r = await api(action, { token: adminToken, ...data });
    if (!r.ok) throw Error(r.message || 'Có lỗi xảy ra');
    return r;
  }

  function statusLabel(s) {
    return ({ READY: 'CHỜ DUYỆT', APPROVED: 'ĐÃ DUYỆT', ACTIVE: 'ĐANG THI', ELIMINATED: 'ĐÃ BỊ LOẠI' })[s] || s;
  }

  function render(d) {
    snapshot = d;
    $('#connection').innerHTML = '<i></i> Đang kết nối';
    $('#connection').classList.remove('offline');
    $('#statusText').textContent = ({ WAITING: 'ĐANG CHỜ', RUNNING: 'ĐANG DIỄN RA', PAUSED: 'TẠM DỪNG', FINISHED: 'ĐÃ KẾT THÚC' })[d.status] || d.status;

    const totalReady = d.pending || 0;
    const totalPlaying = (d.active || 0) + (d.approved || 0);
    const totalElim = d.eliminated || 0;

    $('#mTotal').textContent = d.total || 0;
    $('#mActive').textContent = totalPlaying;
    $('#mPending').textContent = totalReady;
    $('#mEliminated').textContent = totalElim;

    $('#btnApproveAllCount').textContent = totalReady;
    $('#btnApproveAll').disabled = totalReady === 0 || d.status === 'FINISHED';
    $('#btnRescueAllCount').textContent = totalElim;
    $('#btnRescueAll').disabled = totalElim === 0 || d.status === 'FINISHED';

    if (document.activeElement !== $('#totalQ')) $('#totalQ').value = d.totalQuestions || 20;
    if (document.activeElement !== $('#seconds')) $('#seconds').value = d.secondsPerQuestion || 10;
    if (document.activeElement !== $('#pool') && d.poolSize) $('#pool').value = d.poolSize;

    const q = d.question;
    $('#questionBadge').textContent = 'CÂU ' + (d.currentQuestion || 0);
    $('#qProgress').textContent = q ? `CÂU ${q.no} / ${d.totalQuestions}` : 'Chưa bắt đầu';
    $('#qTimer').textContent = (d.status === 'RUNNING' || d.status === 'PAUSED') ? Math.max(0, Math.ceil((d.remainingMs || 0) / 1000)) + 's' : '--';
    $('#currentQuestion').textContent = q?.text || 'Câu hỏi sẽ hiển thị tại đây khi MC bắt đầu.';
    $('#currentOptions').innerHTML = q ? ['A', 'B', 'C', 'D'].map(k => `<div class="${q.correct === k ? 'is-correct' : ''}"><b>${k}</b>${esc(q[k])}</div>`).join('') : '<div>A · —</div><div>B · —</div><div>C · —</div><div>D · —</div>';
    $('#correctAnswer').textContent = q?.correct || '—';
    $('#answeredCount').textContent = (d.answered || 0) + ' lượt trả lời';

    $('#fAll').textContent = d.total || 0;
    $('#fReady').textContent = totalReady;
    $('#fApproved').textContent = d.approved || 0;
    $('#fActive').textContent = d.active || 0;
    $('#fElim').textContent = totalElim;

    renderStudents(d.students || []);
    renderEvents(d.events || []);

    $('#start').disabled = d.status === 'RUNNING' || d.status === 'PAUSED' || d.status === 'FINISHED' || !(d.approved > 0 || d.active > 0);
    $('#pause').disabled = d.status !== 'RUNNING';
    $('#resume').disabled = d.status !== 'PAUSED';
    $('#next').disabled = d.status !== 'RUNNING';
    $('#finish').disabled = d.status === 'FINISHED' || d.status === 'WAITING';
  }

  function renderStudents(list) {
    const query = $('#studentSearch').value.trim().toLowerCase();
    const rows = list.filter(s => (filter === 'ALL' || s.status === filter) && (!query || [s.hoTen, s.lop, s.studentId, s.reason].join(' ').toLowerCase().includes(query)));
    $('#rosterCount').textContent = `Hiển thị ${rows.length}/${list.length} thí sinh`;
    $('#studentRows').innerHTML = rows.length ? rows.map(s => {
      let actions = '';
      if (s.status === 'READY') {
        actions = `<button class="mini-btn approve" data-action="approve" data-id="${esc(s.studentId)}">✓ Duyệt thi</button><button class="mini-btn reject" data-action="eliminate" data-id="${esc(s.studentId)}">Loại</button>`;
      } else if (s.status === 'ELIMINATED') {
        actions = `<button class="mini-btn restore" data-action="restore" data-id="${esc(s.studentId)}">↻ Cứu trợ</button>`;
      } else if (s.status === 'ACTIVE' || s.status === 'APPROVED') {
        actions = `<button class="mini-btn reject" data-action="eliminate" data-id="${esc(s.studentId)}">✕ Loại ngay</button>`;
      }
      return `<tr><td><b>${esc(s.hoTen)}</b><small>${esc(s.lop)}</small></td><td><code>${esc(s.studentId)}</code><small>${s.joinedAt ? new Date(s.joinedAt).toLocaleTimeString('vi-VN') : '—'}</small></td><td><span class="status-tag ${s.status.toLowerCase()}">${statusLabel(s.status)}</span></td><td class="reason-cell">${esc(s.reason || '—')}</td><td><div class="row-actions">${actions || '—'}</div></td></tr>`;
    }).join('') : '<tr><td colspan="5" class="empty-row">Không có thí sinh phù hợp.</td></tr>';
  }

  function renderEvents(events) {
    const rows = (events || []).slice(0, 50);
    $('#eventRows').innerHTML = rows.length ? rows.map(a => {
      const kind = String(a.event || '');
      const good = (kind === 'ANSWER' && String(a.detail).includes('ĐÚNG')) || kind.includes('APPROVE') || kind.includes('RESCUE');
      const bad = kind === 'ELIMINATED' || (kind === 'ANSWER' && String(a.detail).includes('SAI'));
      return `<tr><td>${a.timestamp ? new Date(a.timestamp).toLocaleTimeString('vi-VN') : '—'}</td><td><b>${esc(a.studentId || 'Hệ thống')}</b></td><td>${esc(kind)}</td><td>${esc(a.detail || '—')}</td><td><span class="event-result ${good ? 'good' : bad ? 'bad' : ''}">${bad ? 'CẦN CHÚ Ý' : good ? 'HỢP LỆ' : 'GHI NHẬN'}</span></td></tr>`;
    }).join('') : '<tr><td colspan="5" class="empty-row">Chưa có sự kiện.</td></tr>';
  }

  async function refresh() {
    if (!adminToken || busy) return;
    try {
      const d = await call('dashboard');
      render(d);
    } catch (e) {
      $('#connection').innerHTML = '<i></i> Mất kết nối';
      $('#connection').classList.add('offline');
      if (e.message && e.message.includes('hết hạn')) {
        sessionStorage.removeItem('rcv_admin_token');
        adminToken = '';
        clearInterval(pollTimer);
        $('#controls').classList.add('hidden');
        $('#loginPanel').classList.remove('hidden');
        $('#adminMsg').textContent = e.message;
      }
    }
  }

  async function action(a, data = {}, confirmText = '') {
    if (busy) return;
    if (confirmText && !confirm(confirmText)) return;
    busy = true;
    try {
      const r = await call(a, data);
      toast(r.message || 'Đã cập nhật');
      await refresh();
    } catch (e) {
      toast(e.message, true);
    } finally {
      busy = false;
    }
  }

  // Question Bank Management
  async function loadQuestionBank() {
    try {
      const res = await call('getQuestions');
      qBankList = res.questions || [];
      renderQuestionBank();
    } catch (e) {
      toast(e.message, true);
    }
  }

  function renderQuestionBank() {
    const tbody = $('#qBankRows');
    tbody.innerHTML = qBankList.length ? qBankList.map(q => `
      <tr>
        <td><code>${esc(q.id)}</code><br><small style="color:${q.hoatDong ? 'var(--green)' : 'var(--red)'}">${q.hoatDong ? '● Hoạt động' : '○ Tạm ẩn'}</small></td>
        <td><b>${esc(q.noiDung)}</b><small>A: ${esc(q.A)} | B: ${esc(q.B)} | C: ${esc(q.C)} | D: ${esc(q.D)}</small></td>
        <td><span class="status-tag active">${esc(q.dapAn)}</span></td>
        <td>${esc(q.chuDe)}<small>${esc(q.doKho)}</small></td>
        <td>
          <div class="row-actions">
            <button class="mini-btn approve" data-qedit="${esc(q.id)}">✎ Sửa</button>
            <button class="mini-btn reject" data-qdel="${esc(q.id)}">✕ Xóa</button>
          </div>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty-row">Chưa có câu hỏi nào trong ngân hàng.</td></tr>';
  }

  function exportCsv() {
    if (!snapshot || !snapshot.students?.length) return toast('Chưa có dữ liệu thí sinh để xuất', true);
    const headers = ['MaThiSinh', 'HoTen', 'Lop', 'TrangThai', 'LyDo', 'ThoiGianThamGia'];
    const lines = [headers.join(',')];
    snapshot.students.forEach(s => {
      lines.push([s.studentId, s.hoTen, s.lop, statusLabel(s.status), s.reason, s.joinedAt].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob(['﻿' + lines.join('
')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DanhSach_ThiSinh_RCV_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Đã xuất file danh sách thí sinh (.CSV)');
  }

  async function initAdminSession() {
    $('#loginPanel').classList.add('hidden');
    $('#controls').classList.remove('hidden');
    await refresh();
    clearInterval(pollTimer);
    pollTimer = setInterval(refresh, 2500);
  }

  $('#loginAdmin').onclick = async () => {
    try {
      const r = await api('adminLogin', { username: $('#adminUser').value.trim(), password: $('#adminPass').value });
      if (!r.ok) throw Error(r.message);
      adminToken = r.token;
      sessionStorage.setItem('rcv_admin_token', adminToken);
      initAdminSession();
    } catch (e) {
      $('#adminMsg').textContent = e.message;
    }
  };

  $('#adminPass').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginAdmin').click(); });
  $('#start').onclick = () => action('startGame', {}, 'Bắt đầu cuộc thi với các thí sinh đã được duyệt?');
  $('#pause').onclick = () => action('pauseGame', {}, 'Tạm dừng cuộc thi?');
  $('#resume').onclick = () => action('resumeGame', {}, 'Tiếp tục cuộc thi từ thời gian còn lại?');
  $('#next').onclick = () => action('nextQuestion', {}, 'Chốt câu hiện tại và chuyển sang câu tiếp theo?');
  $('#finish').onclick = () => action('finishGame', {}, 'Kết thúc cuộc thi? Thao tác này không thể tự hoàn tác.');
  $('#resetGame').onclick = () => action('resetGame', {}, 'CẢNH BÁO: Đặt lại phiên thi mới sẽ xóa nhật ký trả lời cũ và đưa tất cả thí sinh về trạng thái CHỜ DUYỆT. Tiếp tục?');
  $('#saveSettings').onclick = () => action('saveSettings', { totalQuestions: $('#totalQ').value, secondsPerQuestion: $('#seconds').value, poolSize: $('#pool').value });
  $('#refreshNow').onclick = refresh;

  // Bulk Actions
  $('#btnApproveAll').onclick = () => action('approveAllStudents', {}, `Duyệt đồng loạt tất cả ${snapshot?.pending || 0} thí sinh đang chờ vào thi?`);
  $('#btnRescueAll').onclick = () => action('reinstateAllStudents', {}, `Kích hoạt CỨU TRỢ khôi phục toàn bộ ${snapshot?.eliminated || 0} thí sinh đã bị loại?`);
  $('#btnExportCsv').onclick = exportCsv;

  $('#studentSearch').oninput = () => snapshot && renderStudents(snapshot.students || []);
  $('#filterTabs').onclick = e => {
    const b = e.target.closest('button[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    document.querySelectorAll('#filterTabs button').forEach(x => x.classList.toggle('active', x === b));
    if (snapshot) renderStudents(snapshot.students || []);
  };

  $('#studentRows').onclick = e => {
    const b = e.target.closest('button[data-action]');
    if (!b) return;
    const id = b.dataset.id, act = b.dataset.action;
    const names = { approve: 'Duyệt học sinh này vào thi?', eliminate: 'Loại học sinh này ngay lập tức?', restore: 'Cứu trợ / khôi phục học sinh này vào lượt thi?' };
    const apiAction = { approve: 'approveStudent', eliminate: 'eliminateStudent', restore: 'reinstateStudent' }[act];
    action(apiAction, { studentId: id, reason: 'LOẠI BỞI BAN TỔ CHỨC' }, names[act]);
  };

  // Modal Question Bank Events
  $('#btnOpenQBank').onclick = () => { $('#qBankModal').classList.remove('hidden'); loadQuestionBank(); };
  $('#btnCloseQBank').onclick = () => $('#qBankModal').classList.add('hidden');
  $('#btnResetQForm').onclick = () => { $('#qForm').reset(); $('#qId').value = ''; };

  $('#qForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const payload = {
        id: $('#qId').value,
        noiDung: $('#qText').value,
        A: $('#qA').value,
        B: $('#qB').value,
        C: $('#qC').value,
        D: $('#qD').value,
        dapAn: $('#qCorrect').value,
        chuDe: $('#qTopic').value,
        doKho: $('#qDiff').value,
        hoatDong: $('#qActive').value
      };
      const res = await call('saveQuestion', payload);
      toast(res.message);
      $('#qForm').reset();
      $('#qId').value = '';
      loadQuestionBank();
    } catch (err) {
      toast(err.message, true);
    }
  };

  $('#qBankRows').onclick = async e => {
    const editBtn = e.target.closest('button[data-qedit]');
    const delBtn = e.target.closest('button[data-qdel]');
    if (editBtn) {
      const q = qBankList.find(x => x.id === editBtn.dataset.qedit);
      if (q) {
        $('#qId').value = q.id;
        $('#qText').value = q.noiDung;
        $('#qA').value = q.A;
        $('#qB').value = q.B;
        $('#qC').value = q.C;
        $('#qD').value = q.D;
        $('#qCorrect').value = q.dapAn;
        $('#qTopic').value = q.chuDe;
        $('#qDiff').value = q.doKho;
        $('#qActive').value = q.hoatDong ? 'true' : 'false';
      }
    } else if (delBtn) {
      if (!confirm('Xóa vĩnh viễn câu hỏi này khỏi Google Sheet?')) return;
      try {
        const res = await call('deleteQuestion', { id: delBtn.dataset.qdel });
        toast(res.message);
        loadQuestionBank();
      } catch (err) {
        toast(err.message, true);
      }
    }
  };

  if (adminToken) initAdminSession();
})();
