import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImageMime } from "./portraits.js";

describe("detectImageMime", () => {
  it("detects jpeg/png/gif/webp magic bytes", () => {
    assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(
      detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png",
    );
    assert.equal(detectImageMime(Buffer.from("GIF89a....")), "image/gif");

    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    assert.equal(detectImageMime(webp), "image/webp");
  });

  it("rejects non-image payloads", () => {
    assert.equal(detectImageMime(Buffer.from("not an image")), null);
    assert.equal(detectImageMime(Buffer.alloc(0)), null);
  });
});
