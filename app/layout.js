import "./globals.css";
export const metadata = { title: "Chanpro Admin", robots: "noindex,nofollow" };
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }) {
  return <html lang="ja"><body>{children}</body></html>;
}
