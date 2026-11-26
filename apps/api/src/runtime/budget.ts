/**
 * Counts external subrequests (model APIs, GitHub) of one invocation. The Workers Free plan
 * allows 50 per invocation; calls to Cloudflare services (D1, Durable Objects, Workers AI) have
 * their own limit of 1000 and are not counted here. A run is split into stages (Durable Object
 * alarms), each with a fresh budget, so a long task pauses before the limit instead of failing.
 */
export const EXTERNAL_SUBREQUESTS_PER_STAGE = 40;

export class BudgetExhausted extends Error {
  constructor() {
    super("Subrequest-Budget dieser Etappe ist aufgebraucht.");
  }
}

export class SubrequestBudget {
  private used = 0;

  constructor(readonly limit: number = EXTERNAL_SUBREQUESTS_PER_STAGE) {}

  get remaining(): number {
    return this.limit - this.used;
  }

  get spent(): number {
    return this.used;
  }

  /** Call right before an external fetch. Throws instead of letting the runtime kill the invocation. */
  take(count = 1): void {
    if (this.used + count > this.limit) throw new BudgetExhausted();
    this.used += count;
  }
}
