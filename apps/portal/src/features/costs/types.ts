export interface CostReport {
  days: number;
  since: number;
  basis: "estimated";
  totals: { cost: number; tokensIn: number; tokensOut: number; calls: number };
  byDay: { day: string; cost: number; tokensIn: number; tokensOut: number; calls: number }[];
  byAgent: { agentId: string | null; agent: string; cost: number; tokensIn: number; tokensOut: number; calls: number }[];
  byModel: { model: string; cost: number; tokensIn: number; tokensOut: number; calls: number }[];
}
