import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { parseScannedCode, type ScanKind } from "@/lib/qr-payload";

/**
 * The camera half of badge/vehicle entry. Every screen that offers this
 * keeps its manual text input too — there is no camera at all under
 * `expo start --web`, a driver can decline the permission, and a
 * sticker on a van door gets scuffed. Scanning is the fast path, never
 * the only path.
 *
 * `onScanned` receives the already-validated value (a raw badge token
 * or a vehicle uuid), not the raw QR contents — kind-checking and
 * unwrapping live in lib/qr-payload.ts so they can be unit tested
 * without a camera.
 *
 * Design notes: the viewfinder is the classic dimmed-surround-plus-
 * cut-out, because a driver holding a phone at arm's length in a depot
 * needs to know where to aim without reading anything. The reticle is
 * white rather than brand red — red is this app's error colour
 * (ThemedText accent), and a red frame around a working camera reads as
 * a fault. Exactly one thing moves (the sweep line), per the "animate
 * 1–2 elements per view" rule; it stops on success, and never starts at
 * all when the OS reports reduced motion.
 */

/** Success only. Not in the theme, which has no positive colour — and the theme's accent is red, which here means "error". */
const SCAN_SUCCESS = "#22c55e";
const RETICLE = "#ffffff";

export function QrScanner({
  kind,
  onScanned,
  onCancel,
}: {
  kind: ScanKind;
  onScanned: (value: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  // onBarcodeScanned keeps firing for as long as a code is in frame —
  // without this the parent gets a burst of duplicate calls (and, on
  // the enroll screen, a burst of enrollment attempts).
  const handled = useRef(false);

  const reducedMotion = useReducedMotion();
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || succeeded || !permission?.granted) {
      sweep.value = 0;
      return;
    }
    sweep.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reducedMotion, succeeded, permission?.granted, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    // Percentage of the frame height, so this needs no measured layout.
    top: `${sweep.value * 100}%`,
    opacity: 0.9,
  }));

  function handleBarcode(scanned: { data: string }) {
    if (handled.current) return;
    const parsed = parseScannedCode(scanned.data, kind);
    if (!parsed.ok) {
      // Not latched: a wrong-kind or unreadable code should let the
      // driver just point the camera at the right sticker, with no
      // extra tap to re-arm.
      setError(parsed.message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    handled.current = true;
    setError(null);
    setSucceeded(true);
    // The confirmation a driver actually feels — they are looking at a
    // van, not at the screen, when this lands.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onScanned(parsed.value);
  }

  const label = kind === "badge" ? "badge" : "vehicle";

  if (!permission) {
    // Permissions still loading — expo-camera returns null on the very
    // first render before it has read the current status.
    return (
      <ThemedView style={styles.message}>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Checking camera access…
        </ThemedText>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.message}>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {permission.canAskAgain
            ? `Camera access is needed to scan a ${label} code.`
            : `Camera access is off for Fleetly. Turn it on in Settings to scan a ${label} code, or type it in instead.`}
        </ThemedText>
        {permission.canAskAgain && (
          <Pressable
            testID="qr-grant-permission"
            accessibilityRole="button"
            onPress={() => {
              void requestPermission();
            }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText style={styles.buttonText}>Allow camera</ThemedText>
          </Pressable>
        )}
        <Pressable
          testID="qr-cancel"
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
        >
          <ThemedText themeColor="accent">Type it instead</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const frameColor = succeeded ? SCAN_SUCCESS : RETICLE;

  return (
    <ThemedView style={styles.wrapper}>
      <View style={styles.viewfinder}>
        <CameraView
          testID="qr-camera"
          style={StyleSheet.absoluteFill}
          facing="back"
          // Only QR: barcodeTypes narrows what the scanner even looks
          // for, which both speeds it up and stops a stray barcode on
          // packaging in frame being read as a Fleetly code.
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcode}
        />

        {/*
          Four scrim panels around the cut-out rather than a real mask:
          RN has no cross-platform cutout without pulling in SVG or
          masked-view, and this reads identically.
        */}
        <View style={[styles.scrim, styles.scrimTop]} pointerEvents="none" />
        <View style={[styles.scrim, styles.scrimBottom]} pointerEvents="none" />
        <View style={[styles.scrim, styles.scrimLeft]} pointerEvents="none" />
        <View style={[styles.scrim, styles.scrimRight]} pointerEvents="none" />

        <View style={styles.frame} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL, { borderColor: frameColor }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: frameColor }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: frameColor }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: frameColor }]} />

          {!succeeded && !reducedMotion && (
            <Animated.View
              style={[styles.sweep, { backgroundColor: theme.accent }, sweepStyle]}
            />
          )}
        </View>
      </View>

      <ThemedText
        themeColor="textSecondary"
        style={styles.center}
        accessibilityLiveRegion="polite"
      >
        {succeeded ? "Scanned" : `Point the camera at the ${label} code.`}
      </ThemedText>

      {error && (
        <ThemedView type="backgroundElement" style={styles.errorPill}>
          <ThemedText testID="qr-error" themeColor="accent" style={styles.center} type="small">
            {error}
          </ThemedText>
        </ThemedView>
      )}

      {Platform.OS === "web" && (
        <ThemedText themeColor="textSecondary" type="small" style={styles.center}>
          Scanning needs a real device. On web, type the code instead.
        </ThemedText>
      )}

      <Pressable
        testID="qr-cancel"
        accessibilityRole="button"
        onPress={onCancel}
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
      >
        <ThemedText themeColor="accent">Type it instead</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

/** Fraction of the viewfinder the cut-out occupies, per side. */
const FRAME_INSET = "14%";

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  message: { gap: Spacing.two, paddingVertical: Spacing.three },
  center: { textAlign: "center" },

  viewfinder: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Spacing.four,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },

  scrim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.45)" },
  scrimTop: { top: 0, left: 0, right: 0, height: FRAME_INSET },
  scrimBottom: { bottom: 0, left: 0, right: 0, height: FRAME_INSET },
  scrimLeft: { left: 0, width: FRAME_INSET, top: FRAME_INSET, bottom: FRAME_INSET },
  scrimRight: { right: 0, width: FRAME_INSET, top: FRAME_INSET, bottom: FRAME_INSET },

  frame: {
    position: "absolute",
    top: FRAME_INSET,
    bottom: FRAME_INSET,
    left: FRAME_INSET,
    right: FRAME_INSET,
    overflow: "hidden",
  },
  corner: { position: "absolute", width: 26, height: 26, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  sweep: { position: "absolute", left: 0, right: 0, height: 2, borderRadius: 2 },

  errorPill: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  button: {
    minHeight: 48,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  /** 48px tall so the fallback is a real touch target, not a thin line of text. */
  linkButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
});
