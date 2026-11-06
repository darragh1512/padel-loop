// Opens the phone's own maps app on iPhone and Mac, and Google Maps elsewhere.
export function openDirections(query: string) {
  const q = encodeURIComponent(query);
  const apple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  window.open(
    apple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`,
    "_blank",
    "noopener",
  );
}
