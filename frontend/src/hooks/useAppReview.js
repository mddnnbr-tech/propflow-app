// Triggers the native iOS / Android "Rate this app" sheet via Capacitor.
// Gracefully does nothing in web browsers or when Capacitor is not present.
// Only activates in production native builds where Capacitor plugins are installed.

const STORAGE_KEY = 'propflow_review_last_prompted';
const MIN_DAYS_BETWEEN_PROMPTS = 30;

async function maybeRequestReview(triggerName = 'unknown') {
  try {
    // Only attempt in environments where Capacitor is globally available (native builds)
    const Capacitor = window?.Capacitor;
    if (!Capacitor || !Capacitor.isNativePlatform()) return;

    // Throttle: don't ask more than once per 30 days
    const lastPrompted = localStorage.getItem(STORAGE_KEY);
    if (lastPrompted) {
      const daysSince = (Date.now() - parseInt(lastPrompted)) / (1000 * 60 * 60 * 24);
      if (daysSince < MIN_DAYS_BETWEEN_PROMPTS) return;
    }

    // AppReview plugin is only available in native Capacitor builds
    const { AppReview } = window.CapacitorPlugins || {};
    if (!AppReview?.requestReview) return;

    await AppReview.requestReview();
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    console.log(`[AppReview] Prompted after trigger: ${triggerName}`);
  } catch (err) {
    console.warn('[AppReview] Could not prompt:', err.message);
  }
}

export { maybeRequestReview };
