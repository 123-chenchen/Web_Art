# Landing page đặt tranh lục giác custom

MVP React + Vite + Tailwind cho luồng:

Khách upload ảnh -> xem preview lục giác -> tự tính combo/tổng tiền -> gửi đơn về Google Apps Script -> ghi Google Sheet -> Gmail báo admin.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Cloudinary unsigned upload preset
- Google Apps Script + Google Sheet + Gmail
- Deploy bằng Vercel

## Chạy local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Điền biến môi trường trong `.env.local`:

```bash
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=luc_giac_unsigned_preset
VITE_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/your_deployment_id/exec
```

## Build

```bash
npm run build
```

## Tài liệu triển khai

- Hướng dẫn Cloudinary, Google Sheet, Apps Script và Vercel: `docs/SETUP.md`
- Code Google Apps Script: `google-apps-script/Code.gs`

## Ghi chú bảo mật MVP

- Frontend validate loại file và dung lượng.
- Apps Script validate lại dữ liệu, số ảnh, tổng tiền và URL ảnh trước khi ghi Sheet.
- Không dùng database.
- Không đưa Cloudinary API key/API secret vào frontend.
