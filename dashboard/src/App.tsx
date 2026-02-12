import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AgentsPage from "./pages/AgentsPage";
import AddAgentPage from "./pages/AddAgentPage";
import AgentDetailPage from "./pages/AgentDetailPage";
import ServicesPage from "./pages/ServicesPage";
import AddServicePage from "./pages/AddServicePage";
import ServiceDetailPage from "./pages/ServiceDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/new" element={<AddAgentPage />} />
        <Route path="/agents/:name" element={<AgentDetailPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/new" element={<AddServicePage />} />
        <Route path="/services/:name" element={<ServiceDetailPage />} />
        <Route path="/" element={<Navigate to="/agents" replace />} />
      </Route>
    </Routes>
  );
}
