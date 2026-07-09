import { useEffect } from "react";
import { useGame } from "../GameContext";
import Confetti from "./Confetti";
import { useSound } from "../hooks/useSound";

export default function Leaderboard() {
  const {
    role, leaderboard,
    targetPrompt, setTargetPrompt,
    handleAdminStartRound,
    isStartingRound,
    playerName,
  } = useGame();

  const { playConfetti } = useSound();

  useEffect(() => {
    playConfetti();
  }, [playConfetti]);

  return (
    <>
      <Confetti />
      <div className="glass-panel leaderboard-panel">
      <h3 style={{ textAlign: "center", marginBottom: "30px", color: "var(--secondary)" }}>LEADERBOARD</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "30px" }}>
        {leaderboard.map((player, idx) => {
          const isWinner = idx === 0;
          const isCurrentUser = player.name === playerName;
          
          let rowClass = "glass-panel";
          if (isWinner) rowClass += " winner-row";
          if (isCurrentUser && !isWinner) rowClass += " current-player-row";

          let backgroundStyle = "rgba(255,255,255,0.02)";
          if (isWinner) {
            backgroundStyle = "rgba(124, 77, 255, 0.1)";
          } else if (isCurrentUser) {
            backgroundStyle = "rgba(0, 229, 255, 0.1)";
          }

          let borderStyle = "var(--border-glass)";
          if (isWinner) {
            borderStyle = "1px solid var(--primary)";
          } else if (isCurrentUser) {
            borderStyle = "1px solid var(--success)";
          }

          let rankColor = "var(--text-secondary)";
          if (isWinner) {
            rankColor = "var(--warning)";
          } else if (isCurrentUser) {
            rankColor = "var(--success)";
          }

          return (
            <div
              key={player.id}
              className={rowClass}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 24px",
                background: backgroundStyle,
                border: borderStyle,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <span style={{ fontWeight: "800", color: rankColor, fontSize: "1.2rem" }}>
                  #{idx + 1}
                </span>
                <span style={{ fontWeight: "700", fontSize: "1.1rem" }}>
                  {player.name} {isCurrentUser && " (You)"}
                </span>
              </div>
              <span style={{ fontWeight: "800", color: "var(--secondary)", fontSize: "1.2rem" }}>
                {typeof player.score === "number" ? player.score.toFixed(1) : player.score} pts
              </span>
            </div>
          );
        })}
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
    </>
  );
}
