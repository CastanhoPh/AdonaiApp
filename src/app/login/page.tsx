"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { firebaseConfigurado } from "@/lib/firebase";
import { useEnvio } from "@/lib/hooks";
import { MolduraAcesso } from "@/components/acesso/moldura-acesso";
import { QrCode } from "@phosphor-icons/react";
import { Aviso, Botao, BotaoLink, Campo, Divisor, Entrada } from "@/components/ui";

export default function Login() {
  const { uid, ehAdmin, carregando, entrar, recuperarSenha } = useAuth();
  const router = useRouter();
  const { enviando, erro, definirErro, enviar } = useEnvio();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [recuperando, setRecuperando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Login identifica o papel e encaminha para a área correspondente.
  useEffect(() => {
    if (!carregando && uid) router.replace(ehAdmin ? "/admin" : "/inicio");
  }, [carregando, uid, ehAdmin, router]);

  async function aoEntrar(evento: React.FormEvent) {
    evento.preventDefault();
    setAviso(null);
    if (!email.trim() || !senha) {
      definirErro("Informe e-mail e senha.");
      return;
    }
    await enviar(() => entrar(email, senha));
  }

  async function aoRecuperar(evento: React.FormEvent) {
    evento.preventDefault();
    setAviso(null);
    if (!email.trim()) {
      definirErro("Informe o e-mail para receber o link de redefinição.");
      return;
    }
    const ok = await enviar(() => recuperarSenha(email));
    if (ok) {
      setAviso("Enviamos um link de redefinição para o seu e-mail.");
      setRecuperando(false);
    }
  }

  if (!firebaseConfigurado) {
    return (
      <MolduraAcesso
        titulo="Configuração pendente"
        subtitulo="O aplicativo precisa das chaves do projeto Firebase para funcionar."
      >
        <Aviso tom="aviso">
          Copie <code className="font-mono">.env.local.example</code> para{" "}
          <code className="font-mono">.env.local</code>, preencha as chaves e reinicie o servidor.
          O README traz o passo a passo.
        </Aviso>
      </MolduraAcesso>
    );
  }

  if (recuperando) {
    return (
      <MolduraAcesso
        titulo="Recuperar senha"
        subtitulo="Enviaremos um link para você criar uma nova senha."
      >
        <form onSubmit={aoRecuperar} className="space-y-4">
          <Campo etiqueta="E-mail" obrigatorio>
            <Entrada
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </Campo>

          {erro ? <Aviso>{erro}</Aviso> : null}

          <Botao type="submit" altura="form" larguraTotal disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar link"}
          </Botao>
          <button
            type="button"
            onClick={() => {
              setRecuperando(false);
              definirErro(null);
            }}
            className="w-full text-[14px] text-ink-heading hover:text-brand-strong"
          >
            Voltar para o login
          </button>
        </form>
      </MolduraAcesso>
    );
  }

  return (
    <MolduraAcesso
      titulo="Entrar"
      subtitulo="Entre para ver seu personagem, o roteiro e os próximos ensaios."
      rodape={
        <>
          Não recebeu convite?{" "}
          <Link href="/cadastro" className="font-medium text-brand-strong underline">
            Criar conta sem código
          </Link>
          <br />
          A direção liga sua conta à sua ficha depois.
        </>
      }
    >
      <form onSubmit={aoEntrar} className="space-y-4">
        <Campo etiqueta="E-mail" obrigatorio>
          <Entrada
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </Campo>

        <Campo etiqueta="Senha" obrigatorio>
          <Entrada
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
          />
        </Campo>

        {aviso ? <Aviso tom="positivo">{aviso}</Aviso> : null}
        {erro ? <Aviso>{erro}</Aviso> : null}

        <Botao type="submit" altura="form" larguraTotal disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Botao>

        <button
          type="button"
          onClick={() => {
            setRecuperando(true);
            definirErro(null);
          }}
          className="w-full text-[14px] text-ink-heading hover:text-brand-strong"
        >
          Esqueci minha senha
        </button>
      </form>

      {/*
        Primeiro acesso por convite.
        Fica na tela de entrar, e não escondido no rodapé, porque é o caminho de
        quem está abrindo o app pela primeira vez — e é justamente quem não sabe
        onde procurar. O código já carrega a ficha da pessoa, então ela entra com
        personagem e histórico no lugar em vez de esperar a direção ligar a conta.
      */}
      <div className="mt-6">
        <Divisor />
        <p className="mt-6 text-center text-[13px] leading-5 text-ink-caption">
          Recebeu um QR code ou um código da direção?
        </p>
        <div className="mt-3">
          <BotaoLink href="/convite" variante="ghost" altura="form" larguraTotal className="gap-2">
            <QrCode size={18} />
            Tenho um convite
          </BotaoLink>
        </div>
      </div>
    </MolduraAcesso>
  );
}
