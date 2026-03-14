"use client";

type DebugDetails = Record<string, string | number | boolean | null | undefined>;

const isDevelopment = process.env.NODE_ENV === "development";
const debugStorageKey = "bkflow:board-realtime-debug";

const isDebugEnabled = () => {
  if (!isDevelopment || typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(debugStorageKey) === "1";
};

const cleanDetails = (details?: DebugDetails) => {
  if (!details) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
};

export const debugBoardRealtime = (
  message: string,
  details?: DebugDetails,
) => {
  if (!isDebugEnabled()) {
    return;
  }

  const payload = cleanDetails(details);

  if (payload && Object.keys(payload).length > 0) {
    console.info("[board-realtime]", message, payload);
    return;
  }

  console.info("[board-realtime]", message);
};
