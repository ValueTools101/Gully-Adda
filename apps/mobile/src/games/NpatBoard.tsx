import { NPAT_MAX_ANSWER, scoreNpat, type NpatView, type PlayerId } from '@gully/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GameOverPanel, LogFeed, PlayerStrip, TurnBanner, playerName } from '../components/game';
import { Btn, Card, Countdown, H2, P, Row } from '../components/ui';
import { feedback } from '../lib/feedback';
import { t } from '../strings';
import { colors, fonts, radius, retroShadow } from '../theme';
import { useGameNav } from './nav';
import type { BoardProps } from './types';

export function catLabel(c: string): string {
  const k = `npat.cat.${c}`;
  const v = t(k);
  return v === k ? c.charAt(0).toUpperCase() + c.slice(1) : v;
}

function AnswerForm({ view, act, mode }: Pick<BoardProps<NpatView>, 'view' | 'act' | 'mode'>) {
  const cats = view.config.categories;
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...view.myAnswers }));
  const sent = useRef(JSON.stringify(view.myAnswers));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(answers);
  useEffect(() => {
    latest.current = answers;
  }, [answers]);

  const flush = () => {
    const json = JSON.stringify(latest.current);
    if (json !== sent.current) {
      sent.current = json;
      act({ type: 'answer', answers: latest.current } as never);
    }
  };
  const change = (c: string, v: string) => {
    latest.current = { ...latest.current, [c]: v };
    setAnswers(latest.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, mode === 'online' ? 500 : 150);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Pass & play: each player gets their own countdown while holding the phone.
  const [localDeadline] = useState(() => (mode === 'pass' && view.config.roundSeconds > 0 ? Date.now() + view.config.roundSeconds * 1000 : null));
  const submitted = useRef(false);
  const submit = (type: 'submit' | 'stop') => {
    if (submitted.current) return;
    submitted.current = true;
    if (timer.current) clearTimeout(timer.current);
    flush();
    feedback(type === 'stop' ? 'stop' : 'tap', type === 'stop' ? 'heavy' : 'tap');
    act({ type } as never);
  };
  const filled = cats.every((c) => (answers[c] ?? '').trim().length > 0);
  const canStop = filled && !view.stoppedBy && (view.legal as { type: string }[]).some((a) => a.type === 'answer');

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={st.letterBox}>
          <Text style={st.letterLabel}>{t('npat.letter')}</Text>
          <Text style={st.letter} testID="npat-letter">{view.letter}</Text>
        </View>
        <Countdown
          deadline={localDeadline ?? view.deadline}
          onTick={(s) => {
            if (localDeadline && s === 0) submit('submit');
          }}
        />
      </Row>
      {view.stoppedBy ? <P style={{ color: colors.danger, fontFamily: fonts.bodyBold }}>{t('npat.stoppedBy', { name: playerName(view, view.stoppedBy) })}</P> : null}
      {cats.map((c, i) => (
        <View key={c} style={{ gap: 4 }}>
          <Text style={st.catLabel}>{catLabel(c)}</Text>
          <TextInput
            testID={`npat-input-${c}`}
            value={answers[c] ?? ''}
            onChangeText={(v) => change(c, v)}
            placeholder={`${view.letter}...`}
            placeholderTextColor={colors.inkSoft}
            maxLength={NPAT_MAX_ANSWER}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            returnKeyType={i === cats.length - 1 ? 'done' : 'next'}
            onBlur={flush}
            style={st.input}
          />
        </View>
      ))}
      <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <Btn label={t('npat.stop')} kind="danger" disabled={!canStop} onPress={() => submit('stop')} testID="npat-stop" style={{ flexGrow: 1 }} />
        <Btn label={t('npat.submit')} kind="secondary" onPress={() => submit('submit')} testID="npat-submit" style={{ flexGrow: 1 }} />
      </Row>
    </Card>
  );
}

