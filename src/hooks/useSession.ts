import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccessProfiles, getMyProfile } from "@/features/core/api";
import type { AccessProfile, Profile, UserAccessProfile } from "@/types/domain";

export interface SessionState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  accessProfiles: UserAccessProfile[];
  profileKeys: AccessProfile[];
  isAdmin: boolean;
  isChurchLeader: boolean;
  isDepartmentLeader: boolean;
  isViewerOnly: boolean;
  churchScopeIds: string[];
  departmentScopeIds: string[];
}

/**
 * Usuário logado, perfis de acesso (user_access_profiles) e flags derivadas.
 * O perfil de acesso é independente da qualificação ministerial — nunca lido
 * de `profiles`, sempre da tabela separada `user_access_profiles`.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const profileQuery = useQuery({
    queryKey: ["session", "profile", userId],
    queryFn: () => getMyProfile(userId as string),
    enabled: !!userId,
  });

  const accessQuery = useQuery({
    queryKey: ["session", "access-profiles", userId],
    queryFn: () => getMyAccessProfiles(userId as string),
    enabled: !!userId,
  });

  const accessProfiles = accessQuery.data ?? [];
  const profileKeys = accessProfiles.map((p) => p.profile);

  return {
    loading: authLoading || (!!userId && (profileQuery.isLoading || accessQuery.isLoading)),
    user: session?.user ?? null,
    session,
    profile: profileQuery.data ?? null,
    accessProfiles,
    profileKeys,
    isAdmin: profileKeys.includes("pastor_admin"),
    isChurchLeader: profileKeys.includes("church_leader"),
    isDepartmentLeader: profileKeys.includes("department_leader"),
    isViewerOnly: profileKeys.length > 0 && profileKeys.every((p) => p === "ministerial_viewer"),
    churchScopeIds: accessProfiles.filter((p) => p.church_id).map((p) => p.church_id as string),
    departmentScopeIds: accessProfiles.filter((p) => p.department_id).map((p) => p.department_id as string),
  };
}
