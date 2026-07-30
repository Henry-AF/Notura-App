import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/theme/tokens";

export interface GreetingHeaderProps {
  userName: string;
  meetingsProcessedToday: number;
}

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: "Bom dia", emoji: "👋" };
  if (hour >= 12 && hour < 18) return { text: "Boa tarde", emoji: "☀️" };
  return { text: "Boa noite", emoji: "🌙" };
}

export function GreetingHeader({ userName, meetingsProcessedToday }: GreetingHeaderProps) {
  const router = useRouter();
  const greeting = getGreeting();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {greeting.text}, <Text style={styles.userName}>{userName}</Text> {greeting.emoji}
      </Text>
      <Text style={styles.description}>
        Sua inteligência fluida processou{" "}
        <Text style={styles.descriptionEmphasis}>{meetingsProcessedToday} reuniões</Text> hoje.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => router.push("/(app)/record")}
      >
        <Text style={styles.buttonText}>+ Nova reunião</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
  },
  userName: {
    color: colors.primary,
  },
  description: {
    fontSize: 13,
    color: colors.secondaryForeground,
  },
  descriptionEmphasis: {
    fontWeight: "700",
    color: colors.foreground,
  },
  button: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 14,
  },
});
