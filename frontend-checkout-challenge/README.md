# Тестовое задание для фронтенд-разработчика

Нужно сделать интерфейс магазина: каталог, корзину, оформление заказа и оплату тестовой картой. Бэкенд готов, фронтенд добавьте в `apps/web`.

[Условия задания](docs/ASSIGNMENT.md) · [Работа с API](docs/INTEGRATION.md) · [Критерии оценки](docs/EVALUATION.md)

## Запуск

Потребуются Node.js 24.x и npm 11.x. Отдельная база данных и ключи внешних сервисов не нужны.

```sh
git clone https://github.com/instatdigital/frontend-checkout-challenge.git
cd frontend-checkout-challenge
npm ci
npm run dev
```

Магазин: [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Swagger: [http://localhost:4000/docs/](http://localhost:4000/docs/). Спецификация: [http://localhost:4000/openapi.json](http://localhost:4000/openapi.json) или [файл в репозитории](docs/openapi.json).

Отдельно: `npm run dev:api` и `npm run dev:web`. Сборка фронтенда входит в `npm run build`. Описание решения — в [apps/web/README.md](apps/web/README.md).

В Swagger выполните `POST /api/sessions` с телом `{}`. Скопируйте `data.token` в **Authorize**, без слова `Bearer`.

## Структура

```text
apps/api/             бэкенд
apps/web/             фронтенд (React + Vite)
packages/contracts/   схемы API и типы TypeScript
docs/                 задание и документация
scripts/              проверки
```

Проект использует npm workspaces. Фронтенд — `@checkout/web`. `npm run dev` поднимает API и магазин вместе.

## Проверки

```sh
npm run check       # форматирование, сборка, тесты и OpenAPI
npm run build
npm start           # запуск собранного бэкенда
```

При работающем API в другом терминале выполните `npm run smoke`. Эта команда проверяет покупку, отказ карты, отмену и повтор оплаты по HTTP.

## Настройки

Адрес по умолчанию — `127.0.0.1:4000`. Если порт занят, скопируйте `.env.example` в `.env` и измените `PORT`. Для проверки другого порта передайте `BASE_URL`, например `BASE_URL=http://localhost:4100 npm run smoke`.

Фронтенд может работать на любом HTTP-порту `localhost`, `127.0.0.1` или `[::1]`. Другие разрешённые адреса задаются в `CORS_ORIGINS`. Авторизация передаётся заголовком; cookies и `credentials: include` не нужны.

Данные сохраняются в `.data/store.json`. Запускайте один экземпляр API на один файл. Для сброса остановите сервер и выполните `npm run data:reset`; затем создайте новую сессию. Если меняли `DATA_FILE`, свой файл удалите вручную при остановленном сервере.

Товары и адреса вымышленные. Остаток ограничивает количество в одной корзине и не уменьшается у других покупателей. Для получателя используйте тестовые контакты, например `buyer@example.test`. Вместо ввода номера карты интерфейс должен предлагать тестовые карты из API.

Корневые `npm run build` и `npm test` собирают контракты, API и фронтенд, затем гоняют тесты бэкенда. Схемы API в `packages/contracts` используются во фронтенде как типы.
