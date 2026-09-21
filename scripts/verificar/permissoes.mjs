/**
 * O que um participante consegue ler e escrever, de fato.
 *
 * Roda contra a produção, e por isso obedece a uma regra: **toda escrita aqui
 * tem de ser uma escrita que deve falhar.** Gravação negada não muda nada, e
 * um teste de permissão que altera dado de alguém é pior que não ter teste.
 *
 * Há uma única exceção, marcada como tal: a regra de `ativo` só pode ser
 * exercida com um valor diferente do que está lá, senão o teste passa de
 * graça (ver abaixo). Essa passa pelo `comRestauracao`, que lê o valor antes e
 * o devolve num `finally`, aconteça o que acontecer.
 *
 * ## A armadilha que esta suíte existe para não repetir
 *
 * As regras usam `diff().affectedKeys().hasOnly([...])`. Uma gravação que põe
 * o mesmo valor que já estava **não afeta chave nenhuma**, e `hasOnly` de
 * lista vazia é verdadeiro. Mandar `ativo: true` numa ficha já ativa passa —
 * e o teste conclui que a regra está aberta quando ela está fechada. Todo
 * valor daqui é escolhido para ser diferente do que está gravado.
 */
import { auth, db } from "../firebase-admin-app.mjs";
import { BUCKET, FIRESTORE } from "./ambiente.mjs";
import { contaDoPapel, entrarComo } from "./sessao.mjs";
import { criarCaderno } from "./relatorio.mjs";

export const nome = "permissoes";
export const titulo = "Permissões vistas por um participante";

const texto = (v) => ({ stringValue: v });
const logico = (v) => ({ booleanValue: v });
/** Único a cada execução: garante que a gravação testada muda algo de fato. */
const inedito = () => `verificacao-${Date.now()}`;

