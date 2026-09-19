import {
  getSubscriberByConfirmationTokenHash,
  hashToken,
  htmlResponse,
  HttpError,
  statusPage,
  updateSubscriberById
} from "./shared/newsletter-service.mjs";

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return htmlResponse(statusPage({
      title: "Method not allowed",
      body: "Please open the confirmation link from your email."
    }), 405);
  }
  try {
    const token = event.queryStringParameters?.token || "";
    const tokenHash = token ? hashToken(token) : "";
    const subscriber = tokenHash ? await getSubscriberByConfirmationTokenHash(tokenHash) : null;
    if (!subscriber) {
      return htmlResponse(statusPage({
        title: "This confirmation link is no longer active",
        body: "This one-time link may have already confirmed your subscription, or a newer confirmation email may have replaced it. If you already confirmed, no further action is needed. Otherwise, subscribe again to receive a new link.",
        cta: "Open ActuaryRadar"
      }), 400);
    }
    await updateSubscriberById(subscriber.id, {
      status: "active",
      confirmation_token: null,
      confirmed_at: new Date().toISOString(),
      unsubscribed_at: null
    });
    return htmlResponse(statusPage({
      title: "Subscription confirmed",
      body: "You are now subscribed to ActuaryRadar Daily.",
      cta: "Open ActuaryRadar"
    }));
  } catch (error) {
    console.error("newsletter_confirm_failed", error);
    const status = error instanceof HttpError ? error.status : 500;
    return htmlResponse(statusPage({
      title: "Confirmation unavailable",
      body: "We could not confirm your subscription right now. Please try the link again later."
    }), status);
  }
}
