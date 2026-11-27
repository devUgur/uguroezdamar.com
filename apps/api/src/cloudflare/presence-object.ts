import { DurableObject } from "cloudflare:workers";
import { OfficePresenceCore } from "../office/presence.ts";
import { actorState, platformFrom, type CloudflareBindings } from "./platform.ts";

/** The office of a tenant as a Durable Object; motion planning lives in OfficePresenceCore. */
export class OfficePresence extends DurableObject<CloudflareBindings> {
  private readonly office: OfficePresenceCore;

  constructor(ctx: DurableObjectState, bindings: CloudflareBindings) {
    super(ctx, bindings);
    this.office = new OfficePresenceCore(actorState(ctx), platformFrom(bindings));
  }

  configure(...args: Parameters<OfficePresenceCore["configure"]>) {
    return this.office.configure(...args);
  }

  setViewers(count: number) {
    return this.office.setViewers(count);
  }

  recordEvent(...args: Parameters<OfficePresenceCore["recordEvent"]>) {
    return this.office.recordEvent(...args);
  }

  override alarm() {
    return this.office.alarm();
  }
}
