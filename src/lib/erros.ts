/**
 * Tradução dos códigos de erro do Firebase para mensagens em português.
 * O Firebase usa `auth/invalid-credential` tanto para e-mail inexistente
 * quanto para senha errada, por isso a mensagem cobre os dois casos.
 */
export function mensagemDeErro(erro: unknown): string {
  const codigo = (erro as { code?: string })?.code ?? "";
  switch (codigo) {
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/email-already-in-use":
      return "Já existe uma conta com este e-mail. Faça login.";
    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "auth/network-request-failed":
      return "Sem conexão. Verifique sua internet.";
    case "permission-denied":
      return "Você não tem permissão para esta ação.";
    default:
      return (erro as Error)?.message ?? "Não foi possível concluir a ação.";
  }
}
