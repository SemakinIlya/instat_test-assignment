# План доработки: checkout + canvas

Документ фиксирует ревью обоих решений относительно README, ASSIGNMENT, INTEGRATION, EVALUATION и требования «максимальный DRY / один проход по данным». Реализация — после согласования этого плана. Бэкенд и `packages/contracts` не меняем.

Связанный репозиторий: `C:\work\frontend-checkout-challenge` (тот же план лежит в корне checkout).

---

## 0. Что требуют задания

Оба тестовых обязательны. Общий фильтр: нет ложного успеха, нет тихой потери данных, HTTP и ошибки не разбираются в компонентах.

### Checkout (`frontend-checkout-challenge`)

- Сценарий: каталог → корзина → оформление → карта/наличные → страница заказа.
- API: `http://127.0.0.1:4000`, обёртка `{ data, meta, links }`, `Authorization: Bearer`.
- Суммы в копейках. Форма карты — только название и маска из `/api/sandbox`.
- Оценка: A 40 / B 30 / C 15 / D 10 / E 5. Порог отбора: ≥75, A≥30, B≥15.
- D2 явно просит README: где заголовки, отправка, разбор, ошибки.

### Canvas (`frontend-canvas-challenge`)

- Сценарий: space → три ноды → связи prompt→generator→result → debounce 500 мс PUT + If-Match → генерация с flush сохранения.
- API: `http://127.0.0.1:4001`, тело = ресурс (без `data`), ошибки `{ error: { code, message } }`.
- Оценка: **D 40 / P 10 / A 20 / B 20 / C 5 / E 5**. Порог: ≥75, D≥30, A≥15, B≥10, **D1=D3=D4=5**.
- README обязан объяснить API-слой, очередь сохранений и **один реальный участок обработки данных** (частота, проходы, память).

### Комментарий к отбору (оба репо)

1. Ошибки не обрабатываются в каждом вызове fetch.
2. Fetch не разный в каждом компоненте.
3. DRY на максимум: обобщать всё повторяющееся.
4. `.map().filter()` / повторный `.find()` внутри обхода хуже одного прохода (`reduce` / `for` + `Map`), если результат тот же.

---

## 1. Версии пакетов и API (npm + Context7)

Проверено 2026-09-09. Корневой TypeScript **5.9.3** оставляем: он общий с API, latest 5.x = 5.9.3, TypeScript 7 — отдельный major для всего монорепо.

| Пакет | Сейчас | Latest в том же major | Latest overall | Решение |
| --- | --- | --- | --- | --- |
| `react` / `react-dom` | 19.2.3 | **19.2.8** | 19.2.8 | Поднять. `createRoot` из `react-dom/client` + `StrictMode` — актуальный API React 19.2. |
| `@types/react` | 19.2.7 | **19.2.18** | 19.2.18 | Поднять вместе с React. |
| `@types/react-dom` | 19.2.3 | **19.2.7** | 19.2.7 | Поднять. |
| `react-router-dom` | 7.11.0 | **7.18.3** | 7.18.3 | Поднять. **Declarative `BrowserRouter` + `Routes` остаётся валидным API v7.** `createBrowserRouter` / framework-plugin не внедряем: это другой режим, для Vite-SPA не обязателен. Импорт из `react-router-dom` в v7 — официальный re-export `react-router`. |
| `vite` | 7.3.0 | **7.3.6** | 8.2.2 | Поднять до **7.3.6**. Vite 8 не берём: `@vitejs/plugin-react@6` требует Vite ≥8, это смена major без выигрыша в задании. `defineConfig` + `loadEnv` + `envPrefix: 'VITE_'` — актуальный API. |
| `@vitejs/plugin-react` | 5.1.2 | **5.2.0** | 6.1.1 | Поднять до **5.2.0**. v6 несовместим с Vite 7. Вызов `react()` без опций корректен. |
| `@xyflow/react` (только canvas) | 12.10.0 | **12.11.6** | 12.11.6 | Поднять. Используемые API живы: `ReactFlow`, `Handle`, `applyNodeChanges` / `applyEdgeChanges`, `addEdge`, `isValidConnection`, `onMoveEnd`, `Background` / `Controls` / `MiniMap`. `ReactFlowProvider` нужен только для хуков **снаружи** `<ReactFlow>`; сейчас хуки xyflow снаружи не используются — провайдер не обязателен. Атрибуцию не скрывать (`hideAttribution: false` уже так). |
| `typescript` (apps/web и корень) | 5.9.3 | 5.9.3 | 7.0.2 | Не трогать. |

