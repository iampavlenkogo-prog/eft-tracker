# CLAUDE.md — Правила для Claude Code

## ЗАБОРОНЕНІ команди (НІКОЛИ не виконувати без явного підтвердження)

```
prisma db push --force-reset   ← ВИДАЛЯЄ ВСІ ДАНІ
prisma migrate reset           ← ВИДАЛЯЄ ВСІ ДАНІ
DROP TABLE                     ← ВИДАЛЯЄ ДАНІ
DELETE FROM (без WHERE)        ← ВИДАЛЯЄ ВСІ РЯДКИ
```

Якщо потрібно змінити схему бази даних — використовувати:
```bash
npx prisma db push        # додає нові таблиці/поля, НЕ скидає дані
npx prisma migrate dev    # для міграцій з версіонуванням
```

Перед будь-якою командою з `--force-reset`, `reset`, або `DROP` — обов'язково попередити користувача і отримати явне підтвердження.

## Проєкт

- **Назва:** Обійми ЕФТ Space (obiymu.com)
- **Стек:** React + TypeScript + Vite (client) / Express + Prisma + PostgreSQL Neon (server)
- **Деплой:** Render.com (статичний сайт + Node web service)
- **БД:** Neon PostgreSQL — production дані, скидати ЗАБОРОНЕНО

## Загальні правила

- Перед запуском будь-якої деструктивної операції (видалення файлів, скидання БД, force push) — питати підтвердження
- Не пушити напряму в `main` без погодження якщо зміни зачіпають production дані
