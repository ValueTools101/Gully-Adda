import type { BaseView } from '@gully/engine';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Btn, Card, H2, P } from '../components/ui';
import { useSettings } from '../lib/settings';
import { t } from '../strings';
import { colors, fonts, radius } from '../theme';
import { api, errorMessage, type ChatMsg } from './api';
import { writableChannels } from './chatPolicy';

export function ChatPanel({ code, chat, view, status, uid, dark }: { code: string; chat: ChatMsg[]; view: BaseView | null; status: string; uid: string; dark?: boolean }) {
  const { settings } = useSettings();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const channels = writableChannels(view, status);
  const channel = channels[0];
  const visible = chat.filter((m) => !settings.blocked[m.from]).slice(-25);
  const fg = dark ? colors.cream : colors.ink;

  const send = async () => {
    if (!channel || !text.trim()) return;
    const msg = text;
    setText('');
    setErr('');
    try {
      await api.sendChat(code, channel, msg);
    } catch (e) {
      setErr(errorMessage(e));
      setText(msg);
    }
  };

  return (
    <Card dark={dark}>
      <H2 style={{ color: fg }}>💬 {t('online.chat')}{channel ? ` · ${t(`online.chat.${channel}`)}` : ''}</H2>
      <View style={{ gap: 4 }}>
        {visible.map((m) => (
          <Text key={m.id} style={[st.msg, { color: fg }]}>
            <Text style={[st.who, m.channel === 'mafia' && { color: colors.pink }, m.channel === 'dead' && { color: colors.inkSoft }]}>
              {m.channel !== 'all' && m.channel !== 'living' ? `[${t(`online.chat.${m.channel}`)}] ` : ''}
              {m.from === uid ? t('common.you') : m.name}:{' '}
            </Text>
            {m.text}
          </Text>
        ))}
      </View>
      {channel ? (
        <View style={st.row}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('online.chatPlaceholder')}
            placeholderTextColor={colors.inkSoft}
            maxLength={200}
            onSubmitEditing={send}
            returnKeyType="send"
            style={st.input}
          />
          <Btn small label="➤" onPress={send} disabled={!text.trim()} />
        </View>
      ) : (
        <P style={{ color: fg }}>🔇 {t('online.chatClosed')}</P>
      )}
      {err ? <P style={{ color: colors.danger }}>{err}</P> : null}
    </Card>
  );
}

const st = StyleSheet.create({
  msg: { fontFamily: fonts.body, fontSize: 14 },
  who: { fontFamily: fonts.bodyBold, color: colors.teal },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.sm, backgroundColor: colors.white, paddingHorizontal: 10, minHeight: 44, fontFamily: fonts.body, color: colors.ink },
});
