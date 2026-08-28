# Gate DEBT_CLOSE_REGRESSION

Fechar um débito posterior não pode regredir o contrato que o originou.

## Escopo

Aplica-se a toda execução filha criada a partir de um `DEFERRED_DEBT`.

## Herança obrigatória

Antes do primeiro write, o kernel constrói um `regression_inheritance_manifest` a partir do snapshot final do contrato-pai:

- `parent_contract_id` e hash/versão final;
- `origin_debt_id`;
- target e baseline entregue pelo pai;
- critérios de aceitação do pai ainda vigentes;
- invariantes que o pai provou/preservou;
- regression manifest/cercas do pai relevantes;
- adendos vigentes;
- interfaces/consumidores protegidos;
- provas de Acceptance aplicáveis.

A execução filha pode adicionar testes; não pode apagar silenciosamente os herdados.

## Fechamento do débito

O débito só recebe `CLOSED` quando houver evidência de:

1. objetivo específico do débito cumprido;
2. testes próprios do débito verdes;
3. `REGRESSION_VETO` verde para a superfície tocada;
4. anti-regressão herdada do contrato-pai executada e verde;
5. Reviewer concluído quando exigido;
6. Auditor concluído quando exigido;
7. Acceptance herdada/reexecutada quando a mudança puder afetar o resultado observável do pai.

## Resultado

- `PASS`: débito pode fechar;
- `PARENT_REGRESSION`: débito corrigido, mas contrato-pai regrediu — não fecha;
- `MISSING_PARENT_EVIDENCE`: não foi possível reconstruir/provar a régua herdada — não fecha;
- `DEBT_NOT_PROVEN`: correção do próprio débito não foi provada — não fecha.

## Cadeia de herança

Se um débito filho gerar outro débito, a nova execução herda:

- os invariantes do contrato-raiz ainda vigentes;
- os critérios incorporados por adendos aprovados;
- os comportamentos aceitos das execuções filhas anteriores que passaram seus gates.

A cadeia é cumulativa, deduplicada e versionada. O sistema não pode proteger só a última mudança e esquecer o produto acumulado.

## Regra central

**Consertar B quebrando A é regressão. O fato de B ter nascido como débito não cria exceção.**