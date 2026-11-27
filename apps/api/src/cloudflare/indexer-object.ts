import { DurableObject } from "cloudflare:workers";
import { KnowledgeIndexerCore } from "../knowledge/indexer.ts";
import { actorState, platformFrom, type CloudflareBindings } from "./platform.ts";

/** The knowledge index of one project as a Durable Object; indexing lives in KnowledgeIndexerCore. */
export class KnowledgeIndexer extends DurableObject<CloudflareBindings> {
  private readonly indexer: KnowledgeIndexerCore;

  constructor(ctx: DurableObjectState, bindings: CloudflareBindings) {
    super(ctx, bindings);
    this.indexer = new KnowledgeIndexerCore(actorState(ctx), platformFrom(bindings));
  }

  start(...args: Parameters<KnowledgeIndexerCore["start"]>) {
    return this.indexer.start(...args);
  }

  status() {
    return this.indexer.status();
  }

  override alarm() {
    return this.indexer.alarm();
  }
}
