import { describe, expect, it } from "vitest";
import { ForbiddenError, hasRole, type CurrentUser } from "./auth";

const user = (roles: CurrentUser["roles"]): CurrentUser => ({
  id: "u",
  authIdentity: "a",
  email: "x@ashoka.edu.in",
  displayName: "X",
  cohortYear: null,
  roles,
});

describe("hasRole", () => {
  it("matches a global role regardless of season", () => {
    const u = user([{ role: "core", seasonId: null }]);
    expect(hasRole(u, "core")).toBe(true);
    expect(hasRole(u, "core", "season-1")).toBe(true);
    expect(hasRole(u, "member")).toBe(false);
  });

  it("matches a season role only for that season", () => {
    const u = user([{ role: "member", seasonId: "season-1" }]);
    expect(hasRole(u, "member", "season-1")).toBe(true);
    expect(hasRole(u, "member", "season-2")).toBe(false);
    expect(hasRole(u, "member")).toBe(true);
  });

  it("an applicant holds nothing else", () => {
    const u = user([{ role: "applicant", seasonId: null }]);
    expect(hasRole(u, "member")).toBe(false);
    expect(hasRole(u, "core")).toBe(false);
  });
});

describe("ForbiddenError", () => {
  it("carries a 403 status for route handlers", () => {
    expect(new ForbiddenError().status).toBe(403);
  });
});
