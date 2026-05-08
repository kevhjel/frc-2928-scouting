export type RawOffenseValues = {
  teamNumber: number;
  autoBalls: number;
  teleBalls: number;
  fedBalls: number;
  epa: number;
};

export type NormalizedOffenseMetrics = {
  autoBalls: number;
  teleBalls: number;
  fedBalls: number;
  epa: number;
  rawAutoBalls: number;
  rawTeleBalls: number;
  rawFedBalls: number;
  rawEpa: number;
};

export function computeOffenseMetrics(
  teams: RawOffenseValues[],
): Record<number, NormalizedOffenseMetrics> {
  const maxAuto = Math.max(...teams.map((t) => t.autoBalls), 1);
  const maxTele = Math.max(...teams.map((t) => t.teleBalls), 1);
  const maxFed = Math.max(...teams.map((t) => t.fedBalls), 1);
  const maxEpa = Math.max(...teams.map((t) => t.epa), 1);
  const result: Record<number, NormalizedOffenseMetrics> = {};
  for (const t of teams) {
    result[t.teamNumber] = {
      autoBalls: (t.autoBalls / maxAuto) * 5,
      teleBalls: (t.teleBalls / maxTele) * 5,
      fedBalls: (t.fedBalls / maxFed) * 5,
      epa: (t.epa / maxEpa) * 5,
      rawAutoBalls: t.autoBalls,
      rawTeleBalls: t.teleBalls,
      rawFedBalls: t.fedBalls,
      rawEpa: t.epa,
    };
  }
  return result;
}
