import { ImageResponse } from "next/og";
import { getGameOrThrow } from "@/lib/data";
import { shareStateOf, shareWhen, spotsPhrase } from "./share-copy";

// The picture shown when a game's link is shared, drawn per game.
//
// It has to read as a thumbnail: WhatsApp shows it around 300–400px wide, about a
// third of full size. So there are only the venue, the time and the spots, sized so
// the smallest text still clears about 12px once shrunk. The court shows how full
// the game is, the same way it does in the app.
//
// Fonts are the ImageResponse defaults on purpose. Fetching any others would put a
// network call, and a way to fail, in front of a preview with seconds to render.
//
// Colours are the light-mode values from ios.css, since an image can't read them.

export const alt = "Padel Loop game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Spots left is live data, so this must never be prerendered at build time.
export const dynamic = "force-dynamic";

const SURROUND = "#0b4a82";
const COURT = "#1262a8";
const CARD = "#ffffff";
const LABEL = "#000000";
const SECONDARY = "#60606a";
const FILL = "#e5e5ea";
const DESTRUCTIVE = "#d70015";

// Where players stand on the app's court: a near and far pair, or one each side.
const SPOTS: Record<number, [number, number][]> = {
  2: [[62, 50], [138, 50]],
  4: [[62, 27], [62, 73], [138, 27], [138, 73]],
};

function MiniCourt({ taken, places }: { taken: number; places: number }) {
  return (
    <svg width="240" height="120" viewBox="0 0 200 100">
      <rect width="200" height="100" rx="9" fill={COURT} />
      <path d="M30.5 0V100M169.5 0V100M30.5 50H169.5" fill="none" stroke="#fff" strokeOpacity=".78" strokeWidth="1.5" />
      <path d="M100 0V100" stroke="#fff" strokeWidth="2.6" />
      {(SPOTS[places] ?? SPOTS[4]).map(([x, y], i) =>
        i < taken ? (
          <circle key={i} cx={x} cy={y} r="13" fill="#fff" />
        ) : (
          <circle key={i} cx={x} cy={y} r="11.6" fill="none" stroke="#fff" strokeWidth="2.6" />
        ),
      )}
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameOrThrow(id).catch(() => undefined);

  // The game was deleted, or the read failed. A scraper that gets an error shows no
  // image at all, which looks like a broken site, so it always gets a real card, and
  // a failed read doesn't claim the game has gone.
  if (!game) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: SURROUND,
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700 }}>Padel Loop</div>
          {game === null && (
            <div style={{ display: "flex", fontSize: 52, marginTop: 24, opacity: 0.85 }}>This game is no longer listed</div>
          )}
        </div>
      ),
      { ...size, headers: cacheHeaders() },
    );
  }

  const state = shareStateOf(game);
  const cancelled = state === "cancelled";
  const open = state === "open";
  const places = game.maxPlayers === 2 ? 2 : 4;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: SURROUND,
          padding: 56,
        }}
      >
        <div
          style={{
            width: 1000,
            display: "flex",
            flexDirection: "column",
            background: CARD,
            borderRadius: 48,
            padding: "48px 56px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: COURT }}>Padel Loop</div>
            <MiniCourt taken={game.players.length + game.guestCount} places={places} />
          </div>

          {/* Two lines at most: a third would squeeze everything below it. */}
          <div
            style={{
              display: "flex",
              fontSize: 84,
              lineHeight: 1.06,
              fontWeight: 700,
              color: LABEL,
              marginTop: 16,
              maxHeight: 180,
              overflow: "hidden",
            }}
          >
            {game.venue}
          </div>

          <div style={{ display: "flex", fontSize: 44, color: SECONDARY, marginTop: 12 }}>{shareWhen(game)}</div>

          <div style={{ display: "flex", marginTop: 28 }}>
            <div
              style={{
                display: "flex",
                background: open ? COURT : FILL,
                color: open ? "#fff" : cancelled ? DESTRUCTIVE : LABEL,
                borderRadius: 999,
                padding: "14px 36px",
                fontSize: 44,
                fontWeight: 600,
              }}
            >
              {spotsPhrase(game)}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, headers: cacheHeaders() },
  );
}

/* Spots left changes as people join and leave, so this is deliberately short. It
   governs our own CDN and any repeat scrape, but can't reach a preview a chat app
   has already stored against the URL. */
function cacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  };
}
