/**
 * Owner-only voice control policy for PPI.
 * There is no SpeechRecognition / speaker-ID stack in this repo.
 * When mic or voice UI is added (e.g. operator cockpit), call canUseVoiceControl
 * and hide/disable it unless the session has RoleName.OWNER (titolare / Massimo).
 * Operators must never get voice control. No fake biometric enrollment.
 *
 * Client-safe: do not import @/lib/access (that module pulls next/headers via session).
 */
import { RoleName } from "@prisma/client";

export function canUseVoiceControl(roles: { role: RoleName }[]): boolean {
  return roles.some((item) => item.role === RoleName.OWNER);
}