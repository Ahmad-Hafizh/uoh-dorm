"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import type { SessionUser } from "@/lib/auth-client";
import Layout from "@/components/Layout";
import Login from "@/screens/Login";
import AdminDashboard from "@/screens/AdminDashboard";
import StudentDashboard from "@/screens/StudentDashboard";
import Students from "@/screens/Students";
import Staff from "@/screens/Staff";
import Complaints from "@/screens/Complaints";
import Documents from "@/screens/Documents";
import Announcements from "@/screens/Announcements";
import Permissions from "@/screens/Permissions";
import Forms from "@/screens/Forms";
import Profile from "@/screens/Profile";

const screens = {
  students: Students,
  staff: Staff,
  complaints: Complaints,
  documents: Documents,
  announcements: Announcements,
  permissions: Permissions,
  forms: Forms,
  profile: Profile,
};

type ScreenName = keyof typeof screens | "dashboard" | "login";

export default function Screen({ name }: { name: ScreenName }) {
  const { data: session, isPending } = useSession();

  // Cast to our extended type so `role` is known to TypeScript
  const user = session?.user as SessionUser | undefined;
  const role = user?.role;

  const router = useRouter();

  const forbidden =
    !!user &&
    ((name === "students" && !["ADMIN", "STAFF"].includes(role ?? "")) ||
      (name === "staff" && role !== "ADMIN"));

  useEffect(() => {
    if (isPending) return;
    if (!user && name !== "login") router.replace("/login");
    else if (user && (name === "login" || forbidden)) router.replace("/");
  }, [user, isPending, name, forbidden, router]);

  // Loading state while Better Auth resolves the session
  if (isPending) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }

  // Transitioning — keep the loading UI while router.replace() fires
  if ((!user && name !== "login") || (user && name === "login") || forbidden) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }

  if (name === "login") return <Login />;

  const Component =
    name === "dashboard"
      ? role === "STUDENT"
        ? StudentDashboard
        : AdminDashboard
      : screens[name];

  return (
    <Layout>
      <Component />
    </Layout>
  );
}
