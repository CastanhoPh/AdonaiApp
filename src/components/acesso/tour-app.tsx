"use client";

/**
 * Tour completo do app, aberto na primeira vez que o AdonaiApp roda instalado
 * na tela de início. É mais longo que o tutorial do navegador: passa por todas
 * as telas, mostra o destaque de fala ao vivo e, para a direção, cobre também
 * a área administrativa.
 *
 * Pode ser reaberto pela tela de Perfil.
 */
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDots,
  CaretRight,
  Certificate,
  Check,
  DiamondsFour,
  DotsThree,
  House,
  MagnifyingGlass,
  MaskHappy,
  PencilSimple,
  PuzzlePiece,
  Scroll,
  TextAa,
  User,
  UsersThree,
} from "@phosphor-icons/react";
import { marcarGuiaVisto } from "@/lib/instalacao";
import { Botao, Divisor, Eyebrow, MarcaAlianca, Tag, juntar } from "../ui";
import { ControleNotificacoes } from "../comum/notificacoes";

interface Passo {
  eyebrow: string;
  titulo: string;
  texto: string;
  conteudo?: React.ReactNode;
}

/* ------------------------------------------------------------- ingredientes */

function Linha({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-stroke-list py-3 last:border-0">
      <span className="mt-0.5 shrink-0 text-brand">{icone}</span>
      <span className="min-w-0">
        <span className="block text-[14px] leading-[21px] font-medium text-ink-heading">
          {titulo}
        </span>
        <span className="block text-[13px] leading-5 text-ink-caption">{texto}</span>
      </span>
    </li>
  );
}

/**
 * Demonstração do roteiro com os mesmos estilos da tela real: uma fala de
 * outro personagem e uma sua, destacada. É a coisa mais importante do app, e
 * explicar por texto não mostra o que a pessoa vai ver.
 */
