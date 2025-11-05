import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { StepIndicator } from "@/components/app/step-indicator";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="fixed top-0 left-0 w-full h-full bg-gradient-to-br from-green-300 via-blue-300 to-purple-400 dark:from-green-900 dark:via-blue-900 dark:to-purple-900 opacity-30 z-[-1]"></div>
      <Header />
      <StepIndicator />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
