import { db, unwrap } from "@/services/supabase";
import { insertRow, updateRow } from "@/features/core/api";
import type { InAppNotification, UUID } from "@/types/domain";

export async function listInAppNotifications(userId: UUID): Promise<InAppNotification[]> {
  return unwrap(
    await db.from("in_app_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
  ) as InAppNotification[];
}

export async function countUnreadNotifications(userId: UUID): Promise<number> {
  const result = await db
    .from("in_app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return result.count ?? 0;
}

export function markNotificationRead(id: UUID): Promise<InAppNotification> {
  return updateRow<InAppNotification>("in_app_notifications", id, { read_at: new Date().toISOString() });
}

export async function markAllNotificationsRead(userId: UUID): Promise<void> {
  unwrap(
    await db
      .from("in_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null),
  );
}

export function createInAppNotification(
  values: Partial<InAppNotification> & { user_id: UUID; title: string; message: string },
): Promise<InAppNotification> {
  return insertRow<InAppNotification>("in_app_notifications", values);
}
