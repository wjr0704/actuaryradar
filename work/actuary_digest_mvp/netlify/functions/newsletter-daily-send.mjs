import {
  dailyNewsletterEmail,
  HttpError,
  jsonResponse,
  listActiveSubscribers,
  listDeliveriesForDate,
  loadLatestDigest,
  normalizeLanguage,
  recordDelivery,
  requireNewsletterEnv,
  sendResendEmail
} from "./shared/newsletter-service.mjs";

export const config = {
  schedule: "30 6 * * *"
};

export async function handler(event) {
  try {
    requireNewsletterEnv();
    const digest = await loadLatestDigest();
    const digestDate = digest.report_date || digest.generation_date;
    if (!digestDate) throw new HttpError(500, "Digest date missing", "Latest digest is not available yet.");
    const subscribers = await listActiveSubscribers();
    const deliveries = await listDeliveriesForDate(digestDate);
    const alreadySent = new Set((deliveries || []).filter(row => row.status === "sent").map(row => row.subscriber_id));
    const results = { digest_date: digestDate, attempted: 0, sent: 0, skipped: 0, failed: 0 };

    for (const subscriber of subscribers || []) {
      if (alreadySent.has(subscriber.id)) {
        results.skipped += 1;
        continue;
      }
      results.attempted += 1;
      try {
        const message = dailyNewsletterEmail({
          digest,
          subscriber: {
            ...subscriber,
            language: normalizeLanguage(subscriber.language)
          }
        });
        const provider = await sendResendEmail({ to: subscriber.email, subject: message.subject, html: message.html });
        await recordDelivery({
          subscriber_id: subscriber.id,
          digest_date: digestDate,
          provider_message_id: provider.id || null,
          status: "sent"
        });
        results.sent += 1;
      } catch (error) {
        results.failed += 1;
        await recordDelivery({
          subscriber_id: subscriber.id,
          digest_date: digestDate,
          provider_message_id: null,
          status: "failed",
          error_message: String(error.message || error).slice(0, 500)
        }).catch(() => {});
        console.error("newsletter_delivery_failed", { subscriber_id: subscriber.id, error: error.message });
      }
    }

    console.log(JSON.stringify({ event: "newsletter_daily_send", ...results }));
    return jsonResponse({ ok: true, ...results });
  } catch (error) {
    console.error("newsletter_daily_send_failed", error);
    return jsonResponse({ ok: false, error: error.publicMessage || "Newsletter send failed." }, error.status || 500);
  }
}
