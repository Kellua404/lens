import type { Metadata } from "next";
import { Schibsted_Grotesk, DM_Mono } from "next/font/google";
import "./globals.css";

// Schibsted Grotesk — an optical, modern grotesque: precise but human. The display/UI
// voice of the instrument (PLAN §2/§3). Deliberately distinct from the other portfolio
// projects' pairings.
const schibsted = Schibsted_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// DM Mono — a clean lab-readout monospace. Every number, id, confidence %, dimension and
// latency is set in this, so the readout reads like instrument output.
const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lens — see what the machine sees",
  description:
    "Drop in an image and watch real vision models read it: ONNX classification, Tesseract OCR, and a pixel-true palette — all running inside our own server, no Vision API, no key, $0.",
  metadataBase: new URL("https://lens.vercel.app"),
  openGraph: {
    title: "Lens — see what the machine sees",
    description:
      "Real server-side computer vision: classification + OCR + palette, self-hosted, no API.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${schibsted.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-text">{children}</body>
    </html>
  );
}
