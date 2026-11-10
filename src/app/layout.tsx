import "@/index.css";
import "@/App.css";
import Providers from "./providers";

export const metadata = { title: "UoH Dormitory", description: "University of Hail dormitory services" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body><Providers>{children}</Providers></body></html>;
}
