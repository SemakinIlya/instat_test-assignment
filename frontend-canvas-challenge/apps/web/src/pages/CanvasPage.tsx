import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { SaveBadge } from '@/components/SaveBadge';
import { Spinner } from '@/components/Spinner';
import { nodeTypes } from '@/nodes';
import { useCanvas } from '@/state/CanvasProvider';

export function CanvasWorkspace() {
  const {
    ready,
    loadError,
    space,
    nodes,
    edges,
    viewport,
    saveStatus,
    notice,
    noticeTone,
    flowKey,
    config,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    onMoveEnd,
    addNode,
    removeSelected,
    reloadServerGraph,
  } = useCanvas();

  if (!ready) return <Spinner label="Открываем канвас" />;
  if (loadError) {
    return (
      <Notice tone="error">
        {loadError}{' '}
        <Link className="text-link" to="/spaces">
          К списку пространств
        </Link>
      </Notice>
    );
  }

  const nodeLimit = nodes.length >= config.maxNodes;
  const edgeLimit = edges.length >= config.maxEdges;

  return (
    <div className="canvas">
      <div className="canvas__toolbar">
        <div className="canvas__meta">
          <h1 className="canvas__title">{space?.title ?? 'Канвас'}</h1>
          <SaveBadge status={saveStatus} />
        </div>
        <div className="canvas__actions">
          <Button variant="ghost" disabled={nodeLimit} onClick={() => addNode('prompt')}>
            Добавить текст
          </Button>
          <Button variant="ghost" disabled={nodeLimit} onClick={() => addNode('generator')}>
            Добавить генератор
          </Button>
          <Button variant="ghost" disabled={nodeLimit} onClick={() => addNode('result')}>
            Добавить результат
          </Button>
          <Button variant="text" onClick={removeSelected}>
            Удалить выбранные
          </Button>
        </div>
      </div>
      {notice ? (
        <Notice tone={noticeTone}>
          {notice}
          {saveStatus === 'conflict' ? (
            <>
              {' '}
              <Button variant="ghost" onClick={() => void reloadServerGraph()}>
                Загрузить серверный граф
              </Button>
            </>
          ) : null}
        </Notice>
      ) : null}
      {nodeLimit || edgeLimit ? (
        <p className="muted canvas__limits">
          {nodeLimit ? `Достигнут лимит ${config.maxNodes} нод. ` : ''}
          {edgeLimit ? `Достигнут лимит ${config.maxEdges} связей.` : ''}
        </p>
      ) : (
        <p className="muted canvas__limits">
          Связи: текст → генератор и генератор → результат. Ввод текста не двигает ноду. Delete
          удаляет выбранное.
        </p>
      )}
      <div className="canvas__stage">
        <ReactFlow
          key={flowKey}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultViewport={viewport}
          minZoom={0.1}
          maxZoom={4}
          deleteKeyCode={['Backspace', 'Delete']}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onMoveEnd={(_, next) => onMoveEnd(next)}
          fitView={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={22} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
