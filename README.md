# HustFlow

Hướng dẫn chạy HustFlow trên máy local, cấu hình Stripe và triển khai trên Railway.

## 1. Chạy local

### Yêu cầu

- Node.js 20+
- MySQL
- npm
- Tài khoản Clerk, Pusher, UploadThing, Unsplash và OpenAI
- Stripe CLI nếu cần kiểm thử thanh toán

### Cài đặt

```bash
cd bkflow
npm install
```

Tạo file `bkflow/.env`:

```env
# Database
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"

# URL ứng dụng
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/select-org"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/select-org"

# Pusher
PUSHER_APP_ID=""
PUSHER_KEY=""
PUSHER_SECRET=""
PUSHER_CLUSTER=""
NEXT_PUBLIC_PUSHER_KEY=""
NEXT_PUBLIC_PUSHER_CLUSTER=""

# UploadThing
UPLOADTHING_TOKEN=""

# Unsplash
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=""

# OpenAI
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"

# Stripe
STRIPE_API_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Khởi tạo cấu trúc database:

```bash
npx prisma generate
npx prisma db push
```

Chạy ứng dụng:

```bash
npm run dev
```

Truy cập [http://localhost:3000](http://localhost:3000).

Nếu cần xem dữ liệu:

```bash
npx prisma studio
```

## 2. Kết nối Stripe

Ứng dụng tự tạo Stripe Checkout cho gói `HustFlow Pro` với giá 20 USD/tháng, vì vậy không cần tạo hoặc cấu hình `STRIPE_PRICE_ID`.

### Chạy webhook ở local

Đăng nhập Stripe CLI:

```bash
stripe login
```

Chạy ứng dụng ở terminal thứ nhất:

```bash
cd bkflow
npm run dev
```

Chuyển webhook về local ở terminal thứ hai:

```bash
stripe listen \
  --events checkout.session.completed,invoice.payment_succeeded \
  --forward-to localhost:3000/api/webhook
```

Stripe CLI sẽ trả về một signing secret dạng `whsec_...`. Gán giá trị đó cho:

```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Sau khi sửa `.env`, khởi động lại `npm run dev`. Dùng `sk_test_...` cho `STRIPE_API_KEY` khi kiểm thử local.

### Webhook khi deploy

Trong Stripe Dashboard, tạo webhook endpoint:

```text
https://TEN-MIEN-CUA-BAN/api/webhook
```

Chọn hai event:

- `checkout.session.completed`
- `invoice.payment_succeeded`

Sao chép signing secret của endpoint vào biến `STRIPE_WEBHOOK_SECRET` trên Railway. Secret webhook local và secret webhook production là hai giá trị khác nhau.

Nếu sử dụng chức năng quản lý hoặc hủy gói, bật và cấu hình Customer Portal trong Stripe Dashboard.

## 3. Deploy trên Railway

### Tạo service

1. Đẩy repository lên GitHub.
2. Tạo project mới trên Railway và chọn **Deploy from GitHub Repo**.
3. Trong service ứng dụng, đặt **Root Directory**:

```text
/bkflow
```

4. Thêm một service MySQL vào cùng Railway project.
5. Trong Variables của service ứng dụng, tạo:

```env
DATABASE_URL=${{MySQL.MYSQL_URL}}
```

Nếu service database không có tên `MySQL`, thay `MySQL` bằng đúng tên service trên Railway.

### Cấu hình deploy

Trong phần Settings của service ứng dụng:

```text
Build Command: npm run build
Pre-deploy Command: npx prisma db push
Start Command: npm run start
```

Dự án hiện dùng `prisma db push` vì repository chưa có thư mục migration.

Thêm toàn bộ biến môi trường đã liệt kê ở phần chạy local vào Railway Variables. Riêng:

```env
NEXT_PUBLIC_APP_URL="https://TEN-MIEN-CUA-BAN"
STRIPE_API_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Có thể tiếp tục dùng Stripe test mode (`sk_test_...`) nếu đây chỉ là bản demo.

### Hoàn tất

1. Vào **Settings → Networking → Generate Domain**.
2. Cập nhật `NEXT_PUBLIC_APP_URL` bằng domain vừa tạo.
3. Kiểm tra domain và redirect URL tương ứng trong Clerk.
4. Tạo Stripe webhook production trỏ tới `/api/webhook`.
5. Redeploy service.

Mỗi lần thay đổi Prisma schema, commit schema mới rồi redeploy để Railway chạy lại `npx prisma db push`.
