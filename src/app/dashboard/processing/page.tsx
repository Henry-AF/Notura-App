"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid #6851FF",
          borderTopColor: "transparent",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// The dedicated processing screen was retired (NOT-78): processing now happens
// in place on the meeting details page. This page only redirects old links and
// open tabs to the new location.
function ProcessingRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const meetingId = params.get("id");

  useEffect(() => {
    router.replace(
      meetingId ? `/dashboard/meetings/${meetingId}` : "/dashboard"
    );
  }, [meetingId, router]);

  return <LoadingState />;
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProcessingRedirect />
    </Suspense>
  );
}
