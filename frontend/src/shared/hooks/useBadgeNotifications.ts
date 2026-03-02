import { useEffect, useState, useCallback, useRef } from "react";
import { onSidebarUpdate, offSidebarUpdate } from "@/shared/helpers/sidebarEvents";
import { getSeenAt } from "@/shared/helpers/seenPagesStore";

// ============================================================
// Badge Notification Hook
// Fetches counts for sidebar red dot badges per menu item.
// Each badge is role-aware and only returns true/counts
// for actions the user can actually take.
// ============================================================

export interface BadgeCounts {
  /** Kegiatan: events needing action */
  events: number;
  /** Kas & Keuangan: dues rule not set or new data */
  finance: number;
  /** Pembayaran (resident): unpaid current month */
  payment: number;
  /** Profil: incomplete profile fields */
  profile: number;
  /** Dues rule not configured (for finance sub-badge) */
  duesRuleNotSet: boolean;
}

const EMPTY: BadgeCounts = { events: 0, finance: 0, payment: 0, profile: 0, duesRuleNotSet: false };

// Stale-while-revalidate cache
let globalCache: BadgeCounts = { ...EMPTY };
let lastFetchTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export function useBadgeNotifications(): BadgeCounts {
  const [badges, setBadges] = useState<BadgeCounts>(globalCache);
  const mountedRef = useRef(true);

  const fetchBadges = useCallback(async (force = false) => {
    // Throttle: skip if recently fetched and not forced
    if (!force && Date.now() - lastFetchTime < CACHE_TTL) {
      setBadges(globalCache);
      return;
    }

    try {
      const user = readUser();
      if (!user) return;

      const role = user.role as string;
      const result: BadgeCounts = { ...EMPTY };

      // Parallel fetch all badge sources
      const promises: Promise<void>[] = [];

      // 1. PROFILE: check incomplete fields (all roles)
      promises.push(
        fetchProfileBadge(result)
      );

      // 2. EVENTS: check pending approval / action needed
      if (["LEADER", "ADMIN", "TREASURER"].includes(role)) {
        promises.push(fetchEventBadge(role, result));
      }

      // 3. FINANCE: check dues rule config + new transactions (LEADER, ADMIN, TREASURER)
      if (["LEADER", "ADMIN", "TREASURER"].includes(role)) {
        promises.push(fetchFinanceBadge(role, result));
      }

      // 4. PAYMENT (RESIDENT): check unpaid current month
      if (role === "RESIDENT") {
        promises.push(fetchPaymentBadge(result));
      }

      await Promise.allSettled(promises);

      globalCache = result;
      lastFetchTime = Date.now();
      if (mountedRef.current) setBadges(result);
    } catch {
      // Non-critical: don't break the sidebar
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchBadges();

    // Re-fetch on sidebar update events (e.g. after profile edit, payment, etc.)
    const handleUpdate = () => fetchBadges(true);
    onSidebarUpdate(handleUpdate);

    // Also re-fetch periodically (every 2 minutes)
    const interval = setInterval(() => fetchBadges(true), 120_000);

    return () => {
      mountedRef.current = false;
      offSidebarUpdate(handleUpdate);
      clearInterval(interval);
    };
  }, [fetchBadges]);

  return badges;
}

// Force invalidate cache from anywhere (call after mutations)
export function invalidateBadgeCache() {
  lastFetchTime = 0;
}

// ============================================================
// HELPERS
// ============================================================

function readUser() {
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Lazy-import services to avoid circular deps
async function getFinanceService() {
  const mod = await import("@/features/finance/services/financeService");
  return mod.financeService;
}
async function getEventService() {
  const mod = await import("@/features/event/services/eventService");
  return mod.eventService;
}
async function getUserService() {
  const mod = await import("@/shared/services/userService");
  return mod.userService;
}
async function getPaymentService() {
  const mod = await import("@/features/payment/services/paymentService");
  return mod.paymentService;
}

// -----------------------------------------------------------
// 1. PROFILE BADGE
// Check if phone, address, or profileImage are missing
// -----------------------------------------------------------
async function fetchProfileBadge(result: BadgeCounts) {
  try {
    const userService = await getUserService();
    const profile = await userService.getProfile();
    let missing = 0;
    if (!profile.phone) missing++;
    if (!profile.address) missing++;
    if (!profile.profileImage) missing++;
    result.profile = missing;
  } catch { /* ignore */ }
}

// -----------------------------------------------------------
// 2. EVENT BADGE
// Count events that need action from the current user's role.
// Only counts events where the user is the assigned approver
// or the creator, matching the actual permission matrix.
// -----------------------------------------------------------
async function fetchEventBadge(role: string, result: BadgeCounts) {
  try {
    const user = readUser();
    if (!user) return;

    const eventService = await getEventService();
    const events = await eventService.getAll();
    let count = 0;

    for (const event of events) {
      // Find the first PENDING approval step
      const pendingApproval = event.approvals?.find(a => a.status === "PENDING");
      const isAssignedApprover = pendingApproval?.approverId === user.id;
      const isCreator = event.createdById === user.id;

      // TREASURER/LEADER: approve events where user is the assigned approver
      if (["SUBMITTED", "UNDER_REVIEW"].includes(event.status) && isAssignedApprover) {
        count++;
        continue;
      }

      // TREASURER: submit expense report for FUNDED events in same group
      if (role === "TREASURER" && event.status === "FUNDED" &&
          event.communityGroupId === user.communityGroupId) {
        if (!event.expenses || event.expenses.length === 0) {
          count++;
          continue;
        }
      }

      // Creator: settle COMPLETED events
      if (event.status === "COMPLETED" && isCreator) {
        count++;
        continue;
      }
    }

    result.events = count;
  } catch { /* ignore */ }
}

// -----------------------------------------------------------
// 3. FINANCE BADGE
// - Check if OWN dues rule is configured (LEADER/ADMIN).
// - Count transactions added since the user last visited FinancePage.
// -----------------------------------------------------------
async function fetchFinanceBadge(role: string, result: BadgeCounts) {
  try {
    const financeService = await getFinanceService();

    const [configResult, txResult] = await Promise.allSettled([
      ["LEADER", "ADMIN"].includes(role) ? financeService.getDuesConfig() : Promise.resolve(null),
      financeService.getTransactions(),
    ]);

    // Dues rule not set badge
    if (configResult.status === "fulfilled" && configResult.value && !configResult.value.duesRule) {
      result.finance += 1;
      result.duesRuleNotSet = true;
    }

    // New transactions since last visit
    if (txResult.status === "fulfilled" && Array.isArray(txResult.value)) {
      const seenAt = getSeenAt("finance");
      if (seenAt !== null) {
        const newCount = txResult.value.filter(
          (tx: { createdAt: string }) => new Date(tx.createdAt).getTime() > seenAt
        ).length;
        result.finance += newCount;
      }
    }
  } catch { /* ignore */ }
}

// -----------------------------------------------------------
// 4. PAYMENT BADGE (RESIDENT)
// - Check if current month dues are unpaid.
// - Count payments added since the user last visited ResidentPaymentPage.
// -----------------------------------------------------------
async function fetchPaymentBadge(result: BadgeCounts) {
  try {
    const [finServiceMod, payServiceMod] = await Promise.all([
      getFinanceService(),
      getPaymentService(),
    ]);

    const [billResult, historyResult] = await Promise.allSettled([
      finServiceMod.getMyBill(),
      payServiceMod.getHistory(),
    ]);

    // Unpaid dues badge
    if (billResult.status === "fulfilled" && billResult.value?.baseMonthlyAmount > 0 && billResult.value?.unpaidMonthsCount > 0) {
      result.payment += billResult.value.unpaidMonthsCount;
    }

    // New payment history since last visit
    if (historyResult.status === "fulfilled" && Array.isArray(historyResult.value)) {
      const seenAt = getSeenAt("payment");
      if (seenAt !== null) {
        const newCount = historyResult.value.filter(
          (p: { createdAt: string }) => new Date(p.createdAt).getTime() > seenAt
        ).length;
        result.payment += newCount;
      }
    }
  } catch { /* ignore */ }
}
