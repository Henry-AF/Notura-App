import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useTheme } from '@/theme';
import { getEnv } from '@/lib/env';

// Same promotional banners the web dashboard shows (`src/components/dashboard/BannerCarousel.tsx`),
// served from the web app's public folder — reused as-is instead of bundling
// duplicate copies into the mobile app.
const BANNER_FILENAMES = [
  'banner-plano-pro-mobile.png',
  'banner-integracoes-mobile.png',
  'banner-atendimento-mobile.png',
] as const;

const INTERVAL_MS = 6000;

export function BannerCarousel() {
  const { colors, radius } = useTheme();
  const { apiBaseUrl } = getEnv();
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!width) return;
    const timer = setInterval(() => {
      setCurrent((previous) => {
        const next = (previous + 1) % BANNER_FILENAMES.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [width]);

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    setCurrent(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          style={[styles.track, { borderRadius: radius.lg }]}
        >
          {BANNER_FILENAMES.map((filename) => (
            <Image
              key={filename}
              source={{ uri: `${apiBaseUrl}/banners/${filename}` }}
              style={{ width, aspectRatio: 1 }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.dots}>
        {BANNER_FILENAMES.map((filename, index) => (
          <View
            key={filename}
            style={[
              styles.dot,
              {
                width: index === current ? 20 : 8,
                backgroundColor: index === current ? colors.primary : colors.muted,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 8,
    borderRadius: 99,
  },
});
