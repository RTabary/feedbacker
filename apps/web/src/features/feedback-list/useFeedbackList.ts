import type { Feedback } from "@feedbacker/contracts";
import { useCallback, useEffect, useState } from "react";
import { listFeedback, type ListFeedbackResult } from "../../api/feedbackClient.ts";

export type FeedbackListState =
  | { status: "loading" }
  | { status: "notAllowed" }
  | { status: "error" }
  | { status: "ready"; items: Feedback[] };

const toState = (result: ListFeedbackResult): FeedbackListState => {
  if (result.kind === "ok") return { status: "ready", items: result.items };
  return { status: result.kind === "notAllowed" ? "notAllowed" : "error" };
};

export const useFeedbackList = (origin: string) => {
  const [list, setList] = useState<FeedbackListState>({ status: "loading" });

  const reload = useCallback(async () => {
    setList(toState(await listFeedback(origin)));
  }, [origin]);

  useEffect(() => {
    let active = true;
    void listFeedback(origin).then((result) => {
      if (active) setList(toState(result));
    });
    return () => {
      active = false;
    };
  }, [origin]);

  return { list, reload };
};
