"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEnvio } from "@/lib/hooks";
import { MolduraAcesso } from "@/components/acesso/moldura-acesso";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";

export default function Cadastro() {
  const { usuario, carregando, cadastrar } = useAuth();
  const router = useRouter();
  const { enviando, erro, definirErro, enviar } = useEnvio();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");

  useEffect(() => {
    if (!carregando && usuario) router.replace("/inicio");
  }, [carregando, usuario, router]);

  async function aoCadastrar(evento: React.FormEvent) {
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
    await enviar(() => cadastrar(nome, email, senha));
  }

  return (
    <MolduraAcesso
      titulo="Criar conta"
      subtitulo="Use o mesmo e-mail que você informou à direção do teatro."
      rodape={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-brand-strong underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={aoCadastrar} className="space-y-4">
        <Campo etiqueta="Nome completo" obrigatorio>
          <Entrada
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
          />
        </Campo>

        <Campo
          etiqueta="E-mail"
          obrigatorio
          dica="Se a direção já cadastrou você, o vínculo com seu personagem é automático."
        >
          <Entrada
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </Campo>

        <Campo etiqueta="Senha" obrigatorio dica="Mínimo de 6 caracteres.">
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
          {enviando ? "Criando conta…" : "Criar conta"}
        </Botao>
      </form>
    </MolduraAcesso>
  );
}
