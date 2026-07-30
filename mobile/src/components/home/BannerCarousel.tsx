import { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { buildSupportWhatsAppUrl } from "@/lib/support-contact";
import { colors } from "@/lib/theme/tokens";

type BannerAction =
  | { type: "plan" }
  | { type: "alert"; message: string }
  | { type: "external"; href: string };

interface Banner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source: any;
  alt: string;
  action: BannerAction;
}

const BANNERS: Banner[] = [
  {
    source: require("../../../assets/banners/banner-plano-pro-mobile.png"),
    alt: "Teste o plano Pro",
    action: { type: "plan" },
  },
  {
    source: require("../../../assets/banners/banner-integracoes-mobile.png"),
    alt: "Quero receber novidades sobre integrações",
    action: { type: "alert", message: "Email salvo" },
  },
  {
    source: require("../../../assets/banners/banner-atendimento-mobile.png"),
    alt: "Nossa equipe de desenvolvimento atende você diretamente",
    action: { type: "external", href: buildSupportWhatsAppUrl() },
  },
];

export function BannerCarousel() {
  const router = useRouter();
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function handlePress(banner: Banner) {
    if (banner.action.type === "plan") {
      router.push("/(app)/profile");
      return;
    }
    if (banner.action.type === "alert") {
      Alert.alert(banner.action.message);
      return;
    }
    void Linking.openURL(banner.action.href);
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!containerWidth) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
    setActiveIndex(index);
  }

  return (
    <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {containerWidth > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          style={styles.track}
        >
          {BANNERS.map((banner, index) => (
            <Pressable
              key={index}
              style={{ width: containerWidth }}
              onPress={() => handlePress(banner)}
              accessibilityLabel={banner.alt}
            >
              <Image
                source={banner.source}
                style={[styles.image, { width: containerWidth }]}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.dots}>
        {BANNERS.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 14,
  },
  image: {
    height: 140,
    borderRadius: 14,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.primary,
  },
});
