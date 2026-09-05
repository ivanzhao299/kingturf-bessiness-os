export type SessionDto = Readonly<{
  employeeId: string;
  companyId: string;
  displayName: string | null;
  employeeNumber: string | null;
  permissions: readonly string[];
}>;
