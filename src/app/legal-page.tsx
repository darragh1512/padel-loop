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
import LegalBack from "./legal-back";
import { marked } from "marked";
import BottomNav from "@/components/BottomNav";

export default async function LegalPage({ slug }: { slug: "terms" | "privacy" }) {
  const source = await readFile(
    join(process.cwd(), "content", `${slug}.md`),
    "utf8",
  );
  const html = await marked.parse(source);

  return (
    <main className="px-5 pt-6 relative">
      <LegalBack />

      {/* One papel poster holding the whole document. The prose styles live
          here rather than in globals.css because this is the only place in the
          app that renders markdown — everything else is hand-built JSX. */}
      <article
        className="pl-card p-5 mt-4 mb-6 text-tinta
          [&_h1]:t-display [&_h1]:text-display-sm [&_h1]:leading-tight [&_h1]:mb-4
          [&_h2]:t-display [&_h2]:text-title [&_h2]:mt-6 [&_h2]:mb-2
          [&_h3]:t-mono [&_h3]:text-label [&_h3]:tracking-[0.12em] [&_h3]:mt-5 [&_h3]:mb-1.5
          [&_p]:text-body [&_p]:font-medium [&_p]:text-tinta/80 [&_p]:leading-relaxed [&_p]:mb-3
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1
          [&_li]:text-body [&_li]:font-medium [&_li]:text-tinta/80 [&_li]:leading-relaxed
          [&_strong]:font-extrabold [&_strong]:text-tinta
          [&_em]:not-italic [&_em]:t-mono [&_em]:text-micro [&_em]:tracking-[0.1em] [&_em]:text-tinta/55
          [&_a]:text-naranja-d [&_a]:underline [&_a]:underline-offset-2
          [&_hr]:border-tinta/20 [&_hr]:my-5
          [&_code]:t-mono [&_code]:text-micro [&_code]:bg-tinta/8 [&_code]:rounded [&_code]:px-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <BottomNav />
    </main>
  );
}
