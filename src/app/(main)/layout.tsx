import { Header } from "@/components/app/header";
import { StepIndicator } from "@/components/app/step-indicator";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <StepIndicator />
      <main className="flex-1">{children}</main>
    </div>
  );
}