Конфиг Vite (`loadEnv` + `define import.meta.env.VITE_API_URL`) соответствует docs. `vite-env.d.ts` типизирует `VITE_API_URL` правильно.

---

## 2. Текущее состояние: что уже хорошо

Оба фронтенда уже проходят «фильтр fetch»: один `send()` в `api/http.ts`, страницы зовут `api.*`, сырой `Response` в UI нет.

### Checkout

| Слой | Файлы | Роль |
| --- | --- | --- |
| Транспорт | `api/http.ts` | URL, заголовки, `fetch`, `NetworkError` |
| Разбор | `api/parse.ts` | 204/304, JSON, `unwrapData`, `Retry-After` |
| Ошибки | `api/errors.ts` | `mapError`, коды → русский текст, `fieldErrors` |
| Ресурсы | `api/resources.ts` | токен + методы API |
| Состояние | `state/ShopProvider.tsx`, `boot.ts` | сессия, корзина, epoch от устаревшего GET |
| Домен | `lib/{money,validate,checkout,storage}` | копейки, форма, идемпотентность |

A1–A8 по коду закрыты: каталог, абсолютный PUT количества, quote из API, карта по title/mask, успех только по статусу **заказа**, наличные без simulate.

### Canvas

| Слой | Файлы | Роль |
| --- | --- | --- |
| Транспорт | `api/http.ts` | + `If-Match` / `If-None-Match` |
| Разбор | `api/parse.ts` | тело = ресурс, ETag/Location/Retry-After |
| Ошибки | `api/errors.ts` | единый `mapError` |
| Граф | `lib/graph.ts` | один проход, `Map`/`Set`, strip RF-полей |
| Сохранение | `lib/save-queue.ts` + `persist.ts` | debounce 500, serial PUT, 412 pause |
| Генерация | `lib/generation.ts` + `lib/poll.ts` | pollUntil, stale-guard `mayApplyGeneration` |

D1–D8 по коду близки к 5. A1–A4 закрыты. SaveQueue + ETag + flush перед generate соответствуют INTEGRATION.

---

## 3. Разрывы относительно критериев

### 3.1 Оба проекта — E1 / D2 README

`apps/web/README.md` **нет** (корень на него ссылается). Без файла:

- Checkout: E1 не 5, D2 режут («в README объяснено, где это сделано»).
- Canvas: E1 ≈ 0, плюс обязательный разбор проходов по графу.

Это первый обязательный артефакт после кода.

### 3.2 Checkout — устойчивость и DRY

| ID | Проблема | Где |
| --- | --- | --- |
| B5 | Два опроса оплаты. Mount-effect держит свой `AbortController`, `runScenario` абортит только `watchRef`. Старый `watchPayment` может перезаписать `order` / `notice`. | `pages/OrderPage.tsx` |
| B3 | При 401 boot создаёт новую сессию, но `orderId` в state/localStorage не сбрасывается. Шапка ведёт на чужой заказ. | `state/boot.ts`, `ShopProvider` |
| B4 | После `QUOTE_EXPIRED` quote обнуляется, но эффект расчёта зависит от `cart`. Если версия корзины та же — **новый quote сам не уйдёт**, текст «посчитаем заново» врёт. | `CheckoutPage` |
| D / DRY | Один и тот же `catch { setError(userMessage(err)) }` на каталоге, корзине, checkout, заказе. | страницы |
| P1 | В `products.map` внутри `.find` по корзине — O(n×m). В корзине `stockOf` = `.find` по товарам на каждую строку. | `CatalogPage`, `CartPage` |
| D6 | `PickupPointId` захардкожен (`point-center` / `point-north`) в types, storage и `isPickupPointId`. Select отбрасывает неизвестные пункты API. | `api/types.ts`, `lib/checkout.ts` |
| D6 | `CheckoutOptions`, `Sandbox`, `Session` продублированы вручную, хотя схемы есть в `@checkout/contracts`. | `api/types.ts` |
| D3 | Невалидный JSON → `undefined`, `unwrapData` без проверки envelope. 200 с битым телом даст тихий `undefined`. | `api/parse.ts` |
| C2 | `Field` считает `describedBy`, но не вешает `aria-describedby` на контрол (`data-described` на обёртке). Адресные поля без aria. | `components/Field.tsx` |
| — | `Spinner` мёртвый. `clearIdempotency` не используется. `paymentId` пишется и не читается. `sleep`+цикл опроса не вынесены (в canvas уже есть `pollUntil`). | |