export function NpatBoard({ view, act, actGroup, mode, shared }: BoardProps<NpatView>) {
  const nav = useGameNav();
  const cats = view.config.categories;
  const ids = view.players.map((p) => p.id);
  const preview = useMemo(
    () => (view.phase === 'answer' ? null : scoreNpat(ids, cats, view.letter, view.revealed, view.votes)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.version, view.phase],
  );
  const iAmPending = !!view.me && view.waitingFor.includes(view.me);

  const toggleReject = (target: PlayerId, c: string) => {
    feedback('tap');
    const rejectedNow = preview?.[target]?.[c]?.rejected ?? false;
    if (mode === 'pass' && shared) {
      actGroup((pid) => (pid === target ? null : { type: 'challenge', target, category: c, reject: !rejectedNow } as never));
    } else {
      const mine = (view.votes[target]?.[c] ?? []).includes(view.me ?? '');
      act({ type: 'challenge', target, category: c, reject: !mine } as never);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{t('common.round', { n: view.round, total: view.config.rounds })}</H2>
        {view.phase !== 'answer' ? <Countdown deadline={view.deadline} /> : null}
      </Row>
      <PlayerStrip
        view={view}
        scores={view.totals}
        extra={(id) => (view.phase === 'answer' && view.submitted.includes(id) ? <Text>✅</Text> : null)}
      />

      {view.phase === 'answer' && !shared && iAmPending ? <AnswerForm key={`${view.round}-${view.me}`} view={view} act={act} mode={mode} /> : null}
      {view.phase === 'answer' && (shared || !iAmPending) ? (
        <Card style={{ alignItems: 'center' }}>
          <Text style={st.letterBig}>{view.letter}</Text>
          <P center>{view.submitted.length}/{view.players.length} {t('npat.submitted')}</P>
          <Countdown deadline={view.deadline} />
        </Card>
      ) : null}

      {view.phase !== 'answer' && preview ? (
        <Card>
          <H2>{view.phase === 'challenge' ? t('npat.challenge') : t('npat.results')} · {view.letter}</H2>
          {view.phase === 'challenge' ? <P>{t('npat.challengeHint')}</P> : null}
          {cats.map((c) => (
            <View key={c} style={st.catBlock}>
              <Text style={st.catLabel}>{catLabel(c)}</Text>
              {view.players.map((p) => {
                const cell = preview[p.id]?.[c];
                if (!cell) return null;
                const empty = !cell.answer.trim();
                const myVote = (view.votes[p.id]?.[c] ?? []).includes(view.me ?? '');
                const canChallenge = view.phase === 'challenge' && !empty && cell.valid && (shared || p.id !== view.me) && (shared || !view.ready.includes(view.me ?? ''));
                return (
                  <View key={p.id} style={st.answerRow}>
                    <Text style={st.answerName} numberOfLines={1}>{p.name}</Text>
                    <Text style={[st.answer, (cell.rejected || !cell.valid) && st.struck]} numberOfLines={1}>
                      {empty ? '—' : cell.answer}
                    </Text>
                    <Text style={[st.pts, cell.points === 0 && { color: colors.inkSoft }]}>
                      {!empty && !cell.valid ? t('npat.invalid') : cell.points}
                    </Text>
                    {canChallenge ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${t('npat.reject')} ${cell.answer}`}
                        onPress={() => toggleReject(p.id, c)}
                        style={[st.rejectBtn, (shared ? cell.rejected : myVote) && st.rejectOn]}
                        hitSlop={6}
                      >
                        <Text style={st.rejectText}>{(shared ? cell.rejected : myVote) ? '✗' : '?'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
          {!view.over && (iAmPending || shared) ? (
            <Btn
              label={view.phase === 'challenge' ? t('npat.ready') : t('npat.next')}
              onPress={() => actGroup(() => ({ type: 'ready' } as never))}
              testID="npat-ready"
            />
          ) : null}
        </Card>
      ) : null}

      {view.over ? <GameOverPanel view={view} scores={view.totals} onAgain={nav.again} onHome={nav.home} /> : <TurnBanner view={view} />}
      <LogFeed log={view.log} max={3} />
    </View>
  );
}

const st = StyleSheet.create({
  letterBox: { alignItems: 'center', backgroundColor: colors.mustard, borderWidth: 3, borderColor: colors.ink, borderRadius: radius.md, paddingHorizontal: 16, ...retroShadow },
  letterLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, marginTop: 4 },
  letter: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60, color: colors.maroon },
  letterBig: { fontFamily: fonts.display, fontSize: 96, lineHeight: 110, color: colors.maroon },
  catLabel: { fontFamily: fonts.heading, fontSize: 18, color: colors.teal },
  input: { borderWidth: 2, borderColor: colors.ink, borderRadius: radius.sm, backgroundColor: colors.white, paddingHorizontal: 12, minHeight: 50, fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink },
  catBlock: { borderTopWidth: 2, borderColor: colors.cream, paddingTop: 6, gap: 2 },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  answerName: { width: 80, fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  answer: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  struck: { textDecorationLine: 'line-through', color: colors.danger },
  pts: { fontFamily: fonts.heading, fontSize: 16, color: colors.maroon, minWidth: 28, textAlign: 'right' },
  rejectBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  rejectOn: { backgroundColor: colors.danger },
  rejectText: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
});
