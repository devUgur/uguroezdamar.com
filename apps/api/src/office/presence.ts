import type { Env } from "../env.ts";
import type { ActorStatePort } from "../platform/ports.ts";
import type { AgentEvent } from "../events.ts";
import { distance, randomSpot, type DeskAssignment, type OfficeBounds, type Vec2 } from "./layout.ts";

const ROOM_KEY = "office";
const WALK_SPEED = 2.8;
const MOTION_VERSION = 3;

export type AgentActivity = "idle" | "working" | "waiting" | "error";

export interface OfficeMotion {
  agentId: string;
  activity: AgentActivity;
  from: Vec2;
  target: Vec2;
  startedAt: number;
  speed: number;
  restUntil: number | null;
  lastEventId: number;
}

export interface OfficeSnapshot {
  revision: number;
  serverTime: number;
  bounds: OfficeBounds;
  placements: DeskAssignment[];
  agents: Record<string, OfficeMotion>;
}

interface RoomState extends OfficeSnapshot {
  initialized: boolean;
  motionVersion: number;
  viewers: number;
}

function activityOf(type: string | null | undefined): AgentActivity {
  if (type === "approval_requested") return "waiting";
  if (type === "error" || type === "budget_blocked") return "error";
  if (["user_message", "thinking", "model_result", "tool_call", "tool_result", "stage_paused", "approval_decided"].includes(type ?? "")) {
    return "working";
  }
  return "idle";
}

function positionAt(motion: OfficeMotion, now: number): Vec2 {
  const length = distance(motion.from, motion.target);
  if (length < 0.001) return motion.target;
  const progress = Math.min(1, Math.max(0, (now - motion.startedAt) * motion.speed / 1000 / length));
  return { x: motion.from.x + (motion.target.x - motion.from.x) * progress, z: motion.from.z + (motion.target.z - motion.from.z) * progress };
}

/**
 * One office is one coordination atom. It persists motion plans, never browser camera state. Hosted by a Durable
 * Object on Cloudflare (cloudflare/presence-object.ts); it only needs ActorStatePort and Env (ADR 0040).
 */
export class OfficePresenceCore {
  constructor(
    private readonly state: ActorStatePort,
    private readonly env: Env,
  ) {
    void state.blockConcurrencyWhile(async () => {
      state.sql.exec(`CREATE TABLE IF NOT EXISTS office_state (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`);
    });
  }

  private async load(): Promise<RoomState> {
    const row = this.state.sql.exec<{ value: string }>("SELECT value FROM office_state WHERE id = ?", ROOM_KEY).toArray()[0];
    if (row) {
      const state = JSON.parse(row.value) as Partial<RoomState>;
      return {
        initialized: state.initialized ?? false,
        motionVersion: state.motionVersion ?? 0,
        viewers: state.viewers ?? 0,
        revision: state.revision ?? 0,
        serverTime: state.serverTime ?? Date.now(),
        bounds: state.bounds ?? { minX: -4, maxX: 4, minZ: 0, maxZ: 4 },
        placements: state.placements ?? [],
        agents: state.agents ?? {},
      };
    }
    return {
      initialized: false,
      motionVersion: 0,
      viewers: 0,
      revision: 0,
      serverTime: Date.now(),
      bounds: { minX: -4, maxX: 4, minZ: 0, maxZ: 4 },
      placements: [],
      agents: {},
    };
  }

  private async save(state: RoomState, publish = true): Promise<OfficeSnapshot> {
    state.serverTime = Date.now();
    this.state.sql.exec(
      "INSERT INTO office_state (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
      ROOM_KEY,
      JSON.stringify(state),
    );
    await this.scheduleNext();
    const snapshot = this.publicSnapshot(state);
    if (publish && state.viewers > 0) {
      try {
        await this.env.HUB.get("main").broadcast(JSON.stringify({ type: "office", snapshot }));
      } catch (error) {
        console.error("office state broadcast failed", error);
      }
    }
    return snapshot;
  }

  private publicSnapshot(state: RoomState): OfficeSnapshot {
    return {
      revision: state.revision,
      serverTime: Date.now(),
      bounds: state.bounds,
      placements: state.placements,
      agents: state.agents,
    };
  }

  /**
   * Idle wandering is drawn by every browser from the same clock and agent id (office: localFallbackMotion), so the
   * room needs no wake-ups of its own. A timer here cost one Durable Object request every few seconds per open
   * office and used up the free daily quota (27.11.2026). Alarms of older versions are cleared.
   */
  private async scheduleNext(): Promise<void> {
    await this.state.deleteAlarm();
  }

