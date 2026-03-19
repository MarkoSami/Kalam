import { useCallback, useEffect, useRef, useState } from "react";

export type SignalingMessage = {
  type: string;
  [key: string]: unknown;
};

type UseSignalingOptions = {
  onMessage: (msg: SignalingMessage) => void;
};

const MAX_RETRIES = 10;
const BASE_DELAY = 1000;
const MAX_DELAY = 10000;

export function useSignaling({ onMessage }: UseSignalingOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      if (!mountedRef.current) return;

      if (retriesRef.current < MAX_RETRIES) {
        const delay = Math.min(
          BASE_DELAY * Math.pow(2, retriesRef.current),
          MAX_DELAY
        );
        retriesRef.current++;
        console.log(
          `[Signaling] Reconnecting in ${delay}ms (attempt ${retriesRef.current})`
        );
        setTimeout(connect, delay);
      } else {
        console.error("[Signaling] Max retries reached");
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessageRef.current(msg);
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const send = useCallback((msg: SignalingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected };
}
