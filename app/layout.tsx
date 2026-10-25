import type { Metadata } from "next";
import "./path.css";
import "./independent.css";
import "./flashcards.css";
import "./lessons.css";

export const metadata: Metadata = {
  title: "IELTS Path — tu próximo nivel",
  description: "Reading y Writing con una ruta personal, práctica deliberada y resultados medibles. Objetivo: 7.5+.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
