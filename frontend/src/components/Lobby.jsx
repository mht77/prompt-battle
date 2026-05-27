import { useGame } from "../GameContext";

export default function Lobby() {
  const {
    wsConnected, role, needsName,
    playerName, setPlayerName,
    adminPassword, setAdminPassword,
    promptTimeLimit, setPromptTimeLimit,
    voteTimeLimit, setVoteTimeLimit,
    playerCount, setPlayerCount,
    askPlayerNames, setAskPlayerNames,
    roomCode, setRoomCode,
    playerNameInput, setPlayerNameInput,
    playersList,
    targetPrompt, setTargetPrompt,
    handleCreate, handleJoin, handlePlayerSubmitName, handleAdminStartRound,
    isLoading, isStartingRound,
  } = useGame();

  if (!wsConnected) {
    return (
      <div className="glass-panel lobby-selection-panel">
        {role === "admin" ? (
          <div>
            <h3 style={{ marginBottom: "20px", color: "var(--secondary)", textAlign: "center" }}>Host a Game</h3>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Host Name</label>
                <input type="text" className="form-input" placeholder="e.g. Captain Narrator" value={playerName} onChange={(e) => setPlayerName(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Admin Password</label>
                <input type="password" className="form-input" placeholder="e.g. admin" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
              </div>
              <div className="settings-grid">
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Prompt Limit (s)</label>
                  <input type="number" className="form-input" value={promptTimeLimit} onChange={(e) => setPromptTimeLimit(parseInt(e.target.value) || 0)} required />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Vote Limit (s)</label>
                  <input type="number" className="form-input" value={voteTimeLimit} onChange={(e) => setVoteTimeLimit(parseInt(e.target.value) || 0)} required />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Players Limit</label>
                  <input type="number" className="form-input" value={playerCount} onChange={(e) => setPlayerCount(parseInt(e.target.value) || 0)} required />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "5px" }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    id="askPlayerNames"
                    checked={askPlayerNames}
                    onChange={(e) => setAskPlayerNames(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                <label htmlFor="askPlayerNames" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" }}>
                  Allow players to enter custom names/nicknames
                </label>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: "10px" }} disabled={isLoading}>
                {isLoading ? (<><div className="spinner"></div> Creating...</>) : "Create Lobby"}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h3 style={{ marginBottom: "20px", color: "var(--secondary)", textAlign: "center" }}>Join Battle</h3>
            <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Room Code</label>
                <input type="text" className="form-input" placeholder="ABCD" maxLength={6} value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: "15px" }} disabled={isLoading}>
                {isLoading ? (<><div className="spinner"></div> Joining...</>) : "Join Game"}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (needsName) {
    return (
      <div className="glass-panel lobby-selection-panel" style={{ textAlign: "center" }}>
        <h3 style={{ marginBottom: "20px", color: "var(--secondary)" }}>Enter Your Name</h3>
        <form onSubmit={handlePlayerSubmitName} style={{ display: "flex", flexDirection: "column", gap: "15px", textAlign: "left" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Your Name</label>
            <input type="text" className="form-input" placeholder="e.g. Alice" value={playerNameInput} onChange={(e) => setPlayerNameInput(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: "15px" }}>
            Join Lobby
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-panel lobby-panel">
      <h3 style={{ marginBottom: "10px" }}>Room Lobby</h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: "30px" }}>
        Share Room Code: <strong style={{ color: "var(--secondary)", fontSize: "1.4rem" }}>{roomCode}</strong>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto", padding: "10px", background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)", marginBottom: "30px" }}>
        <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", alignSelf: "start" }}>Joined Players ({playersList.length} / {playerCount})</h4>
        {playersList.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", padding: "10px" }}>Waiting for players to connect...</p>
        ) : (
          playersList.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "12px 18px", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontWeight: "600" }}>{p.name}</span>
              <span style={{ color: "var(--secondary)", fontSize: "0.9rem" }}>Ready</span>
            </div>
          ))
        )}
      </div>

      {role === "admin" ? (
        <form onSubmit={handleAdminStartRound} style={{ display: "flex", flexDirection: "column", gap: "15px", textAlign: "left" }}>
          <h4 style={{ marginBottom: "5px" }}>Start Next Round</h4>
          {playersList.length < playerCount && (
            <div style={{ background: "rgba(255, 214, 0, 0.1)", border: "1px solid var(--warning)", borderRadius: "var(--radius-md)", padding: "10px 15px", marginBottom: "10px", fontSize: "0.85rem", color: "var(--warning)" }}>
              ⚠️ Note: Only {playersList.length} of {playerCount} configured players have joined.
            </div>
          )}
          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Set Target Prompt for Players:</label>
          <textarea className="form-input" style={{ resize: "none", height: "80px" }} placeholder="e.g. A gorgeous cyberpunk glowing cat drinking tea on top of a floating neon skyscraper" value={targetPrompt} onChange={(e) => setTargetPrompt(e.target.value)} required />
          <button type="submit" className="btn btn-primary" disabled={isStartingRound}>
            {isStartingRound ? (
              <>
                <div className="spinner" style={{ marginRight: "8px" }}></div>
                Generating Target Image...
              </>
            ) : (
              "Generate Target Image & Start Game"
            )}
          </button>
        </form>
      ) : (
        <div className="pulse-slow" style={{ color: "var(--text-secondary)" }}>
          Waiting for host to start the round...
        </div>
      )}
    </div>
  );
}
