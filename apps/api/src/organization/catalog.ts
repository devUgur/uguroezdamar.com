import type { Env } from "../env.ts";

interface DepartmentRow {
  id: string;
  name: string;
  purpose: string;
  sort_order: number;
}

interface RoleRow {
  id: string;
  department_id: string;
  name: string;
  purpose: string;
  responsibilities: string;
  capabilities: string;
  version: number;
}

interface DefinitionRow {
  id: string;
  role_id: string;
  runtime_key: string;
  version: number;
}

interface InstanceRow {
  id: string;
  name: string;
  definition_id: string | null;
  definition_role_id: string | null;
  department_id: string | null;
  active: number;
  desk_x: number | null;
  desk_y: number | null;
}

function parseList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Authoritative read model for the organization; planned profiles are not executable staff. */
export async function organizationCatalog(env: Env) {
  const [departments, roles, definitions, instances] = await Promise.all([
    env.DB.prepare("SELECT id, name, purpose, sort_order FROM departments ORDER BY sort_order, id").all<DepartmentRow>(),
    env.DB.prepare("SELECT id, department_id, name, purpose, responsibilities, capabilities, version FROM role_profiles ORDER BY department_id, name").all<RoleRow>(),
    env.DB.prepare("SELECT id, role_id, runtime_key, version FROM agent_definitions ORDER BY id").all<DefinitionRow>(),
    env.DB.prepare(
      `SELECT a.id, a.name, a.definition_id, d.role_id AS definition_role_id, r.department_id,
              a.active, a.desk_x, a.desk_y
         FROM agents a
         LEFT JOIN agent_definitions d ON d.id = a.definition_id
         LEFT JOIN role_profiles r ON r.id = d.role_id
        ORDER BY a.created_at, a.id`,
    ).all<InstanceRow>(),
  ]);

  return {
    departments: departments.results.map((department) => ({
      id: department.id,
      name: department.name,
      purpose: department.purpose,
      sortOrder: department.sort_order,
    })),
    roles: roles.results.map((role) => ({
      id: role.id,
      departmentId: role.department_id,
      name: role.name,
      purpose: role.purpose,
      responsibilities: parseList(role.responsibilities),
      capabilities: parseList(role.capabilities),
      version: role.version,
    })),
    definitions: definitions.results.map((definition) => ({
      id: definition.id,
      roleId: definition.role_id,
      runtimeKey: definition.runtime_key,
      version: definition.version,
    })),
    instances: instances.results.map((instance) => ({
      id: instance.id,
      name: instance.name,
      definitionId: instance.definition_id,
      roleId: instance.definition_role_id,
      departmentId: instance.department_id,
      active: instance.active === 1,
      executable: Boolean(instance.definition_id),
      desk: { x: instance.desk_x, y: instance.desk_y },
    })),
  };
}
