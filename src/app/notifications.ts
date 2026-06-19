// Reads and updates the logged-in person's notifications (the "notifications"
// table). Each row is one alert addressed to one user (user_id), optionally
// about one game (game_id), with the text (message), whether it's been seen
// (is_read), and when it arrived (created_at).
//
// IMPORTANT: the notifications table has Row Level Security, so the database
// only ever returns rows belonging to the signed-in user. That means these
// queries are automatically limited to "my own" notifications — no one can
// read anyone else's.

import { supabase } from "@/lib/supabaseClient";

// One notification, matching the columns in the "notifications" table.
export type Notification = {
  id: number;
  user_id: string;
  game_id: number | null; // which game it's about (null = not tied to a game)
  type: string; // kind of alert, e.g. "game_full"
  message: string; // the text the person reads
  is_read: boolean; // have they seen it yet
  created_at: string; // when it arrived (ISO timestamp)
};

// Get the logged-in user's notifications, newest first.
export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load notifications:", error.message);
    return [];
  }
  return (data ?? []) as Notification[];
}

// Count how many of the user's notifications are still unread (for the badge).
// `head: true` asks Supabase for just the count, not the rows themselves.
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Could not count notifications:", error.message);
    return 0;
  }
  return count ?? 0;
}

// Mark all of the user's unread notifications as read. Called when they open
// the notifications screen, so the badge clears once they've seen them.
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Could not mark notifications read:", error.message);
  }
}
