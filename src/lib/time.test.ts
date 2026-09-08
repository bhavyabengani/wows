import { describe, expect, it } from "vitest";
import { InvalidInstantError, formatInIST, toDate } from "./time";

describe("formatInIST", () => {
  it("shifts UTC midnight forward by 5h30 into IST", () => {
    expect(formatInIST("2026-01-01T00:00:00Z")).toBe("1 Jan 2026, 05:30 IST");
  });

  it("rolls the calendar date over when the IST offset crosses midnight", () => {
    // 18:30 UTC on 31 March is 00:00 IST on 1 April.
    expect(formatInIST("2026-03-31T18:30:00Z")).toBe("1 Apr 2026, 00:00 IST");
    // One second earlier is still 31 March in IST.
    expect(formatInIST("2026-03-31T18:29:59Z")).toBe("31 Mar 2026, 23:59 IST");
  });

  it("treats a Date and its ISO string identically", () => {
    const asDate = new Date(Date.UTC(2026, 8, 8, 7, 20, 0));
    expect(formatInIST(asDate)).toBe(formatInIST("2026-09-08T07:20:00Z"));
    expect(formatInIST(asDate)).toBe("8 Sep 2026, 12:50 IST");
  });

  it("accepts a non-UTC offset and still displays IST", () => {
    // 12:50 at +05:30 is 07:20Z, which is 12:50 IST.
    expect(formatInIST("2026-09-08T12:50:00+05:30")).toBe(
      "8 Sep 2026, 12:50 IST",
    );
    // 12:50 at -04:00 is 16:50Z, which is 22:20 IST.
    expect(formatInIST("2026-09-08T12:50:00-04:00")).toBe(
      "8 Sep 2026, 22:20 IST",
    );
  });

  it("can omit the time", () => {
    expect(formatInIST("2026-12-31T20:00:00Z", { withTime: false })).toBe(
      "1 Jan 2027",
    );
  });

  it("uses a 24-hour clock with zero-padded hours and minutes", () => {
    expect(formatInIST("2026-06-14T18:31:00Z")).toBe("15 Jun 2026, 00:01 IST");
    expect(formatInIST("2026-06-14T03:35:00Z")).toBe("14 Jun 2026, 09:05 IST");
  });
});

describe("toDate", () => {
  it("rejects ISO strings without an explicit offset", () => {
    // A zone-less string would be parsed in the host's local time zone.
    expect(() => toDate("2026-09-08T12:50:00")).toThrow(InvalidInstantError);
    expect(() => toDate("2026-09-08")).toThrow(InvalidInstantError);
  });

  it("rejects unparsable input", () => {
    expect(() => toDate("not a date")).toThrow(InvalidInstantError);
    expect(() => toDate(new Date("garbage"))).toThrow(InvalidInstantError);
    expect(() => toDate("2026-13-45T99:99:00Z")).toThrow(InvalidInstantError);
  });

  it("returns the same instant for a valid Date", () => {
    const d = new Date("2026-09-08T07:20:00Z");
    expect(toDate(d).getTime()).toBe(d.getTime());
  });
});
