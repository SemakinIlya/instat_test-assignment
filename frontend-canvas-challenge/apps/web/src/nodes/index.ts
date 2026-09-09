import type { NodeTypes } from '@xyflow/react';
import { GeneratorNodeView } from './GeneratorNode';
import { PromptNodeView } from './PromptNode';
import { ResultNodeView } from './ResultNode';

export const nodeTypes = {
  prompt: PromptNodeView,
  generator: GeneratorNodeView,
  result: ResultNodeView,
} satisfies NodeTypes;
