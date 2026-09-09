import type { ReactNode } from "react";
import { Protegido, ShellAdmin } from "@/components/shell";

export default function LayoutAdmin({ children }: { children: ReactNode }) {
  return (
    <Protegido apenasAdmin>
      <ShellAdmin>{children}</ShellAdmin>
    </Protegido>
  );
}