### 3.3 Canvas — устойчивость, P2, DRY-мелочи

| ID | Проблема | Где |
| --- | --- | --- |
| B1/E | `SaveQueue.bump` делает `void this.flush()` без catch → unhandled rejection при ошибке PUT. | `lib/save-queue.ts` |
| B4 | При старте poll сразу `applyGeneration(processing)`. Если цепочку переподключили, финальный apply отсекается `mayApplyGeneration`, но спиннер на старой result-ноде остаётся. | `CanvasProvider.watchGeneration` |
| B3 | `IDEMPOTENCY_CONFLICT` не помечает ключ `done` — повтор с тем же fingerprint крутит тот же ключ. | `generate` + `lib/storage.ts` |
| P2 | `NodeUiContext` отдаёт `{ views, busy, generate, ... }`. Любой апдейт view/busy ререндерит **все** memo-ноды. | `CanvasProvider`, `nodes/*` |
| D3 | Тот же мягкий `JSON.parse` → `undefined` на 200. | `api/parse.ts` |
| D6 | Локальный тип `Config` дублирует схему `Config` из контрактов (ещё и без `links`). | `api/resources.ts` |
| C1 | Генератор disabled только при `conflict`, не при `saving`/`error`. `generate()` сам выходит, UI врёт. | `GeneratorNode.tsx` |
| C1 | `Field` без `aria-describedby` на инпуте. | `components/Field.tsx` |
| — | `countBy` и `SaveQueue.resume` не используются. `generate` заново строит `indexNodes` вместо `nodeByIdRef`. | |

---

## 4. Принципы правок (как проходят D и P)

1. **Транспорт один.** Новый метод = строка в `api` object. Компонент не знает про headers/status/json.
2. **Ошибка транспорта мапится один раз** (`mapError`). UI только показывает уже понятную строку.
3. **Показ ошибки в UI — тоже один хелпер**, не копипаста `catch` на каждый клик.
4. **Опрос/debounce/очередь** — модули (`pollUntil`, `SaveQueue`), не циклы в страницах.
5. **Горячие пути: один проход.** Индекс `Map` строится один раз на снимок данных, не `.find` внутри `.map`.
6. **Не плодить абстракции «ради D».** Нет флагов-комбайна. Разные правила (envelope checkout vs raw canvas) остаются разными `parse.ts`.
7. **Общий пакет между двумя репо не делаем** (в EVALUATION canvas это явно не требуется).

---

## 5. План реализации

Порядок: сначала корректность (B), потом DRY/P, потом README и версии, потом ручная проверка.

### Этап A — общий каркас API (оба репо)

**Checkout `api/parse.ts` + `api/errors.ts`**

- `readPayload`: пустое тело на 204/304 — ок; на остальных статусах, где ждали JSON, кидать `ApiClientError('PARSE_ERROR')`, не `undefined`.
- `unwrapData`: проверить, что payload — объект с `data`; иначе PARSE_ERROR.
- Вынести `retryAfterSeconds` без изменений.

**Canvas `api/parse.ts`**

- Та же жёсткая политика JSON.
- Успех: тело и есть ресурс (не unwrap). Переименовать клиентский `Envelope` → `ApiResult`, чтобы ревьюер не принял это за обёртку checkout.

**Оба `components/Field.tsx`**

- `cloneElement` (если child — один элемент): прокинуть `aria-describedby` и `aria-invalid`.
- Убрать бесполезный `data-described`.

Не раздувать http.ts. Заголовки уже централизованы.

### Этап B — Checkout: баги B3–B5

1. **Один AbortController для оплаты**
   - Mount и `runScenario` делят `watchRef`.
   - Перед новым watch всегда abort предыдущего.
   - Цикл `sleep(800) + GET payment` заменить на общий `pollUntil` в `lib/poll.ts` (как в canvas). Первый delay — `Retry-After` симуляции / `sandbox.settlementDelayMs`, дальше короткий интервал.
   - Опционально monotonic `watchEpoch`, чтобы запоздавший `setOrder` игнорировался (как `cartEpoch`).

2. **Новая сессия чистит заказ**
   - В `boot.ts` при createSession: `removeItem('orderId')`, payment/order keys.
   - В `ShopProvider`: всегда `setActiveOrderIdState(result.openOrderId)` (в том числе `null`).

3. **QUOTE_EXPIRED реально пересчитывает**
   - После конфликта инкремент `quoteNonce` в deps эффекта **или** сразу `createQuote` в catch submit.
   - Текст Notice должен совпадать с действием.

