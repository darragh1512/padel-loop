// A plain placeholder, so the Game Page's blue header doesn't flash before the form.
export default function EditLoading() {
  return (
    <main className="ios" aria-busy="true">
      <div aria-hidden>
        <div className="ios-skel" style={{ height: 44, margin: "calc(var(--ios-top-gap) + 8px) 16px 0" }} />
        <div className="ios-skel" style={{ height: 240, margin: "16px 16px 0" }} />
      </div>
    </main>
  );
}
