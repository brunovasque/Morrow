# Runtime adapter contract

O kernel não conhece fornecedores de LLM nem presume que o acesso seja por API. Ele chama um adapter com uma interface canônica e recebe resultado canônico.

**Modelo e forma de acesso são dimensões separadas.** O mesmo papel/modelo pode ser executado por uma sessão autenticada por assinatura/cota, por API paga ou por outro runtime autorizado.

## Modos de acesso nativos

- `quota-session` — usa um cliente/runtime autenticado por assinatura, plano ou cota do usuário; o kernel despacha para uma sessão/processo suportado e mede capacidade/limite sem transformar uso em custo por token.
- `api` — usa endpoint programático com cobrança/limite próprio e credencial entregue pelo Secret Broker.
- `hybrid` — a política permite mais de um modo e o router escolhe/faz fallback somente dentro das regras explícitas do contrato.
- `local` — modelo/runtime local sem cobrança de provedor, quando houver capacidade adequada.

API **não é requisito** para o Morrow funcionar.

## Entrada mínima

```ts
interface AgentInvocation {
  invocationId: string;
  roleId: string;
  objective: string;
  workdir: string;
  modelProfile: string;
  accessPolicy: {
    allowedModes: Array<"quota-session" | "api" | "local">;
    preferredMode?: "quota-session" | "api" | "local";
    apiFallbackAllowed: boolean;
  };
  maxBudget?: number;
  timeoutMs: number;
  contextManifest: ContextManifest;
  skills: Array<{ id: string; version: string }>;
  permissions: CapabilitySet;
}
```

`maxBudget` representa dinheiro apenas quando o modo escolhido possui custo monetário medível por execução. Em `quota-session`, o limite principal é capacidade/cota, não preço por token.

## Saída mínima

```ts
interface AgentResult {
  invocationId: string;
  provider: string;
  model: string;
  accessMode: "quota-session" | "api" | "local";
  runtimeId: string;
  exitCode: number;
  durationMs: number;
  cost: number | null;
  quota: {
    measurable: boolean;
    unit?: string;
    consumed?: number;
    remaining?: number;
    resetAt?: string;
    source?: string;
  } | null;
  rawOutput: string;
  outputComplete: boolean;
  stderr: string;
  artifacts: string[];
  contextManifestHash: string;
}
```

## Responsabilidades do adapter

- iniciar ou endereçar o processo/sessão do runtime escolhido;
- respeitar a forma de autenticação suportada pelo cliente sem extrair credenciais de assinatura para o prompt;
- entregar o prompt/contexto sem truncamento silencioso;
- aplicar timeout, limites de sessão e budget suportados;
- capturar saída integral ou declarar truncamento;
- normalizar custo quando disponível;
- capturar estado de cota quando o runtime expuser isso de modo suportado;
- não inventar `remaining`/`resetAt` quando o cliente não fornecer dado confiável;
- não interpretar decisão do agente;
- não embutir regra de negócio ou de papel;
- remover/segregar credenciais que não devam chegar ao processo filho;
- registrar provider, modelo, runtime e access mode usados.

## Observabilidade da sessão

Quando a invocação possui terminal gerenciado, o resultado final continua canônico, mas não é a única superfície. O adapter expõe eventos incrementais ordenados de ciclo de vida e saída, vinculados a `terminal_session_id`, `agent_instance_id` e `workspace_id`.

O backend declara capabilities reais (`tty`, entrada interativa e resize). `process-pipes` é suficiente para automação e testes do V0; uma interface equivalente a terminal interativo exige backend PTY/ConPTY. O chat com o Cérebro nunca é implementado como escrita implícita no terminal de outro agente.

## Regras de fallback

1. `quota-session` nunca cai silenciosamente para `api`.
2. Fallback para API exige `apiFallbackAllowed: true` e budget explícito.
3. Cota esgotada pode provocar: aguardar reset, trocar runtime/modelo autorizado, usar outra cota autorizada ou escalar; a política decide.
4. O router não pode trocar um modelo crítico por modelo inferior apenas para continuar rodando sem registrar a degradação.
5. Credencial de assinatura/sessão não vira segredo exportável para outro adapter.

## Fora do adapter

Seleção de próximo objetivo, promoção de memória, decisão de merge, retries semânticos, escalada, conclusão e política de gasto/cota pertencem ao kernel/orquestrador.

Adapters iniciais podem ser específicos; a interface não pode ser.
