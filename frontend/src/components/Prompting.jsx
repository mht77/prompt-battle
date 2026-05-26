import { useGame } from "../GameContext";
import { getImageUrl } from "../utils";

export default function Prompting() {
  const {
    role, targetImageUrl, timeRemaining, activeTargetPrompt,
    playerPromptInput, setPlayerPromptInput,
    isGenerating, currentGeneratedImage, generatedHistory,
    playersList,
    handlePlayerSubmitPrompt,
  } = useGame();

  if (!targetImageUrl) {
    return (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
        <div className="spinner" style={{ width: "50px", height: "50px" }}></div>
        <h3>Generating Target Image...</h3>
        <p style={{ color: "var(--text-secondary)" }}>Gemini is working on the prompt.</p>
      </div>
    );
  }

  return (
    <div className="game-grid">
      <div className="glass-panel battle-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "var(--secondary)" }}>Recreate This Image!</h3>
          <div className="glass-panel" style={{ padding: "10px 18px", border: "1px solid var(--accent)", color: "var(--accent)", fontSize: "1.3rem", fontWeight: "800" }}>
            ⏱ {timeRemaining}s
          </div>
        </div>
        <div className="target-image-container">
          <img src={getImageUrl(targetImageUrl)} alt="Target Artwork" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
        {role === "admin" && (
          <div style={{ background: "rgba(255,255,255,0.02)", padding: "15px", borderRadius: "var(--radius-md)", border: "var(--border-glass)" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Target Prompt:</p>
            <p style={{ fontStyle: "italic" }}>{activeTargetPrompt || "Provided by host narrator"}</p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
        {role === "player" ? (
          <>
            <div className="glass-panel battle-panel">
              <h3 style={{ marginBottom: "15px" }}>Your Prompt Generation</h3>
              <form onSubmit={handlePlayerSubmitPrompt} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <textarea className="form-input" style={{ resize: "none", height: "100px" }} placeholder="Type your descriptive prompt to match the target image..." value={playerPromptInput} onChange={(e) => setPlayerPromptInput(e.target.value)} required disabled={isGenerating || timeRemaining <= 0} />
                <button type="submit" className="btn btn-primary" disabled={isGenerating || timeRemaining <= 0}>
                  {isGenerating ? (
                    <><div className="spinner"></div> Generating Image...</>
                  ) : timeRemaining <= 0 ? (
                    "Time's Up!"
                  ) : (
                    "Generate Submission"
                  )}
                </button>
              </form>
            </div>

            <div className="glass-panel render-panel">
              <h4 style={{ alignSelf: "start", marginBottom: "15px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Latest Submission Image</h4>
              {currentGeneratedImage ? (
                <img src={getImageUrl(currentGeneratedImage)} alt="Your render" style={{ maxWidth: "100%", maxHeight: "240px", objectFit: "contain", borderRadius: "var(--radius-md)" }} />
              ) : (
                <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Submit your first prompt to generate an image
                </div>
              )}
            </div>

            {generatedHistory.length > 0 && (
              <div className="glass-panel" style={{ padding: "20px" }}>
                <h4 style={{ marginBottom: "10px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Prompt History (Last generated is active)</h4>
                <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px" }}>
                  {generatedHistory.map((url, idx) => (
                    <img key={idx} src={getImageUrl(url)} alt={`History ${idx}`} style={{ height: "60px", width: "60px", objectFit: "cover", borderRadius: "6px", border: "2px solid rgba(255,255,255,0.05)" }} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="glass-panel" style={{ padding: "30px", display: "flex", flexDirection: "column", justifyItems: "center", alignItems: "center", height: "100%", justifyContent: "center", gap: "20px" }}>
            <h3 className="pulse-slow" style={{ color: "var(--secondary)" }}>Battle In Progress!</h3>
            <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
              Players are writing prompts and generating images.
            </p>
            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center", marginTop: "20px" }}>
              {playersList.map((p) => (
                <div key={p.id} className="glass-panel" style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--secondary)" }}></div>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
