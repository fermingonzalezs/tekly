import { Topbar } from "@/components/topbar";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Topbar title={title} />
      <main className="p-8">{children}</main>
    </>
  );
}