export async function rodar() {
  const { achados, anotar } = criarCaderno();

  const conta = await contaDoPapel("participante");
  const sessao = await entrarComo(conta.uid);
  const cabecalho = {
    authorization: `Bearer ${sessao.idToken}`,
    "content-type": "application/json",
  };

  const eu = conta.personId;
  if (!eu) throw new Error(`A conta ${conta.email} não está ligada a nenhuma ficha.`);
  const outraPessoa = (await db.collection("people").get()).docs.find((d) => d.id !== eu).id;
  const algumaPeca = (await db.collection("plays").get()).docs[0].id;

  const ler = (caminho) => () => fetch(`${FIRESTORE}/${caminho}`, { headers: cabecalho });
  const listar = (colecao) => () =>
    fetch(`${FIRESTORE}/${colecao}?pageSize=1`, { headers: cabecalho });
  const gravar = (caminho, campos) => () =>
    fetch(
      `${FIRESTORE}/${caminho}?` +
        Object.keys(campos).map((c) => `updateMask.fieldPaths=${c}`).join("&"),
      { method: "PATCH", headers: cabecalho, body: JSON.stringify({ fields: campos }) },
    );
  const subir = (caminho) => () =>
    fetch(
      `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(caminho)}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${sessao.idToken}`, "content-type": "image/jpeg" },
        body: Buffer.from("isto nao deve passar"),
      },
    );

  const linhas = [];
  async function checar(oQue, esperado, acao) {
    let obtido;
    try {
      const r = await acao();
      obtido =
        r.status === 200 || r.status === 204
          ? "pode"
          : r.status === 401 || r.status === 403
            ? "negado"
            : `HTTP ${r.status}`;
    } catch (erro) {
      obtido = `erro: ${erro.message}`;
    }
    const ok = obtido === esperado;
    linhas.push({ oQue, esperado, obtido, ok });
    /*
     * As duas direções são graves, e a segunda engana.
     *
     * "Deveria ser negado e passou" é buraco de segurança, e ninguém discute.
     * "Deveria poder e foi negado" parece menor e não é: foi assim que a troca
     * de foto quebrou — um campo faltando na lista das regras fez o Firestore
     * recusar a gravação inteira, sem erro visível, e a foto do Davi subia sem
     * a ficha atualizar. Regra apertada demais quebra o app em silêncio.
     */
    if (!ok) {
      anotar(
        "alta",
        oQue,
        esperado === "negado"
          ? `deveria ser negado e foi ${obtido}`
          : `deveria poder e foi ${obtido}`,
      );
    }
  }

  /* -------------------------------------------------------------- leitura */
  await checar("ler a própria ficha", "pode", ler(`people/${eu}`));
  await checar("ler a ficha de outra pessoa", "pode", ler(`people/${outraPessoa}`));
  await checar("ler o próprio contato", "pode", ler(`people/${eu}/privado/contato`));
  await checar("ler o contato de outra pessoa", "negado", ler(`people/${outraPessoa}/privado/contato`));
  await checar("ler as observações da direção sobre si", "negado", ler(`people/${eu}/privado/direcao`));
  await checar("ler a própria conta", "pode", ler(`users/${conta.uid}`));
  await checar("listar as contas do elenco", "negado", listar("users"));
  await checar("ler as peças", "pode", listar("plays"));
  await checar("ler os personagens", "pode", listar(`plays/${algumaPeca}/characters`));
  await checar("ler os exercícios", "pode", listar("exercicios"));
  await checar("ler os convites", "negado", listar("convites"));
  await checar("ler os avisos", "negado", listar("avisos"));
  await checar("ler as avaliações da direção", "negado", listar("direcao"));

  /* -------------------------------------------------------------- escrita */
  await checar("virar administrador sozinho", "negado", gravar(`users/${conta.uid}`, { role: texto("admin") }));
  await checar("apontar a própria conta para outra ficha", "negado", gravar(`users/${conta.uid}`, { personId: texto(outraPessoa) }));
  await checar("renomear outra pessoa", "negado", gravar(`people/${outraPessoa}`, { nome: texto(inedito()) }));
  await checar("pôr telefone de volta na ficha", "negado", gravar(`people/${eu}`, { telefone: texto("11999999999") }));
  await checar("pôr e-mail de volta na ficha", "negado", gravar(`people/${eu}`, { email: texto(`${inedito()}@exemplo.com`) }));
  /*
   * O e-mail mora no contato privado, que a pessoa escreve — menos este campo.
   * É por ele que a direção sabe quem é quem ao ligar conta e ficha.
   */
  await checar(
    "trocar o próprio e-mail no contato",
    "negado",
    gravar(`people/${eu}/privado/contato`, { email: texto(`${inedito()}@exemplo.com`) }),
  );
  await checar("ler observações da direção sobre outra pessoa", "negado", ler(`people/${outraPessoa}/privado/direcao`));
  await checar("ler a contagem de tentativas do convite", "negado", listar("limites"));
  await checar("ler a agenda de indisponibilidade de todos", "negado", listar("indisponibilidades"));
  await checar("criar exercício", "negado", gravar(`exercicios/${inedito()}`, { nome: texto("x") }));
  await checar("criar convite", "negado", gravar(`convites/${inedito()}`, { codigo: texto("x") }));
  await checar("criar aviso", "negado", gravar(`avisos/${inedito()}`, { titulo: texto("x") }));
  await checar("editar uma peça", "negado", gravar(`plays/${algumaPeca}`, { titulo: texto(inedito()) }));
  await checar("criar personagem", "negado", gravar(`plays/${algumaPeca}/characters/${inedito()}`, { nome: texto("x") }));
  await checar("escrever no roteiro", "negado", gravar(`plays/${algumaPeca}/lines/${inedito()}`, { texto: texto("x") }));
  await checar("avaliar alguém", "negado", gravar("direcao/caracteristicas", { invadido: texto("x") }));

  /*
   * A exceção. `ativo` fica de fora da lista que a pessoa pode escrever, e a
   * única forma de exercer isso é mandar o contrário do que está gravado —
   * mandar o mesmo valor não afeta chave nenhuma e passaria de graça.
   */
  const fichaRef = db.collection("people").doc(eu);
  await comRestauracao(fichaRef, ["ativo"], async (antes) => {
    await checar(
      "mudar a própria situação no grupo",
      "negado",
      gravar(`people/${eu}`, { ativo: logico(antes.ativo === false) }),
    );
  });

  /* ------------------------------------------------- o que ela PODE gravar */
  /*
   * A direção contrária, e a que engana.
   *
   * Regra apertada demais não aparece como erro: o Firestore recusa a
   * gravação inteira, a tela não reclama, e o dado simplesmente não muda. Foi
   * assim que a troca de foto quebrou. Aqui os valores são de verdade
   * diferentes — gravação que repete o que já estava passaria sem exercer
   * regra nenhuma — e são devolvidos ao original em seguida.
   */
  await comRestauracao(fichaRef, ["nome"], async (antes) => {
    await checar(
      "mudar o próprio nome",
      "pode",
      gravar(`people/${eu}`, { nome: texto(`${antes.nome} ${inedito()}`) }),
    );
  });

  await comRestauracao(fichaRef, ["jaAtuou", "experiencia", "pecasAnteriores"], async (antes) => {
    await checar(
      "responder o cadastro de primeiro acesso",
      "pode",
      gravar(`people/${eu}`, {
        jaAtuou: logico(antes.jaAtuou !== true),
        experiencia: texto(antes.experiencia === "1 a 2" ? "3 a 5" : "1 a 2"),
        pecasAnteriores: texto(antes.pecasAnteriores === "1" ? "2 a 3" : "1"),
      }),
    );
  });

  /*
   * Foto e miniatura na mesma gravação, que é como o app envia.
   *
   * Separadas passariam mesmo com a lista incompleta; juntas é que a lista é
   * exercida — e era exatamente a miniatura que faltava nela.
   */
  await comRestauracao(fichaRef, ["fotoUrl", "fotoMiniUrl"], async (antes) => {
    await checar(
      "trocar a própria foto (grande e miniatura juntas)",
      "pode",
      gravar(`people/${eu}`, {
        fotoUrl: texto(`${antes.fotoUrl ?? ""}#${inedito()}`),
        fotoMiniUrl: texto(`${antes.fotoMiniUrl ?? ""}#${inedito()}`),
      }),
    );
  });

  const contatoRef = fichaRef.collection("privado").doc("contato");
  await comRestauracao(contatoRef, ["telefone"], async (antes) => {
    await checar(
      "gravar o próprio telefone",
      "pode",
      gravar(`people/${eu}/privado/contato`, {
        telefone: texto(antes.telefone === "11999999999" ? "11888888888" : "11999999999"),
      }),
    );
  });

  /*
   * Avisar que não pode é do próprio: no nome de outro seria poder tirar
   * alguém de um ensaio sem que ele saiba.
   */
  await checar(
    "avisar indisponibilidade no nome de outra pessoa",
    "negado",
    gravar(`indisponibilidades/${inedito()}`, {
      personId: texto(outraPessoa),
      personNome: texto("Invadido"),
      de: texto("2030-01-01"),
      ate: texto("2030-01-02"),
    }),
  );

  /* ------------------------------------- conta sem vínculo não vê o teatro */
  /*
   * A pergunta que o uso público faz: e quem só criou um login?
   *
   * Qualquer pessoa cria conta em /cadastro — é assim que o app funciona. O
   * que essa conta enxerga depende de estar ligada a uma ficha, e é isso que
   * se testa aqui: o vínculo do participante é desligado por alguns segundos,
   * as leituras são refeitas, e o vínculo volta no `finally`.
   *
   * Desligar de verdade em vez de criar uma conta descartável é de propósito:
   * conta criada para teste é conta que sobra quando algo dá errado no meio, e
   * já sobrou uma aqui.
   */
  const contaRef = db.collection("users").doc(conta.uid);
  await comClaimsIntactas(conta.uid, async () => {
  await comRestauracao(contaRef, ["personId"], async () => {
    await contaRef.update({ personId: null });
    // O token não muda, mas as regras leem o documento, não o token.
    await checar("(sem vínculo) ler o elenco", "negado", listar("people"));
    await checar("(sem vínculo) ler as peças", "negado", listar("plays"));
    await checar("(sem vínculo) ler o roteiro", "negado", listar(`plays/${algumaPeca}/lines`));
    await checar("(sem vínculo) ler os ensaios", "negado", listar("rehearsals"));
    await checar("(sem vínculo) ler o histórico", "negado", listar("participations"));
    await checar("(sem vínculo) ler os exercícios", "negado", listar("exercicios"));
    await checar("(sem vínculo) ler a própria conta", "pode", ler(`users/${conta.uid}`));
  });
  });

  /* -------------------------------------------------------------- arquivos */
  await checar("subir imagem na pasta de outra pessoa", "negado", subir(`atores/${outraPessoa}/${inedito()}.jpg`));
  await checar("subir capa de peça", "negado", subir(`pecas/${algumaPeca}/${inedito()}.jpg`));
  await checar("subir em uma pasta inventada", "negado", subir(`${inedito()}/arquivo.jpg`));

  const conformes = linhas.filter((l) => l.ok).length;
  return {
    achados,
    resumo: `${conformes}/${linhas.length} conforme, como ${sessao.email}`,
    detalhe: linhas.map(
      (l) => `${l.ok ? "ok   " : "FALHA"} ${l.oQue} — esperado ${l.esperado}, obtido ${l.obtido}`,
    ),
  };
}

