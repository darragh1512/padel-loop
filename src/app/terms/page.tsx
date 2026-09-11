import type { Metadata } from "next";
import LegalPage from "../legal-page";

// The words live in content/terms.md. Nothing here needs touching to change
// them — see src/app/legal-page.tsx.
export const metadata: Metadata = {
  title: "Terms of Use · Padel Loop",
  description: "The terms you agree to when you use Padel Loop.",
};

export default function TermsPage() {
  return <LegalPage slug="terms" />;
}
