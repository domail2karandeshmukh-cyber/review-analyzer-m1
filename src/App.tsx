import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider, Notice } from './components/ui';
import { StampProvider } from './components/Authority';
import { Shell } from './components/Shell';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Workspace from './pages/Workspace';
import Risks from './pages/Risks';
import Actions from './pages/Actions';
import ActionDetail from './pages/ActionDetail';
import Approvals from './pages/Approvals';
import { Incidents, IncidentDetail } from './pages/Incidents';
import Scenarios from './pages/Scenarios';
import Audit from './pages/Audit';
import Organisation from './pages/Organisation';
import { Departments, Assets, Reports, Guide } from './pages/Misc';

function Gate() {
  const { session, loading, memberships, signOut } = useSession();
  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><div className="spinner" /></div>;
  if (!session) return <Login />;
  if (memberships.length === 0) return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', padding: 16 }}>
      <div className="card" style={{ padding: 24, maxWidth: 440 }}>
        <Notice kind="warn">This account is signed in but is not an active member of any organisation. Access is granted by an administrator.</Notice>
        <button className="btn" style={{ marginTop: 12 }} onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/risks" element={<Risks />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/actions/:id" element={<ActionDetail />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/scenarios" element={<Scenarios />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/organisation" element={<Organisation />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <StampProvider>
            <Gate />
          </StampProvider>
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
