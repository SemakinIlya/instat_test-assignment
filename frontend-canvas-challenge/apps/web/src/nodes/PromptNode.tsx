import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { usePromptUi } from '@/state/CanvasProvider';
import type { PromptNode } from '@/lib/graph';

export const PromptNodeView = memo(function PromptNodeView({ id, data }: NodeProps<PromptNode>) {
  const { updatePrompt } = usePromptUi();
  return (
    <article className="rf-node rf-node--prompt">
      <p className="rf-node__kicker">1. Текст</p>
      <h3 className="rf-node__title">Описание</h3>
      <label className="rf-node__label" htmlFor={`${id}-text`}>
        Описание изображения
      </label>
      <textarea
        id={`${id}-text`}
        className="nodrag nopan nowheel"
        value={data.text}
        maxLength={2000}
        rows={5}
        placeholder="Горы на рассвете"
        onChange={(event) => updatePrompt(id, event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
      />
      <Handle type="source" position={Position.Right} aria-label="Выход к генератору" />
    </article>
  );
});
