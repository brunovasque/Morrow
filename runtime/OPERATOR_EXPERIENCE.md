# Experiência canônica do operador

Este documento é requisito canônico do Morrow. Implementações do runtime, worker e interface devem preservar estas fronteiras; uma decisão técnica local não pode enfraquecê-las silenciosamente.

## Separação entre operador e agentes

O operador pode usar seus próprios terminais e trabalhar em outros projetos ao mesmo tempo em que o Morrow executa contratos.

- terminal aberto manualmente pelo operador pertence ao operador;
- terminal iniciado pelo Morrow pertence a uma `AgentInstance`;
- workspace do operador não é capturado, espelhado, reutilizado nem encerrado pelo Morrow;
- workspace de agente nasce sob uma raiz gerenciada e isolada;
- um terminal de agente nunca adota o diretório atual de um terminal do operador de forma implícita;
- importar um workspace já existente exige ação explícita, escopo declarado e nova validação de isolamento.

O caminho normal não depende de o operador manter PowerShell, Windows Terminal ou outro shell aberto. Fechar um terminal manual do operador não encerra agentes; encerrar um agente não fecha terminais do operador.

## Experiência-alvo na interface

A interface do Morrow é a superfície principal para observar a equipe:

```text
Contrato
  ├── Chat privado: Operador ↔ Cérebro
  ├── Terminais dos agentes
  │     ├── Executor — sessão e workspace próprios
  │     ├── Reviewer — sessão e workspace próprios
  │     └── Diagnostician — sessão e workspace próprios
  └── Sala de reunião governada
        └── Operador + Cérebro + papéis convidados
```

Cada painel de agente mostra a sessão real daquele agente ao vivo: identidade, papel, contrato, runtime, workspace, estado, saída incremental e encerramento. A interface não simula atividade a partir de resumos do Cérebro.

O chat com o Cérebro é um canal próprio. Ele explica, responde, coordena e recebe comandos do operador sem se confundir com `stdin` de qualquer terminal. A sala de reunião também é uma superfície própria e segue `governance/MEETING_ROOM.md`; participantes podem ser convidados sem fundir suas sessões privadas.

## Terminal real

Para a experiência final, “terminal real” significa uma sessão de sistema operacional ligada a PTY/ConPTY (ou equivalente da plataforma), capaz de preservar semântica interativa, sinais, tamanho de tela e sequências de terminal.

Um processo com `stdin/stdout/stderr` por pipes é válido como transporte de automação e backend de teste do Runtime V0, mas não pode ser apresentado ao operador como compatibilidade completa com Windows Terminal. A interface deve conhecer e expor a capability efetiva do backend.

Cada sessão registra no mínimo:

- `terminal_session_id` e `agent_instance_id`;
- `contract_id`, `role_id`, `runtime_id` e `workspace_id`;
- backend e capabilities de terminal;
- PID quando local;
- timestamps de início e fim;
- status e causa de encerramento;
- fluxo de saída ordenado para observação ao vivo.

Entrada sensível não é copiada para Event Log ou memória por padrão. Persistência e retenção de transcript seguem política explícita e redaction.

## Múltiplas sessões e isolamento

O Runtime pode manter vários terminais simultâneos, inclusive papéis iguais em contratos diferentes. Cada sessão é um processo/runtime endereçável e não uma aba visual fictícia.

O Runtime V0 deve recusar mecanicamente:

- dois agentes ativos usando o mesmo workspace de escrita;
- sessão cujo contrato, papel ou `workspace_id` não corresponda ao descritor recebido;
- diretório arbitrário fora do workspace gerenciado;
- reaproveitamento silencioso do terminal do operador;
- colisão de `terminal_session_id` ou `agent_instance_id` ativo.

Paralelismo permitido continua sujeito a locks, dependências, cota e permissões do contrato.

## Critérios observáveis do Runtime V0

1. iniciar um processo de agente vinculado a um workspace explícito;
2. observar saída incremental antes do processo terminar;
3. listar sessões e estados sem depender do resumo de um agente;
4. executar duas ou mais sessões simultâneas em workspaces diferentes;
5. enviar entrada, encerrar a entrada e interromper uma sessão endereçada;
6. impedir compartilhamento acidental de workspace entre sessões ativas;
7. preservar identidade e resultado terminal para checkpoint/auditoria;
8. manter terminais/projetos do operador fora do ciclo de vida gerenciado.

O backend PTY/ConPTY e a renderização de terminal na interface completam a experiência final; o backend processual inicial prova ciclo de vida, streaming, concorrência e cercas sem fingir equivalência visual prematuramente.
