import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLimit } from "./pagination.js";

describe("parseLimit", () => {
  it("defaults when missing or non-numeric", () => {
    assert.equal(parseLimit(undefined), 50);
    assert.equal(parseLimit("abc"), 50);
    assert.equal(parseLimit(Number.NaN), 50);
  });

  it("rejects zero and negative values (SQLite LIMIT -1 is unlimited)", () => {
    assert.equal(parseLimit(0), 50);
    assert.equal(parseLimit(-1), 50);
    assert.equal(parseLimit("-1"), 50);
  });

  it("caps at max and floors decimals", () => {
    assert.equal(parseLimit(999), 200);
    assert.equal(parseLimit(12.9), 12);
    assert.equal(parseLimit("25"), 25);
  });
});
