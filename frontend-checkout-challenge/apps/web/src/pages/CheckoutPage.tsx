import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  fieldErrors,
  isApiClientError,
  isConflict,
  reportError,
  type CheckoutOptions,
  type Quote,
} from '@/api';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { LineList } from '@/components/LineList';
import { Notice } from '@/components/Notice';
import { Reveal } from '@/components/Reveal';
import { deliveryFromDraft, sameDelivery } from '@/lib/checkout';
import { formatMoney } from '@/lib/money';
import { idempotencyKey } from '@/lib/storage';
import { validateDraft } from '@/lib/validate';
import { useShop } from '@/state/ShopProvider';

export function CheckoutPage() {
  const { cart, draft, patchDraft, refreshCart, setActiveOrderId } = useShop();
  const navigate = useNavigate();
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    const ac = new AbortController();
    void api
      .checkoutOptions(ac.signal)
      .then((res) => setOptions(res.data))
      .catch((error) => {
        reportError(error, setFormError);
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!cart || cart.items.length === 0) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    const delivery = deliveryFromDraft(draft);
    if (!delivery) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    const ac = new AbortController();
    setQuoteLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.createQuote({ cartVersion: cart.version, delivery }, ac.signal);
          if (ac.signal.aborted) return;
          setQuote(res.data);
          setFormError(null);
        } catch (error) {
          if (ac.signal.aborted) return;
          setQuote(null);
          if (isConflict(error, 'CART_VERSION_CONFLICT')) {
            void refreshCart();
          }
          reportError(error, setFormError);
        } finally {
          if (!ac.signal.aborted) setQuoteLoading(false);
        }
      })();
    }, 350);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [
    cart,
    draft.deliveryMethod,
    draft.pickupPointId,
    draft.city,
    draft.street,
    draft.house,
    draft.apartment,
    quoteNonce,
    refreshCart,
  ]);

  if (!cart) return null;

  if (cart.items.length === 0) {
    return (
      <div className="page">
        <Notice tone="info">
          Оформить нечего.{' '}
          <Link to="/" className="text-link">
            Выберите товары
          </Link>
        </Notice>
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || !cart) return;
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFormError('Исправьте поля формы — введённые данные сохранены.');
      return;
    }
    const delivery = deliveryFromDraft(draft);
    if (!delivery) return;
    submitLock.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      let current = quote;
      if (
        !current ||
        current.cartVersion !== cart.version ||
        !sameDelivery(current.delivery, delivery)
      ) {
        current = (await api.createQuote({ cartVersion: cart.version, delivery })).data;
        setQuote(current);
      }
      const body = {
        quoteId: current.id,
        paymentMethod: draft.paymentMethod,
        customer: {
          name: draft.name.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim(),
        },
      };
      const key = idempotencyKey('orderKey', JSON.stringify(body));
      const { data: order } = await api.createOrder(body, key);
      setActiveOrderId(order.id);
      await refreshCart();
      navigate(`/orders/${order.id}`);
    } catch (error) {
      if (isConflict(error, 'QUOTE_EXPIRED') || isConflict(error, 'CART_VERSION_CONFLICT')) {
        await refreshCart();
        setQuote(null);
        setQuoteNonce((n) => n + 1);
        reportError(error, setFormError);
      } else if (isApiClientError(error) && error.code === 'CART_EMPTY') {
        await refreshCart();
        reportError(error, setFormError);
      } else {
        setErrors((current) => ({ ...current, ...fieldErrors(error) }));
        reportError(error, setFormError);
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const pickup = options
    ? options.deliveryMethods.find((method) => method.id === 'pickup')
    : undefined;
  const shipping = quote?.shipping;
  const total = quote?.total ?? cart.subtotal;

  return (
    <div className="page">
      <header className="page__intro">
        <p className="eyebrow">Оформление</p>
        <h1>Получатель и доставка</h1>
      </header>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <div className="checkout">
        <form className="checkout__form" onSubmit={(event) => void onSubmit(event)} noValidate>
          <Field id="name" label="Имя" error={errors.name}>
            <input
              id="name"
              name="name"
              autoComplete="name"
              value={draft.name}
              onChange={(event) => patchDraft({ name: event.target.value })}
            />
          </Field>
          <Field id="email" label="Email" error={errors.email} hint="Например buyer@example.test">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(event) => patchDraft({ email: event.target.value })}
            />
          </Field>
          <Field id="phone" label="Телефон" error={errors.phone} hint="Формат +79990000000">
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(event) => patchDraft({ phone: event.target.value })}
            />
          </Field>

          <fieldset className="fieldset">
            <legend>Доставка</legend>
            {(options?.deliveryMethods ?? []).map((method) => (
              <label key={method.id} className="choice">
                <input
                  type="radio"
                  name="deliveryMethod"
                  value={method.id}
                  checked={draft.deliveryMethod === method.id}
                  onChange={() => patchDraft({ deliveryMethod: method.id })}
                />
                <span>
                  <strong>{method.title}</strong>
                  <span className="muted">
                    {method.price
                      ? ` ${formatMoney(method.price)}${
                          method.freeFrom ? `, бесплатно от ${formatMoney(method.freeFrom)}` : ''
                        }`
                      : ' бесплатно'}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <Reveal open={draft.deliveryMethod === 'pickup'}>
            <Field id="pickupPointId" label="Пункт выдачи" error={errors.pickupPointId}>
              <select
                id="pickupPointId"
                name="pickupPointId"
                value={draft.pickupPointId}
                onChange={(event) => patchDraft({ pickupPointId: event.target.value })}
              >
                {(pickup?.pickupPoints ?? []).map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.title} — {point.address}
                  </option>
                ))}
              </select>
            </Field>
          </Reveal>
          <Reveal open={draft.deliveryMethod === 'courier'}>
            <div className="address-grid">
              <Field id="city" label="Город" error={errors.city}>
                <input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  value={draft.city}
                  onChange={(event) => patchDraft({ city: event.target.value })}
                />
              </Field>
              <Field id="street" label="Улица" error={errors.street}>
                <input
                  id="street"
                  name="street"
                  autoComplete="address-line1"
                  value={draft.street}
                  onChange={(event) => patchDraft({ street: event.target.value })}
                />
              </Field>
              <Field id="house" label="Дом" error={errors.house}>
                <input
                  id="house"
                  name="house"
                  value={draft.house}
                  onChange={(event) => patchDraft({ house: event.target.value })}
                />
              </Field>
              <Field id="apartment" label="Квартира" error={errors.apartment}>
                <input
                  id="apartment"
                  name="apartment"
                  value={draft.apartment}
                  onChange={(event) => patchDraft({ apartment: event.target.value })}
                />
              </Field>
            </div>
          </Reveal>

          <fieldset className="fieldset">
            <legend>Оплата</legend>
            {(options?.paymentMethods ?? []).map((method) => (
              <label key={method.id} className="choice">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  checked={draft.paymentMethod === method.id}
                  onChange={() => patchDraft({ paymentMethod: method.id })}
                />
                <span>{method.title}</span>
              </label>
            ))}
          </fieldset>

          <Button type="submit" disabled={submitting}>
            {submitting
              ? 'Отправляем…'
              : draft.paymentMethod === 'card'
                ? 'Перейти к оплате'
                : 'Оформить заказ'}
          </Button>
        </form>

        <aside className="card summary" aria-live="polite">
          <h2>Итог</h2>
          <LineList items={cart.items} />
          <p className="summary__row">
            <span>Товары</span>
            <span className={`num${quoteLoading ? ' is-busy' : ''}`}>
              {formatMoney(quote?.subtotal ?? cart.subtotal)}
            </span>
          </p>
          <p className="summary__row">
            <span>Доставка</span>
            <span className={`num${quoteLoading ? ' is-busy' : ''}`}>
              {shipping === undefined ? '—' : formatMoney(shipping)}
            </span>
          </p>
          <p className="summary__total">
            <span>К оплате</span>
            <span className={`num${quoteLoading ? ' is-busy' : ''}`}>{formatMoney(total)}</span>
          </p>
          <p className="muted">
            Суммы приходят с сервера. При смене корзины или доставки расчёт обновляется.
          </p>
        </aside>
      </div>
    </div>
  );
}