/**
 * Garante que as claims do token voltem ao que o documento diz, no fim.
 *
 * Mexer em `users/{uid}` dispara `sincronizarClaims`, que é assíncrono e mora
 * fora daqui. Enquanto ele não roda — ou se ele falhar —, o token fica
 * descrevendo um estado que o documento já não tem, e é o token que decide se
 * a pessoa pode trocar a própria foto. Quem mexe arruma: o teste não termina
 * deixando alguém sem conseguir enviar foto.
 *
 * Isto não é zelo hipotético. A primeira versão deste teste deixou a claim de
 * um participante nula, o gatilho não recuperou sozinho, e foi assim que se
 * descobriu que ele perdia corridas — o defeito de verdade que este bloco
 * agora protege contra.
 */
async function comClaimsIntactas(uid, acao) {
  try {
    await acao();
  } finally {
    const dados = (await db.collection("users").doc(uid).get()).data() ?? {};
    const desejado = { role: dados.role ?? "participante", personId: dados.personId ?? null };
    const usuario = await auth.getUser(uid);
    const atual = usuario.customClaims ?? {};
    if (atual.role !== desejado.role || (atual.personId ?? null) !== desejado.personId) {
      await auth.setCustomUserClaims(uid, { ...atual, ...desejado });
    }
  }
}

/**
 * Roda algo que pode alterar campos de um documento e devolve o original.
 *
 * Existe porque este é o único ponto da suíte onde uma gravação de teste pode
 * pegar. O valor original é lido antes e regravado no `finally`, então mesmo
 * que a regra esteja furada e mesmo que a verificação exploda no meio, o
 * documento volta ao que era.
 */
async function comRestauracao(referencia, campos, acao) {
  const antes = (await referencia.get()).data() ?? {};
  try {
    await acao(antes);
  } finally {
    const devolver = {};
    for (const campo of campos) {
      if (antes[campo] !== undefined) devolver[campo] = antes[campo];
    }
    if (Object.keys(devolver).length > 0) await referencia.update(devolver);
  }
}
