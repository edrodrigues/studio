import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { StepIndicator } from "@/components/app/step-indicator";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Suspense } from "react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <Suspense fallback={<div className="h-20 border-b bg-background/70 backdrop-blur-xl" />}>
          <Header />
        </Suspense>
        <StepIndicator />
        <main id="main" className="flex w-full flex-1 flex-col">
          {children}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
