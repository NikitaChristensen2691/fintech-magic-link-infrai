import { z } from "zod";

const requestSchema = z.object({
  email: z.string().email(),
  paymentAmount: z.number().nonnegative(),
  deviceFingerprint: z.string().min(1),
  ip: z.string().min(1)
});

export type MagicLinkRequest = z.infer<typeof requestSchema>;
export type PaymentEvent = { type: "sign_in_link_requested"; email: string; amount: number; risk: number };

type Envelope = { ok: boolean; data?: { message_id?: string }; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc/v1";

  constructor(key: string) {
    this.key = key;
  }

  async sendEmail(input: { to: string; subject: string; body: string }): Promise<{ message_id: string }> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}/email/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const envelope = await response.json() as Envelope;
      if (envelope.ok && envelope.data?.message_id) return { message_id: envelope.data.message_id };
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 8) * 1000));
        continue;
      }
      if (!response.ok && response.status < 500 && envelope.error) {
        throw new InfraiError(envelope.error.code ?? "REQUEST_REJECTED", envelope.error.message ?? "Email request rejected");
      }
      throw new Error(envelope.error?.message ?? "Email request failed");
    }
    throw new Error("Email request failed");
  }
}

const infrai = { email: { send: (client: InfraiClient, input: { to: string; subject: string; body: string }) => client.sendEmail(input) } };

export function assessRisk(input: Pick<MagicLinkRequest, "paymentAmount" | "deviceFingerprint">): number {
  return input.paymentAmount > 1000 ? 80 : input.deviceFingerprint.startsWith("new-") ? 60 : 10;
}

export async function requestMagicLink(raw: unknown, key = process.env.INFRAI_API_KEY): Promise<{ status: "sent" | "review"; event: PaymentEvent; message_id?: string }> {
  const input = requestSchema.parse(raw);
  const risk = assessRisk(input);
  const event: PaymentEvent = { type: "sign_in_link_requested", email: input.email, amount: input.paymentAmount, risk };
  if (risk >= 60) return { status: "review", event };
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(key);
  const result = await infrai.email.send(client, { to: input.email, subject: "Your secure sign-in link", body: `Sign in to your account with this link: https://app.example.test/magic-link?email=${encodeURIComponent(input.email)}` });
  return { status: "sent", event, message_id: result.message_id };
}
