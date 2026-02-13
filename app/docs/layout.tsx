import { Suspense } from "react";
import { DocsSidebar, DocsMobileNav } from "@/components/docs/sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex">
      {/* Desktop Sidebar */}
      <Suspense>
        <DocsSidebar />
      </Suspense>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Nav */}
        <Suspense>
          <DocsMobileNav />
        </Suspense>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
