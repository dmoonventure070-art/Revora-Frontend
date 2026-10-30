/**
 * AllocationWidget.test.tsx
 * Issue #163 – Investor Portfolio Summary: allocation widget
 * Coverage target ≥95% on AllocationWidget.tsx
 */

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllocationWidget, AllocationSlice } from "./AllocationWidget";

const SLICES: AllocationSlice[] = [
  { id: "1", label: "TechFlow AI", value: 45000, percentage: 45 },
  { id: "2", label: "Quantum Ledger", value: 30000, percentage: 30 },
  { id: "3", label: "Nexus Pay", value: 25000, percentage: 25 },
];

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_DEG = 2;
const GAP_LEN = (GAP_DEG / 360) * CIRCUMFERENCE;

function makeSlices(percentages: number[]): AllocationSlice[] {
  return percentages.map((percentage, idx) => ({
    id: String(idx + 1),
    label: `Slice ${idx + 1}`,
    value: percentage * 1000,
    percentage,
  }));
}

function getSliceCircles(container: HTMLElement): SVGCircleElement[] {
  return Array.from(container.querySelectorAll<SVGCircleElement>("svg circle[stroke-dasharray]"));
}

describe("AllocationWidget – empty state", () => {
  it("renders allocation-widget testid", () => {
    render(<AllocationWidget slices={[]} />);
    expect(screen.getByTestId("allocation-widget")).toBeInTheDocument();
  });

  it("shows 'No holdings to display' when slices is empty", () => {
    render(<AllocationWidget slices={[]} />);
    expect(screen.getByText(/No holdings to display/i)).toBeInTheDocument();
  });

  it("does not render toggle buttons when empty", () => {
    render(<AllocationWidget slices={[]} />);
    expect(screen.queryByTestId("donut-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bar-toggle")).not.toBeInTheDocument();
  });
});

