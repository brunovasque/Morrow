# Estratégia de protocolos

O Morrow evita inventar protocolo quando existe padrão aberto adequado.

## Skills — Agent Skills

Formato preferencial para conhecimento e workflow especializado. `SKILL.md` permanece portátil e compatível com clientes que suportam o padrão.

## Tools — MCP

MCP é a fronteira preferencial para ferramentas/recursos externos quando houver servidor adequado. O kernel continua responsável por allowlist, autorização, segredo e policy antes da chamada.

## Agent-to-Agent externo — A2A

A2A é o candidato para interoperabilidade futura com agentes independentes/remotos, inclusive de outros frameworks ou fornecedores.

Não é requisito para o V0 interno.

## Comunicação interna — Event Envelope Morrow

O V0 usa um envelope interno pequeno, persistível e provider-neutral:

```ts
interface MorrowEvent {
  eventId: string;
  contractId: string;
  stepId?: string;
  invocationId?: string;
  type: string;
  actor: { kind: "human" | "agent" | "kernel"; id: string };
  occurredAt: string;
  payload: unknown;
  causationId?: string;
  correlationId?: string;
  schemaVersion: string;
}
```

Requisitos:
- JSON serializável;
- append-only no event log;
- IDs idempotentes;
- correlação causal explícita;
- payload validado por schema por tipo de evento;
- nenhum segredo em payload por padrão.

## Provider adapters

OpenAI, Anthropic, Google ou qualquer outro motor entra atrás de `ADAPTER_CONTRACT.md`. Provider nunca define papel, skill, memória ou transição de workflow.

## Regra de compatibilidade

Padrão externo serve à fronteira. A semântica central do contrato continua canônica no Morrow.