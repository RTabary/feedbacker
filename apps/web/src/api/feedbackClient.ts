import { ApiError, Feedback, ListFeedbackResponse, type CreateFeedbackRequest } from "@feedbacker/contracts";

export type ListFeedbackResult = { kind: "ok"; items: Feedback[] } | { kind: "notAllowed" } | { kind: "error" };

export const listFeedback = async (origin: string): Promise<ListFeedbackResult> => {
  try {
    const response = await fetch(`/api/feedback?origin=${encodeURIComponent(origin)}`);
    if (response.status === 403) return { kind: "notAllowed" };
    if (!response.ok) return { kind: "error" };
    const parsed = ListFeedbackResponse.safeParse(await response.json());
    return parsed.success ? { kind: "ok", items: parsed.data.items } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
};

export type CreateFeedbackResult =
  | { kind: "ok"; feedback: Feedback }
  | { kind: "invalid"; paths: string[] }
  | { kind: "notAllowed" }
  | { kind: "error" };

export const createFeedback = async (request: CreateFeedbackRequest): Promise<CreateFeedbackResult> => {
  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.status === 403) return { kind: "notAllowed" };
    if (response.status === 400 || response.status === 413) {
      const error = ApiError.safeParse(await response.json());
      return { kind: "invalid", paths: error.success ? (error.data.issues ?? []).map((issue) => issue.path) : [] };
    }
    if (!response.ok) return { kind: "error" };
    const parsed = Feedback.safeParse(await response.json());
    return parsed.success ? { kind: "ok", feedback: parsed.data } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
};
