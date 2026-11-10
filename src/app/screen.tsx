"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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
const screens = { students: Students, staff: Staff, complaints: Complaints, documents: Documents, announcements: Announcements, permissions: Permissions, forms: Forms, profile: Profile };
type ScreenName = keyof typeof screens | "dashboard" | "login";
export default function Screen({ name }: { name: ScreenName }) {
  const { user } = useAuth();
  const router = useRouter();
  const forbidden = user && ((name === "students" && !["admin", "staff"].includes(user.role)) || (name === "staff" && user.role !== "admin"));
  useEffect(() => {
    if (user === false && name !== "login") router.replace("/login");
    else if (user && (name === "login" || forbidden)) router.replace("/");
  }, [user, name, forbidden, router]);
  if (user === null || (name !== "login" && !user) || (name === "login" && user) || forbidden) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (name === "login") return <Login />;
  const Component = name === "dashboard" ? (user && user.role === "student" ? StudentDashboard : AdminDashboard) : screens[name];
  return <Layout><Component /></Layout>;
}
