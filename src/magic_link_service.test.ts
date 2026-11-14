import assert from "node:assert/strict";
import test from "node:test";
import { assessRisk } from "./magic_link_service.ts";

test("a new device or large payment enters review before a link is sent", () => {
  assert.equal(assessRisk({ paymentAmount: 1200, deviceFingerprint: "known-device" }), 80);
  assert.equal(assessRisk({ paymentAmount: 20, deviceFingerprint: "new-device" }), 60);
  assert.equal(assessRisk({ paymentAmount: 20, deviceFingerprint: "known-device" }), 10);
});
