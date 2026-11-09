import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorDialog } from "../src/features/author/AuthorDialog.tsx";
import { useAuthorName } from "../src/features/author/useAuthorName.ts";
import { t } from "../src/i18n/t.ts";
import { expectNoAxeViolations } from "./helpers/axe.ts";
import { stubDialog } from "./helpers/dialog.ts";

const KEY = "feedbacker.authorName";

beforeEach(() => {
  stubDialog();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useAuthorName", () => {
  it("has no name at first", () => {
    const { result } = renderHook(() => useAuthorName());
    expect(result.current.name).toBeNull();
  });

  it("remembers the name on the device", () => {
    const { result } = renderHook(() => useAuthorName());
    act(() => result.current.setName("Camille"));
    expect(result.current.name).toBe("Camille");
    expect(window.localStorage.getItem(KEY)).toBe("Camille");
  });

  it("reuses the remembered name", () => {
    window.localStorage.setItem(KEY, "Camille");
    const { result } = renderHook(() => useAuthorName());
    expect(result.current.name).toBe("Camille");
  });

  it("ignores an invalid remembered name", () => {
    window.localStorage.setItem(KEY, "   ");
    const { result } = renderHook(() => useAuthorName());
    expect(result.current.name).toBeNull();
  });

  it("survives a storage that throws: the name stays in memory only", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => useAuthorName());
    expect(result.current.name).toBeNull();
    act(() => result.current.setName("Camille"));
    expect(result.current.name).toBe("Camille");
  });
});

describe("AuthorDialog", () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    onSubmit.mockClear();
    onCancel.mockClear();
  });

  const open = (initialName: string | null = null) =>
    render(<AuthorDialog open initialName={initialName} onSubmit={onSubmit} onCancel={onCancel} />);
  const nameField = () => screen.getByRole("textbox", { name: t("author.nameLabel") });
  const save = () => screen.getByRole("button", { name: t("author.save") });

  it("opens as a modal dialog, with the focus on the name, and passes the audit", async () => {
    const { container } = open();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(document.activeElement).toBe(nameField());
    await expectNoAxeViolations(container);
  });

  it("does nothing when closed", () => {
    render(<AuthorDialog open={false} initialName={null} onSubmit={onSubmit} onCancel={onCancel} />);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it("submits the trimmed name", async () => {
    open();
    await userEvent.type(nameField(), "  Camille ");
    await userEvent.click(save());
    expect(onSubmit).toHaveBeenCalledWith("Camille");
  });

  it("submits with the Enter key", async () => {
    open();
    await userEvent.type(nameField(), "Camille{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("Camille");
  });

  it("refuses an empty name with a message", async () => {
    open();
    await userEvent.type(nameField(), "   ");
    await userEvent.click(save());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(t("author.nameRequired"))).toBeTruthy();
    expect(nameField().getAttribute("aria-invalid")).toBe("true");
  });

  it("refuses a name over 100 characters", async () => {
    open("a".repeat(101));
    await userEvent.click(save());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(t("author.nameTooLong", { max: 100 }))).toBeTruthy();
  });

  it("starts from the current name when modifying it", () => {
    open("Camille");
    expect((nameField() as HTMLInputElement).value).toBe("Camille");
  });

  it("can be cancelled", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reports the native Escape close as a cancellation", () => {
    open();
    act(() => {
      screen.getByRole("dialog").dispatchEvent(new Event("cancel"));
    });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
