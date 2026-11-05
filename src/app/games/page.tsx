import { redirect } from "next/navigation";

// The old "All games" list. Discover does this job now; any saved link lands there.
export default function GamesPage() {
  redirect("/discover");
}
