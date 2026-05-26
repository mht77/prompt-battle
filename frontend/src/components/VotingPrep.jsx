import { useGame } from "../GameContext";

export default function VotingPrep() {
  const { role, submissionsList, handleAdminShowNextSubmission } = useGame();

  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
      <div className="spinner" style={{ width: "50px", height: "50px" }}></div>
      <h3>Evaluating Submissions...</h3>
      <p style={{ color: "var(--text-secondary)" }}>Host will present players' submissions 1 by 1.</p>
      {role === "admin" && (
        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "15px" }}>
          <p>Click below to begin projecting the submissions for rating:</p>
          <button className="btn btn-primary" onClick={handleAdminShowNextSubmission}>
            Start Presenting Submissions ({submissionsList.length} submissions)
          </button>
        </div>
      )}
    </div>
  );
}
