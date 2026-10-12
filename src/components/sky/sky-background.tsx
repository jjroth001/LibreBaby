import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { Scene } from '@/lib/sky';
import { skySvg } from '@/lib/sky-svg';

/** The time-of-day sky, filling its parent. */
export function SkyBackground({ scene }: { scene: Scene }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const xml =
    size.width > 0 ? skySvg(scene, Math.round(size.width), Math.round(size.height)) : null;

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: scene.sky[1] }]}
      onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {xml && <SvgXml xml={xml} width={size.width} height={size.height} />}
    </View>
  );
}
