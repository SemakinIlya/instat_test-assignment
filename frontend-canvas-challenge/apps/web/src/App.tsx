import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CanvasWorkspace } from '@/pages/CanvasPage';
import { SpacesPage } from '@/pages/SpacesPage';
import { CanvasProvider } from '@/state/CanvasProvider';
import { readJson } from '@/lib/storage';

function HomeRedirect() {
  const lastSpaceId = readJson<string | null>('lastSpaceId', null);
  return <Navigate to={lastSpaceId ? `/spaces/${lastSpaceId}` : '/spaces'} replace />;
}

function CanvasRoute() {
  const { spaceId } = useParams();
  if (!spaceId) return <Navigate to="/spaces" replace />;
  return (
    <CanvasProvider spaceId={spaceId}>
      <CanvasWorkspace />
    </CanvasProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/spaces/:spaceId" element={<CanvasRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
