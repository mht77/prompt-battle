import { useState } from "react";
import { useGame } from "../GameContext";

export default function Header() {
  const { wsConnected, hostName, playerName, role, roomCode, disconnect } = useGame();
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
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
        {wsConnected ? (
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
        ) : (
          <button className="btn btn-secondary" onClick={() => setShowGuide(true)} style={{ padding: "6px 16px", fontSize: "0.85rem" }}>
            How to Play
          </button>
        )}
      </header>

      {showGuide && (
        <div className="guide-overlay" onClick={() => setShowGuide(false)}>
          <div className="glass-panel guide-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ color: "var(--secondary)" }}>How to Play</h3>
              <button className="btn btn-danger" onClick={() => setShowGuide(false)} style={{ padding: "4px 12px", fontSize: "0.8rem" }}>✕</button>
            </div>
            <div className="guide-steps">
              <div className="guide-step"><span className="guide-step-num">1</span><span>One player hosts a game and shares the <strong>room code</strong></span></div>
              <div className="guide-step"><span className="guide-step-num">2</span><span>Other players join using the code</span></div>
              <div className="guide-step"><span className="guide-step-num">3</span><span>The host picks a prompt — AI generates a <strong>target image</strong></span></div>
              <div className="guide-step"><span className="guide-step-num">4</span><span>Players write their own prompts to <strong>recreate</strong> that image</span></div>
              <div className="guide-step"><span className="guide-step-num">5</span><span>Everyone <strong>votes</strong> on how close each attempt is (1–7)</span></div>
              <div className="guide-step"><span className="guide-step-num">6</span><span>Scores are tallied — best prompt engineer wins! 🏆</span></div>
            </div>

            <div className="guide-features">
              <h4 style={{ color: "var(--text-primary)", fontSize: "0.85rem", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Features</h4>
              <div className="guide-feature">🔄 <span>Submit <strong>multiple attempts</strong> — your last generation becomes your final entry</span></div>
              <div className="guide-feature">🎬 <span>All attempts are shown in a <strong>slideshow</strong> before voting begins</span></div>
              <div className="guide-feature">🔀 <span>Drag the <strong>comparison slider</strong> to wipe between target and submission</span></div>
              <div className="guide-feature">🔥 <span>Send <strong>live emoji reactions</strong> during the slideshow review</span></div>
              <div className="guide-feature">📝 <span>Host can set an optional <strong>word limit</strong> to challenge creativity</span></div>
              <div className="guide-feature">🤖 <span><strong>Gemini AI</strong> also rates each submission alongside player votes</span></div>
              <div className="guide-feature">🎨 <span>Background colors <strong>shift dynamically</strong> with each game phase</span></div>
              <div className="guide-feature">🔊 <span><strong>Sound cues</strong> for countdowns, generation complete, and results</span></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
