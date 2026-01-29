import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { StepIndicator } from "@/components/app/step-indicator";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col">
        <Header />
        <StepIndicator />
        <main className="flex-1 flex flex-col w-full">
          {children}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
