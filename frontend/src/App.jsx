import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import { GameContext } from "./GameContext";
import { WS_FATAL_ERRORS } from "./utils";
import Header from "./components/Header";
import Lobby from "./components/Lobby";
import Prompting from "./components/Prompting";
import VotingPrep from "./components/VotingPrep";
import Voting from "./components/Voting";
import Leaderboard from "./components/Leaderboard";
import FloatingEmojis from "./components/FloatingEmojis";
import { useSound, getCtx } from "./hooks/useSound";

const checkIsHostRoute = () => {
  return window.location.pathname.startsWith("/host") || 
         window.location.search.includes("host") || 
         window.location.hash.includes("host");
};

function App() {
  const [stage, setStage] = useState("LOBBY");
  const [wsConnected, setWsConnected] = useState(false);
  const [role, setRole] = useState(checkIsHostRoute() ? "admin" : "player");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [hostName, setHostName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [playersList, setPlayersList] = useState([]);

  const [askPlayerNames, setAskPlayerNames] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState("");

  const [promptTimeLimit, setPromptTimeLimit] = useState(60);
  const [voteTimeLimit, setVoteTimeLimit] = useState(15);
  const [playerCount, setPlayerCount] = useState(4);

  const [currentRound, setCurrentRound] = useState(0);
  const [targetPrompt, setTargetPrompt] = useState("");
  const [activeTargetPrompt, setActiveTargetPrompt] = useState("");
  const [targetImageUrl, setTargetImageUrl] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);

  const [playerPromptInput, setPlayerPromptInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneratedImage, setCurrentGeneratedImage] = useState(null);
  const [generatedHistory, setGeneratedHistory] = useState([]);

  const [activeSubmission, setActiveSubmission] = useState(null);
  const [userRating, setUserRating] = useState(null);
  const [hasRatedActive, setHasRatedActive] = useState(false);
  const [votingResults, setVotingResults] = useState(null);
  const [submissionsList, setSubmissionsList] = useState([]);
  const [currentSubIndex, setCurrentSubIndex] = useState(0);
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [wordLimit, setWordLimit] = useState(null);
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { playSuccess } = useSound();

  const ws = useRef(null);
  const timerInterval = useRef(null);
  const intentionalDisconnect = useRef(false);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const handleServerMessageRef = useRef(null);

  handleServerMessageRef.current = (message) => {
    const { type, data } = message;

    switch (type) {
      case "game_created":
        setPlayerId(data.player_id);
        setRoomCode(data.code);
        setRole("admin");
        setPlayerCount(data.player_count || 4);
        setHostName(data.host_name || "Host");
        setWordLimit(data.word_limit || null);
        setIsLoading(false);
        sessionStorage.setItem("pt_roomCode", data.code);
        sessionStorage.setItem("pt_playerId", data.player_id);
        sessionStorage.setItem("pt_role", "admin");
        break;

      case "name_required":
        setNeedsName(true);
        setIsLoading(false);
        break;

      case "game_joined":
        setPlayerId(data.player_id);
        setRoomCode(data.code);
        setRole("player");
        setPlayerCount(data.player_count || 4);
        setPromptTimeLimit(data.prompt_time_limit || 60);
        setVoteTimeLimit(data.vote_time_limit || 15);
        setPlayerName(data.name);
        setHostName(data.host_name || "Host");
        setWordLimit(data.word_limit || null);
        setNeedsName(false);
        setIsLoading(false);
        sessionStorage.setItem("pt_roomCode", data.code);
        sessionStorage.setItem("pt_playerId", data.player_id);
        sessionStorage.setItem("pt_role", "player");
        sessionStorage.setItem("pt_playerName", data.name);
        if (data.stage && data.stage !== "LOBBY") {
          let clientStage = data.stage;
          if (clientStage === "VOTING") clientStage = "VOTING_PREPARATION";
          if (clientStage === "RESULTS") clientStage = "LEADERBOARD";
          setStage(clientStage);
          if (data.target_image_url) setTargetImageUrl(data.target_image_url);
          if (data.current_round) setCurrentRound(data.current_round);
        }
        break;

      case "players_list":
        setPlayersList(data);
        break;

      case "status_update":
        setStatusMessage(message.message || "");
        break;

      case "round_started":
        setStage("PROMPTING");
        setIsStartingRound(false);
        setStatusMessage("");
        setCurrentRound(data.round_number);
        setTargetImageUrl(data.target_image_url);
        setActiveTargetPrompt(data.target_prompt || "");
        setTimeRemaining(data.prompt_time_limit);
        setGeneratedHistory([]);
        setCurrentGeneratedImage(null);
        setPlayerPromptInput("");
        setVotingResults(null);
        setHasRatedActive(false);
        setFloatingEmojis([]);
        if (data.word_limit) setWordLimit(data.word_limit);
        startTimer(data.prompt_time_limit);
        break;

      case "prompt_generated":
        setIsGenerating(false);
        setCurrentGeneratedImage(data.image_url);
        setGeneratedHistory(data.history || []);
        playSuccess();
        break;

      case "show_submission":
        setStage("VOTING");
        setStatusMessage("");
        setActiveSubmission(data);
        setVotingResults(null);
        setHasRatedActive(false);
        setUserRating(null);
        setFloatingEmojis([]);
        setTimeRemaining(voteTimeLimit);
        if (!data.history || data.history.length <= 1) {
          startTimer(voteTimeLimit);
        }
        break;

      case "voting_ended":
        setVotingResults(data);
        if (timerInterval.current) clearInterval(timerInterval.current);
        setTimeRemaining(0);
        break;

      case "prompting_ended":
        setStage("VOTING_PREPARATION");
        setStatusMessage("");
        setSubmissionsList(data || []);
        setCurrentSubIndex(0);
        if (timerInterval.current) clearInterval(timerInterval.current);
        setTimeRemaining(0);
        break;

      case "leaderboard":
        setStage("LEADERBOARD");
        setStatusMessage("");
        setLeaderboard(data);
        break;

      case "error": {
        const errorMsg = data?.message || message.message;
        const isFatal = WS_FATAL_ERRORS.some((e) => errorMsg?.includes(e));
        setIsStartingRound(false);
        if (isFatal) {
          setError(errorMsg);
          disconnect();
        } else {
          setError(errorMsg);
          setTimeout(() => setError(null), 5000);
        }
        setIsLoading(false);
        break;
      }

      case "emoji_reaction":
        setFloatingEmojis((prev) => [
          ...prev,
          { id: Date.now() + Math.random(), emoji: data.emoji },
        ]);
        break;

      default:
        break;
    }
  };

  const startTimer = useCallback((seconds) => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    setTimeRemaining(seconds);
    timerInterval.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const connectWebSocket = useCallback((code, pName, isCreate = false, rejoinPlayerId = null) => {
    intentionalDisconnect.current = false;
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/game/${code.toUpperCase()}/`;

    if (ws.current && ws.current.readyState < 2) {
      ws.current.close();
    }

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setWsConnected(true);
      reconnectAttempts.current = 0;
      if (isCreate) {
        ws.current.send(
          JSON.stringify({
            type: "create_game",
            data: {
              admin_name: pName || "Host",
              prompt_time_limit: promptTimeLimit,
              vote_time_limit: voteTimeLimit,
              player_count: playerCount,
              ask_player_names: askPlayerNames,
              word_limit: wordLimit,
            },
          })
        );
      } else {
        ws.current.send(
          JSON.stringify({
            type: "join_game",
            data: {
              player_id: rejoinPlayerId,
            },
          })
        );
      }
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (handleServerMessageRef.current) {
        handleServerMessageRef.current(message);
      }
    };

    ws.current.onerror = (err) => {
      console.error("WebSocket error:", err);
      setIsLoading(false);
    };

    ws.current.onclose = () => {
      setWsConnected(false);
      if (!intentionalDisconnect.current) {
        const savedRoom = sessionStorage.getItem("pt_roomCode");
        const savedPlayerId = sessionStorage.getItem("pt_playerId");
        if (savedRoom && savedPlayerId && reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectAttempts.current += 1;
          reconnectTimeout.current = setTimeout(() => {
            connectWebSocket(savedRoom, "", false, parseInt(savedPlayerId));
          }, delay);
        } else {
          setStage("LOBBY");
        }
      }
    };
  }, [promptTimeLimit, voteTimeLimit, playerCount, askPlayerNames, wordLimit]);

  useEffect(() => {
    const savedRoom = sessionStorage.getItem("pt_roomCode");
    const savedPlayerId = sessionStorage.getItem("pt_playerId");
    const savedRole = sessionStorage.getItem("pt_role");
    if (savedRoom && savedPlayerId && savedRole) {
      const isHostRoute = checkIsHostRoute();
      if ((isHostRoute && savedRole === "admin") || (!isHostRoute && savedRole === "player")) {
        setRoomCode(savedRoom);
        setPlayerId(parseInt(savedPlayerId));
        setRole(savedRole);
        if (savedRole === "player") {
          setPlayerName(sessionStorage.getItem("pt_playerName") || "");
        }
        connectWebSocket(savedRoom, savedRole === "admin" ? "Host" : "", false, parseInt(savedPlayerId));
      }
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  const disconnect = useCallback(() => {
    intentionalDisconnect.current = true;
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    if (ws.current) ws.current.close();
    sessionStorage.removeItem("pt_playerId");
    sessionStorage.removeItem("pt_roomCode");
    sessionStorage.removeItem("pt_role");
    sessionStorage.removeItem("pt_playerName");
    reconnectAttempts.current = 0;
    setWsConnected(false);
    setStage("LOBBY");
    setRole(checkIsHostRoute() ? "admin" : "player");
    setRoomCode("");
    setPlayerName("");
    setHostName("");
    setPlayerId(null);
    setPlayersList([]);
    setNeedsName(false);
    setPlayerNameInput("");
    setIsLoading(false);
    setError(null);
  }, []);

  const handlePlayerSubmitName = useCallback((e) => {
    e.preventDefault();
    if (!playerNameInput.trim()) return;
    ws.current.send(
      JSON.stringify({
        type: "join_game",
        data: { name: playerNameInput.trim() },
      })
    );
  }, [playerNameInput]);

  const handleCreate = useCallback((e) => {
    e.preventDefault();
    setIsLoading(true);
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    connectWebSocket(code, playerName || "Host", true);
  }, [playerName, connectWebSocket]);

  const handleJoin = useCallback((e) => {
    e.preventDefault();
    if (!roomCode) return;
    setIsLoading(true);
    connectWebSocket(roomCode, "", false);
  }, [roomCode, connectWebSocket]);

  const handleAdminStartRound = useCallback((e) => {
    e.preventDefault();
    if (!targetPrompt) return;
    setIsStartingRound(true);
    setActiveTargetPrompt(targetPrompt);
    ws.current.send(
      JSON.stringify({
        type: "start_round",
        data: { target_prompt: targetPrompt },
      })
    );
    setTargetPrompt("");
  }, [targetPrompt]);

  const handlePlayerSubmitPrompt = useCallback((e) => {
    e.preventDefault();
    if (!playerPromptInput || isGenerating || timeRemaining <= 0) return;
    if (wordLimit && playerPromptInput.trim().split(/\s+/).length > wordLimit) return;
    setIsGenerating(true);
    ws.current.send(
      JSON.stringify({
        type: "submit_prompt",
        data: { prompt: playerPromptInput },
      })
    );
  }, [playerPromptInput, isGenerating, timeRemaining, wordLimit]);

  const handleSendEmoji = useCallback((emoji) => {
    if (!ws.current || ws.current.readyState !== 1) return;
    ws.current.send(
      JSON.stringify({
        type: "send_emoji",
        data: { emoji },
      })
    );
  }, []);

  const handlePlayerRate = useCallback((score) => {
    setUserRating(score);
    setHasRatedActive(true);
    ws.current.send(
      JSON.stringify({
        type: "submit_rating",
        data: {
          submission_id: activeSubmission?.submission_id,
          score: score,
        },
      })
    );
  }, [activeSubmission]);

  const handleAdminShowLeaderboard = useCallback(() => {
    ws.current.send(
      JSON.stringify({
        type: "show_leaderboard",
        data: {},
      })
    );
  }, []);

  const handleAdminShowNextSubmission = useCallback(() => {
    if (currentSubIndex >= submissionsList.length) {
      handleAdminShowLeaderboard();
      return;
    }
    const nextSub = submissionsList[currentSubIndex];
    ws.current.send(
      JSON.stringify({
        type: "show_submission",
        data: { submission_id: nextSub.id },
      })
    );
    setCurrentSubIndex((prev) => prev + 1);
  }, [currentSubIndex, submissionsList, handleAdminShowLeaderboard]);

  const phaseMap = {
    LOBBY: "lobby",
    PROMPTING: "prompting",
    VOTING_PREPARATION: "voting",
    VOTING: "voting",
    LEADERBOARD: "results",
  };
  const dataPhase = phaseMap[stage] || "lobby";
  const dataUrgent = stage === "PROMPTING" && timeRemaining > 0 && timeRemaining <= 10;

  useEffect(() => {
    document.body.setAttribute("data-phase", dataPhase);
    if (dataUrgent) {
      document.body.setAttribute("data-urgent", "true");
    } else {
      document.body.removeAttribute("data-urgent");
    }
    return () => {
      document.body.removeAttribute("data-phase");
      document.body.removeAttribute("data-urgent");
    };
  }, [dataPhase, dataUrgent]);

  useEffect(() => {
    const resumeAudio = () => {
      const ctx = getCtx();
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
    };
    window.addEventListener("click", resumeAudio);
    window.addEventListener("keydown", resumeAudio);
    window.addEventListener("touchstart", resumeAudio);
    return () => {
      window.removeEventListener("click", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
      window.removeEventListener("touchstart", resumeAudio);
    };
  }, []);

  const contextValue = {
    stage, wsConnected, role, roomCode, playerName, hostName, playerId,
    playersList, askPlayerNames, needsName, playerNameInput,
    promptTimeLimit, voteTimeLimit, playerCount, wordLimit,
    currentRound, targetPrompt, activeTargetPrompt, targetImageUrl, timeRemaining,
    playerPromptInput, isGenerating, currentGeneratedImage, generatedHistory,
    activeSubmission, userRating, hasRatedActive, votingResults,
    submissionsList, currentSubIndex, leaderboard, isLoading, error,
    isStartingRound, statusMessage, floatingEmojis,

    setPlayerName, setPromptTimeLimit, setVoteTimeLimit,
    setPlayerCount, setAskPlayerNames, setPlayerNameInput, setPlayerPromptInput,
    setRoomCode, setTargetPrompt, setUserRating, setStatusMessage, setWordLimit,

    handleCreate, handleJoin, handlePlayerSubmitName, handleAdminStartRound,
    handlePlayerSubmitPrompt, handlePlayerRate, handleAdminShowNextSubmission,
    handleAdminShowLeaderboard, handleSendEmoji, disconnect, startTimer,
  };

  return (
    <GameContext.Provider value={contextValue}>
      <div
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "20px" }}
      >
        <Header />

        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            {error}
          </div>
        )}

        {statusMessage && (
          <div className="loading-overlay">
            <div className="loading-overlay-content">
              <div className="spinner-large"></div>
              <p className="loading-status-text">{statusMessage}</p>
              <p className="loading-subtext">Please wait a moment...</p>
            </div>
          </div>
        )}

        <FloatingEmojis emojis={floatingEmojis} />

        <main style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {stage === "LOBBY" && <Lobby />}
          {stage === "PROMPTING" && <Prompting />}
          {stage === "VOTING_PREPARATION" && <VotingPrep />}
          {stage === "VOTING" && <Voting />}
          {stage === "LEADERBOARD" && <Leaderboard />}
        </main>
      </div>
    </GameContext.Provider>
  );
}

export default App;
