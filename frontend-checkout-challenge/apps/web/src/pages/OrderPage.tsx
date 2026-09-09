import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  isApiClientError,
  reportError,
  type CheckoutOptions,
  type Order,
  type Payment,
  type Sandbox,
  type Scenario,
} from '@/api';
import { Button } from '@/components/Button';
import { LineList } from '@/components/LineList';
import { Notice } from '@/components/Notice';
import { Spinner } from '@/components/Spinner';
import { formatDelivery, PAYMENT_DONE, pickupTitles } from '@/lib/checkout';
import { activePayment } from '@/lib/lookup';
import { formatMoney } from '@/lib/money';
import { pollUntil } from '@/lib/poll';
import { idempotencyKey, readJson, removeItem, writeJson } from '@/lib/storage';

function successCopy(order: Order): string {
  if (order.paymentMethod === 'cash_on_delivery') {
    return 'Заказ оформлен, оплата при получении';
  }
  return 'Оплата прошла, заказ подтверждён';
}

function isPaidSuccess(order: Order): boolean {
  return (
    (order.status === 'paid' && order.paymentStatus === 'succeeded') ||
    (order.status === 'confirmed' && order.paymentMethod === 'cash_on_delivery')
  );
}

function cardById(cards: Sandbox['cards'], id: string): Sandbox['cards'][number] | undefined {
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].id === id) return cards[i];
  }
  return undefined;
}

