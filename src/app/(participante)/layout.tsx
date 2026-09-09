import type { ReactNode } from "react";
import { Protegido, ShellParticipante } from "@/components/shell";

export default function LayoutParticipante({ children }: { children: ReactNode }) {
  return (
    <Protegido>
      <ShellParticipante>{children}</ShellParticipante>
    </Protegido>
  );
}
