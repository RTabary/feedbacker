import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Alert, Button, Field, Spinner } from "../src/ui/index.ts";
import { expectNoAxeViolations } from "./helpers/axe.ts";

afterEach(cleanup);

describe("Button", () => {
  it("is a real button, of type button by default", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);
    const button = screen.getByRole("button", { name: "Valider" });
    expect(button.getAttribute("type")).toBe("button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("can be focused with the keyboard", async () => {
    render(<Button>Valider</Button>);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button"));
  });
});

describe("Field", () => {
  it("links the label, the help and the error to the control", async () => {
    const { container } = render(
      <Field label="Nom" help="Visible par tous" error="Le nom est requis">
        {(controlProps) => <input {...controlProps} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Nom" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    const descriptions = (input.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);
    expect(descriptions).toEqual(["Visible par tous", "Le nom est requis"]);
    await expectNoAxeViolations(container);
  });

  it("does not mark a valid control as invalid", () => {
    render(<Field label="Nom">{(controlProps) => <input {...controlProps} />}</Field>);
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBeNull();
  });
});

describe("Alert", () => {
  it("announces an error with role alert", async () => {
    const { container } = render(<Alert tone="error">Erreur</Alert>);
    expect(screen.getByRole("alert").textContent).toContain("Erreur");
    await expectNoAxeViolations(container);
  });

  it("announces information with role status", () => {
    render(<Alert tone="info">Information</Alert>);
    expect(screen.getByRole("status").textContent).toContain("Information");
  });
});

describe("Spinner", () => {
  it("exposes its label to assistive technologies", async () => {
    const { container } = render(<Spinner label="Chargement" />);
    expect(screen.getByRole("status", { name: "Chargement" })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
