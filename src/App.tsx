import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import RecipesList from './pages/RecipesList';
import RecipeEdit from './pages/RecipeEdit';
import RecipeDetail from './pages/RecipeDetail';
import JournalList from './pages/JournalList';
import JournalEdit from './pages/JournalEdit';
import JournalDetail from './pages/JournalDetail';
import FamilyHub from './pages/FamilyHub';
import { role } from './lib/auth';

function RequireAdmin({ children }: { children: ReactNode }) {
  const loc = useLocation();
  if (role() !== 'admin') return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}
function RequireFamily({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const r = role();
  if (r === 'guest') return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}&family=1`} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route path="/recipes" element={<RequireAdmin><RecipesList /></RequireAdmin>} />
        <Route path="/recipes/new" element={<RequireAdmin><RecipeEdit /></RequireAdmin>} />
        <Route path="/recipes/:id" element={<RequireAdmin><RecipeDetail /></RequireAdmin>} />
        <Route path="/recipes/:id/edit" element={<RequireAdmin><RecipeEdit /></RequireAdmin>} />

        <Route path="/journal" element={<RequireAdmin><JournalList /></RequireAdmin>} />
        <Route path="/journal/new" element={<RequireAdmin><JournalEdit /></RequireAdmin>} />
        <Route path="/journal/:id" element={<RequireAdmin><JournalDetail /></RequireAdmin>} />
        <Route path="/journal/:id/edit" element={<RequireAdmin><JournalEdit /></RequireAdmin>} />

        <Route path="/family" element={<RequireFamily><FamilyHub /></RequireFamily>} />
        <Route path="/family/recipes/:id" element={<RequireFamily><RecipeDetail readOnly /></RequireFamily>} />
        <Route path="/family/journal/:id" element={<RequireFamily><JournalDetail readOnly /></RequireFamily>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
