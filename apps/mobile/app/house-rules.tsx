import { Card, Header, P, Screen } from '../src/components/ui';
import { t } from '../src/strings';

export default function HouseRules() {
  return (
    <Screen>
      <Header title={t('house.title')} />
      <Card>
        <P>{t('house.body')}</P>
      </Card>
    </Screen>
  );
}