export function OrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [cardId, setCardId] = useState(() => readJson<string>('cardId', 'test-success'));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const watchRef = useRef<AbortController | null>(null);
  const watchGen = useRef(0);
  const titles = useMemo(() => pickupTitles(options), [options]);
  const pollMs = sandbox?.settlementDelayMs || 800;

  function beginWatch(): { ac: AbortController; gen: number } {
    watchRef.current?.abort();
    const ac = new AbortController();
    watchRef.current = ac;
    watchGen.current += 1;
    return { ac, gen: watchGen.current };
  }

  useEffect(() => {
    if (!orderId) return;
    const { ac, gen } = beginWatch();
    void (async () => {
      try {
        const [orderRes, sandboxRes, optionsRes] = await Promise.all([
          api.order(orderId, ac.signal),
          api.sandbox(ac.signal),
          api.checkoutOptions(ac.signal),
        ]);
        if (ac.signal.aborted || watchGen.current !== gen) return;
        setOrder(orderRes.data);
        setSandbox(sandboxRes.data);
        setOptions(optionsRes.data);
        if (orderRes.data.paymentMethod === 'card' && !isPaidSuccess(orderRes.data)) {
          const payments = await api.payments(orderId, ac.signal);
          if (ac.signal.aborted || watchGen.current !== gen) return;
          const active = activePayment(payments.data);
          const latest = payments.data[0];
          if (active) {
            await watchPayment(orderId, active, ac.signal, gen, sandboxRes.data.settlementDelayMs || 800);
          } else if (latest?.status === 'failed') {
            setNotice('Банк отказал в оплате. Можно оплатить этот заказ ещё раз.');
          } else if (latest?.status === 'cancelled') {
            setNotice('Оплата отменена. Можно оплатить этот заказ ещё раз.');
          }
        }
      } catch (err) {
        reportError(err, setError);
      }
    })();
    return () => {
      ac.abort();
    };
  }, [orderId]);

  async function watchPayment(
    id: string,
    payment: Payment,
    signal: AbortSignal,
    gen: number,
    intervalMs: number,
    firstDelayMs = 0,
  ) {
    setWaiting(true);
    setError(null);
    try {
      const current = PAYMENT_DONE.has(payment.status)
        ? payment
        : await pollUntil(
            async (next) => (await api.payment(payment.id, next)).data,
            (item) => PAYMENT_DONE.has(item.status),
            signal,
            intervalMs,
            firstDelayMs,
          );
      if (signal.aborted || watchGen.current !== gen) return;
      const latest = (await api.order(id, signal)).data;
      if (watchGen.current !== gen) return;
      setOrder(latest);
      if (current.status === 'failed') {
        setNotice('Банк отказал в оплате. Можно оплатить этот заказ ещё раз.');
        removeItem(`paymentKey:${id}`);
      } else if (current.status === 'cancelled') {
        setNotice('Оплата отменена. Можно оплатить этот заказ ещё раз.');
        removeItem(`paymentKey:${id}`);
      } else if (latest.status === 'paid' && latest.paymentStatus === 'succeeded') {
        setNotice(null);
        removeItem(`paymentKey:${id}`);
      }
    } catch (err) {
      if (watchGen.current === gen) reportError(err, setError);
    } finally {
      if (!signal.aborted && watchGen.current === gen) setWaiting(false);
    }
  }

  async function runScenario(scenario: Scenario) {
    if (!orderId || !order || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null);
    const { ac, gen } = beginWatch();
    try {
      const existing = await api.payments(orderId, ac.signal);
      const active = activePayment(existing.data);
      const key = idempotencyKey(`paymentKey:${orderId}`, `n:${existing.data.length}`);
      const payment = active ? active : (await api.createPayment(orderId, key, ac.signal)).data;
      let firstDelay = 0;
      if (!PAYMENT_DONE.has(payment.status) && payment.status !== 'processing') {
        const simulated = await api.simulatePayment(payment.id, scenario, ac.signal);
        if (simulated.status === 202) {
          firstDelay = (simulated.retryAfterSec ?? 1) * 1000;
        }
      }
      const latestPayment = firstDelay
        ? payment
        : (await api.payment(payment.id, ac.signal)).data;
      await watchPayment(orderId, latestPayment, ac.signal, gen, pollMs, firstDelay);
    } catch (err) {
      if (isApiClientError(err) && err.code === 'PAYMENT_IN_PROGRESS' && orderId) {
        const payments = await api.payments(orderId, ac.signal);
        const active = activePayment(payments.data);
        if (active) await watchPayment(orderId, active, ac.signal, gen, pollMs);
        else reportError(err, setError);
      } else {
        reportError(err, setError);
      }
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  const done = Boolean(order && isPaidSuccess(order));
  const showPay = Boolean(order && sandbox && order.paymentMethod === 'card' && !done);

  if (error && !order) {
    return (
      <div className="page">
        <Notice tone="error">{error}</Notice>
        <Link to="/" className="text-link">
          На витрину
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__intro">
        {!order ? (
          <>
            <p className="eyebrow">Заказ</p>
            <h1>Собираем данные</h1>
            <p className="lede">Ещё секунда — статус придёт с сервера.</p>
          </>
        ) : done ? (
          <>
            <p className="eyebrow">Готово</p>
            <h1>{successCopy(order)}</h1>
            <p className="lede">Номер заказа {order.number}</p>
          </>
        ) : waiting ? (
          <>
            <p className="eyebrow">Оплата</p>
            <h1>Ждём ответ банка</h1>
            <p className="lede">Не закрывайте страницу. Если обновить её, проверка продолжится.</p>
            <Spinner label="Проверяем статус оплаты" />
          </>
        ) : (
          <>
            <p className="eyebrow">Оплата картой</p>
            <h1>Тестовая платёжная форма</h1>
            <p className="lede">Номер и CVC вводить не нужно — выберите карту из списка API.</p>
          </>
        )}
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice && !done ? <Notice tone="info">{notice}</Notice> : null}

      <section className={`card order-sheet${order ? '' : ' is-skeleton'}`}>
        <h2>{order ? `Заказ ${order.number}` : 'Заказ'}</h2>
        {order ? (
          <>
            <LineList items={order.items} />
            <p className="summary__row">
              <span>Доставка</span>
              <span>{formatDelivery(order.delivery, titles)}</span>
            </p>
            <p className="summary__row">
              <span>Доставка, сумма</span>
              <span className="num">{formatMoney(order.shipping)}</span>
            </p>
            <p className="summary__total">
              <span>Итого</span>
              <span className="num">{formatMoney(order.total)}</span>
            </p>
          </>
        ) : (
          <>
            <div className="skel skel--text" />
            <div className="skel skel--text" />
            <div className="skel skel--title" />
          </>
        )}
      </section>

      {showPay && sandbox ? (
        <form
          className={`card pay-form${waiting ? ' is-waiting' : ''}`}
          onSubmit={(event) => {
            event.preventDefault();
            const card = cardById(sandbox.cards, cardId);
            if (!card) {
              setError('Выберите тестовую карту.');
              return;
            }
            writeJson('cardId', card.id);
            void runScenario(card.scenario);
          }}
        >
          <fieldset className="fieldset">
            <legend>Тестовая карта</legend>
            {sandbox.cards.map((card) => (
              <label key={card.id} className="choice">
                <input
                  type="radio"
                  name="card"
                  value={card.id}
                  checked={cardId === card.id}
                  onChange={() => setCardId(card.id)}
                  disabled={waiting || busy}
                />
                <span>
                  <strong>{card.title}</strong>
                  <span className="muted"> {card.maskedNumber}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="pay-form__actions">
            <Button type="submit" disabled={busy || waiting}>
              Оплатить
            </Button>
            <Button
              variant="ghost"
              disabled={busy || waiting}
              onClick={() => void runScenario('cancel')}
            >
              Отменить оплату
            </Button>
          </div>
        </form>
      ) : null}

      {done ? (
        <p className="page__next">
          <Link to="/" className="text-link">
            Вернуться на витрину
          </Link>
        </p>
      ) : (
        <p className="page__next" />
      )}
    </div>
  );
}
