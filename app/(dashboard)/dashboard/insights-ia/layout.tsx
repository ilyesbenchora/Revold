import type { ReactNode } from "react";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { CoachingHeader } from "@/components/coaching-header";

export default async function CoachingLayout({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-6">
      <CoachingHeader />

      {children}

      <InsightLockedBlock />
    </section>
  );
}
