# RUNG CHUÔNG VÀNG PRO — HƯỚNG DẪN TRIỂN KHAI THỰC TẾ

Hệ thống đã được nâng cấp toàn diện từ bản gốc lên phiên bản **Pro** để sẵn sàng vận hành thực tế tại sân trường/hội trường.

---

## 1. Các tính năng mới đã nâng cấp trong bản Pro
1. **Duyệt đồng loạt & Cứu trợ toàn bộ (`admin.html` + `code.gs`)**:
   - Nút **Duyệt tất cả**: Đưa toàn bộ thí sinh đang chờ (`READY`) vào danh sách thi chỉ với 1 lần bấm.
   - Nút **Cứu trợ tất cả**: Khôi phục toàn bộ thí sinh đã bị loại (`ELIMINATED`) quay trở lại sàn đấu khi có cứu trợ từ thầy cô/khán giả.
   - Nút **Tạo phiên mới (Reset)**: Xóa lịch sử trả lời cũ và đưa toàn bộ thí sinh về trạng thái chờ duyệt để bắt đầu lượt thi mới nhanh chóng.
2. **Quản lý Ngân hàng câu hỏi trực tiếp trên Web Admin**:
   - Thêm mới, chỉnh sửa, ẩn/hiện hoặc xóa câu hỏi ngay trên giao diện Admin mà không cần mở trực tiếp file Google Sheet.
3. **Xuất báo cáo Excel/CSV**:
   - Xuất nhanh danh sách thí sinh kèm trạng thái và bảng xếp hạng chung cuộc ra file `.CSV` (mở trực tiếp bằng Excel hỗ trợ đầy đủ tiếng Việt có dấu UTF-8 BOM).
4. **Màn hình sân khấu (`screen.html`) & Thí sinh (`index.html`) nâng cấp**:
   - Bổ sung hiệu ứng âm thanh đếm ngược 3 giây cuối, tiếng chuông bắt đầu và vinh danh kết thúc (có nút bật/tắt âm thanh chủ động).
   - Hiển thị điểm số trực tiếp của thí sinh trên thanh trạng thái cá nhân.
   - Tự động khôi phục phiên đăng nhập từ Google Sheet nếu bộ nhớ đệm `CacheService` của Google bị làm mới giữa chừng.

---

## 2. Cấu trúc thư mục trong gói `.zip`
- `index.html`, `app.js`: Giao diện và logic dành cho thí sinh tham gia thi trên điện thoại/máy tính.
- `admin.html`, `admin.js`: Bảng điều khiển trung tâm dành cho Ban tổ chức / MC.
- `screen.html`, `screen.js`: Màn hình trình chiếu lớn trên sân khấu / máy chiếu hội trường.
- `results.html`: Bảng xếp hạng vinh danh Top 3 và toàn bộ thí sinh.
- `config.js`: Cấu hình đường dẫn Web App Apps Script và thời gian đồng bộ.
- `style.css`: Giao diện chuẩn hóa tương thích cả điện thoại, máy tính bảng và màn hình chiếu lớn.
- `apps-script/Config.gs` & `apps-script/code.gs`: Mã nguồn Backend chạy trên Google Apps Script kết nối với Google Sheet.

---

## 3. Quy trình cập nhật lên Google Apps Script (Bắt buộc)
Để các nút mới (Duyệt tất cả, Cứu trợ tất cả, Ngân hàng câu hỏi, Reset phiên thi) hoạt động:
1. Mở file Google Sheet của chương trình -> chọn **Tiện ích mở rộng (Extensions)** > **Apps Script**.
2. Cập nhật nội dung file `Config.gs` (hoặc `Config`) và `code.gs` (hoặc `Code.gs`) bằng 2 tệp tương ứng trong thư mục `apps-script/` của gói này.
3. Bấm **Lưu (Ctrl + S)**.
4. Bấm **Triển khai (Deploy)** > **Quản lý các bản triển khai (Manage deployments)**.
5. Chọn biểu tượng **Chỉnh sửa (hình cây bút)** ở bản triển khai hiện tại -> tại mục *Phiên bản (Version)* chọn **Phiên bản mới (New version)** -> bấm **Triển khai (Deploy)**.
   *(Lưu ý: Việc chọn "Phiên bản mới" giúp giữ nguyên đường dẫn `API_URL` cũ mà không cần sửa lại `config.js`)*.
6. Đưa các tệp Frontend (`index.html`, `admin.html`, `screen.html`, `results.html`, `app.js`, `admin.js`, `screen.js`, `config.js`, `style.css`) lên hosting/GitHub Pages để sử dụng ngay.
