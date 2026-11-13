# RUNG CHUÔNG VÀNG PRO — BẢN NÂNG CẤP HOÀN CHỈNH CHO GITHUB PAGES

## 1. Các lỗi đã khắc phục & Nâng cấp trong bản Pro
1. **Khắc phục triệt để lỗi không đăng nhập được trang Admin trên GitHub Pages**:
   - Đã chuẩn hóa tên tệp cấu hình thành chữ thường **`config.js`** (tránh lỗi phân biệt chữ hoa/thường `Config.js` vs `config.js` trên máy chủ Linux của GitHub Pages khiến trình duyệt không tải được cấu hình `API_URL`).
   - Nâng cấp cơ chế gọi API hỗ trợ **tự động chuyển sang JSONP** nếu trình duyệt chặn CORS khi nhận phản hồi chuyển hướng từ Google Apps Script.
   - Nâng cấp xác thực phiên Admin lưu đồng thời trên `CacheService` và `PropertiesService`, tránh tình trạng vừa đăng nhập đã báo hết hạn phiên.
2. **Tính năng điều hành chuyên nghiệp (Pro)**:
   - **Duyệt tất cả** & **Cứu trợ tất cả** thí sinh chỉ với 1 lần bấm.
   - **Tạo phiên mới (Reset)** xóa lịch sử trả lời cũ và đưa thí sinh về hàng chờ.
   - **Ngân hàng câu hỏi trực tiếp**: Thêm, sửa, ẩn/hiện, xóa câu hỏi ngay trên Web Admin.
   - **Xuất báo cáo CSV**: Hỗ trợ tiếng Việt có dấu chuẩn UTF-8 BOM.

## 2. Hướng dẫn cập nhật nhanh (2 bước)
### Bước 1: Cập nhật Google Apps Script
1. Mở file Google Sheet `rungchuongvang` -> chọn **Tiện ích mở rộng (Extensions)** > **Apps Script**.
2. Cập nhật 2 tệp trong thư mục `apps-script/`:
   - `Config.gs`
   - `code.gs`
3. Nhấn **Lưu (Ctrl + S)** -> chọn **Triển khai (Deploy)** > **Quản lý các bản triển khai (Manage deployments)**.
4. Bấm biểu tượng **Chỉnh sửa (cây bút)** -> chọn **Phiên bản mới (New version)** -> đảm bảo quyền truy cập là **Bất kỳ ai (Anyone)** -> bấm **Triển khai (Deploy)**.

### Bước 2: Đưa toàn bộ tệp lên GitHub Pages
1. Tải toàn bộ các tệp ở thư mục gốc (`index.html`, `admin.html`, `screen.html`, `results.html`, `app.js`, `admin.js`, `screen.js`, `config.js`, `style.css`) lên kho lưu trữ `rungchuongvang` trên GitHub.
2. Lưu ý: Xóa tệp `Config.js` viết hoa chữ `C` cũ (nếu có) trên GitHub để tránh xung đột.
3. Truy cập `https://doantruongc3leduan.github.io/rungchuongvang/admin.html` và đăng nhập với tài khoản `admin` / mật khẩu `Thien@2026#`.
