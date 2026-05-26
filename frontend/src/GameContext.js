import { createContext, useContext } from "react";

export const GameContext = createContext(null);

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameContext.Provider");
  }
  return context;
}
