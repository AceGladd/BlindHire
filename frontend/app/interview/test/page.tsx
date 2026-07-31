"use client";

/**
 * DEV-ONLY TEST PAGE
 * Renders ArenaStage directly — bypasses password gate.
 * Route: /interview/test
 */
import dynamic from "next/dynamic";

const ArenaStage = dynamic(() => import("../[id]/ArenaStage"), { ssr: false });

export default function InterviewTestPage() {
  return <ArenaStage interviewId="test-session" />;
}
