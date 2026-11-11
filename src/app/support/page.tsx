import type { Metadata } from "next";
import LegalPage from "../legal-page";

// The words live in content/support.md, including the contact email (still a
// placeholder: see LAUNCH_CHECKLIST.md). Nothing here needs touching to change
// them — see src/app/legal-page.tsx.
export const metadata: Metadata = {
  title: "Support · Padel Loop",
  description: "How to contact Padel Loop, delete your account, report or block a player, and reset your password.",
};

export default function SupportPage() {
  return <LegalPage slug="support" />;
}
