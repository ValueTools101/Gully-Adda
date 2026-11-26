import type { BaseView, ChatChannel, MafiaView } from '@gully/engine';

/**
 * UI-side mirror of the engine's chat policy, used only to decide which
 * channel the input box posts to. The server enforces the real rules.
 */
export function writableChannels(view: BaseView | null, status: string): ChatChannel[] {
  if (!view || status !== 'playing' || view.over) return ['all'];
  if (view.game !== 'mafia') return ['all'];
  const v = view as MafiaView;
  if (!v.amAlive) return ['dead'];
  if (v.phase === 'day' || v.phase === 'vote') return ['living'];
  if (v.phase === 'night' && v.myRole === 'mafia') return ['mafia'];
  return [];
}

export function canSpeak(view: BaseView | null): boolean {
  if (!view || view.game !== 'mafia') return false;
  const v = view as MafiaView;
  return !v.over && v.amAlive && (v.phase === 'day' || v.phase === 'vote');
}
