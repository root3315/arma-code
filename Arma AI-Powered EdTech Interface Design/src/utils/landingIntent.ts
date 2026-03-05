export interface LandingIntentPayload {
  topic?: string;
  file?: File | null;
}

export interface LandingIntentSnapshot {
  topic: string;
  fileName: string | null;
  hasFile: boolean;
  createdAt: number;
}

const LANDING_INTENT_KEY = 'arma_landing_intent';

let pendingLandingFile: File | null = null;

export function setLandingIntent(payload: LandingIntentPayload): void {
  const topic = (payload.topic || '').trim();
  const file = payload.file || null;

  pendingLandingFile = file;

  const snapshot: LandingIntentSnapshot = {
    topic,
    fileName: file?.name || null,
    hasFile: Boolean(file),
    createdAt: Date.now(),
  };

  sessionStorage.setItem(LANDING_INTENT_KEY, JSON.stringify(snapshot));
}

export function hasLandingIntent(): boolean {
  return Boolean(sessionStorage.getItem(LANDING_INTENT_KEY));
}

export function clearLandingIntent(): void {
  sessionStorage.removeItem(LANDING_INTENT_KEY);
  pendingLandingFile = null;
}

export function consumeLandingIntent(): { topic: string; file: File | null } | null {
  const raw = sessionStorage.getItem(LANDING_INTENT_KEY);
  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(LANDING_INTENT_KEY);
  let topic = '';

  try {
    const parsed = JSON.parse(raw) as Partial<LandingIntentSnapshot>;
    topic = typeof parsed.topic === 'string' ? parsed.topic.trim() : '';
  } catch {
    topic = '';
  }

  const file = pendingLandingFile;
  pendingLandingFile = null;

  return { topic, file };
}
