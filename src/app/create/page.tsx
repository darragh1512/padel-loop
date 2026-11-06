import BottomNav from "@/components/BottomNav";
import CreateGameSheet from "@/components/CreateGameSheet";
import HomeDashboard from "@/components/HomeDashboard";

// Opening the address directly, such as after logging in: there's no screen to
// rise over, so the sheet sits over Home.
export default function CreateGamePage() {
  return (
    <>
      <main className="ios">
        <HomeDashboard />
        <BottomNav />
      </main>
      <CreateGameSheet />
    </>
  );
}
