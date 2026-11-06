// Connection failures come back as technical text. Rule messages from the server
// are already readable, so they pass through unchanged.
export function friendlyError(message: string): string {
  if (message === "" || /fetch|network|load failed/i.test(message)) {
    return "Couldn’t reach Padel Loop. Check your connection and try again.";
  }
  return message;
}
