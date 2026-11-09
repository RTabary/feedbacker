const POLL_INTERVAL_MS = 500;

/**
 * Détecte les changements de page par sondage de `location.pathname`, ce qui fonctionne avec tout routeur
 * sans modifier `history` du produit (FR-006b, research.md R7).
 */
export const createPageTracker = (window: Window, onChange: (path: string) => void): (() => void) => {
  let lastPath = window.location.pathname;
  const timer = window.setInterval(() => {
    const path = window.location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    onChange(path);
  }, POLL_INTERVAL_MS);
  return () => {
    window.clearInterval(timer);
  };
};
