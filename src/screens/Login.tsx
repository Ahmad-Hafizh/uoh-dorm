"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, Globe, Building2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const HERO_IMAGE = "https://images.unsplash.com/photo-1700085060165-1ac17cf08286?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxzYXVkaSUyMGFyYWJpYSUyMHVuaXZlcnNpdHklMjBidWlsZGluZ3xlbnwwfHx8fDE3ODUxNjY2MDR8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const [email, setEmail] = useState("admin@uoh.edu.sa");
  const [password, setPassword] = useState("demo");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      toast.success(t("sign_in") + " ✓");
      router.push("/");
    } else {
      toast.error(res.error || t("invalid_credentials"));
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Visual side */}
      <div className="relative hidden lg:block overflow-hidden">
        <img src={HERO_IMAGE} alt="University of Hail" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/85 via-primary/40 to-transparent" />
        <div className="absolute inset-0 bg-grid opacity-40 mix-blend-overlay" />
        <div className="relative h-full flex flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="text-lg font-bold tracking-tight">University of Hail</div>
          </div>
          <div className="max-w-md space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
              {t("app_full")}
            </h1>
            <p className="text-white/85 text-base leading-relaxed">{t("tagline")}</p>
            <div className="flex gap-6 pt-4 text-sm">
              <div><div className="text-2xl font-bold">120+</div><div className="text-white/70">Students</div></div>
              <div><div className="text-2xl font-bold">15</div><div className="text-white/70">Nationalities</div></div>
              <div><div className="text-2xl font-bold">3</div><div className="text-white/70">Buildings</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex flex-col justify-center px-6 sm:px-14 py-10 relative">
        <div className="absolute top-6 end-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="login-lang-switcher">
                <Globe className="h-4 w-4" />
                <span className="text-xs font-semibold">{lang.toUpperCase()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLang("en")}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang("ar")}>العربية</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">H</div>
            <div>
              <div className="text-sm font-bold">{t("app_name")}</div>
              <div className="text-xs text-muted-foreground">{t("tagline")}</div>
            </div>
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{t("login_title")}</h2>
            <p className="text-muted-foreground mt-2">{t("login_subtitle")}</p>
          </div>

          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="demo-accounts">
              <p className="text-sm font-semibold">Local demo · بيانات تجريبية</p>
              <p className="mt-1 text-xs text-muted-foreground">Choose a role. Any non-empty password works for these fictional accounts.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["admin", "staff", "student"] as const).map(role => <Button type="button" key={role} variant="outline" size="sm" onClick={() => { setEmail(`${role}@uoh.edu.sa`); setPassword("demo"); }}>{role}</Button>)}
              </div>
            </div>
            <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password" type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 gap-2" data-testid="login-submit">
              <LogIn className="h-4 w-4" />
              {loading ? "…" : t("sign_in")}
            </Button>
          </form>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-muted-foreground space-y-1">
            <div className="font-semibold text-slate-700">Demo accounts</div>
            <div>Admin · admin@uoh.edu.sa</div>
            <div>Staff · staff@uoh.edu.sa</div>
            <div>Student · student@uoh.edu.sa</div>
          </div>
        </div>
      </div>
    </div>
  );
}
