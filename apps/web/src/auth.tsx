import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Navigate, useParams } from "react-router";
import { ApiError, api } from "./lib/api";

export type Me = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  phoneVerified: boolean;
  smsOptIn: boolean;
  timezone: string;
  platformRole: string;
  lastActiveOrgId: string | null;
  hasCalendarFeed: boolean;
};

export type OrgCard = {
  id: string;
  name: string;
  slug: string;
  type: string;
  community: string;
  role: string;
  remindersMuted: boolean;
  plan: string;
};

type AuthValue = {
  me: Me | null;
  orgs: OrgCard[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        const me = await api<Me>("/me");
        const orgs = await api<OrgCard[]>("/orgs");
        return { me, orgs };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return { me: null, orgs: [] as OrgCard[] };
        }
        throw error;
      }
    },
  });

  const value = useMemo<AuthValue>(
    () => ({
      me: session.data?.me ?? null,
      orgs: session.data?.orgs ?? [],
      loading: session.isLoading,
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: ["session"] });
      },
    }),
    [queryClient, session.data, session.isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth is missing");
  return value;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) {
    return <p className="p-4">Loading your workspace…</p>;
  }
  if (!me) return <Navigate to="/sign-in" replace />;
  return children;
}

export function useOrg(): OrgCard | null {
  const { orgSlug } = useParams();
  const { orgs } = useAuth();
  return orgs.find((org) => org.slug === orgSlug) ?? null;
}