  async configure(input: {
    bounds: OfficeBounds;
    agents: (DeskAssignment & { activity: AgentActivity; lastEventId: number })[];
  }): Promise<OfficeSnapshot> {
    const state = await this.load();
    const now = Date.now();
    const previousPlacements = state.placements;
    const activeIds = new Set(input.agents.map((agent) => agent.agentId));
    let changed =
      !state.initialized ||
      JSON.stringify(state.bounds) !== JSON.stringify(input.bounds) ||
      JSON.stringify(state.placements) !== JSON.stringify(input.agents.map(({ agentId, desk, seat }) => ({ agentId, desk, seat })));
    state.bounds = input.bounds;
    state.placements = input.agents.map(({ agentId, desk, seat }) => ({ agentId, desk, seat }));

    for (const inputAgent of input.agents) {
      const existing = state.agents[inputAgent.agentId];
      if (!existing) {
        const from = inputAgent.activity === "idle" ? randomSpot(input.bounds) : inputAgent.seat;
        const initial: OfficeMotion = {
          agentId: inputAgent.agentId,
          activity: inputAgent.activity,
          from,
          target: inputAgent.activity === "idle" ? randomSpot(input.bounds) : from,
          startedAt: now,
          speed: WALK_SPEED,
          restUntil: null,
          lastEventId: inputAgent.lastEventId,
        };
        state.agents[inputAgent.agentId] = initial;
        changed = true;
      } else {
        if (state.motionVersion < MOTION_VERSION) {
          existing.speed = WALK_SPEED;
          if (existing.activity === "idle") {
            existing.from = randomSpot(input.bounds);
            existing.target = randomSpot(input.bounds);
            existing.startedAt = now;
            existing.restUntil = null;
          }
          changed = true;
        }
        const previousPlacement = previousPlacements.find((placement) => placement.agentId === inputAgent.agentId);
        const seatChanged = previousPlacement && JSON.stringify(previousPlacement.seat) !== JSON.stringify(inputAgent.seat);
        if (inputAgent.lastEventId > existing.lastEventId) {
          this.setActivity(existing, inputAgent.activity, inputAgent.seat, input.bounds, now);
          existing.lastEventId = inputAgent.lastEventId;
          changed = true;
        } else if (seatChanged) {
          const from = positionAt(existing, now);
          existing.from = from;
          existing.target = existing.activity === "idle" ? randomSpot(input.bounds) : inputAgent.seat;
          existing.startedAt = now;
          existing.restUntil = null;
          changed = true;
        }
      }
    }
    for (const id of Object.keys(state.agents)) {
      if (!activeIds.has(id)) {
        delete state.agents[id];
        changed = true;
      }
    }

    state.initialized = true;
    state.motionVersion = MOTION_VERSION;
    if (changed) state.revision += 1;
    return this.save(state, changed);
  }

  async setViewers(count: number): Promise<void> {
    const state = await this.load();
    const previousCount = state.viewers;
    state.viewers = Math.max(0, Math.floor(count));
    let motionChanged = false;
    if (previousCount === 0 && state.viewers > 0) {
      const now = Date.now();
      for (const motion of Object.values(state.agents)) {
        if (motion.activity !== "idle") continue;
        motion.from = positionAt(motion, now);
        motion.target = randomSpot(state.bounds);
        motion.startedAt = now;
        motion.restUntil = null;
        motionChanged = true;
      }
      if (motionChanged) state.revision += 1;
    }
    await this.save(state, motionChanged);
  }

  async recordEvent(event: Pick<AgentEvent, "agentId" | "type"> & { id: number }): Promise<void> {
    if (!event.agentId) return;
    const state = await this.load();
    const motion = state.agents[event.agentId];
    if (!motion || event.id <= motion.lastEventId) return;
    const seat = state.placements.find((placement) => placement.agentId === event.agentId)?.seat;
    const activity = activityOf(event.type);
    const changed = motion.activity !== activity;
    if (seat && changed) this.setActivity(motion, activity, seat, state.bounds, Date.now());
    else if (changed) motion.activity = activity;
    // An event that changes nothing is neither written nor published: no storage write, no broadcast.
    if (!changed) return;
    motion.lastEventId = event.id;
    state.revision += 1;
    await this.save(state);
  }

  private setActivity(motion: OfficeMotion, activity: AgentActivity, seat: Vec2, bounds: OfficeBounds, now: number): void {
    if (motion.activity === activity) return;
    const from = positionAt(motion, now);
    motion.activity = activity;
    motion.from = from;
    motion.target = activity === "idle" ? randomSpot(bounds) : seat;
    motion.startedAt = now;
    motion.speed = WALK_SPEED;
    motion.restUntil = null;
  }

  /** Only clears alarms an older version left behind; nothing is scheduled any more. */
  async alarm(): Promise<void> {
    await this.state.deleteAlarm();
  }
}

export { activityOf as officeActivityOf };
