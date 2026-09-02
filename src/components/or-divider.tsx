import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Separates a primary action from its manual fallback. Without it, a
 * scan button, a text field and a submit button read as three steps in
 * one sequence rather than as two alternative ways to do the same
 * thing — which is exactly the wrong impression on the enrol and
 * start-trip screens.
 */
export function OrDivider({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="none">
      <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
      <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
