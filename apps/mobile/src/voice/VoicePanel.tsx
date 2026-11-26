/** Web / fallback: no voice. Text chat (same phase rules) is used instead. */
export interface VoicePanelProps {
  code: string;
  canSpeak: boolean;
  amAlive: boolean;
  night: boolean;
  blocked: Record<string, string>;
  dark?: boolean;
}

export function VoicePanel(_props: VoicePanelProps) {
  return null;
}
