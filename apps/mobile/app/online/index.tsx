import { isGameId } from '@gully/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Btn, Card, Field, H2, Header, P, Screen } from '../../src/components/ui';
import { useSettings } from '../../src/lib/settings';
import { api, errorMessage } from '../../src/online/api';
import { onlineConfigured } from '../../src/online/firebase';
import { t } from '../../src/strings';
import { colors } from '../../src/theme';

export default function OnlineHome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ game?: string }>();
  const { settings, update } = useSettings();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [err, setErr] = useState('');
  const name = settings.displayName.trim();

  const go = async (kind: 'create' | 'join') => {
    setErr('');
    setBusy(kind);
    try {
      const res = kind === 'create'
        ? await api.createRoom(name, isGameId(params.game) ? params.game : undefined)
        : await api.joinRoom(code.trim().toUpperCase(), name);
      router.replace({ pathname: '/online/[code]', params: { code: res.code } });
    } catch (e) {
      setErr(t('online.error', { msg: errorMessage(e) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen testID="online-home">
      <Header title={t('online.title')} />
      {!onlineConfigured ? (
        <Card>
          <P>{t('online.notConfigured')}</P>
        </Card>
      ) : (
        <>
          <Card>
            <Field
              label={t('online.yourName')}
              value={settings.displayName}
              onChangeText={(v) => update({ displayName: v })}
              maxLength={16}
              placeholder={t('online.namePlaceholder')}
              autoCorrect={false}
            />
            <P style={{ color: colors.inkSoft, fontSize: 12 }}>{t('online.houseRulesAgree')}</P>
          </Card>
          <Card>
            <H2>{t('online.create')}</H2>
            <Btn label={t('online.create')} icon="🏠" disabled={!name} loading={busy === 'create'} onPress={() => go('create')} testID="online-create" />
          </Card>
          <Card>
            <H2>{t('online.join')}</H2>
            <Field
              label={t('online.code')}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder={t('online.codePlaceholder')}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ fontSize: 28, letterSpacing: 6, textAlign: 'center' }}
            />
            <Btn label={t('online.join')} icon="🚪" kind="secondary" disabled={!name || code.length !== 6} loading={busy === 'join'} onPress={() => go('join')} testID="online-join" />
          </Card>
          {err ? <P style={{ color: colors.danger }}>{err}</P> : null}
          <Btn small kind="ghost" label={`📜 ${t('house.title')}`} onPress={() => router.push('/house-rules')} />
        </>
      )}
    </Screen>
  );
}
