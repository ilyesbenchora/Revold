export function getScoreLabel(score: number): { label: string; className: string } {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 60) return { label: "Correct", className: "bg-yellow-50 text-yellow-700 border-yellow-200" };
  if (score >= 40) return { label: "Moyen", className: "bg-orange-50 text-orange-600 border-orange-200" };
  return { label: "Faible", className: "bg-red-50 text-red-700 border-red-200" };
}

export function getBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-yellow-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-500";
}

export function getScoreTextColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function getStrokeColor(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 60) return "stroke-yellow-400";
  if (score >= 40) return "stroke-orange-400";
  return "stroke-red-500";
}
