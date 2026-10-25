import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider, Notice } from './components/ui';
import { StampProvider } from './components/Authority';
import { Shell } from './components/Shell';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Situation from './pages/Situation';
import Workspace from './pages/Workspace';
import Risks from './pages/Risks';
import Actions from './pages/Actions';
import ActionDetail from './pages/ActionDetail';
import Approvals from './pages/Approvals';
import { Incidents, IncidentDetail } from './pages/Incidents';
import Scenarios from './pages/Scenarios';
import Present from './pages/Present';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Ebios from './pages/Ebios';
import Quant from './pages/Quant';
import Compliance from './pages/Compliance';
import Controls from './pages/Controls';
import Policies from './pages/Policies';
import Vendors from './pages/Vendors';
import Continuity from './pages/Continuity';
import Board from './pages/Board';
import Access from './pages/Access';
import Audit from './pages/Audit';
import Organisation from './pages/Organisation';
import { Departments, Assets, Reports, Guide } from './pages/Misc';

function Gate() {
  const { session, loading, memberships, signOut } = useSession();
  const loc = useLocation();
  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><div className="spinner" /></div>;
  if (!session) return loc.pathname === '/login' ? <Login /> : <Landing />;
  if (memberships.length === 0) return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', padding: 16 }}>
      <div className="card" style={{ padding: 24, maxWidth: 440 }}>
        <Notice kind="warn">This account is signed in but is not an active member of any organisation. Access is granted by an administrator.</Notice>
        <button className="btn" style={{ marginTop: 12 }} onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
  return (
    <Routes>
      <Route path="/present" element={<Present />} />
      <Route path="*" element={<Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/live" element={<Situation />} />
        <Route path="/login" element={<Navigate to="/" />} />
        <Route path="/ebios" element={<Ebios />} />
        <Route path="/quant" element={<Quant />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/controls" element={<Controls />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/continuity" element={<Continuity />} />
        <Route path="/board" element={<Board />} />
        <Route path="/access" element={<Access />} />
        <Route path="/briefing" element={<Overview />} />
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
    </Shell>} />
    </Routes>
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
