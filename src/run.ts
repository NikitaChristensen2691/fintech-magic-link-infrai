import { requestMagicLink } from "./magic_link_service.ts";

const recipient = process.env.MAGIC_LINK_RECIPIENT;
if (!recipient) throw new Error("MAGIC_LINK_RECIPIENT is required");

const result = await requestMagicLink({
  email: recipient,
  paymentAmount: 42,
  deviceFingerprint: "known-device",
  ip: "203.0.113.10"
});
console.log(JSON.stringify(result, null, 2));
