/**
 * LiveKit voice for online Mafia. Tokens are minted only for room members;
 * the server decides who may publish audio from the engine's chat policy
 * and updates permissions whenever the phase changes.
 */
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export const VOICE_ENABLED = defineBoolean('VOICE_ENABLED', { default: false, description: 'Enable LiveKit voice for online Mafia' });
export const LIVEKIT_URL = defineString('LIVEKIT_URL', { default: '', description: 'wss://<project>.livekit.cloud' });
export const LIVEKIT_API_KEY = defineSecret('LIVEKIT_API_KEY');
export const LIVEKIT_API_SECRET = defineSecret('LIVEKIT_API_SECRET');

export function voiceReady(): boolean {
  try {
    return VOICE_ENABLED.value() && !!LIVEKIT_URL.value() && !!LIVEKIT_API_KEY.value() && LIVEKIT_API_KEY.value() !== 'unset';
  } catch {
    return false;
  }
}

export function livekitRoomName(code: string): string {
  return `gully-${code}`;
}

export async function mintToken(code: string, uid: string, name: string, canPublish: boolean): Promise<string> {
  const at = new AccessToken(LIVEKIT_API_KEY.value(), LIVEKIT_API_SECRET.value(), { identity: uid, name, ttl: '2h' });
  at.addGrant({ roomJoin: true, room: livekitRoomName(code), canPublish, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false });
  return at.toJwt();
}

/** Apply per-participant publish permissions after a phase change (best effort). */
export async function syncVoicePermissions(code: string, perms: Record<string, boolean>): Promise<void> {
  if (!voiceReady()) return;
  const host = LIVEKIT_URL.value().replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  const client = new RoomServiceClient(host, LIVEKIT_API_KEY.value(), LIVEKIT_API_SECRET.value());
  const room = livekitRoomName(code);
  let present: string[] = [];
  try {
    present = (await client.listParticipants(room)).map((p) => p.identity);
  } catch {
    return; // room not created yet (nobody joined voice)
  }
  await Promise.all(
    present.map(async (identity) => {
      const canPublish = perms[identity] ?? false;
      try {
        await client.updateParticipant(room, identity, { permission: { canPublish, canSubscribe: true, canPublishData: false } });
        if (!canPublish) {
          // Also force-mute any audio already being sent.
          const p = await client.getParticipant(room, identity);
          await Promise.all(p.tracks.filter((t) => !t.muted).map((t) => client.mutePublishedTrack(room, identity, t.sid, true)));
        }
      } catch (e) {
        logger.warn('voice permission update failed', { code, identity, e: String(e) });
      }
    }),
  );
}
