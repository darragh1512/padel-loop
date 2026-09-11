import type { Metadata } from "next";
import LegalPage from "../legal-page";

// The words live in content/privacy.md. Nothing here needs touching to change
// them — see src/app/legal-page.tsx.
export const metadata: Metadata = {
  title: "Privacy Policy · Padel Loop",
  description: "What Padel Loop holds about you, and what happens when you delete your account.",
};

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />;
}
