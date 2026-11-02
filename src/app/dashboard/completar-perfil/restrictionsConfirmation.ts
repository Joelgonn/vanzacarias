// Regra visual da etapa de restrições do perfil alimentar.
// Pura e sem dependências: a página não pode exportar valores extras (o
// typecheck do Next.js rejeita exports além do componente da rota).

/**
 * Lista vazia exige a confirmação explícita de ausência de restrições;
 * qualquer restrição informada dispensa a confirmação adicional.
 */
export function podeContinuarEtapaRestricoes(
  quantidadeRestricoes: number,
  confirmouAusencia: boolean
): boolean {
  return quantidadeRestricoes > 0 || confirmouAusencia;
}
