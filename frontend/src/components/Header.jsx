import { useGame } from "../GameContext";

export default function Header() {
  const { wsConnected, hostName, playerName, role, roomCode, disconnect } = useGame();

  return (
    <header className="header-bar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: wsConnected ? "drop-shadow(0 0 8px var(--success))" : "none",
            color: wsConnected ? "var(--success)" : "var(--accent)",
            transition: "var(--transition-smooth)"
          }}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="8" y1="16" x2="16" y2="8" stroke="var(--secondary)" />
          <line x1="16" y1="16" x2="8" y2="8" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "800", background: "linear-gradient(45deg, var(--secondary), #ffffff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          PROMPT BATTLE
        </h2>
      </div>
      {wsConnected && (
        <div className="header-actions">
          {hostName && (
            <span className="glass-panel" style={{ padding: "6px 14px", fontSize: "0.9rem", color: "var(--secondary)", border: "1px solid rgba(255,255,255,0.1)", fontWeight: "600" }}>
              Host: {hostName}
            </span>
          )}
          {playerName && (
            <span className="glass-panel" style={{ padding: "6px 14px", fontSize: "0.9rem", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.1)", fontWeight: "600" }}>
              You: {playerName}
            </span>
          )}
          {role === "admin" && (
            <span className="glass-panel" style={{ padding: "6px 14px", fontSize: "0.9rem", fontWeight: "bold", border: "1px dashed var(--secondary)" }}>
              ROOM: {roomCode}
            </span>
          )}
          <button className="btn btn-danger" onClick={disconnect} style={{ padding: "6px 14px", fontSize: "0.85rem" }}>
            Leave
          </button>
        </div>
      )}
    </header>
  );
}