4. **Pickup без хардкода**
   - `pickupPointId: string`. Удалить `isPickupPointId`. Пункты только из `checkout/options`.

5. **Типы из контрактов**
   - `Static<typeof CheckoutOptionsSchema>` и соседние схемы вместо ручных интерфейсов в `api/types.ts` (только type-only import, схемы не меняем).

### Этап C — Checkout: DRY и P1

1. **`useActionError()`** (один хук)
   - `{ error, run, clear }`
   - `run(fn)` = try/catch + skip abort + `userMessage`.
   - Каталог/корзина/checkout/order перестают копировать catch.

2. **Индексы одним проходом**
   - `qtyByProductId`: один `for`/`reduce` по `cart.items` → `Map` или объект.
   - `stockByProductId`: один проход по `products`.
   - Каталог и корзина читают индекс, не `.find` внутри `.map`.
   - `addOne` берёт qty из `Map`/ref, не линейный поиск (при 4 товарах это скорее демонстрация P1, чем профит).

3. **Общий кусок строк заказа**
   - Список `title × qty` + money row — маленький `LineList`, чтобы checkout summary и order sheet не расходились.

4. **Мёртвое**
   - Либо применить `Spinner` на boot/order wait, либо удалить.
   - Удалить неиспользуемые `clearIdempotency` **или** вызывать его при новой попытке оплаты (сейчас `removeItem`).

5. **ShopProvider `delete` на Record**
   - Для объекта это не hole в массиве V8. Можно оставить или собирать новый объект без ключа через rest. Не трогать массивы через `delete`.

### Этап D — Canvas: баги B и P2

1. **SaveQueue**
   - `bump`: `void this.flush().catch(() => {})` — UI уже уведомлён в `persist`.
   - Удалить `resume()`, если так и не нужен после 412 (сейчас только `reset` + reload).

2. **Сброс processing UI при разрыве цепи**
   - После изменения edges/nodes: один проход по `views`, удалить записи, для которых `findResultForGenerator` больше не совпадает.
   - Не подставлять чужой результат (правило B4 сохранить).

3. **Idempotency**
   - На `IDEMPOTENCY_CONFLICT` — `expireIdempotencyKey`, затем пользователь жмёт снова с новым ключом.
   - На терминальном `failed` ключ уже `complete` — не ломать.

4. **P2 нод**
   - Не кормить все ноды одним context-value с `views`.
   - Вариант с меньшей ценой: хранить preview **только в `data` result-ноды** (локально). `toApiGraph` и так сериализует лишь `label` — на PUT не уйдёт. `updateAt` уже сохраняет ссылки остальных нод.
   - Альтернатива: три узких контекста (prompt / generator / result). Предпочтителен первый: меньше ререндеров, один проход `updateAt`.

5. **generate()**
   - Использовать `nodeByIdRef`, не `indexNodes(nodesRef)` заново.
   - Кнопки генератора: disabled при `saving | error | conflict | waiting`.
   - Если flush не довёл до `saved` — не молчать, если notice ещё нет.

6. **Config**
   - Тип из `Static<typeof Config>` контракта (schema уже есть). Локальный дубль убрать.

7. **Удалить `countBy`.**

### Этап E — README (оба `apps/web/README.md`)

Обязательные блоки из ASSIGNMENT:

- Команды: `npm ci`, `npm run dev`, `npm run build`, отдельно `dev:web` / `dev:api`.
- Слои API: config → http → parse → errors → resources → UI. Что менять, чтобы добавить запрос / заголовок / разбор / текст ошибки.
- Проверенные сценарии (чеклист ниже).
- Известные недоработки.
- Время.

**Только canvas — разбор горячего пути**, например `toApiGraph` + `canConnect`/`indexEdges`:

- Когда вызывается (debounce PUT, generate flush, каждый connect).
- Сколько проходов: один по nodes, один по edges, lookup O(1) через Map/Set.
- Что выделяется: два плотных массива под лимит 20, без промежуточного `.map().filter()`, без дыр.

**Только checkout — распределение обязанностей** для D2: страницы не ходят в `fetch`, токен только в `resources`, epoch корзины в провайдере, идемпотентность в `storage`.

### Этап F — версии

В обоих `apps/web/package.json`:

```text
react, react-dom          19.2.8
@types/react              19.2.18
@types/react-dom          19.2.7
react-router-dom          7.18.3
vite                      7.3.6
@vitejs/plugin-react      5.2.0
@xyflow/react (canvas)    12.11.6
```

