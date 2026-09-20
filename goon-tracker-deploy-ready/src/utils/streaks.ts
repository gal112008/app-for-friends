// All date math here works in UTC calendar days, derived from each goon's
// timestamp. (Good enough to start; if you want streaks to respect each
// user's local timezone instead of UTC, store a per-user timezone and
// shift timestamps before truncating to a day — flagging that as a
// known simplification, not solving it now.)

function toUTCDateString(d: Date): string {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(b) - Date.parse(a)) / msPerDay);
}

export interface GoonStats {
  currentStreak: number;
  maxStreak: number;
  avgPerDay: number; // total goons / days since first goon (inclusive), so missed days count as 0
  maxPerDay: number;
  totalGoons: number;
}

export function computeStats(goonTimestamps: Date[], now: Date = new Date()): GoonStats {
  if (goonTimestamps.length === 0) {
    return { currentStreak: 0, maxStreak: 0, avgPerDay: 0, maxPerDay: 0, totalGoons: 0 };
  }

  // Count goons per UTC day.
  const countsByDay = new Map<string, number>();
  for (const ts of goonTimestamps) {
    const day = toUTCDateString(ts);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }

  const sortedDays = [...countsByDay.keys()].sort(); // ascending "YYYY-MM-DD"
  const totalGoons = goonTimestamps.length;
  const maxPerDay = Math.max(...countsByDay.values());

  // --- avg per day: total goons divided by the full span since the first goon,
  // so days with zero goons pull the average down (this is meant to reflect
  // real court-visit consistency, not just "average on days I remembered").
  const firstDay = sortedDays[0];
  const todayStr = toUTCDateString(now);
  const spanDays = Math.max(1, daysBetween(firstDay, todayStr) + 1);
  const avgPerDay = totalGoons / spanDays;

  // --- max streak: longest run of consecutive days present in countsByDay.
  let maxStreak = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    if (daysBetween(sortedDays[i - 1], sortedDays[i]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    maxStreak = Math.max(maxStreak, run);
  }

  // --- current streak: walk backward from today (or yesterday, so a
  // still-open "today" doesn't reset the streak before the day is over).
  const dayLoggedSet = new Set(sortedDays);
  let currentStreak = 0;
  let cursor = todayStr;
  if (!dayLoggedSet.has(cursor)) {
    // haven't gooned today yet — check if yesterday keeps the streak alive
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    cursor = toUTCDateString(yesterday);
  }
  while (dayLoggedSet.has(cursor)) {
    currentStreak += 1;
    const d = new Date(cursor + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = toUTCDateString(d);
  }

  return {
    currentStreak,
    maxStreak,
    avgPerDay: Math.round(avgPerDay * 100) / 100,
    maxPerDay,
    totalGoons,
  };
}
