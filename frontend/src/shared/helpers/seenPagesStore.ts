/**
 * seenPagesStore
 * Tracks when a user last visited specific pages so that
 * "New" badges can be shown for data added since the last visit.
 *
 * Keys are scoped per user (userId suffix) to avoid cross-user contamination.
 *
 * Usage:
 *   // On page mount — call BEFORE fetching data so badge clears immediately:
 *   const prevSeenAt = markAsSeen("finance");   // returns previous timestamp (ms)
 *   invalidateBadgeCache();                     // tell sidebar to re-evaluate
 *   emitSidebarUpdate();
 *
 *   // In badge hook or table — compare item.createdAt against this:
 *   const seenAt = getSeenAt("finance");        // null = never visited
 */

type SeenPage = "finance" | "payment";

function buildKey(page: SeenPage): string {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}") as { id?: string };
    return `${page}SeenAt_${user.id ?? "anon"}`;
  } catch {
    return `${page}SeenAt_anon`;
  }
}

/** Returns the last-seen timestamp (ms) for a page, or null if never visited. */
export function getSeenAt(page: SeenPage): number | null {
  try {
    const raw = localStorage.getItem(buildKey(page));
    if (!raw) return null;
    const val = parseInt(raw, 10);
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

/**
 * Records "now" as the last-seen timestamp for a page.
 * Returns the PREVIOUS timestamp (useful for marking rows as "New" during this visit).
 */
export function markAsSeen(page: SeenPage): number | null {
  const prev = getSeenAt(page);
  try {
    localStorage.setItem(buildKey(page), Date.now().toString());
  } catch { /* ignore storage errors */ }
  return prev;
}
