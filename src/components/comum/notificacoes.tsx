"use client";

/**
 * Controle da permissão de notificação, usado no tutorial de primeiro acesso e
 * na tela de Perfil. Concentra aqui a máquina de estados do navegador para as
 * duas telas não divergirem.
 */
import { useState } from "react";
import { BellRinging, BellSlash, CheckCircle } from "@phosphor-icons/react";
import {
  estadoDasNotificacoes,
  pedirNotificacoes,
  type EstadoNotificacoes,
} from "@/lib/instalacao";
import { pushConfigurado, registrarAparelho } from "@/lib/notificacoes";
import { useAuth } from "@/lib/auth-context";
import { Botao, Tag } from "../ui";

export function ControleNotificacoes({
  larguraTotal = false,
  onMudar,
}: {
  larguraTotal?: boolean;
  onMudar?: (estado: EstadoNotificacoes) => void;
}) {
  // Só monta em árvore já hidratada (dentro de `Protegido`), então pode ler o
  // estado do navegador direto no valor inicial.
  /*
   * `uid`, não `usuario`.
   *
   * Desde que o app passou a abrir com a última sessão conhecida, `usuario` —
   * o objeto confirmado pelo Firebase — fica nulo nos primeiros instantes.
   * Quem tocasse em "Permitir avisos" nessa janela via "Avisos autorizados" e
   * não era registrado em lugar nenhum: permissão dada, aparelho de fora da
   * lista, e nada na tela dizendo isso. `uid` vale desde o primeiro quadro, e
   * a gravação espera a sessão de qualquer jeito, dentro do próprio SDK.
   */
  const { uid } = useAuth();
  const [estado, setEstado] = useState<EstadoNotificacoes>(() => estadoDasNotificacoes());
  const [pedindo, setPedindo] = useState(false);

  async function autorizar() {
    setPedindo(true);
    const resultado = await pedirNotificacoes();
    // Com a permissão dada, o aparelho já entra na lista de destinatários.
    if (resultado === "granted" && uid) await registrarAparelho(uid);
    setEstado(resultado);
    setPedindo(false);
    onMudar?.(resultado);
  }

  if (estado === "granted") {
    return (
      <div className="space-y-2">
        <Tag tom="positivo">
          <CheckCircle size={13} />
          Avisos autorizados
        </Tag>
        <p className="text-[12px] leading-[18px] text-ink-caption">
          {pushConfigurado
            ? "Este aparelho está na lista de quem recebe os avisos da direção. Para desligar, use as configurações do site no navegador."
            : "Falta a chave de push do projeto para os avisos saírem de fato — a permissão já fica guardada."}
        </p>
      </div>
    );
  }

  if (estado === "denied") {
    return (
      <div className="space-y-2">
        <Tag tom="aviso">
          <BellSlash size={13} />
          Avisos bloqueados
        </Tag>
        <p className="text-[12px] leading-[18px] text-ink-caption">
          O navegador guardou a recusa, então o app não pode perguntar de novo. Libere nas
          configurações do site — no celular, toque no ícone ao lado do endereço e permita as
          notificações do AdonaiApp.
        </p>
      </div>
    );
  }

  if (estado === "indisponivel") {
    return (
      <p className="text-[12px] leading-[18px] text-ink-caption">
        Este navegador não oferece notificações. Os ensaios continuam na aba Ensaios.
      </p>
    );
  }

  return (
    <Botao
      onClick={() => void autorizar()}
      disabled={pedindo}
      larguraTotal={larguraTotal}
      className="gap-1.5"
    >
      <BellRinging size={17} />
      {pedindo ? "Aguardando…" : "Permitir avisos de ensaio"}
    </Botao>
  );
}
