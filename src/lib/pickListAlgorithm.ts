export interface RankedTeam {
  teamNumber: number;
  rank: number;
  notes?: string;
  dnp?: boolean;
}

export interface PickListSubmission {
  _id: string;
  rankedTeams: RankedTeam[];
  isSubmitted: boolean;
}

export interface ConsensusResult {
  teamNumber: number;
  bordaScore: number;
  averageRank: number;
  submissionCount: number;
  dnpCount: number;
  isConfirmed: boolean;
}

export function calculateBordaConsensus(
  submissions: PickListSubmission[],
  allTeamNumbers: number[],
): ConsensusResult[] {
  const filtered = submissions.filter((s) => s.isSubmitted);
  const scores = new Map<
    number,
    { borda: number; rankSum: number; count: number; dnpCount: number }
  >();
  for (const t of allTeamNumbers)
    scores.set(t, { borda: 0, rankSum: 0, count: 0, dnpCount: 0 });

  for (const list of filtered) {
    const ranked = list.rankedTeams.filter((t) => !t.dnp);
    const M = ranked.length;
    for (let i = 0; i < ranked.length; i++) {
      const entry = scores.get(ranked[i].teamNumber);
      if (entry) {
        entry.borda += M - i;
        entry.rankSum += i + 1;
        entry.count += 1;
      }
    }
    for (const t of list.rankedTeams.filter((t) => t.dnp)) {
      const entry = scores.get(t.teamNumber);
      if (entry) entry.dnpCount += 1;
    }
  }

  const submitterCount = filtered.length;
  return allTeamNumbers
    .map((teamNumber) => {
      const s = scores.get(teamNumber)!;
      return {
        teamNumber,
        bordaScore: s.borda,
        averageRank:
          s.count > 0 ? s.rankSum / s.count : allTeamNumbers.length + 1,
        submissionCount: s.count,
        dnpCount: s.dnpCount,
        isConfirmed: false,
      };
    })
    .sort((a, b) => {
      const aDnp = a.dnpCount > submitterCount / 2;
      const bDnp = b.dnpCount > submitterCount / 2;
      if (aDnp && !bDnp) return 1;
      if (!aDnp && bDnp) return -1;
      return b.bordaScore - a.bordaScore;
    });
}
