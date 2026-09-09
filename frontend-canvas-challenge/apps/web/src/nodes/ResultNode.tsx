import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Spinner } from '@/components/Spinner';
import type { ResultNode } from '@/lib/graph';

export const ResultNodeView = memo(function ResultNodeView({ data }: NodeProps<ResultNode>) {
  const view = data.view;
  return (
    <article className="rf-node rf-node--result">
      <Handle type="target" position={Position.Left} aria-label="Вход от генератора" />
      <p className="rf-node__kicker">3. Результат</p>
      <h3 className="rf-node__title">{data.label}</h3>
      <div className="rf-node__preview">
        {view?.status === 'processing' ? <Spinner label="Генерируем изображение" /> : null}
        {view?.status === 'succeeded' && view.imageUrl ? (
          <img src={view.imageUrl} alt="Сгенерированное изображение" />
        ) : null}
        {view?.status === 'failed' ? (
          <p className="rf-node__fail">
            Генерация не удалась ({view.failureCode ?? 'ошибка'}). Нажмите «Сгенерировать» или
            «Проверить отказ» ещё раз.
          </p>
        ) : null}
        {!view ? <p className="rf-node__hint">Картинка появится здесь после генерации.</p> : null}
      </div>
    </article>
  );
});
