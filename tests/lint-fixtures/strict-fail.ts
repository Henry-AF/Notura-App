interface RouteState {
  status: "pending" | "processing" | "completed" | "failed";
  retries: number;
  ownerId: string;
  currentUserId: string;
}

export function makeRouteDecision(
  state: RouteState,
  shouldNotify: boolean,
  shouldRetry: boolean,
  hasWebhook: boolean,
  hasTranscript: boolean
) {
  if (
    state.status === "pending" &&
    shouldNotify &&
    shouldRetry &&
    hasWebhook &&
    hasTranscript
  ) {
    return "queued";
  }

  if (state.status === "processing" && shouldNotify && hasWebhook && hasTranscript) {
    return "processing";
  }

  if (state.status === "completed" && shouldNotify && hasWebhook) {
    return "completed";
  }

  if (state.status === "failed" && shouldRetry && state.retries < 3 && hasTranscript) {
    return "retry";
  }

  if (state.ownerId === state.currentUserId && shouldNotify && hasTranscript) {
    return "notify-owner";
  }

  if (state.ownerId !== state.currentUserId && shouldNotify && hasWebhook) {
    return "forbidden";
  }

  if (state.status === "pending" && !hasTranscript && shouldRetry && hasWebhook) {
    return "awaiting-transcript";
  }

  if (state.status === "failed" && !shouldRetry && shouldNotify && hasWebhook) {
    return "failed-no-retry";
  }

  if (state.status === "completed" && !shouldNotify && hasTranscript && hasWebhook) {
    return "silent-complete";
  }

  if (state.status === "processing" && !shouldNotify && !hasWebhook && hasTranscript) {
    return "background";
  }

  return "noop";
}
