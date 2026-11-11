"use client";
// Settings (/profile): your account, the screens that have no tab of their own,
// blocked players, the legal pages and Support, logging out and deleting your account. What
// you edit about yourself lives on your profile, in Edit Profile.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Icon, { type IconName } from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import PageTitle from "@/components/ios/PageTitle";
import { resetAnalytics } from "@/lib/analytics";
import { supabase } from "@/lib/supabaseClient";
import { getSignedInUser } from "@/lib/session";
import { getProfile, type Profile } from "../profiles";
import BlockedList from "./blocked-list";
import DeleteAccountSheet from "./delete-account";

function Row({ href, label, icon }: { href: string; label: string; icon?: IconName }) {
  return (
    <Link href={href} className="ios-row ios-link" style={{ "--ios-inset": icon ? "52px" : "16px" } as React.CSSProperties}>
      {icon && (
        <span className="ios-rico">
          <Icon name={icon} size={22} />
        </span>
      )}
      <span className="ios-bd ios-grow">{label}</span>
      <span className="ios-chev">
        <Icon name="chevron-right" size={13} />
      </span>
    </Link>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      // Everything here works without the name and photo, so a failed read
      // only leaves them out.
      const found = await getProfile(data.user.id).catch(() => null);
      if (!active) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);
      setProfile(found);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutFailed(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Still signed in, so going to the log in screen would be misleading.
      setLogoutFailed(true);
      setLoggingOut(false);
      return;
    }
    // Stop attributing this device to them: the next person to sign in on a
    // shared phone must not be counted as the same person.
    resetAnalytics();
    router.push("/login");
  }

  return (
    <main className="ios">
      <PageTitle title="Settings" fallback={userId ? `/players/${userId}` : "/"} />

      {loading ? (
        <div aria-hidden>
          <div className="ios-skel" style={{ height: 68, margin: "16px 16px 0" }} />
          <div className="ios-skel" style={{ height: 104, margin: "16px 16px 0" }} />
        </div>
      ) : (
        <>
          <div className="ios-list" style={{ marginTop: 16 }}>
            <Link href={`/players/${userId}`} className="ios-row ios-link" style={{ padding: "10px 16px" }}>
              <Monogram name={profile?.name || email} photoUrl={profile?.avatar_url} size={48} />
              <div className="ios-grow">
                <div className="ios-hl ios-clip">{profile?.name || "Your Profile"}</div>
                {email && <div className="ios-fn ios-sec ios-clip">{email}</div>}
              </div>
              <span className="ios-chev">
                <Icon name="chevron-right" size={13} />
              </span>
            </Link>
          </div>

          <div className="ios-list" style={{ marginTop: 16 }}>
            <Row href="/notifications" label="Notifications" icon="bell" />
            <Row href="/my-games" label="My Games" icon="calendar" />
          </div>

          <BlockedList userId={userId} />

          <div className="ios-list" style={{ marginTop: 16 }}>
            <Row href="/terms" label="Terms of Use" />
            <Row href="/privacy" label="Privacy Policy" />
            <Row href="/support" label="Support" />
          </div>

          <div className="ios-list" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="ios-row ios-toggle-row ios-bd"
              style={{ justifyContent: "center", textAlign: "center", color: "var(--ios-destructive)" }}
              disabled={loggingOut}
              aria-busy={loggingOut || undefined}
              onClick={handleLogout}
            >
              {loggingOut ? "Logging Out…" : "Log Out"}
            </button>
          </div>
          {logoutFailed && (
            <p className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
              Couldn’t log you out. Check your connection and try again.
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button type="button" className="ios-text-btn ios-fn ios-sec" onClick={() => setDeleting(true)}>
              Delete Account
            </button>
          </div>
        </>
      )}

      {deleting && <DeleteAccountSheet onClose={() => setDeleting(false)} />}

      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
