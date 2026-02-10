import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Sentinel</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/agents" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Agents
          </NavLink>
          <NavLink to="/services" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Services
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button className="btn-logout" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
