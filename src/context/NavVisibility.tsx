import { createContext, useContext, useState } from "react";

type Ctx = {
  hideNav: boolean;
  setHideNav: (v: boolean) => void;
  hasUnsavedData: boolean;
  setHasUnsavedData: (v: boolean) => void;
};

export const NavVisibilityContext = createContext<Ctx>({
  hideNav: false,
  setHideNav: () => {},
  hasUnsavedData: false,
  setHasUnsavedData: () => {},
});

export function useNavVisibility() {
  return useContext(NavVisibilityContext);
}

export function NavVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hideNav, setHideNav] = useState(false);
  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  return (
    <NavVisibilityContext.Provider value={{ hideNav, setHideNav, hasUnsavedData, setHasUnsavedData }}>
      {children}
    </NavVisibilityContext.Provider>
  );
}
