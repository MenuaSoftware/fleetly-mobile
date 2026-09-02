import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { QrScanner } from "./qr-scanner";

/**
 * expo-camera can't run under jest (it needs a real camera and a native
 * module), so CameraView is replaced with a plain element that captures
 * its onBarcodeScanned prop — letting these tests fire scans the way
 * the camera would, and cover what is actually this component's own
 * logic: the wrong-kind path, the duplicate-scan latch, and the
 * permission states.
 *
 * `render` is awaited throughout: @testing-library/react-native 14
 * renders concurrently and returns a promise, and its queries (and
 * `screen`) are empty until it resolves.
 */
let mockScanHandler: ((result: { data: string }) => void) | undefined;
let mockPermissionState: { granted: boolean; canAskAgain: boolean } | null = {
  granted: true,
  canAskAgain: true,
};
const mockRequestPermission = jest.fn();

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

jest.mock("expo-camera", () => ({
  CameraView: (props: {
    onBarcodeScanned?: (result: { data: string }) => void;
    testID?: string;
  }) => {
    mockScanHandler = props.onBarcodeScanned;
    const { Text: RNText } = jest.requireActual("react-native");
    return <RNText testID={props.testID}>camera</RNText>;
  },
  useCameraPermissions: () => [mockPermissionState, mockRequestPermission],
}));

/**
 * Fires one barcode read, flushing the state it causes. The `act` here
 * must be awaited — RNTL 14's act is async, and leaving one unresolved
 * corrupts React's act queue for every later test in the file.
 */
async function scan(data: string) {
  if (!mockScanHandler) throw new Error("Camera never mounted");
  const handler = mockScanHandler;
  await act(async () => {
    handler({ data });
  });
}

describe("QrScanner", () => {
  beforeEach(() => {
    mockScanHandler = undefined;
    mockPermissionState = { granted: true, canAskAgain: true };
    mockRequestPermission.mockClear();
    (Haptics.notificationAsync as jest.Mock).mockClear();
  });

  it("hands the unwrapped value to onScanned when the right code is scanned", async () => {
    const onScanned = jest.fn();
    await render(<QrScanner kind="badge" onScanned={onScanned} onCancel={jest.fn()} />);

    await scan("fleetly:badge:MHOD_LL5XUMW");

    expect(onScanned).toHaveBeenCalledWith("MHOD_LL5XUMW");
  });

  it("only reports the first scan, though the camera keeps firing", async () => {
    // onBarcodeScanned fires continuously while a code is in frame —
    // without the latch this would enrol the same badge several times.
    const onScanned = jest.fn();
    await render(<QrScanner kind="badge" onScanned={onScanned} onCancel={jest.fn()} />);

    await scan("fleetly:badge:MHOD_LL5XUMW");
    await scan("fleetly:badge:MHOD_LL5XUMW");
    await scan("fleetly:badge:MHOD_LL5XUMW");

    expect(onScanned).toHaveBeenCalledTimes(1);
  });

  it("explains a wrong-kind scan without reporting it", async () => {
    const onScanned = jest.fn();
    await render(<QrScanner kind="badge" onScanned={onScanned} onCancel={jest.fn()} />);

    await scan("fleetly:vehicle:5e808835-06a1-4938-8b99-cd77c5ab64c9");

    expect(onScanned).not.toHaveBeenCalled();
    expect(screen.getByTestId("qr-error")).toBeTruthy();
  });

  it("stays armed after a bad scan, so the driver can just re-aim", async () => {
    const onScanned = jest.fn();
    await render(<QrScanner kind="badge" onScanned={onScanned} onCancel={jest.fn()} />);

    await scan("https://example.com/not-a-fleetly-code");
    expect(onScanned).not.toHaveBeenCalled();

    await scan("fleetly:badge:MHOD_LL5XUMW");
    expect(onScanned).toHaveBeenCalledWith("MHOD_LL5XUMW");
  });

  it("confirms a good scan with a haptic — the driver is looking at the van, not the screen", async () => {
    await render(<QrScanner kind="badge" onScanned={jest.fn()} onCancel={jest.fn()} />);

    await scan("fleetly:badge:MHOD_LL5XUMW");

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it("uses a distinct haptic for a code it could not accept", async () => {
    await render(<QrScanner kind="badge" onScanned={jest.fn()} onCancel={jest.fn()} />);

    await scan("fleetly:vehicle:5e808835-06a1-4938-8b99-cd77c5ab64c9");

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );
  });

  it("reports the scan succeeded in the status line", async () => {
    await render(<QrScanner kind="badge" onScanned={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText(/Point the camera/)).toBeTruthy();

    await scan("fleetly:badge:MHOD_LL5XUMW");

    expect(screen.getByText("Scanned")).toBeTruthy();
  });

  it("offers a way back to typing when permission is refused", async () => {
    mockPermissionState = { granted: false, canAskAgain: true };
    const onCancel = jest.fn();
    await render(<QrScanner kind="vehicle" onScanned={jest.fn()} onCancel={onCancel} />);

    fireEvent.press(screen.getByTestId("qr-cancel"));

    expect(onCancel).toHaveBeenCalled();
  });

  it("asks for camera permission when it can still be granted", async () => {
    mockPermissionState = { granted: false, canAskAgain: true };
    await render(<QrScanner kind="vehicle" onScanned={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByTestId("qr-grant-permission"));

    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it("points a permanently-denied driver at Settings instead of a dead button", async () => {
    mockPermissionState = { granted: false, canAskAgain: false };
    await render(<QrScanner kind="vehicle" onScanned={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.queryByTestId("qr-grant-permission")).toBeNull();
    expect(screen.getByText(/Settings/)).toBeTruthy();
  });
});
