import { ImageResponse } from "next/og";
import { getGame } from "@/lib/data";
import { shareStateOf, shareWhen, spotsPhrase } from "./share-copy";

// The link preview card, drawn per game in the peña palette.
//
// READABLE AS A THUMBNAIL, which is the actual design constraint here. This is
// not a poster that happens to be small — WhatsApp renders it around 300–400px
// wide in a chat, roughly a third of full size, and smaller again in a reply
// quote. Three rules follow from that:
//
//   1. Three elements only — venue, when, spots. Anything else is noise at
//      1/3 scale.
//   2. Type is sized so the SMALLEST element still clears ~12px once scaled:
//      the venue at 92px lands near 30px, the spots pill near 15px.
//   3. Everything sits in the middle 640px, so a platform that centre-crops to
//      a square keeps the whole card rather than slicing the venue in half.
//
// Palette straight from globals.css: pista wall, papel poster, tinta ink,
// lima for a live game, naranja-d for one nobody can join.
//
// Fonts are the ImageResponse defaults on purpose. The brand faces are loaded
// through next/font, which gives no raw font data to hand to satori, and
// fetching them from Google on every scrape would put a network call — and a
// failure mode — in front of a preview that has seconds to render. Weight and
// scale carry the identity here; the palette does the rest.

export const alt = "Padel Loop game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Spots left is live data, so this must never be prerendered at build time.
export const dynamic = "force-dynamic";

const PISTA = "#1A4FC4";
const PISTA_D = "#0F1C3F";
const PAPEL = "#F4EEE0";
const TINTA = "#10214A";
const NARANJA_D = "#C93E0F";
const LIMA = "#C6E63F";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);

  // The game was deleted, or never existed, after the link was shared. Give a
  // real card rather than a 500: a scraper that gets an error shows no image
  // at all, which looks like a broken site instead of a finished game.
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
            background: PISTA_D,
            color: PAPEL,
            fontSize: 64,
            letterSpacing: "0.02em",
          }}
        >
          <div style={{ display: "flex", fontSize: 88, fontWeight: 800 }}>
            PADEL LOOP
          </div>
          <div style={{ display: "flex", marginTop: 24, opacity: 0.85 }}>
            This game is no longer listed
          </div>
        </div>
      ),
      { ...size, headers: cacheHeaders() },
    );
  }

  const state = shareStateOf(game);
  const live = state === "open";
  // A game nobody can join reads in the dark orange; a live one in lima. The
  // colour is the fastest signal at thumbnail size — faster than the words.
  const pillBg = live ? LIMA : NARANJA_D;
  const pillFg = live ? TINTA : PAPEL;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(160deg, ${PISTA} 0%, ${PISTA_D} 100%)`,
          padding: 56,
        }}
      >
        {/* The poster. Fixed width so it stays inside a square centre-crop. */}
        <div
          style={{
            width: 940,
            display: "flex",
            flexDirection: "column",
            background: PAPEL,
            border: `10px solid ${TINTA}`,
            borderRadius: 28,
            padding: "56px 56px 48px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              letterSpacing: "0.34em",
              color: NARANJA_D,
              fontWeight: 700,
            }}
          >
            PADEL LOOP
          </div>

          {/* Venue — the one thing that must survive any amount of shrinking. */}
          <div
            style={{
              display: "flex",
              fontSize: 92,
              lineHeight: 1.04,
              fontWeight: 800,
              color: TINTA,
              marginTop: 20,
              // Two lines maximum, then clipped — a third line would shrink
              // everything below it out of legibility.
              maxHeight: 200,
              overflow: "hidden",
            }}
          >
            {game.venue}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 46,
              color: TINTA,
              opacity: 0.75,
              marginTop: 22,
            }}
          >
            {shareWhen(game)}
          </div>

          {/* Spots — colour first, words second. */}
          <div style={{ display: "flex", marginTop: 34 }}>
            <div
              style={{
                display: "flex",
                background: pillBg,
                color: pillFg,
                border: `6px solid ${TINTA}`,
                borderRadius: 999,
                padding: "16px 36px",
                fontSize: 44,
                fontWeight: 700,
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

/* Spots left changes as people join and leave, so this is deliberately short.
   It governs our own CDN and any repeat scrape — it cannot reach into a
   preview a chat app has already cached and stored against the URL. */
function cacheHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  };
}