function DemonstracaoRoteiro() {
  return (
    <div className="rounded-[8px] border border-stroke-frame bg-surface-base p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-stroke-frame pb-2.5">
        <p className="text-[13px] leading-5 font-bold text-ink-heading">Cena 3 · O retorno</p>
        <Tag tom="areia">2 falas suas</Tag>
      </div>

      <div className="flex flex-col gap-3.5">
        <p className="text-center text-[12px] leading-[18px] text-ink-caption italic">
          A estrada, ao anoitecer.
        </p>

        <div>
          <p className="eyebrow-fala mb-1 text-ink-caption">Judá, o pai</p>
          <p className="text-[15px] leading-[23px] text-ink-body">
            Ele volta, mulher. Eu sei que ele volta.
          </p>
        </div>

        <div
          className="rounded-r-[8px] border-l-[3px] border-brand px-3.5 py-3"
          style={{ background: "var(--speech-bg)" }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="eyebrow-fala text-[color:var(--color-speech-label)]">Míriam</span>
            <span className="text-[10px] leading-4 tracking-[0.12em] text-[color:var(--color-speech-label)] uppercase">
              Sua fala
            </span>
          </div>
          <p className="text-[16px] leading-6 font-medium text-ink-heading">
            Há dias que eu olho essa estrada, Judá. Há dias.
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- passos */

function montarPassos(ehAdmin: boolean): Passo[] {
  const passos: Passo[] = [
    {
      eyebrow: "Tour completo",
      titulo: "O AdonaiApp está instalado",
      texto:
        "Agora ele abre direto do ícone, em tela cheia. Vamos passar por cada tela para você saber onde está o que precisa no dia do ensaio.",
      conteudo: (
        <ul>
          <Linha
            icone={<House size={20} />}
            titulo="Quatro abas na base"
            texto="Início, Roteiro, Ensaios e Perfil. Tudo cabe nessas quatro."
          />
          <Linha
            icone={<MarcaAlianca tamanho={20} />}
            titulo="Feito para o celular"
            texto="A tela foi pensada para uma mão só, com o aparelho em pé."
          />
        </ul>
      ),
    },
    {
      eyebrow: "Aba 1 de 4",
      titulo: "Início",
      texto: "O resumo do que importa hoje. É a tela que abre quando você entra.",
      conteudo: (
        <ul>
          <Linha
            icone={<PuzzlePiece size={20} />}
            titulo="A peça atual"
            texto="Título, status, data e local da apresentação."
          />
          <Linha
            icone={<MaskHappy size={20} />}
            titulo="Seu personagem"
            texto="Nome, tipo do papel e a descrição curta. O botão leva à tela completa dele."
          />
          <Linha
            icone={<CalendarDots size={20} />}
            titulo="O próximo ensaio"
            texto="Dia, horário, local e se ele já está confirmado."
          />
          <Linha
            icone={<Certificate size={20} />}
            titulo="Dois atalhos"
            texto="Roteiro, com a contagem das suas falas, e Histórico, com quantas peças você já fez."
          />
        </ul>
      ),
    },
    {
      eyebrow: "Pelo Início",
      titulo: "Seu personagem",
      texto:
        "A tela do personagem reúne o que a direção escreveu sobre ele. Você chega nela pelo card do Início.",
      conteudo: (
        <ul>
          <Linha
            icone={<MaskHappy size={20} />}
            titulo="Descrição"
            texto="Quem é o personagem, sua história e o comportamento em cena."
          />
          <Linha
            icone={<PencilSimple size={20} />}
            titulo="Observações da direção"
            texto="Orientações de interpretação, figurino e marcação, marcadas com uma barra dourada."
          />
          <Linha
            icone={<Scroll size={20} />}
            titulo="Suas contas"
            texto="Em quantas cenas você entra e quantas falas tem na peça."
          />
        </ul>
      ),
    },
    {
      eyebrow: "Aba 2 de 4",
      titulo: "O roteiro",
      texto:
        "A tela mais usada. O roteiro completo fica visível, e as falas do seu personagem aparecem destacadas assim:",
      conteudo: (
        <div className="space-y-4">
          <DemonstracaoRoteiro />
          <ul>
            <Linha
              icone={<ArrowRight size={20} />}
              titulo="Navegador de falas"
              texto="No pé da tela, “Sua fala 2 de 14” com Anterior e Próxima. Ele rola direto até a sua fala, mesmo em outro ato."
            />
            <Linha
              icone={<MagnifyingGlass size={20} />}
              titulo="Busca"
              texto="Procure uma palavra ou o nome de um personagem para achar o trecho."
            />
            <Linha
              icone={<TextAa size={20} />}
              titulo="Tamanho da letra"
              texto="Aumente a letra quando a luz do ensaio estiver baixa."
            />
          </ul>
        </div>
      ),
    },
    {
      eyebrow: "Aba 3 de 4",
      titulo: "Ensaios",
      texto:
        "Os mais próximos primeiro; os que já passaram ficam na aba Anteriores. O próximo vem com borda dourada.",
      conteudo: (
        <ul>
          <Linha
            icone={<CalendarDots size={20} />}
            titulo="Data, horário e local"
            texto="Com o dia da semana, para não errar na pressa."
          />
          <Linha
            icone={<Check size={20} />}
            titulo="Status"
            texto="Agendado, Confirmado, Alterado, Cancelado ou Concluído. Ensaio alterado avisa em amarelo."
          />
          <Linha
            icone={<UsersThree size={20} />}
            titulo="Convocação"
            texto="Se você foi chamado, aparece uma etiqueta dizendo isso."
          />
        </ul>
      ),
    },
    {
      eyebrow: "Aba 4 de 4",
      titulo: "Histórico e perfil",
      texto:
        "O histórico guarda tudo o que você já fez no teatro, e o perfil é onde você ajusta seus dados.",
      conteudo: (
        <ul>
          <Linha
            icone={<Certificate size={20} />}
            titulo="Histórico"
            texto="As peças por ano, o personagem de cada uma e o total realizado. É preenchido quando a direção conclui uma peça."
          />
          <Linha
            icone={<User size={20} />}
            titulo="Perfil"
            texto="Telefone e foto ficam editáveis por você; o nome é da direção."
          />
        </ul>
      ),
    },
  ];

  if (ehAdmin) {
    passos.push({
      eyebrow: "Só para a direção",
      titulo: "Área da direção",
      texto:
        "Sua conta também administra o teatro. No computador ela aparece com um menu lateral; no celular, o menu vira uma faixa de ícones.",
      conteudo: (
        <ul>
          <Linha
            icone={<DiamondsFour size={20} />}
            titulo="Painel"
            texto="Participantes ativos, personagens sem ator, falas cadastradas e o próximo ensaio."
          />
          <Linha
            icone={<UsersThree size={20} />}
            titulo="Pessoas"
            texto="Cadastro, características de atuação e as observações internas — que o participante nunca vê."
          />
          <Linha
            icone={<PuzzlePiece size={20} />}
            titulo="Peças, personagens e elenco"
            texto="A escalação sugere candidatos comparando as características da pessoa com as desejadas do papel."
          />
          <Linha
            icone={<Scroll size={20} />}
            titulo="Editor de roteiro"
            texto="Atos e cenas na lateral, falas editadas na linha. Publicar cria uma versão nova para o elenco."
          />
          <Linha
            icone={<CalendarDots size={20} />}
            titulo="Ensaios"
            texto="Data, local, observações e quem está convocado."
          />
        </ul>
      ),
    });
  }

  passos.push({
    eyebrow: "Último passo",
    titulo: "Avisos de ensaio",
    texto:
      "Com a permissão dada, a direção poderá te avisar quando um ensaio for marcado, alterado ou cancelado.",
    conteudo: (
      <div className="space-y-3">
        <ControleNotificacoes larguraTotal />
        <Divisor />
        <p className="text-[12px] leading-[18px] text-ink-caption">
          O envio dos avisos ainda vai ser ligado pela direção — a permissão fica guardada até lá.
          Você pode autorizar depois pela tela de Perfil. Nenhuma outra autorização é pedida: o app
          não usa câmera, microfone nem localização.
        </p>
      </div>
    ),
  });

  return passos;
}

/* --------------------------------------------------------------------- tour */

export function TourApp({
  uid,
  ehAdmin,
  onFechar,
}: {
  uid: string;
  ehAdmin: boolean;
  onFechar: () => void;
}) {
  const passos = montarPassos(ehAdmin);
  const [indice, setIndice] = useState(0);
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

  function encerrar() {
    marcarGuiaVisto("tour", uid);
    // O tour já cobre instalação e avisos: o tutorial do navegador não
    // precisa aparecer depois dele.
    marcarGuiaVisto("tutorial", uid);
    onFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-surface-deep/85 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tour do AdonaiApp"
        className="relative flex w-full max-w-lg flex-col overflow-hidden border-stroke-frame bg-surface-card sm:max-h-[92vh] sm:rounded-[16px] sm:border"
      >
        <MarcaAlianca
          tamanho={150}
          opacidade={0.05}
          className="pointer-events-none absolute -top-8 -right-10"
        />

        <div className="relative flex-1 overflow-y-auto px-5 pt-8 pb-4 sm:pt-6">
          <Eyebrow className="text-brand-strong">{passo.eyebrow}</Eyebrow>
          <h2 className="mt-2 text-[24px] leading-7 font-bold text-ink-heading">{passo.titulo}</h2>
          <p className="mt-2 mb-5 text-[14px] leading-[21px] text-ink-body">{passo.texto}</p>
          {passo.conteudo}
        </div>

        <div className="relative border-t border-stroke-frame px-5 pt-3 pb-safe sm:pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-hidden>
              {passos.map((_, i) => (
                <span
                  key={i}
                  className={juntar(
                    "h-1.5 rounded-full transition-all",
                    i === indice ? "w-5 bg-brand" : "w-1.5 bg-stroke-frame",
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {indice > 0 ? (
                <Botao variante="ghost" onClick={() => setIndice((i) => i - 1)} className="gap-1.5">
                  <ArrowLeft size={15} />
                  Voltar
                </Botao>
              ) : (
                <Botao variante="bare" onClick={encerrar}>
                  Pular
                </Botao>
              )}

              {ultimo ? (
                <Botao onClick={encerrar} className="gap-1.5">
                  <Check size={15} />
                  Concluir
                </Botao>
              ) : (
                <Botao onClick={() => setIndice((i) => i + 1)} className="gap-1.5">
                  Continuar
                  <CaretRight size={15} />
                </Botao>
              )}
            </div>
          </div>

          <p className="mt-2 text-center text-[11px] leading-4 text-ink-caption">
            <DotsThree size={12} className="inline align-middle" /> Você pode rever este tour pela
            tela de Perfil.
          </p>
        </div>
      </div>
    </div>
  );
}
