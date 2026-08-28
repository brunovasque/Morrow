# Gate REGRESSION_VETO

Regressão de comportamento já aceito é veto, não débito tolerável da execução atual.

## Princípio

Uma mudança só pode avançar se:

1. prova o comportamento novo contratado;
2. preserva os comportamentos aceitos que deveriam continuar iguais;
3. executa todas as cercas obrigatórias aplicáveis à superfície tocada.

Ter uma prova existente não basta. O gate deve comprovar que a prova/cerca obrigatória **foi executada** contra o estado candidato.

## Regression manifest

Cada etapa que modifica um target deve resolver antes da execução:

- superfícies potencialmente afetadas;
- invariantes/critério aceito correspondente;
- testes/provas/canários obrigatórios;
- tipo de prova: `static | unit | integration | e2e | live | model-behavior | manual-acceptance`;
- comando/instrumento reproduzível quando existir;
- razão explícita para qualquer superfície sem instrumento;
- baseline e candidate SHA/artifact.

## Resultado

- `PASS` — todas as cercas exigidas rodaram e passaram;
- `FAIL` — pelo menos uma regressão foi provada;
- `INCONCLUSIVE` — instrumento/dado insuficiente;
- `MISSING_REQUIRED_CHECK` — cerca obrigatória não foi executada.

Somente `PASS` permite avanço. `INCONCLUSIVE` e `MISSING_REQUIRED_CHECK` bloqueiam; não equivalem a verde.

## Independência

Reviewer confere se a superfície e as provas escolhidas cobrem o risco. Auditor pode rerodar, invalidar a prova ou exigir contraprova.

## Mudança deliberada

Se o contrato/adendo explicitamente manda alterar um comportamento antigo, esse comportamento deixa de ser regressão **somente na extensão autorizada**. Os demais invariantes continuam protegidos.

## Aprendizado

Toda regressão escapada ou cerca obrigatória não executada alimenta retrospectiva e pode gerar uma nova regra determinística de seleção/execução de testes.