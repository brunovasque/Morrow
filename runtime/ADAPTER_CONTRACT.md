# Runtime adapter contract

O kernel não conhece fornecedores de LLM. Ele chama um adapter com uma interface canônica e recebe resultado canônico.

## Entrada mínima

```ts
interface AgentInvocation {
  invocationId: string;
  roleId: string;
  objective: string;
  workdir: string;
  model: string;
  maxBudget?: number;
  timeoutMs: number;
  contextManifest: ContextManifest;
  skills: Array<{ id: string; version: string }>;
  permissions: CapabilitySet;
}
```

## Saída mínima

```ts
interface AgentResult {
  invocationId: string;
  provider: string;
  model: string;
  exitCode: number;
  durationMs: number;
  cost: number | null;
  rawOutput: string;
  outputComplete: boolean;
  stderr: string;
  artifacts: string[];
  contextManifestHash: string;
}
```

## Responsabilidades do adapter

- iniciar o processo/sessão do fornecedor;
- entregar o prompt/contexto sem truncamento silencioso;
- aplicar timeout e budget suportados;
- capturar saída integral ou declarar truncamento;
- normalizar custo quando disponível;
- não interpretar decisão do agente;
- não embutir regra de negócio ou de papel;
- remover/segregar credenciais que não devam chegar ao processo filho;
- registrar provider/model usados.

## Fora do adapter

Seleção de próximo objetivo, promoção de memória, decisão de merge, retries semânticos, escalada e conclusão pertencem ao kernel/orquestrador.

Adapters iniciais podem ser específicos; a interface não pode ser.
