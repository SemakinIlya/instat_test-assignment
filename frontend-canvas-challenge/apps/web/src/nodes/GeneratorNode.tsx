import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/Button';
import { useGeneratorUi } from '@/state/CanvasProvider';
import type { GeneratorNode } from '@/lib/graph';

export const GeneratorNodeView = memo(function GeneratorNodeView({
  id,
  data,
}: NodeProps<GeneratorNode>) {
  const { generate, saveStatus } = useGeneratorUi();
  const waiting = Boolean(data.busy);
  const blocked = waiting || saveStatus === 'conflict' || saveStatus === 'error';
  return (
    <article className={`rf-node rf-node--generator${waiting ? ' is-busy' : ''}`}>
      <Handle type="target" position={Position.Left} aria-label="Вход от текста" />
      <p className="rf-node__kicker">2. Генератор</p>
      <h3 className="rf-node__title">{data.label}</h3>
      <p className="rf-node__hint">Сначала сохранятся правки, затем запустится сценарий.</p>
      <div className="rf-node__actions">
        <Button disabled={blocked} onClick={() => void generate(id, 'success')}>
          {waiting ? 'Ждём сервер…' : 'Сгенерировать'}
        </Button>
        <Button variant="ghost" disabled={blocked} onClick={() => void generate(id, 'failure')}>
          Проверить отказ
        </Button>
      </div>
      <Handle type="source" position={Position.Right} aria-label="Выход к результату" />
    </article>
  );
});