`npm install` из корня workspace, проверить `npm run build`. Импорты не менять (`react-router-dom`, `@xyflow/react`). Не включать React Compiler и не переходить на Vite 8.

---

## 6. Что сознательно не делаем

- Не менять `apps/api`, OpenAPI, контрактные схемы (только type-import существующих).
- Не общий npm-пакет между checkout и canvas.
- Не `createBrowserRouter` / SSR / React Router framework mode.
- Не React Flow `useNodesState` — контролируемый граф через свои refs нужен для SaveQueue и strip RF-полей.
- Не условное кэширование If-None-Match на все ресурсы (INTEGRATION: не требуется).
- Не мобильная вёрстка canvas (C1: 1280px).
- Не админка, деплой, оплата живой картой, внешняя нейросеть.

---

## 7. Чеклист проверки после кода

### Checkout (1280 и 390)

- [ ] Каталог с API, add в серверную корзину, сток, пустой товар.
- [ ] Qty / удаление, итог = API.
- [ ] Pickup и courier, quote меняется, суммы с сервера.
- [ ] Карта: title+маска, ждать, успех только если заказ `paid/succeeded`.
- [ ] Наличные: «оплата при получении», без POST payments.
- [ ] Decline и cancel различимы, повтор того же orderId новой попыткой.
- [ ] Двойной клик оформить/оплатить — один заказ / одна попытка.
- [ ] Reload на витрине, в чекауте (форма жива), во время processing оплаты.
- [ ] Смена корзины / истекший quote — можно продолжить, данные не стёрты.
- [ ] Уход со страницы заказа останавливает poll.

### Canvas (1280)

- [ ] Создать space, три ноды, UUID, текст и drag сразу на экране.
- [ ] Связи только prompt→generator→result, один вход, один выход генератора, delete ноды чистит edges, PUT принимается.
- [ ] Правки 500 мс → один PUT, If-Match с кавычками.
- [ ] Generate сразу после ввода: flush, потом POST generation, картинка в связанном result.
- [ ] Failure-сценарий и повтор.
- [ ] 412: черновик на месте, кнопка «Загрузить серверный граф».
- [ ] Reload: граф, картинки, processing продолжается.
- [ ] Rewire во время generate: чужая нода без старой картинки и без вечного spinner.
- [ ] Unmount / смена space — poll остановлен.

### Сборка

- [ ] Свежий `npm ci` + `npm run dev` + `npm run build` по README.
- [ ] `apps/web/README.md` на месте в обоих репо.

---

## 8. Оценка «как есть» → «после плана»

| | Checkout сейчас | Checkout цель | Canvas сейчас | Canvas цель |
| --- | --- | --- | --- | --- |
| Основной сценарий | ~40 | 40 | ~20 | 20 |
| Устойчивость | ~20–25 (poll + session + quote) | 30 | ~15–18 (queue reject, stuck processing, idem) | 20 |
| UI | ~12–15 (Field a11y) | 15 | ~2–5 | 5 |
| Код / DRY (+P у canvas) | D ~5–8 без README | 10 | D ~35–40, P ~5–8 | D 40, P 10 |
| README/запуск | 0–2 | 5 | 0–2 | 5 |
| Итого грубо | 75–85 с риском E/B | ≥90 | 75–85 с риском E/B4 | ≥90 |

Фильтр по D1/D3/D4 canvas код уже проходит; режет документация и пара багов состояния. Checkout режет документация, гонка poll и незакрытый DRY в UI-catch / индексах.

---

## 9. Порядок файлов (шпаргалка)

**Checkout:** `api/parse.ts`, `api/types.ts`, `api/errors.ts`, `lib/poll.ts` (новый), `lib/action.ts` или хук `useActionError`, `lib/index-maps.ts` (или функция в `lib/checkout.ts`), `state/boot.ts`, `state/ShopProvider.tsx`, `pages/{Catalog,Cart,Checkout,Order}Page.tsx`, `components/Field.tsx`, `apps/web/README.md`, `apps/web/package.json`.

**Canvas:** `api/parse.ts`, `api/resources.ts`, `lib/save-queue.ts`, `lib/storage.ts`, `lib/update.ts`, `lib/graph.ts` (prune views helper), `state/CanvasProvider.tsx`, `nodes/GeneratorNode.tsx`, `components/Field.tsx`, `apps/web/README.md`, `apps/web/package.json`.
