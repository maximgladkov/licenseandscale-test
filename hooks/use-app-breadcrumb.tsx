"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  lastLabel: string | null;
  setPageBreadcrumbLabel: (label: string | null) => void;
};

const AppBreadcrumbContext = createContext<Ctx | null>(null);

export function AppBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [lastLabel, setLastLabel] = useState<string | null>(null);
  const setPageBreadcrumbLabel = useCallback((label: string | null) => {
    setLastLabel(label);
  }, []);
  const value = useMemo(
    () => ({ lastLabel, setPageBreadcrumbLabel }),
    [lastLabel, setPageBreadcrumbLabel],
  );
  return (
    <AppBreadcrumbContext.Provider value={value}>{children}</AppBreadcrumbContext.Provider>
  );
}

export function useAppBreadcrumb() {
  const ctx = useContext(AppBreadcrumbContext);
  if (!ctx) {
    throw new Error("useAppBreadcrumb must be used within AppBreadcrumbProvider");
  }
  return ctx;
}

export function usePageBreadcrumbLabel(label: string | null) {
  const { setPageBreadcrumbLabel } = useAppBreadcrumb();
  useEffect(() => {
    setPageBreadcrumbLabel(label);
    return () => setPageBreadcrumbLabel(null);
  }, [label, setPageBreadcrumbLabel]);
}
