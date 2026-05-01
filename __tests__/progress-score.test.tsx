import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressScore } from "@/components/progress-score";

describe("ProgressScore", () => {
  it("renders label and score", () => {
    render(<ProgressScore label="Moteur Sales" score={76} colorClass="stroke-indigo-500" />);
    expect(screen.getByText("Moteur Sales")).toBeInTheDocument();
    expect(screen.getByText("76")).toBeInTheDocument();
    expect(screen.getByText(/sur 100/i)).toBeInTheDocument();
  });

  it("clamps score above 100 to 100", () => {
    render(<ProgressScore label="Test" score={150} colorClass="stroke-indigo-500" />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("clamps score below 0 to 0", () => {
    render(<ProgressScore label="Test" score={-10} colorClass="stroke-indigo-500" />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders SVG circle", () => {
    const { container } = render(
      <ProgressScore label="Test" score={50} colorClass="stroke-indigo-500" />,
    );
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });
});
