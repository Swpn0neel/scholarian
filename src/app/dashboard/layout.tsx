import { DashboardLayoutWrapper } from "@/components/dashboard/DashboardLayoutWrapper";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutWrapper>
      {children}
    </DashboardLayoutWrapper>
  );
}