# Hướng dẫn triển khai landing page tranh lục giác

## 1. Chạy local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Điền 3 biến trong `.env.local`:

```bash
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=luc_giac_unsigned_preset
VITE_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/your_deployment_id/exec
```

## 2. Tạo Cloudinary unsigned upload preset

1. Vào Cloudinary Dashboard, lấy `Cloud name`.
2. Mở phần Upload Presets và tạo preset mới.
3. Chọn Signing Mode là `Unsigned`.
4. Đặt folder mặc định, ví dụ `luc-giac-orders`.
5. Giới hạn định dạng ảnh: `jpg`, `png`, `webp`.
6. Giới hạn dung lượng upload ở preset nếu tài khoản/plan cho phép. Frontend cũng đang chặn mỗi ảnh tối đa 10MB.
7. Lưu preset name và đưa vào `VITE_CLOUDINARY_UPLOAD_PRESET`.

Không đưa API key hoặc API secret Cloudinary vào frontend.

## 3. Tạo Google Sheet

Tạo Google Sheet mới. Apps Script sẽ tự tạo header nếu dòng đầu đang trống, gồm:

```text
Thời gian đặt, Họ tên, SĐT, Địa chỉ, Số ảnh, Combo chọn, Tổng tiền, Ghi chú,
Link ảnh 1 ... Link ảnh 20, Trạng thái đơn
```

Copy Sheet ID từ URL:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/edit
```

## 4. Tạo Google Apps Script Web App

1. Trong Google Sheet, vào Extensions -> Apps Script.
2. Dán nội dung file `google-apps-script/Code.gs`.
3. Sửa 2 dòng đầu:

```js
const ADMIN_EMAIL = 'email-admin-cua-ban@example.com';
const SPREADSHEET_ID = 'SHEET_ID_CUA_BAN';
```

4. Chạy thử hàm `doGet` hoặc lưu script để Google yêu cầu cấp quyền.
5. Deploy -> New deployment -> Web app.
6. Execute as: `Me`.
7. Who has access: `Anyone`.
8. Copy URL kết thúc bằng `/exec` vào `VITE_GOOGLE_APPS_SCRIPT_URL`.

Apps Script sẽ:

- validate tên, SĐT, địa chỉ, số ảnh, tổng tiền;
- chỉ nhận tối đa 20 link ảnh Cloudinary;
- ghi 1 dòng đơn hàng vào Google Sheet;
- gửi Gmail cho admin với thông tin đơn và danh sách link ảnh.

## 5. Deploy lên Vercel

1. Đẩy source lên GitHub.
2. Import project vào Vercel.
3. Framework preset: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Thêm Environment Variables:

```bash
VITE_CLOUDINARY_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET
VITE_GOOGLE_APPS_SCRIPT_URL
```

7. Deploy.

## 6. Checklist an toàn MVP

- Frontend chặn file ngoài JPG, PNG, WEBP.
- Frontend chặn ảnh lớn hơn 10MB.
- Chỉ ảnh còn trong preview mới được upload và gửi đơn.
- Cloudinary dùng unsigned preset, không lộ API key.
- Apps Script validate lại payload và tổng tiền trước khi ghi Sheet.
- Form có honeypot field `website`.
- Không dùng database ở MVP.
