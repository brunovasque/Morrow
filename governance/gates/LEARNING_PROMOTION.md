# Learning promotion gate

A retrospectiva pode propor aprendizado, mas não promovê-lo automaticamente.

## Estados

- `EPHEMERAL` — evento pontual sem valor futuro comprovado;
- `CONTRACT_LESSON` — útil ao contrato/target, mas não generalizado;
- `CANDIDATE_LEARNING` — hipótese de melhoria com evidência inicial;
- `PROMOTED` — aprendizado validado e autorizado para injeção futura.

## Tipos de aprendizado promovível

- `RULE` — regra/invariante adicional;
- `CHECKLIST` — pergunta/passagem obrigatória de preflight/review;
- `FENCE` — gate/teste/validação determinística;
- `SKILL_PATCH` — alteração versionada numa skill;
- `ROUTING_POLICY` — mudança de modelo/runtime/effort baseada em evidência;
- `TOOLING_CHANGE` — capability/interface que reduz classe de erro;
- `REMOVAL` — instrução/processo que deve ser removido por causar erro/desperdício.

## Evidência mínima para PROMOTED

Exigir pelo menos uma destas bases, conforme risco:

1. repetição em execuções independentes; ou
2. reprodução objetiva + validação independente; ou
3. falha grave única com mecanismo causal claro e cerca verificável.

E sempre registrar:

- classe do erro/oportunidade;
- evidências e contratos afetados;
- comportamento que deve ser impedido/melhorado;
- onde o aprendizado será aplicado;
- risco de falso positivo/overfitting;
- teste/cerca que prova a melhoria quando possível;
- responsável/autoridade da promoção;
- versão e data.

## Quem não pode promover sozinho

O agente que cometeu o erro pode propor, nunca declarar sua própria proposta como verdade institucional.

O Supervisor consolida e recomenda. A promoção passa pelo gate/autoridade configurada.

## Relação com dúvidas e reuniões

`PREFLIGHT_MISS`, regressão escapada, scope drift bloqueado, reunião recorrente e débito recorrente são sinais fortes para candidato de aprendizado.

Exemplo: se Executores repetidamente precisam chamar Diagnostician pela mesma ambiguidade previsível, a correção preferencial é melhorar o preflight/mapa/skill — não normalizar a reunião eterna.

## Aplicação futura

Aprendizado `PROMOTED` não fica numa pasta passiva. O resolver deve injetá-lo no PRE_DISPATCH somente quando papel/target/risco/skill correspondentes forem aplicáveis.

Cada injeção registra a versão usada para permitir medir se o aprendizado reduziu ou aumentou erros.

## Revogação

Aprendizado pode ser `SUPERSEDED` ou `REVOKED` quando evidência nova mostrar obsolescência, conflito ou piora. Memória institucional também precisa de governança contra envelhecimento.

## Regra

**Aprender não é escrever mais texto. É transformar evidência de erro em mudança verificável de comportamento do sistema.**