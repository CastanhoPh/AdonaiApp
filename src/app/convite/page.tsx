"use client";

/**
 * Primeiro acesso por convite.
 *
 * O caminho antigo era torto: a pessoa criava uma conta qualquer, entrava sem
 * ver nada, e a direção depois adivinhava de quem era aquele e-mail para ligar
 * à ficha. Aqui o código já traz a ficha, então a pessoa entra com o
 * personagem, o histórico e as convocações no lugar — e a direção não precisa
 * decidir quem é quem depois do fato.
 *
 * Duas etapas de propósito. Confirmar o nome antes de pedir e-mail e senha
 * evita o pior caso desta tela: alguém preencher tudo e só no fim descobrir
 * que usou o código de outra pessoa.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { firebaseConfigurado } from "@/lib/firebase";
import { conferirConvite, mensagemDeFuncao, resgatarConvite } from "@/lib/funcoes";
import { useEnvio } from "@/lib/hooks";
import { codigoCompleto, codigoDoTexto, formatarCodigo, normalizarCodigo } from "@/lib/convite";
import { MolduraAcesso } from "@/components/acesso/moldura-acesso";
import { LerQr, suportaLeitorDeQr } from "@/components/acesso/ler-qr";
import { Aviso, Botao, Campo, Carregando, Entrada } from "@/components/ui";

export default function Convite() {
  // useSearchParams exige um limite de Suspense na renderização estática.
  return (
    <Suspense
      fallback={
        <MolduraAcesso titulo="Convite" subtitulo="Abrindo seu convite…">
          <Carregando />
        </MolduraAcesso>
      }
    >
      <ConteudoConvite />
    </Suspense>
  );
}

function ConteudoConvite() {
  const doLink = normalizarCodigo(useSearchParams().get("c") ?? "");
  const { uid, ehAdmin, carregando, entrar } = useAuth();
  const router = useRouter();
  const { enviando, erro, definirErro, enviar } = useEnvio();

  const [codigo, setCodigo] = useState(doLink);
  const [lendoQr, setLendoQr] = useState(false);
  /** Nome da ficha, depois de o código ser aceito. Nulo = ainda na etapa 1. */
  const [convidado, setConvidado] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");

  // Quem já tem sessão não precisa de convite.
  useEffect(() => {
    if (!carregando && uid) router.replace(ehAdmin ? "/admin" : "/inicio");
  }, [carregando, uid, ehAdmin, router]);

  async function conferir(qual: string) {
    const limpo = normalizarCodigo(qual);
    if (!codigoCompleto(limpo)) {
      definirErro("O código tem 8 caracteres.");
      return;
    }
    await enviar(async () => {
      try {
        const dados = await conferirConvite(limpo);
        setConvidado(dados.nome);
        setNome(dados.nome);
        setCodigo(limpo);
      } catch (falha) {
        throw new Error(mensagemDeFuncao(falha));
      }
    });
  }

  /*
   * Código que veio pelo link é conferido sozinho, uma vez.
   *
   * Quem chegou pelo QR já apontou a câmera; pedir "Continuar" em seguida
   * seria um passo sem informação nova. A trava de uma execução é necessária
   * porque `conferir` mexe em estado, e sem ela o efeito reentraria.
   */
  const jaConferiu = useRef(false);
  useEffect(() => {
    if (jaConferiu.current || !doLink || !firebaseConfigurado) return;
    jaConferiu.current = true;
    void conferir(doLink);
    // `conferir` é recriada a cada render; o guard acima é o que garante uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doLink]);

  function aoLerQr(texto: string) {
    setLendoQr(false);
    const achado = codigoDoTexto(texto);
    if (!achado) {
      definirErro("Este QR code não é de um convite do AdonaiApp.");
      return;
    }
    setCodigo(achado);
    void conferir(achado);
  }

  async function criarAcesso(evento: React.FormEvent) {
    evento.preventDefault();
    if (!nome.trim() || !email.trim() || !senha) {
      definirErro("Preencha nome, e-mail e senha.");
      return;
    }
    if (senha.length < 6) {
      definirErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      definirErro("As senhas não são iguais.");
      return;
    }
    await enviar(async () => {
      try {
        await resgatarConvite({ codigo, nome: nome.trim(), email: email.trim(), senha });
      } catch (falha) {
        throw new Error(mensagemDeFuncao(falha));
      }
      /*
       * Entra na sequência. A conta acabou de ser criada no servidor, então a
       * pessoa tem e-mail e senha em mãos e não faz sentido devolvê-la à tela
       * de login para digitar de novo o que digitou agora.
       */
      await entrar(email.trim(), senha);
      router.replace("/inicio");
    });
  }

  if (!firebaseConfigurado) {
    return (
      <MolduraAcesso
        titulo="Configuração pendente"
        subtitulo="O aplicativo precisa das chaves do projeto Firebase para funcionar."
      >
        <Aviso tom="aviso">Preencha o `.env.local` e reinicie o servidor.</Aviso>
      </MolduraAcesso>
    );
  }

  if (lendoQr) {
    return <LerQr aoLer={aoLerQr} aoFechar={() => setLendoQr(false)} />;
  }

  // ------------------------------------------------- etapa 2: os seus dados
  if (convidado !== null) {
    return (
      <MolduraAcesso
        titulo="Criar meu acesso"
        subtitulo={`Convite de ${convidado}. Confira o nome e escolha uma senha.`}
        rodape={
          <>
            Não é você?{" "}
            <button
              type="button"
              onClick={() => {
                setConvidado(null);
                definirErro(null);
              }}
              className="font-medium text-brand-strong underline"
            >
              Usar outro código
            </button>
          </>
        }
      >
        <form onSubmit={criarAcesso} className="space-y-4">
          <Campo
            etiqueta="Seu nome"
            obrigatorio
            dica="É como você aparece no elenco e nas convocações. Corrija se estiver diferente."
          >
            <Entrada
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
            />
          </Campo>

          <Campo etiqueta="Seu e-mail" obrigatorio dica="É com ele que você vai entrar.">
            <Entrada
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </Campo>

          <Campo etiqueta="Criar senha" obrigatorio dica="Mínimo de 6 caracteres.">
            <Entrada
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
            />
          </Campo>

          <Campo etiqueta="Confirmar senha" obrigatorio>
            <Entrada
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="••••••••"
            />
          </Campo>

          {erro ? <Aviso>{erro}</Aviso> : null}

          <Botao type="submit" altura="form" larguraTotal disabled={enviando}>
            {enviando ? "Criando seu acesso…" : "Criar meu acesso"}
          </Botao>
        </form>
      </MolduraAcesso>
    );
  }

  // -------------------------------------------------- etapa 1: o seu código
  return (
    <MolduraAcesso
      titulo="Tenho um convite"
      subtitulo="Escaneie o QR code ou digite o código que a direção passou."
      rodape={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-brand-strong underline">
            Entrar
          </Link>
        </>
      }
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void conferir(codigo);
        }}
        className="space-y-4"
      >
        {suportaLeitorDeQr() ? (
          <Botao
            type="button"
            variante="ghost"
            altura="form"
            larguraTotal
            onClick={() => {
              definirErro(null);
              setLendoQr(true);
            }}
            className="gap-2"
          >
            <Camera size={18} />
            Escanear QR code
          </Botao>
        ) : null}

        <Campo etiqueta="Código do convite" obrigatorio dica="Oito caracteres, como ACDE-4679.">
          <Entrada
            value={formatarCodigo(codigo)}
            onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
            placeholder="ACDE-4679"
            autoComplete="one-time-code"
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            /* Monoespaçado e espaçado: o código é lido caractere a caractere. */
            className="font-mono text-[18px] tracking-[0.16em] uppercase"
          />
        </Campo>

        {erro ? <Aviso>{erro}</Aviso> : null}

        <Botao type="submit" altura="form" larguraTotal disabled={enviando}>
          {enviando ? "Conferindo…" : "Continuar"}
        </Botao>
      </form>
    </MolduraAcesso>
  );
}
