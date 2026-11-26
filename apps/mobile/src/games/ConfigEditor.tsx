import { NPAT_DEFAULT_CATEGORIES, NPAT_EXTRA_CATEGORIES, getGame, type GameId } from '@gully/engine';
import { View } from 'react-native';
import { Chip, P, Row, Segment, Stepper, Toggle } from '../components/ui';
import { t } from '../strings';
import { catLabel } from './NpatBoard';

type Cfg = Record<string, unknown>;

/** Host/local settings for each game. Values are always re-sanitized by the engine. */
export function ConfigEditor({
  game, players, config, onChange, online,
}: { game: GameId; players: number; config: Cfg; onChange: (c: Cfg) => void; online?: boolean }) {
  const def = getGame(game)!;
  const c = def.sanitizeConfig(config, Math.max(players, def.meta.minPlayers)) as Cfg;
  const set = (k: string, v: unknown) => onChange({ ...c, [k]: v });
  const num = (k: string) => Number(c[k] ?? 0);

  switch (game) {
    case 'rmcs':
      return (
        <View>
          <Stepper label={t('setup.rounds')} value={num('rounds')} min={1} max={20} onChange={(v) => set('rounds', v)} />
          {online ? <Stepper label={t('setup.turnSeconds')} value={num('guessSeconds')} min={0} max={120} step={5} onChange={(v) => set('guessSeconds', v)} /> : null}
        </View>
      );
    case 'dots':
      return (
        <View style={{ gap: 6 }}>
          <P>{t('setup.boardSize')}</P>
          <Segment options={[{ value: 4, label: '4 × 4' }, { value: 5, label: '5 × 5' }]} value={num('size')} onChange={(v) => set('size', v)} />
          {online ? <Stepper label={t('setup.turnSeconds')} value={num('turnSeconds')} min={0} max={120} step={5} onChange={(v) => set('turnSeconds', v)} /> : null}
        </View>
      );
    case 'ludo':
      return (
        <View>
          <Toggle label={t('setup.finishAll')} value={!!c.finishAll} onChange={(v) => set('finishAll', v)} />
          {online ? <Stepper label={t('setup.turnSeconds')} value={num('turnSeconds')} min={0} max={120} step={5} onChange={(v) => set('turnSeconds', v)} /> : null}
        </View>
      );
    case 'npat': {
      const cats = (c.categories as string[]) ?? NPAT_DEFAULT_CATEGORIES;
      const all = [...NPAT_DEFAULT_CATEGORIES, ...NPAT_EXTRA_CATEGORIES];
      return (
        <View style={{ gap: 6 }}>
          <Stepper label={t('setup.rounds')} value={num('rounds')} min={1} max={15} onChange={(v) => set('rounds', v)} />
          <Stepper label={t('setup.roundSeconds')} value={num('roundSeconds')} min={0} max={300} step={15} onChange={(v) => set('roundSeconds', v)} />
          <Toggle label={t('setup.challenges')} value={!!c.challenges} onChange={(v) => set('challenges', v)} />
          <P>{t('setup.categories')}</P>
          <Row>
            {all.map((cat) => {
              const on = cats.includes(cat);
              return (
                <Chip
                  key={cat}
                  label={catLabel(cat)}
                  active={on}
                  onPress={() => {
                    const next = on ? cats.filter((x) => x !== cat) : [...cats, cat];
                    if (next.length) set('categories', next);
                  }}
                />
              );
            })}
          </Row>
        </View>
      );
    }
    case 'mafia': {
      const maxMafia = Math.max(1, Math.floor((players - 1) / 2));
      return (
        <View>
          <Stepper label={`🕶️ ${t('setup.mafiaCount')}`} value={num('mafiaCount')} min={1} max={maxMafia} onChange={(v) => set('mafiaCount', v)} />
          <Toggle label={`🩺 ${t('setup.doctor')}`} value={!!c.doctor} onChange={(v) => set('doctor', v)} />
          <Toggle label={`🔍 ${t('setup.detective')}`} value={!!c.detective} onChange={(v) => set('detective', v)} />
          <Toggle label={t('setup.revealOnDeath')} value={!!c.revealOnDeath} onChange={(v) => set('revealOnDeath', v)} />
          {online ? (
            <>
              <Stepper label={t('setup.nightSeconds')} value={num('nightSeconds')} min={15} max={300} step={15} onChange={(v) => set('nightSeconds', v)} />
              <Stepper label={t('setup.daySeconds')} value={num('daySeconds')} min={30} max={900} step={30} onChange={(v) => set('daySeconds', v)} />
              <Stepper label={t('setup.voteSeconds')} value={num('voteSeconds')} min={15} max={300} step={15} onChange={(v) => set('voteSeconds', v)} />
            </>
          ) : null}
        </View>
      );
    }
  }
}

/** Local games run without phase timers (except NPAT's writing timer). */
export function localConfig(game: GameId, players: number, config: Cfg): Cfg {
  const c = getGame(game)!.sanitizeConfig(config, players) as Cfg;
  if (game === 'mafia') return { ...c, nightSeconds: 0, daySeconds: 0, voteSeconds: 0 };
  if (game === 'npat') return { ...c, graceSeconds: 5, challengeSeconds: 0 };
  if (game === 'rmcs') return { ...c, revealSeconds: 0, guessSeconds: 0 };
  return { ...c, turnSeconds: 0 };
}
