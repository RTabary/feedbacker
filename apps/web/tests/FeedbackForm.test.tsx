import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackForm } from "../src/features/annotation/FeedbackForm.tsx";
import { t } from "../src/i18n/t.ts";
import { expectNoAxeViolations } from "./helpers/axe.ts";

const onSubmit = vi.fn<(body: string) => Promise<"saved" | "failed" | "invalid">>();
const onCancel = vi.fn();

const setup = () => render(<FeedbackForm elementDescription="bouton « Enregistrer »" onSubmit={onSubmit} onCancel={onCancel} />);
const field = () => screen.getByRole("textbox", { name: t("feedbackForm.bodyLabel") }) as HTMLTextAreaElement;
const save = () => screen.getByRole("button", { name: t("feedbackForm.submit") });

beforeEach(() => {
  onSubmit.mockReset();
  onSubmit.mockResolvedValue("saved");
  onCancel.mockReset();
});
afterEach(cleanup);

describe("FeedbackForm", () => {
  it("puts the focus on the text when it opens (R5)", () => {
    setup();
    expect(document.activeElement).toBe(field());
  });

  it("recalls the annotated element", () => {
    setup();
    expect(screen.getByText("bouton « Enregistrer »")).toBeTruthy();
  });

  it("refuses an empty text with a message, in focus (FR-007)", async () => {
    setup();
    await userEvent.type(field(), "   ");
    await userEvent.click(save());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(t("feedbackForm.bodyRequired"))).toBeTruthy();
    expect(field().getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field());
  });

  it("shows a counter", async () => {
    setup();
    expect(screen.getByText(t("common.characterCount", { count: 0, max: 5000 }))).toBeTruthy();
    await userEvent.type(field(), "👍a");
    expect(screen.getByText(t("common.characterCount", { count: 2, max: 5000 }))).toBeTruthy();
  });

  it("refuses more than 5000 characters", async () => {
    setup();
    await userEvent.click(field());
    await userEvent.paste("a".repeat(5001));
    await userEvent.click(save());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(t("feedbackForm.bodyTooLong", { max: 5000 }))).toBeTruthy();
  });

  it("accepts exactly 5000 characters", async () => {
    setup();
    await userEvent.click(field());
    await userEvent.paste("a".repeat(5000));
    await userEvent.click(save());
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("submits the trimmed text", async () => {
    setup();
    await userEvent.type(field(), "  Bonjour  ");
    await userEvent.click(save());
    expect(onSubmit).toHaveBeenCalledWith("Bonjour");
  });

  it("disables the button while saving, to avoid a double submission", async () => {
    let finish: (value: "saved") => void = () => undefined;
    onSubmit.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    setup();
    await userEvent.type(field(), "Bonjour");
    await userEvent.click(save());
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    finish("saved");
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  });

  it("can be cancelled (FR-008)", async () => {
    setup();
    await userEvent.type(field(), "Bonjour");
    await userEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe("when saving fails (FR-011)", () => {
    beforeEach(() => {
      onSubmit.mockResolvedValue("failed");
    });

    it("shows an error, keeps the text and allows a new attempt", async () => {
      setup();
      await userEvent.type(field(), "Bonjour");
      await userEvent.click(save());
      expect((await screen.findByRole("alert")).textContent).toContain(t("feedbackForm.saveFailed"));
      expect(field().value).toBe("Bonjour");
      expect((save() as HTMLButtonElement).disabled).toBe(false);
      onSubmit.mockResolvedValue("saved");
      await userEvent.click(save());
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });

    it("clears the error when the new attempt succeeds", async () => {
      setup();
      await userEvent.type(field(), "Bonjour");
      await userEvent.click(save());
      await screen.findByRole("alert");
      onSubmit.mockResolvedValue("saved");
      await userEvent.click(save());
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });

  it("reports data refused by the server without losing the text", async () => {
    onSubmit.mockResolvedValue("invalid");
    setup();
    await userEvent.type(field(), "Bonjour");
    await userEvent.click(save());
    expect((await screen.findByRole("alert")).textContent).toContain(t("feedbackForm.invalid"));
    expect(field().value).toBe("Bonjour");
  });

  it("passes the accessibility audit, with and without error", async () => {
    const { container } = setup();
    await expectNoAxeViolations(container);
    await userEvent.click(save());
    await expectNoAxeViolations(container);
  });
});
