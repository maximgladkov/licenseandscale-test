"use client";

import { I18nProvider, Toast } from "@heroui/react";
import { useEffect, type ReactNode } from "react";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
    root.classList.add("light");
  }, []);

  return (
    <I18nProvider locale="en-US">
      {children}
      <Toast.Provider placement="bottom end" />
    </I18nProvider>
  );
}
