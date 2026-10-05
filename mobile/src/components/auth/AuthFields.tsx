import { useState } from "react";
import { Pressable, StyleSheet, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, radius } from "@/theme/tokens";
import { Input } from "@/components/ui/Input";

const colors = palette.light;

/** Input restyled for the auth screens: white surface, 52px tall, 8px radius. */
export function AuthInput({ style, ...rest }: TextInputProps) {
  return (
    <Input
      placeholderTextColor={colors.mutedForeground}
      style={[styles.input, style]}
      {...rest}
    />
  );
}

/** Password field with a show/hide eye toggle on the right. */
export function PasswordInput(props: TextInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <AuthInput
        placeholder="Senha"
        autoCapitalize="none"
        secureTextEntry={!visible}
        style={styles.passwordInput}
        {...props}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? "Ocultar senha" : "Mostrar senha"}
        hitSlop={10}
        onPress={() => setVisible((current) => !current)}
        style={styles.eye}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    paddingVertical: 0,
    paddingHorizontal: 22,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderColor: "#E4E2F0",
    fontSize: 13,
  },
  passwordInput: { paddingRight: 52 },
  eye: { position: "absolute", right: 18, top: 0, bottom: 0, justifyContent: "center" },
});
