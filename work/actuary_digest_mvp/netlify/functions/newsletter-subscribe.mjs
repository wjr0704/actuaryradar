import {
  checkRateLimit,
  clientIp,
  confirmationEmail,
  createSubscriber,
  getSubscriberByEmail,
  hashToken,
  HttpError,
  jsonResponse,
  makeToken,
  methodNotAllowed,
  normalizeEmail,
  normalizeLanguage,
  requireNewsletterEnv,
  sendResendEmail,
  updateSubscriberById
} from "./shared/newsletter-service.mjs";

export async function handler(event) {
  if (event.httpMethod !== "POST") return methodNotAllowed();
  try {
    const payload = parsePayload(event);
    if (payload["bot-field"]) return jsonResponse({ ok: true });
    const email = normalizeEmail(payload.email);
    const language = normalizeLanguage(payload.language);
    checkRateLimit(`${clientIp(event)}:${email}`);
    requireNewsletterEnv();

    const confirmationToken = makeToken();
    const unsubscribeToken = makeToken();
    const confirmationHash = hashToken(confirmationToken);
    const existing = await getSubscriberByEmail(email);
    let subscriber = existing;

    if (existing) {
      subscriber = await updateSubscriberById(existing.id, {
        status: existing.status === "active" ? "active" : "pending",
        language,
        confirmation_token: existing.status === "active" ? null : confirmationHash,
        unsubscribe_token: existing.unsubscribe_token || unsubscribeToken,
        unsubscribed_at: null
      });
    } else {
      subscriber = await createSubscriber({
        email,
        status: "pending",
        language,
        confirmation_token: confirmationHash,
        unsubscribe_token: unsubscribeToken
      });
    }

    if (subscriber?.status !== "active") {
      const emailMessage = confirmationEmail({ email, token: confirmationToken, language });
      await sendResendEmail({ to: email, subject: emailMessage.subject, html: emailMessage.html });
    }

    console.log(JSON.stringify({ event: "newsletter_subscribe", status: subscriber?.status, language }));
    return jsonResponse({
      ok: true,
      message: "Please check your inbox to confirm your ActuaryRadar Daily subscription."
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("newsletter_subscribe_failed", error);
    return jsonResponse({ ok: false, error: error.publicMessage || "Subscription failed. Please try again later." }, status);
  }
}

function parsePayload(event) {
  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
  if (contentType.includes("application/json")) return JSON.parse(event.body || "{}");
  return Object.fromEntries(new URLSearchParams(event.body || ""));
}
