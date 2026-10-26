/**
 * How well a team matches a search box query — numbers or words both work.
 * 0 = no match, 1 = name contains the text, 2 = number starts with it,
 * 3 = exact team number. Higher scores should sort first.
 */
export function teamMatchScore(teamNumber: number, nickname: string | undefined, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const num = String(teamNumber);
  if (num === q) return 3;
  if (num.startsWith(q)) return 2;
  if ((nickname ?? "").toLowerCase().includes(q)) return 1;
  return 0;
}
