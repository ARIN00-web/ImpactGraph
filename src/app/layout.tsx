import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ImpactGraph",
  description: "Predict what a PR could break, with the code to prove it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full"
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
  try {
    var saved = localStorage.getItem("impactgraph-theme");
    var theme = saved === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    document.documentElement.style.colorScheme = theme;
  } catch(e) {}
})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--g)] text-[var(--t)] font-sans antialiased selection:bg-[var(--a)] selection:text-[var(--a-text)]">
        {children}
      </body>
    </html>
  );
}