describe("AllocationWidget – donut view (default)", () => {
  it("renders toggle group with accessible label", () => {
    render(<AllocationWidget slices={SLICES} />);
    expect(screen.getByRole("group", { name: /Chart view toggle/i })).toBeInTheDocument();
  });

  it("donut toggle is initially aria-pressed=true", () => {
    render(<AllocationWidget slices={SLICES} />);
    expect(screen.getByTestId("donut-toggle")).toHaveAttribute("aria-pressed", "true");
  });

  it("bar toggle is initially aria-pressed=false", () => {
    render(<AllocationWidget slices={SLICES} />);
    expect(screen.getByTestId("bar-toggle")).toHaveAttribute("aria-pressed", "false");
  });

  it("renders svg with accessible label in donut view", () => {
    render(<AllocationWidget slices={SLICES} />);
    expect(screen.getByRole("img", { name: /Donut chart showing portfolio allocation/i })).toBeInTheDocument();
  });

  it("renders legend list", () => {
    render(<AllocationWidget slices={SLICES} />);
    expect(screen.getByRole("list", { name: /Allocation legend/i })).toBeInTheDocument();
  });

  it("legend shows all slice labels", () => {
    render(<AllocationWidget slices={SLICES} />);
    expect(screen.getByText("TechFlow AI")).toBeInTheDocument();
    expect(screen.getByText("Quantum Ledger")).toBeInTheDocument();
    expect(screen.getByText("Nexus Pay")).toBeInTheDocument();
  });

  it("legend shows percentages", () => {
    render(<AllocationWidget slices={SLICES} />);
    expect(screen.getByText("45.0%")).toBeInTheDocument();
    expect(screen.getByText("30.0%")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
  });
});

describe("AllocationWidget – donut SVG geometry & dasharray/dashoffset", () => {
  it("computes correct strokeDasharray and strokeDashoffset for [50, 50] split (two half rings)", () => {
    const { container } = render(<AllocationWidget slices={makeSlices([50, 50])} />);
    const circles = getSliceCircles(container);
    expect(circles).toHaveLength(2);

    const expectedLen = (50 / 100) * CIRCUMFERENCE - GAP_LEN;
    const expectedGap = CIRCUMFERENCE - expectedLen;

    // Slice 0: starts at 0 and spans the first half ring
    expect(circles[0].getAttribute("stroke-dasharray")).toBe(`${expectedLen} ${expectedGap}`);
    expect(Number(circles[0].getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 10);

    // Slice 1: starts at -0.5 * C and spans the second half ring
    expect(circles[1].getAttribute("stroke-dasharray")).toBe(`${expectedLen} ${expectedGap}`);
    expect(Number(circles[1].getAttribute("stroke-dashoffset"))).toBeCloseTo(
      -0.5 * CIRCUMFERENCE,
      10
    );

    // Regression check: dash period of each circle must equal C (not len + C)
    for (const circle of circles) {
      const [dash, gap] = circle
        .getAttribute("stroke-dasharray")!
        .split(" ")
        .map(Number);
      expect(dash).toBeGreaterThanOrEqual(0);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(dash + gap).toBeCloseTo(CIRCUMFERENCE, 10);
    }
  });

  it("computes correct strokeDasharray and strokeDashoffset for [70, 20, 10]", () => {
    const pcts = [70, 20, 10];
    const { container } = render(<AllocationWidget slices={makeSlices(pcts)} />);
    const circles = getSliceCircles(container);
    expect(circles).toHaveLength(3);

    const expectedCumulativePct = [0, 70, 90];

    pcts.forEach((pct, i) => {
      const expectedLen = (pct / 100) * CIRCUMFERENCE - GAP_LEN;
      const expectedGap = CIRCUMFERENCE - expectedLen;
      const expectedOffset = -((expectedCumulativePct[i] / 100) * CIRCUMFERENCE);

      expect(circles[i].getAttribute("stroke-dasharray")).toBe(`${expectedLen} ${expectedGap}`);
      expect(Number(circles[i].getAttribute("stroke-dashoffset"))).toBeCloseTo(expectedOffset, 10);

      const [dash, gap] = circles[i]
        .getAttribute("stroke-dasharray")!
        .split(" ")
        .map(Number);
      expect(dash).toBeGreaterThan(0);
      expect(gap).toBeGreaterThan(0);
      expect(dash + gap).toBeCloseTo(CIRCUMFERENCE, 10);
    });
  });

  it("clamps tiny slice dash length to >= 0 for [99.7, 0.3] with no negative dash values", () => {
    const pcts = [99.7, 0.3];
    const { container } = render(<AllocationWidget slices={makeSlices(pcts)} />);
    const circles = getSliceCircles(container);
    expect(circles).toHaveLength(2);

    const len0 = Math.max(0, (99.7 / 100) * CIRCUMFERENCE - GAP_LEN);
    const len1 = Math.max(0, (0.3 / 100) * CIRCUMFERENCE - GAP_LEN);
    expect(len1).toBe(0);

    expect(circles[0].getAttribute("stroke-dasharray")).toBe(`${len0} ${CIRCUMFERENCE - len0}`);
    expect(Number(circles[0].getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 10);

    expect(circles[1].getAttribute("stroke-dasharray")).toBe(`0 ${CIRCUMFERENCE}`);
    expect(Number(circles[1].getAttribute("stroke-dashoffset"))).toBeCloseTo(
      -((99.7 / 100) * CIRCUMFERENCE),
      10
    );

    for (const circle of circles) {
      const values = circle
        .getAttribute("stroke-dasharray")!
        .split(" ")
        .map(Number);
      values.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    }
  });

  it("normalises slices whose percentages do not sum to 100 so legend and arcs match", () => {
    const unnormalised: AllocationSlice[] = [
      { id: "1", label: "Alpha", value: 25000, percentage: 25 },
      { id: "2", label: "Beta", value: 25000, percentage: 25 },
    ];
    const { container } = render(<AllocationWidget slices={unnormalised} />);

    // Legend shows normalised 50.0% for each slice
    const legend = screen.getByRole("list", { name: /Allocation legend/i });
    const pctLabels = within(legend).getAllByText("50.0%");
    expect(pctLabels).toHaveLength(2);

    // Drawn arcs match a [50, 50] split
    const circles = getSliceCircles(container);
    const expectedLen = (50 / 100) * CIRCUMFERENCE - GAP_LEN;
    expect(circles[0].getAttribute("stroke-dasharray")).toBe(
      `${expectedLen} ${CIRCUMFERENCE - expectedLen}`
    );
    expect(Number(circles[0].getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 10);
    expect(circles[1].getAttribute("stroke-dasharray")).toBe(
      `${expectedLen} ${CIRCUMFERENCE - expectedLen}`
    );
    expect(Number(circles[1].getAttribute("stroke-dashoffset"))).toBeCloseTo(
      -0.5 * CIRCUMFERENCE,
      10
    );
  });

  it("derives normalised percentages from values when input percentages are 0", () => {
    const valueOnlySlices: AllocationSlice[] = [
      { id: "1", label: "Alpha", value: 7000, percentage: 0 },
      { id: "2", label: "Beta", value: 3000, percentage: 0 },
    ];
    render(<AllocationWidget slices={valueOnlySlices} />);
    expect(screen.getByText("70.0%")).toBeInTheDocument();
    expect(screen.getByText("30.0%")).toBeInTheDocument();
  });

  it("handles slices where both percentages and values are 0", () => {
    const zeroSlices: AllocationSlice[] = [
      { id: "1", label: "Zero A", value: 0, percentage: 0 },
    ];
    const { container } = render(<AllocationWidget slices={zeroSlices} />);
    const circles = getSliceCircles(container);
    expect(circles[0].getAttribute("stroke-dasharray")).toBe(`0 ${CIRCUMFERENCE}`);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });
});

describe("AllocationWidget – bar view toggle", () => {
  it("switches to bar view on click", async () => {
    render(<AllocationWidget slices={SLICES} />);
    await userEvent.click(screen.getByTestId("bar-toggle"));
    expect(screen.getByTestId("bar-toggle")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("donut-toggle")).toHaveAttribute("aria-pressed", "false");
  });

  it("bar view shows progressbars for each slice", async () => {
    render(<AllocationWidget slices={SLICES} />);
    await userEvent.click(screen.getByTestId("bar-toggle"));
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(SLICES.length);
  });

  it("bar progressbar has correct aria-valuenow", async () => {
    render(<AllocationWidget slices={SLICES} />);
    await userEvent.click(screen.getByTestId("bar-toggle"));
    const first = screen.getAllByRole("progressbar")[0];
    expect(first).toHaveAttribute("aria-valuenow", "45");
  });

  it("bar view shows all slice labels", async () => {
    render(<AllocationWidget slices={SLICES} />);
    await userEvent.click(screen.getByTestId("bar-toggle"));
    expect(screen.getByText("TechFlow AI")).toBeInTheDocument();
  });

  it("can toggle back to donut from bar", async () => {
    render(<AllocationWidget slices={SLICES} />);
    await userEvent.click(screen.getByTestId("bar-toggle"));
    await userEvent.click(screen.getByTestId("donut-toggle"));
    expect(screen.getByRole("img", { name: /Donut chart/i })).toBeInTheDocument();
  });

  it("__initialView='bar' starts in bar view", () => {
    render(<AllocationWidget slices={SLICES} __initialView="bar" />);
    expect(screen.getByTestId("bar-toggle")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AllocationWidget – single holding", () => {
  it("renders without error with a single slice", () => {
    render(
      <AllocationWidget
        slices={[{ id: "1", label: "Solo Fund", value: 10000, percentage: 100 }]}
      />
    );
    expect(screen.getByText("Solo Fund")).toBeInTheDocument();
    expect(screen.getByText("100.0%")).toBeInTheDocument();
  });
});

describe("AllocationWidget – many holdings (overflow colours)", () => {
  const many: AllocationSlice[] = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    label: `Fund ${i + 1}`,
    value: 1000,
    percentage: 10,
  }));

  it("renders all 10 slices without error", () => {
    render(<AllocationWidget slices={many} />);
    expect(screen.getByText("Fund 10")).toBeInTheDocument();
  });

  it("switches to bar view automatically during print mode", () => {
    render(<AllocationWidget slices={SLICES} />);
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(screen.getByTestId("allocation-widget")).toHaveAttribute("data-print-view", "bar");
    expect(screen.getAllByRole("progressbar")).toHaveLength(SLICES.length);
  });
});
