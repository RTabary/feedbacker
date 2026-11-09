import {
  ConnectorToToolMessage,
  withEnvelope,
  type ToolToConnectorPayload,
} from "@feedbacker/contracts";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export const CONNECTION_TIMEOUT_MS = 10_000;

export type ConnectionState = "connecting" | "connected" | "unresponsive";

interface Options {
  productOrigin: string;
  onMessage?: (message: ConnectorToToolMessage) => void;
}

export interface ProductConnection {
  state: ConnectionState;
  /** Page courante du produit ; inconnue tant que le connecteur n'a pas répondu. */
  path: string | null;
  frameRef: RefObject<HTMLIFrameElement | null>;
  onFrameLoad: () => void;
  send: (payload: ToolToConnectorPayload) => void;
}

export const useProductConnection = ({ productOrigin, onMessage }: Options): ProductConnection => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const [state, setState] = useState<ConnectionState>("connecting");
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const send = useCallback(
    (payload: ToolToConnectorPayload) => {
      frameRef.current?.contentWindow?.postMessage(withEnvelope(payload), productOrigin);
    },
    [productOrigin],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const armTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setState("unresponsive");
    }, CONNECTION_TIMEOUT_MS);
  }, [stopTimer]);

  const onFrameLoad = useCallback(() => {
    setState("connecting");
    setPath(null);
    armTimer();
    send({ type: "tool.ping" });
  }, [armTimer, send]);

  useEffect(() => {
    armTimer();
    const handleMessage = (event: MessageEvent): void => {
      const frameWindow = frameRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow || event.origin !== productOrigin) return;
      const parsed = ConnectorToToolMessage.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === "connector.hello") {
        send({ type: "tool.ping" });
      } else if (message.type === "connector.ready") {
        stopTimer();
        setState("connected");
        setPath(message.path);
      } else if (message.type === "connector.pageChanged") {
        setPath(message.path);
      }
      onMessageRef.current?.(message);
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      stopTimer();
    };
  }, [armTimer, productOrigin, send, stopTimer]);

  return { state, path, frameRef, onFrameLoad, send };
};
