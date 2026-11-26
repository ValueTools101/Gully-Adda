import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { Btn, Card, Field, H2, Header, P, Screen, Toggle } from '../src/components/ui';
import { useSettings } from '../src/lib/settings';
import { deleteMyOnlineData, firebase, onlineConfigured } from '../src/online/firebase';
import { t } from '../src/strings';
import { colors } from '../src/theme';

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://valuetools101.github.io/Gully-Adda/privacy.html';
const DELETE_URL = process.env.EXPO_PUBLIC_DELETE_URL ?? 'https://valuetools101.github.io/Gully-Adda/delete-account.html';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, update } = useSettings();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const playerId = onlineConfigured ? (firebase().auth.currentUser?.uid ?? null) : null;

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteMyOnlineData();
      update({ displayName: '', blocked: {} });
      setMsg(t('settings.deleted'));
    } catch (e) {
      setMsg(t('online.error', { msg: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      void doDelete();
      return;
    }
    Alert.alert(t('settings.deleteData'), t('settings.deleteDataBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.deleteData'), style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  return (
    <Screen testID="settings">
      <Header title={t('settings.title')} />
      <Card>
        <Toggle label={`🔊 ${t('settings.sound')}`} value={settings.sound} onChange={(v) => update({ sound: v })} />
        <Toggle label={`📳 ${t('settings.haptics')}`} value={settings.haptics} onChange={(v) => update({ haptics: v })} />
        <Field label={t('settings.name')} value={settings.displayName} maxLength={16} onChangeText={(v) => update({ displayName: v })} placeholder={t('online.namePlaceholder')} />
      </Card>
      <Card>
        <Btn kind="ghost" label={`📜 ${t('settings.houseRules')}`} onPress={() => router.push('/house-rules')} />
        <Btn kind="ghost" label={`🔒 ${t('settings.privacy')}`} onPress={() => void Linking.openURL(PRIVACY_URL)} />
        <Btn kind="ghost" label={`🎨 ${t('settings.credits')}`} onPress={() => router.push('/credits')} />
      </Card>
      <Card>
        <H2>{t('settings.deleteData')}</H2>
        <P>{t('settings.deleteDataBody')}</P>
        {onlineConfigured ? <Btn kind="danger" label={t('settings.deleteData')} onPress={confirmDelete} loading={busy} testID="delete-data" /> : null}
        <Btn kind="ghost" small label={t('settings.deleteWeb')} onPress={() => void Linking.openURL(DELETE_URL)} />
        {msg ? <P style={{ color: colors.leaf }}>{msg}</P> : null}
      </Card>
      <P center style={{ color: colors.inkSoft }}>{t('settings.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</P>
      <P center style={{ color: colors.inkSoft }}>{t('settings.contact')}</P>
      {playerId ? <P center style={{ color: colors.inkSoft, fontSize: 12 }}>{t('settings.playerId', { id: playerId })}</P> : null}
    </Screen>
  );
}
