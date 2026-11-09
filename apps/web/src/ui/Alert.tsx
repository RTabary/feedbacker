import type { ReactNode } from "react";

interface AlertProps {
  tone: "info" | "error";
  children: ReactNode;
}

export const Alert = ({ tone, children }: AlertProps) => (
  <div role={tone === "error" ? "alert" : "status"} className={tone === "error" ? "alert alert--error" : "alert"}>
    {children}
  </div>
);
