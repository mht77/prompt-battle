import { useGame } from "../GameContext";

export default function Leaderboard() {
  const {
    role, leaderboard,
    targetPrompt, setTargetPrompt,
    handleAdminStartRound,
    isStartingRound,
  } = useGame();

  return (
    <div className="glass-panel leaderboard-panel">
      <h3 style={{ textAlign: "center", marginBottom: "30px", color: "var(--secondary)" }}>LEADERBOARD</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "30px" }}>
        {leaderboard.map((player, idx) => (
          <div key={player.id} className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: idx === 0 ? "rgba(124, 77, 255, 0.1)" : "rgba(255,255,255,0.02)", border: idx === 0 ? "1px solid var(--primary)" : "var(--border-glass)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <span style={{ fontWeight: "800", color: idx === 0 ? "var(--warning)" : "var(--text-secondary)", fontSize: "1.2rem" }}>
                #{idx + 1}
              </span>
              <span style={{ fontWeight: "700", fontSize: "1.1rem" }}>{player.name}</span>
            </div>
            <span style={{ fontWeight: "800", color: "var(--secondary)", fontSize: "1.2rem" }}>
              {typeof player.score === "number" ? player.score.toFixed(1) : player.score} pts
            </span>
          </div>
        ))}
      </div>

      {role === "admin" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <form onSubmit={handleAdminStartRound} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <h4 style={{ marginBottom: "5px" }}>Play Another Round</h4>
            <textarea className="form-input" style={{ resize: "none", height: "80px" }} placeholder="Enter a new target prompt..." value={targetPrompt} onChange={(e) => setTargetPrompt(e.target.value)} required />
            <button type="submit" className="btn btn-primary" disabled={isStartingRound}>
              {isStartingRound ? (
                <>
                  <div className="spinner" style={{ marginRight: "8px" }}></div>
                  Generating Target Image...
                </>
              ) : (
                "Start Next Round"
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="pulse-slow" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Waiting for the host to start the next round...
        </div>
      )}
    </div>
  );
}
