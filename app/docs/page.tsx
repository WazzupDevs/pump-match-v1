"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  IntroSection,
  TrustSection,
  SquadOsSection,
  RoadmapSection,
  IntelligenceCoreV2Section,
} from "@/components/docs/content-sections";

// Content Map pattern: each tab key maps to a component.
// "grand-vision" is the canonical preferred slug; "roadmap" is the legacy alias.
const contentMap: Record<string, React.ReactNode> = {
  intro: <IntroSection />,
  "intelligence-core-v2": <IntelligenceCoreV2Section />,
  trust: <TrustSection />,
  "squad-os": <SquadOsSection />,
  roadmap: <RoadmapSection />,
  "grand-vision": <RoadmapSection />,
};

function DocsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "intro";

  return (
    <div className="py-12 px-6 lg:px-12">
      {contentMap[tab] ?? contentMap["intro"]}
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 px-6 lg:px-12">
          <div className="max-w-3xl animate-pulse space-y-4">
            <div className="h-4 w-32 rounded bg-slate-800" />
            <div className="h-10 w-80 rounded bg-slate-800" />
            <div className="h-4 w-full rounded bg-slate-800/60" />
            <div className="h-4 w-3/4 rounded bg-slate-800/40" />
          </div>
        </div>
      }
    >
      <DocsContent />
    </Suspense>
  );
}
