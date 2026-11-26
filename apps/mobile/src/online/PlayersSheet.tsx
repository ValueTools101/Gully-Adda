import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Btn, Card, H2, P } from '../components/ui';
import { useSettings } from '../lib/settings';
import { t } from '../strings';
import { colors, fonts } from '../theme';
import { api, errorMessage, type RoomDoc } from './api';

const REASONS = ['harassment', 'hate', 'cheating', 'inappropriate', 'other'] as const;

/** Player list with Report / Block (and Remove for the host). Required for user-generated content on Play. */
export function PlayersSheet({ room, uid, dark }: { room: RoomDoc; uid: string; dark?: boolean }) {
  const { settings, update } = useSettings();
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [msg, setMsg] = useState('');
  const isHost = room.hostUid === uid;
  const fg = dark ? colors.cream : colors.ink;

  const block = async (id: string, name: string, on: boolean) => {
    const blocked = { ...settings.blocked };
    if (on) blocked[id] = name;
    else delete blocked[id];
    update({ blocked });
    setMsg(on ? t('online.blocked', { name }) : '');
    api.block(id, on).catch(() => {});
  };

  const report = async (reason: string) => {
    if (!target) return;
    try {
      await api.report(room.code, target.id, reason);
      update({ blocked: { ...settings.blocked, [target.id]: target.name } });
      setMsg(t('online.reportSent'));
    } catch (e) {
      setMsg(errorMessage(e));
    }
    setReporting(false);
    setTarget(null);
  };

  return (
    <Card dark={dark}>
      <H2 style={{ color: fg }}>👥 {t('online.players')}</H2>
      {room.seats.map((s) => {
        const blocked = !!settings.blocked[s.id];
        return (
          <View key={s.id} style={st.row}>
            <Text style={[st.name, { color: fg }]} numberOfLines={1}>
              {s.id === room.hostUid ? '⭐ ' : ''}
              {s.name}
              {s.id === uid ? ` (${t('common.you')})` : ''}
              {!s.isBot && s.botControlled ? ' 🤖💤' : ''}
              {blocked ? ' 🚫' : ''}
            </Text>
            {!s.isBot && s.id !== uid ? (
              <View style={st.actions}>
                <Btn small kind="ghost" label={t('online.report')} onPress={() => { setTarget({ id: s.id, name: s.name }); setReporting(true); }} />
                <Btn small kind="ghost" label={blocked ? t('online.unblock') : t('online.block')} onPress={() => block(s.id, s.name, !blocked)} />
                {isHost ? <Btn small kind="danger" label="✕" onPress={() => api.kick(room.code, s.id).catch((e) => setMsg(errorMessage(e)))} /> : null}
              </View>
            ) : null}
          </View>
        );
      })}
      {msg ? <P style={{ color: dark ? colors.mustard : colors.leaf }}>{msg}</P> : null}
      <Modal visible={reporting} transparent animationType="fade" onRequestClose={() => setReporting(false)}>
        <Pressable style={st.backdrop} onPress={() => setReporting(false)}>
          <Card style={{ width: '90%', maxWidth: 420 }}>
            <H2>{t('online.reportTitle', { name: target?.name ?? '' })}</H2>
            <P>{t('online.reportReason')}</P>
            {REASONS.map((r) => (
              <Btn key={r} kind="ghost" label={t(`online.reason.${r}`)} onPress={() => void report(r)} />
            ))}
            <Btn kind="secondary" label={t('common.cancel')} onPress={() => setReporting(false)} />
          </Card>
        </Pressable>
      </Modal>
    </Card>
  );
}

const st = StyleSheet.create({
  row: { gap: 6, paddingVertical: 4, borderBottomWidth: 1, borderColor: colors.cream },
  name: { fontFamily: fonts.bodyBold, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});
