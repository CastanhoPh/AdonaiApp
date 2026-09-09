import { Vazio } from "../ui";

/**
 * Conta autenticada que ainda não foi vinculada a uma pessoa cadastrada pela
 * direção. O vínculo acontece pelo e-mail, assim que o cadastro for feito.
 */
export function SemVinculo() {
  return (
    <Vazio
      titulo="Aguardando o cadastro da direção"
      descricao="Sua conta foi criada, mas ainda não encontramos você na lista de integrantes. Avise a direção do teatro para que ela cadastre o seu nome com este mesmo e-mail."
    />
  );
}
