"use client";

// The top of the log-in and sign-up screens: the app's name and the court with
// its one open spot, which is what the app is for.

import { useSyncExternalStore } from "react";
import Court from "@/components/ios/Court";

const noSubscribe = () => () => {};

/* The current address's ?next=…&intent=… so moving between log-in and sign-up
   keeps hold of the game the person was joining. */
export function useAuthSearch(): string {
  return useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
}

export default function AuthHeader({ title }: { title: string }) {
  return (
    <header className="ios-auth-head">
      <div style={{ width: 132 }}>
        <Court spots={["1", "2", "3", null]} label="A padel court with one open spot" />
      </div>
      <div className="ios-eyebrow" style={{ marginTop: 14 }}>
        Padel Loop
      </div>
      <h1 className="ios-lt">{title}</h1>
      <p className="ios-sh ios-sec">Find and join a padel game near you.</p>
    </header>
  );
}
