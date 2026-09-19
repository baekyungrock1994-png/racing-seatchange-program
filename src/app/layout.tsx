import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🏎️ 레이싱 자리바꾸기 | Racing Seat Change",
  description: "교실 자리 바꾸기를 흥미진진한 실시간 카트 레이싱 배틀로!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full bg-slate-950 text-white">
      <body className="min-h-full flex flex-col antialiased bg-slate-950 text-white">
        {children}
      </body>
    </html>
  );
}
