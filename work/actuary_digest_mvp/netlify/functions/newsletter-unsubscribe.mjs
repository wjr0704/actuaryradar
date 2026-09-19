import {
  getSubscriberByUnsubscribeToken,
  htmlResponse,
  HttpError,
  statusPage,
  updateSubscriberById
} from "./shared/newsletter-service.mjs";

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return htmlResponse(statusPage({
      title: "Method not allowed",
      body: "Please open the unsubscribe link from your email."
    }), 405);
  }
  try {
    const token = event.queryStringParameters?.token || "";
    const subscriber = token ? await getSubscriberByUnsubscribeToken(token) : null;
    if (!subscriber) {
      return htmlResponse(statusPage({
        title: "Unsubscribe link expired",
        body: "This unsubscribe link is invalid or has already been used."
      }), 400);
    }
    await updateSubscriberById(subscriber.id, {
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString()
    });
    return htmlResponse(statusPage({
      title: "You have been unsubscribed",
      body: "You will no longer receive ActuaryRadar Daily emails.",
      cta: "Open ActuaryRadar"
    }));
  } catch (error) {
    console.error("newsletter_unsubscribe_failed", error);
    const status = error instanceof HttpError ? error.status : 500;
    return htmlResponse(statusPage({
      title: "Unsubscribe unavailable",
      body: "We could not process your request right now. Please try the link again later."
    }), status);
  }
}
