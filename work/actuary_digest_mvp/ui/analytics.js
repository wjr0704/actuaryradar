(function () {
  const MEASUREMENT_ID = "G-Y5FRSBG4V0";
  const PRODUCTION_HOSTS = new Set([
    "insuranceactuaryhub.com",
    "www.insuranceactuaryhub.com"
  ]);
  const SCRIPT_ID = "actuaryradar-ga4";
  const CONSENT_KEY = "actuaryRadar.analyticsConsent";
  const pendingCalls = [];

  function isProduction() {
    return PRODUCTION_HOSTS.has(window.location.hostname);
  }

  function respectsPrivacyPreference() {
    return navigator.doNotTrack === "1"
      || window.doNotTrack === "1"
      || localStorage.getItem("actuaryRadar.analyticsOptOut") === "true";
  }

  function consentStatus() {
    return localStorage.getItem(CONSENT_KEY);
  }

  function isEnabled() {
    return isProduction() && !respectsPrivacyPreference() && consentStatus() === "granted";
  }

  function shouldAskConsent() {
    return isProduction() && !respectsPrivacyPreference() && !consentStatus();
  }

  function safeEventName(name) {
    return String(name || "event").replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 40);
  }

  function cleanParams(params) {
    return Object.fromEntries(
      Object.entries(params || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : value])
    );
  }

  function init() {
    if (!isEnabled() || window.__actuaryRadarGaLoaded) return false;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };

    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted"
    });
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID, {
      send_page_view: false,
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }

    window.__actuaryRadarGaLoaded = true;
    return true;
  }

  function queueOrAskConsent(call) {
    if (!isProduction() || respectsPrivacyPreference() || consentStatus() === "denied") return true;
    if (shouldAskConsent()) {
      pendingCalls.push(call);
      showConsentPrompt();
      return true;
    }
    return false;
  }

  function flushPendingCalls() {
    const calls = pendingCalls.splice(0, pendingCalls.length);
    calls.forEach(call => call());
  }

  function consentCopy() {
    const language = (navigator.language || "en").toLowerCase();
    if (language.startsWith("zh")) {
      return {
        text: "ActuaryRadar 使用隐私友好的分析来了解页面和学习功能的使用情况。不会用于广告，也不会追踪个人身份。",
        accept: "同意分析",
        decline: "拒绝"
      };
    }
    if (language.startsWith("fr")) {
      return {
        text: "ActuaryRadar utilise une mesure d’audience respectueuse de la vie privée pour comprendre l’usage des pages et des parcours de formation. Aucune publicité ni identification personnelle.",
        accept: "Accepter",
        decline: "Refuser"
      };
    }
    return {
      text: "ActuaryRadar uses privacy-conscious analytics to understand page and learning feature usage. No ads and no personal identification.",
      accept: "Allow analytics",
      decline: "Decline"
    };
  }

  function showConsentPrompt() {
    if (document.getElementById("analyticsConsentPrompt")) return;
    const copy = consentCopy();
    const prompt = document.createElement("div");
    prompt.id = "analyticsConsentPrompt";
    prompt.setAttribute("role", "dialog");
    prompt.setAttribute("aria-live", "polite");
    prompt.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:20px",
      "z-index:9999",
      "max-width:390px",
      "background:#ffffff",
      "color:#102033",
      "border:1px solid #d8e0ea",
      "box-shadow:0 18px 50px rgba(7,26,58,.16)",
      "border-radius:8px",
      "padding:16px",
      "font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"
    ].join(";");
    prompt.innerHTML = `
      <p style="margin:0 0 12px;color:#334155;">${escapeHtml(copy.text)}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" data-analytics-decline style="border:1px solid #cbd5e1;background:#fff;color:#102033;border-radius:6px;padding:8px 12px;font-weight:700;cursor:pointer;">${escapeHtml(copy.decline)}</button>
        <button type="button" data-analytics-accept style="border:1px solid #0f766e;background:#0f766e;color:#fff;border-radius:6px;padding:8px 12px;font-weight:700;cursor:pointer;">${escapeHtml(copy.accept)}</button>
      </div>
    `;
    prompt.querySelector("[data-analytics-accept]").addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "granted");
      prompt.remove();
      init();
      flushPendingCalls();
    });
    prompt.querySelector("[data-analytics-decline]").addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "denied");
      pendingCalls.length = 0;
      prompt.remove();
    });
    document.body.appendChild(prompt);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function event(name, params = {}) {
    const send = () => event(name, params);
    if (queueOrAskConsent(send)) return;
    init();
    if (typeof window.gtag !== "function") return;
    window.gtag("event", safeEventName(name), cleanParams(params));
  }

  function pageView(params = {}) {
    const send = () => pageView(params);
    if (queueOrAskConsent(send)) return;
    init();
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", cleanParams({
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search + window.location.hash,
      ...params
    }));
  }

  window.ActuaryRadarAnalytics = {
    init,
    event,
    pageView,
    isEnabled,
    showConsentPrompt
  };
}());
