import type { ButtonHTMLAttributes, Ref } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary";
  ref?: Ref<HTMLButtonElement>;
}

export const Button = ({ variant = "default", type = "button", className, ...props }: ButtonProps) => (
  <button
    {...props}
    type={type}
    className={["button", variant === "primary" ? "button--primary" : "", className ?? ""].filter(Boolean).join(" ")}
  />
);
