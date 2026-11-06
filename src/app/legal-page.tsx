// Renders one markdown file from /content as a page.
//
// THE POINT: the words live in `content/*.md` and nothing else. Editing the
// terms or the privacy policy means editing that file — no component, no JSX,
// no risk of breaking a screen while rewording a clause. (It still needs a
// push, since the file is in the repo and Vercel builds on push; what it does
// not need is a code change.)
//
// The read happens at BUILD time, not per request: this is a plain server
// component with no dynamic APIs, so Next prerenders it and bakes the HTML in.
// That also sidesteps runtime file-tracing, which is the usual way
// filesystem reads break once deployed.
//
// On dangerouslySetInnerHTML: the source is a file in this repository, written
// by us, and it never contains anything a user typed. That is the only reason
// this is safe. If these pages ever render content from the database, this has
// to be sanitised first.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";
import BottomNav from "@/components/BottomNav";
import PageTitle from "@/components/ios/PageTitle";

export default async function LegalPage({ slug }: { slug: "terms" | "privacy" }) {
  const source = await readFile(join(process.cwd(), "content", `${slug}.md`), "utf8");
  const html = await marked.parse(source);

  // The file's own heading becomes the page title, so it isn't shown twice.
  const heading = /<h1[^>]*>(.*?)<\/h1>/.exec(html);
  const title = heading?.[1] ?? "Padel Loop";
  const body = heading ? html.replace(heading[0], "") : html;

  return (
    <main className="ios">
      {/* From sign-up, Back returns to the half-filled form. Opened from a link,
          there's nowhere to go back to, so it goes to Settings. */}
      <PageTitle title={title} fallback="/profile" />
      <article className="ios-card ios-prose" style={{ marginTop: 16, padding: "4px 20px 20px" }} dangerouslySetInnerHTML={{ __html: body }} />
      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
