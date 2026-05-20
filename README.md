# EFT Tracker

Веб-додаток для обліку навчання EFT терапевтів.

## Стек технологій

| Шар | Технологія |
|-----|------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| База даних | PostgreSQL + Prisma ORM |
| Авторизація | JWT + bcrypt |
| Email | Resend |
| Файли | Cloudinary |

---

## Швидкий старт

### 1. Передумови

- Node.js v18+
- PostgreSQL (локально або хмарний інстанс)
- npm або yarn

### 2. Клонувати та встановити залежності

```bash
git clone <repo-url>
cd eft-tracker

# Встановити всі залежності одразу
npm run install:all
```

### 3. Налаштувати змінні середовища

```bash
cp .env .env.local
# Відкрити .env.local і заповнити значення
```

Мінімально необхідні змінні:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/eft_tracker
JWT_SECRET=your-super-secret-key-min-32-chars
```

### 4. Ініціалізувати базу даних

```bash
cd server

# Застосувати схему до бази даних
npm run db:push

# Згенерувати Prisma Client
npm run db:generate

# Наповнити тестовими даними
npm run db:seed
```

### 5. Запустити проєкт

```bash
# З кореневої папки — запускає client і server одночасно
npm run dev
```

| Сервіс | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Prisma Studio | http://localhost:5555 (npm run db:studio у server/) |

---

## Тестові акаунти (після seed)

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | admin@eft.ua | Test1234 |
| Supervisor | supervisor@eft.ua | Test1234 |
| Therapist | therapist@eft.ua | Test1234 |

---

## Структура проєкту

```
eft-tracker/
├── client/                  # React + Vite додаток
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                  # Node.js + Express сервер
│   ├── src/
│   │   └── index.ts         # Точка входу
│   ├── prisma/
│   │   ├── schema.prisma    # Схема бази даних
│   │   └── seed.ts          # Тестові дані
│   ├── tsconfig.json
│   └── package.json
│
├── .env                     # Змінні середовища
├── .gitignore
└── package.json             # Кореневий (запуск обох частин)
```

---

## Prisma — корисні команди

```bash
cd server

# Створити міграцію після зміни схеми
npm run db:migrate

# Відкрити GUI для бази даних
npm run db:studio

# Перезапустити seed
npm run db:seed
```

## API

Базовий URL: `http://localhost:3000/api`

| Endpoint | Метод | Опис |
|----------|-------|------|
| `/api/health` | GET | Перевірка стану сервера |
