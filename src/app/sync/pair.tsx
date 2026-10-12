import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '@/components/screen';
import { CardTitle } from '@/components/card-title';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useChild } from '@/db/use-child';
import { inviteText } from '@/sync/pairing';
import { useSync } from '@/sync/sync-provider';

/** Shows the family code (QR) for another phone to scan. */
export default function PairScreen() {
  const { data: child } = useChild();
  const { family, lastEvent } = useSync();
  if (!child || !family) return null;

  return (
    <Screen withTabBar={false} belowHeader panel>
      <ThemedText>
        On the other phone, open LibreBaby and tap{' '}
        <ThemedText type="smallBold">Join with a family code</ThemedText> (in Settings → Family
        sync, or on the welcome screen), then scan this.
      </ThemedText>

      {/* Black on white regardless of theme: scanners read that most reliably. */}
      <View style={styles.qr}>
        <QRCode
          value={inviteText(family, child)}
          size={260}
          backgroundColor="#FFFFFF"
          color="#000000"
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Both phones need to be on the same Wi-Fi with LibreBaby open. Anyone who scans this code can
        see and change {child.name}&apos;s log, so only show it to family.
      </ThemedText>

      {lastEvent?.type === 'synced' && (
        <CardTitle icon="check">{`Synced with ${lastEvent.peerName}`}</CardTitle>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qr: {
    alignSelf: 'center',
    padding: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.three,
  },
});
