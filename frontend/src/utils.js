export const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
  return `${protocol}//${host}${url}`;
};

export const WS_FATAL_ERRORS = [
  "Room not found",
  "Room code collision",
  "Game already in progress",
  "Game is full",
];
