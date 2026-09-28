import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const DemoModeContext = createContext({ demoMode: false });

export function DemoModeProvider({ children }) {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    api.get("/health")
      .then((res) => setDemoMode(res.data?.demo_mode === true))
      .catch(() => setDemoMode(false));  // network error → treat as false
  }, []);  // empty dep array: runs once, never re-fetches

  return (
    <DemoModeContext.Provider value={{ demoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
