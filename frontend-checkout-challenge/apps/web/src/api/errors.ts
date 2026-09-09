import type { ApiError } from '@checkout/contracts';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: { path: string; message: string }[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: { path: string; message: string }[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}

const MESSAGES: Record<string, string> = {
  CART_EMPTY: 'В корзине нет товаров. Добавьте что-нибудь с витрины.',
  CART_VERSION_CONFLICT: 'Корзина изменилась. Мы обновили данные — проверьте сумму и продолжите.',
  QUOTE_EXPIRED: 'Расчёт доставки устарел. Мы посчитаем его заново.',
  INSUFFICIENT_STOCK: 'Такого количества нет в наличии.',
  PRODUCT_NOT_FOUND: 'Товар больше недоступен.',
  SESSION_INVALID: 'Сессия истекла. Мы создадим новую, данные корзины на сервере не сохранятся.',
  SESSION_REQUIRED: 'Нужна гостевая сессия. Обновите страницу.',
  PAYMENT_IN_PROGRESS: 'Этот заказ уже оплачивается. Дождитесь результата.',
  PAYMENT_FINALIZED: 'Сценарий этой попытки уже выбран. Создайте новую попытку.',
  ORDER_ALREADY_PAID: 'Заказ уже оплачен.',
  PAYMENT_NOT_REQUIRED: 'Этот заказ оплачивается при получении.',
  IDEMPOTENCY_CONFLICT: 'Повтор запроса не совпал с исходным. Отправьте форму ещё раз.',
  VALIDATION_ERROR: 'Проверьте поля формы.',
  PARSE_ERROR: 'Не удалось разобрать ответ сервера.',
};

const FIELD_BY_PATH: Record<string, string> = {
  'body/customer/name': 'name',
  'body/customer/email': 'email',
  'body/customer/phone': 'phone',
  'body/delivery/address/city': 'city',
  'body/delivery/address/street': 'street',
  'body/delivery/address/house': 'house',
  'body/delivery/address/apartment': 'apartment',
  'body/delivery/pickupPointId': 'pickupPointId',
};

function isApiErrorPayload(value: unknown): value is ApiError {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'error' in value &&
    value.error &&
    typeof value.error === 'object',
  );
}

export function mapError(status: number, payload: unknown): ApiClientError {
  if (isApiErrorPayload(payload)) {
    const { error, meta } = payload;
    return new ApiClientError(
      status,
      error.code,
      MESSAGES[error.code] ?? error.message,
      error.fields,
      meta.requestId,
    );
  }
  return new ApiClientError(status, 'UNKNOWN', 'Не удалось выполнить запрос.');
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function isConflict(error: unknown, code: string): boolean {
  return isApiClientError(error) && error.status === 409 && error.code === code;
}

/** API path → form field. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiClientError(error) || !error.fields) return {};
  const result: Record<string, string> = {};
  for (const field of error.fields) {
    const key = FIELD_BY_PATH[field.path];
    if (key) result[key] = 'Проверьте это поле.';
  }
  return result;
}

export function userMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Не удалось выполнить запрос.';
}

/** Ignore abort. */
export function reportError(error: unknown, setError: (message: string) => void): boolean {
  if (isAbortError(error)) return false;
  setError(userMessage(error));
  return true;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}
