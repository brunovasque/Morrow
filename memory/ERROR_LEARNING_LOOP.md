# Ciclo acumulativo de erro e aprendizado

O Morrow não depende de um LLM lembrar espontaneamente de erros anteriores. O aprendizado percorre um pipeline governado e volta a contratos futuros por mecanismos obrigatórios.

## Fluxo

```text
ERRO / PREFLIGHT_MISS / REGRESSÃO / REUNIÃO RECORRENTE
        ↓
EVENTO + EVIDÊNCIA
        ↓
MAPA DE ERROS DO PAPEL / CONTRACT LESSON
        ↓
RETROSPECTIVA INDEPENDENTE
        ↓
REUNIÃO COLETIVA
        ↓
SUPERVISOR
        ↓
CANDIDATE_LEARNING
        ↓
LEARNING_PROMOTION
        ↓
RULE | CHECKLIST | FENCE | SKILL_PATCH | ROUTING_POLICY | TOOLING_CHANGE | REMOVAL
        ↓
PRE_DISPATCH / GATE / SKILL RESOLVER
        ↓
CONTRATOS FUTUROS
        ↓
MÉTRICA: REPETIU OU DIMINUIU?
```

## 1. Captura

Toda falha relevante recebe evento com:

- contrato/step/papel;
- sintoma;
- evidência;
- detector;
- contexto/routing/model/effort quando relevante;
- classificação inicial;
- vínculo com reunião, regressão, débito ou pergunta.

## 2. Deduplicação por assinatura

O Supervisor não cria uma nova "lição" para cada incidente. Ele tenta vincular o evento a uma assinatura de erro existente.

Repetições incrementam evidência e ajudam a distinguir caso isolado de padrão.

## 3. Causa, não só sintoma

Antes de promover solução, separar:

- o que aconteceu;
- por que aconteceu;
- onde deveria ter sido impedido;
- qual mecanismo teria evitado a classe inteira.

Exemplo: "Executor perguntou ao Diagnostician" não é necessariamente erro. Se a dúvida era previsível antes, o erro pode ser `PREFLIGHT`; se nasceu de comportamento novo impossível de antecipar, pode ser `EMERGENT_UNKNOWN` legítimo.

## 4. Forma da melhoria

Preferência:

1. remover causa/processo desnecessário;
2. criar garantia determinística/teste/gate;
3. melhorar ferramenta/interface;
4. melhorar skill/checklist;
5. adicionar instrução textual somente quando as opções acima não forem suficientes.

Isso evita memória virar prompt infinito.

## 5. Promoção

Somente aprendizado `PROMOTED` entra automaticamente no contexto futuro. Candidato permanece fora do caminho canônico até validação.

A promoção especifica `apply_when` por papel, target type, skill, risco ou classe de tarefa.

## 6. Injeção obrigatória

O Memory Resolver consulta o estado promovido antes do PRE_DISPATCH. O manifesto prova quais versões foram entregues.

O agente não pode decidir "não ler" um aprendizado aplicável.

## 7. Medir a eficácia

Depois da promoção, acompanhar:

- ocorrência da mesma assinatura;
- falsos bloqueios;
- aumento de custo/cota/latência;
- novos erros provocados;
- redução de reuniões/intervenções.

Aprendizado que não funciona deve ser revisado, superseded ou revoked.

## Regra central

**A memória institucional só é viva se muda o comportamento obrigatório da próxima execução e se essa mudança continua sendo medida.**