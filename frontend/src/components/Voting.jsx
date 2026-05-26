import { useGame } from "../GameContext";
import { getImageUrl } from "../utils";

export default function Voting() {
  const {
    role, playerName, activeSubmission, timeRemaining,
    userRating, hasRatedActive, votingResults,
    submissionsList, currentSubIndex,
    handlePlayerRate, handleAdminShowNextSubmission, handleAdminShowLeaderboard,
  } = useGame();

  if (!activeSubmission) return null;

  return (
    <div className="glass-panel voting-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Rating Submissions</h3>
        <div className="glass-panel" style={{ 
          padding: "10px 18px", 
          border: "1px solid var(--accent)", 
          color: "var(--accent)", 
          fontSize: "1.3rem", 
          fontWeight: "800",
          width: "120px",
          textAlign: "center",
          fontVariantNumeric: "tabular-nums"
        }}>
          ⏱ {timeRemaining}s
        </div>
      </div>

      <div className="voting-image-container">
        <img src={getImageUrl(activeSubmission.image_url)} alt="Submission" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "5px" }}>Player Prompt:</p>
        <p style={{ fontStyle: "italic", fontSize: "1.1rem", marginBottom: "20px" }}>"{activeSubmission.prompt}"</p>
      </div>

      {role === "player" ? (
        <div style={{ background: "rgba(255,255,255,0.02)", padding: "25px", borderRadius: "var(--radius-md)", border: "var(--border-glass)", display: "flex", flexDirection: "column", gap: "20px" }}>
          {votingResults ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
              <h4 style={{ color: "var(--secondary)", fontSize: "1.3rem", fontWeight: "bold" }}>Rating complete!</h4>
              <span>Gemini Similarity Rating: <strong style={{ color: "var(--success)" }}>{votingResults.gemini_score}/7</strong></span>
              <span>Average Final Score: <strong style={{ color: "var(--primary)" }}>{votingResults.average_score.toFixed(1)}/7</strong></span>
            </div>
          ) : playerName === activeSubmission.player_name ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <h4 style={{ color: "var(--secondary)", marginBottom: "10px" }}>This is your submission!</h4>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                You cannot rate your own submission. Gemini is rating it on your behalf.
              </p>
            </div>
          ) : (
            <>
              <h4 style={{ textAlign: "center", marginBottom: "5px" }}>Rate similarity to target image (1-7)</h4>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "0.85rem", color: "var(--text-secondary)", padding: "0 5px" }}>
                <span>1 (Terrible)</span>
                <span>7 (Perfect)</span>
              </div>
              <div className="rating-buttons-container">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className="btn rating-button"
                    disabled={timeRemaining <= 0}
                    onClick={() => handlePlayerRate(num)}
                    style={{
                      background: userRating === num ? "var(--success)" : "rgba(255,255,255,0.05)",
                      border: userRating === num ? "2px solid var(--success)" : "1px solid rgba(255,255,255,0.1)",
                      color: userRating === num ? "#050308" : "var(--text-primary)",
                      cursor: timeRemaining <= 0 ? "not-allowed" : "pointer",
                      opacity: timeRemaining <= 0 && userRating !== num ? 0.4 : 1,
                      transform: userRating === num ? "scale(1.05)" : "none",
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
              {hasRatedActive && (
                <p style={{ color: "var(--success)", fontSize: "0.85rem", textAlign: "center", marginTop: "10px" }}>
                  Your rating of {userRating} has been submitted. You can change your vote before the timer ends.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
          {!votingResults ? (
            <>
              <p className="pulse-slow" style={{ color: "var(--secondary)" }}>Voting in progress...</p>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Gemini is automatically rating the submission similarity.</p>
            </>
          ) : (
            <div className="glass-panel score-summary-panel">
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Gemini Score</p>
                <h2 style={{ color: "var(--success)", fontSize: "3rem" }}>{votingResults.gemini_score}/7</h2>
              </div>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Final Average Score</p>
                <h2 style={{ color: "var(--primary)", fontSize: "3rem" }}>{votingResults.average_score.toFixed(1)}/7</h2>
              </div>
              <div style={{ gridColumn: "1 / -1", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
                {currentSubIndex < submissionsList.length ? (
                  <button className="btn btn-primary" onClick={handleAdminShowNextSubmission}>
                    Present Next Submission ({submissionsList.length - currentSubIndex} remaining)
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleAdminShowLeaderboard}>
                    Show Leaderboard Standings
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
