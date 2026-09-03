import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { VehicleDamageRegister, isOpen, orderDamage } from "./vehicle-damage-register";
import { listDamage, type DamageSummary } from "@/lib/damage";

// Mocked outright rather than via requireActual: the real module pulls
// in api.ts -> crypto.ts -> @noble/curves, which ships ESM that jest
// does not transform. Nothing here needs it — listDamage is the only
// runtime export in play, and the rest are types, which are erased.
jest.mock("@/lib/damage", () => ({ listDamage: jest.fn() }));

const mockListDamage = listDamage as jest.MockedFunction<typeof listDamage>;

function damage(overrides: Partial<DamageSummary> = {}): DamageSummary {
  return {
    id: "d1",
    vehicleId: "v1",
    tripId: null,
    reportedPhase: null,
    status: "reported",
    view: "front",
    positionX: 0.5,
    positionY: 0.5,
    reportedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function renderRegister(props: Partial<Parameters<typeof VehicleDamageRegister>[0]> = {}) {
  const onConfirm = jest.fn();
  const onReportNew = jest.fn();
  const onCancel = jest.fn();
  await act(async () => {
    render(
      <VehicleDamageRegister
        vehicleId="v1"
        plate="TEST-001"
        onConfirm={onConfirm}
        onReportNew={onReportNew}
        onCancel={onCancel}
        {...props}
      />,
    );
  });
  return { onConfirm, onReportNew, onCancel };
}

describe("orderDamage", () => {
  it("keeps only what still stands against the vehicle", () => {
    // Dismissed means a dispatcher decided it was not real; repaired
    // means it is gone. Asking a driver to confirm either would be
    // asking them to agree to something false.
    const rows = [
      damage({ id: "open", status: "reported" }),
      damage({ id: "accepted", status: "accepted" }),
      damage({ id: "dismissed", status: "dismissed" }),
      damage({ id: "repaired", status: "repaired" }),
    ];
    expect(orderDamage(rows).map((d) => d.id)).toEqual(["open", "accepted"]);
  });

  it("numbers oldest first, so a mark keeps its number while it is open", () => {
    const rows = [
      damage({ id: "newer", reportedAt: "2026-03-01T00:00:00.000Z" }),
      damage({ id: "older", reportedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(orderDamage(rows).map((d) => d.id)).toEqual(["older", "newer"]);
  });

  it("does not mutate the caller's array", () => {
    const rows = [
      damage({ id: "b", reportedAt: "2026-03-01T00:00:00.000Z" }),
      damage({ id: "a", reportedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    orderDamage(rows);
    expect(rows.map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("treats reported and accepted as open, nothing else", () => {
    expect(isOpen(damage({ status: "reported" }))).toBe(true);
    expect(isOpen(damage({ status: "accepted" }))).toBe(true);
    expect(isOpen(damage({ status: "dismissed" }))).toBe(false);
    expect(isOpen(damage({ status: "repaired" }))).toBe(false);
  });
});

describe("VehicleDamageRegister", () => {
  beforeEach(() => mockListDamage.mockReset());

  it("shows a marker per open damage, numbered from one", async () => {
    mockListDamage.mockResolvedValue([
      damage({ id: "a", view: "front", reportedAt: "2026-01-01T00:00:00.000Z" }),
      damage({ id: "b", view: "left", reportedAt: "2026-02-01T00:00:00.000Z" }),
    ]);
    await renderRegister();

    expect(screen.getByTestId("damage-marker-1")).toBeTruthy();
    expect(screen.getByTestId("damage-marker-2")).toBeTruthy();
    expect(screen.getByText("2 damage recorded")).toBeTruthy();
  });

  it("gives the list the same numbers as the diagram", async () => {
    // The whole point of the two tabs is that a driver can move between
    // them; numbers that disagreed would make that actively misleading.
    mockListDamage.mockResolvedValue([
      damage({ id: "a", view: "front", reportedAt: "2026-01-01T00:00:00.000Z" }),
      damage({ id: "b", view: "rear", reportedAt: "2026-02-01T00:00:00.000Z" }),
    ]);
    await renderRegister();

    // Awaited: this is the one press here that asserts on re-rendered
    // output rather than on a callback, and RNTL 14 renders concurrently.
    await act(async () => {
      fireEvent.press(screen.getByTestId("register-tab-list"));
    });

    expect(screen.getByTestId("damage-row-1")).toBeTruthy();
    expect(screen.getByTestId("damage-row-2")).toBeTruthy();
  });

  it("confirms with the exact ids it displayed, not a count", async () => {
    mockListDamage.mockResolvedValue([
      damage({ id: "a", reportedAt: "2026-01-01T00:00:00.000Z" }),
      damage({ id: "b", reportedAt: "2026-02-01T00:00:00.000Z" }),
      damage({ id: "dismissed", status: "dismissed" }),
    ]);
    const { onConfirm } = await renderRegister();

    fireEvent.press(screen.getByTestId("register-confirm"));

    expect(onConfirm).toHaveBeenCalledWith(["a", "b"]);
  });

  it("confirms an empty set when the vehicle is clean", async () => {
    mockListDamage.mockResolvedValue([]);
    const { onConfirm } = await renderRegister();

    expect(screen.getByText("No damage recorded")).toBeTruthy();
    fireEvent.press(screen.getByTestId("register-confirm"));

    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it("hides the view toggle when there is nothing to show either way", async () => {
    mockListDamage.mockResolvedValue([]);
    await renderRegister();

    expect(screen.queryByTestId("register-tab-list")).toBeNull();
  });

  it("routes the report button to the damage form", async () => {
    mockListDamage.mockResolvedValue([damage()]);
    const { onReportNew } = await renderRegister();

    fireEvent.press(screen.getByTestId("register-report-new"));

    expect(onReportNew).toHaveBeenCalled();
  });

  it("surfaces a failed load instead of showing an empty register", async () => {
    // Silently showing "no damage" when the fetch failed would invite a
    // driver to confirm a clean vehicle they never actually saw.
    mockListDamage.mockRejectedValue(new Error("Network request failed"));
    await renderRegister();

    expect(screen.getByText("Network request failed")).toBeTruthy();
    expect(screen.queryByTestId("register-confirm")).toBeNull();
  });
});
