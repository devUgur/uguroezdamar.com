import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminById: vi.fn(),
  countOwners: vi.fn(),
  updateAdminRoleById: vi.fn(),
  deleteAdminById: vi.fn(),
}));

vi.mock("@ugur/server", () => ({
  getAdminById: mocks.getAdminById,
  countOwners: mocks.countOwners,
  updateAdminRoleById: mocks.updateAdminRoleById,
  deleteAdminById: mocks.deleteAdminById,
}));

vi.mock("@/apps/portal/src/adapters/auth/utils", () => ({
  requireAdmin: mocks.requireAdmin,
}));

describe("admin role route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated role changes", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, reason: "no_session" });
    const { PATCH } = await import("../apps/portal/app/api/admins/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/admins/target", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.updateAdminRoleById).not.toHaveBeenCalled();
  });

  it("prevents editors from elevating themselves or other accounts", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      method: "session",
      admin: { _id: "editor", role: "editor" },
      session: { adminId: "editor" },
    });
    const { PATCH } = await import("../apps/portal/app/api/admins/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/admins/target", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.getAdminById).not.toHaveBeenCalled();
    expect(mocks.updateAdminRoleById).not.toHaveBeenCalled();
  });

  it("allows an owner to change a different account role", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      method: "session",
      admin: { _id: "owner", role: "owner" },
      session: { adminId: "owner" },
    });
    mocks.getAdminById.mockResolvedValue({ _id: "target", email: "target@example.com", role: "editor" });
    mocks.updateAdminRoleById.mockResolvedValue({
      _id: "target",
      email: "target@example.com",
      role: "admin",
      status: "active",
    });
    const { PATCH } = await import("../apps/portal/app/api/admins/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/admins/target", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateAdminRoleById).toHaveBeenCalledWith("target", "admin");
  });
});
