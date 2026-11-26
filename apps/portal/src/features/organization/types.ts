export interface OrganizationCatalog {
  departments: { id: string; name: string; purpose: string; sortOrder: number }[];
  roles: {
    id: string;
    departmentId: string;
    name: string;
    purpose: string;
    responsibilities: string[];
    capabilities: string[];
    version: number;
  }[];
  definitions: { id: string; roleId: string; runtimeKey: string; version: number }[];
  instances: {
    id: string;
    name: string;
    definitionId: string | null;
    roleId: string | null;
    departmentId: string | null;
    active: boolean;
    executable: boolean;
    desk: { x: number | null; y: number | null };
  }[];
}
