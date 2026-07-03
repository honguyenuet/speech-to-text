# Hướng dẫn cài đặt & chạy

## 1. Chuẩn bị PostgreSQL

```sql
-- Mở psql và chạy:
CREATE DATABASE golden_voice;
\c golden_voice
\i database/schema.sql
```

## 2. Tạo Google OAuth Credentials

1. Vào https://console.cloud.google.com/apis/credentials
2. Tạo project mới (hoặc chọn project có sẵn)
3. Bật **Google+ API** hoặc **People API**
4. Chọn **Create Credentials → OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Thêm Authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
7. Copy **Client ID** và **Client Secret**

## 3. Cài đặt Backend

```bash
cd backend
copy .env.example .env
# Mở .env và điền các thông tin:
# - DB_PASSWORD, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET

npm install
npm run dev
# Backend chạy tại http://localhost:3001
```

## 4. Cài đặt & chạy Frontend

```bash
cd frontend
copy .env.example .env
# .env chỉ có 1 biến: VITE_API_URL=http://localhost:3001

npm install
npm run dev
# Frontend chạy tại http://localhost:3000
```

## 5. Luồng hoạt động

```
Trang chủ → Bấm nút → Chuyển đến /login
/login → Bấm "Đăng nhập bằng Google" → Google OAuth
  → Đã có tài khoản → /dashboard (đăng nhập thành công)
  → Chưa có → /register (nhập first name, last name, email, password)
              → Tạo xong → /dashboard
```

## Biến môi trường Backend (.env)

| Biến | Ý nghĩa | Ví dụ |
|------|---------|-------|
| PORT | Port backend | 3001 |
| FRONTEND_URL | URL frontend | http://localhost:3000 |
| DB_HOST | Host PostgreSQL | localhost |
| DB_PORT | Port PostgreSQL | 5432 |
| DB_NAME | Tên database | golden_voice |
| DB_USER | User PostgreSQL | postgres |
| DB_PASSWORD | Password PostgreSQL | your_password |
| GOOGLE_CLIENT_ID | Google OAuth Client ID | ... |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret | ... |
| GOOGLE_CALLBACK_URL | Google OAuth callback URL | http://localhost:3001/api/auth/google/callback |
| JWT_SECRET | Chuỗi bí mật cho JWT | random_long_string |
