# Gate STATE_OF_ART_SCAN

O Morrow pesquisa antes de reinventar capacidade técnica não trivial.

## Quando é obrigatório

Antes de criar ou substituir:

- motor de workflow/orquestração;
- memória/recuperação;
- sandbox/workspace;
- protocolo de agentes/ferramentas;
- observabilidade/evals;
- segurança/permissionamento;
- infraestrutura de testes/regressão;
- integração importante;
- capability genérica que provavelmente já possua solução aberta/madura.

Mudança pequena e específica de produto pode marcar `not-applicable` com motivo.

## Artefato mínimo

Registrar:

- data da pesquisa;
- problema/capability buscada;
- pelo menos alternativas relevantes quando existirem;
- projetos/padrões oficiais ou amplamente adotados considerados;
- status de manutenção/frescura observado;
- licença e restrições de reutilização relevantes;
- compatibilidade com linguagem/runtime/arquitetura do Morrow;
- custo de dependência, adapter, fork ou implementação própria;
- riscos de lock-in/obsolescência;
- decisão: `adopt-standard | use-library | thin-adapter | fork | build | defer`;
- motivo da decisão.

## Ordem preferencial

1. padrão aberto;
2. biblioteca/dependência mantida;
3. adapter fino;
4. fork justificado;
5. implementação própria.

Copiar código sem analisar licença/manutenção não passa.

## Tendências e frescura

Decisões arquiteturais sensíveis a evolução tecnológica recebem `review_after` ou gatilho de revisão. Um benchmark antigo não vira verdade eterna.

O Tech Radar pode sugerir revisão quando:

- projeto adotado entra em maintenance/deprecation;
- surge padrão aberto relevante;
- provider/framework muda capacidade crítica;
- custo/latência/qualidade muda materialmente;
- evidência interna mostra que a escolha está piorando resultados.

## Gate

Se obrigatório e ausente, CONTRACT_PREFLIGHT retorna `BLOCKED`.

A pesquisa informa a arquitetura; não substitui nossos requisitos de governança.