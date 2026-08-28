# Extração de origem — Fase 0

## Regra de segurança

Os repositórios de origem são SOMENTE LEITURA. Não apagar, mover, renomear, commitar, abrir PR ou alterar branches neles durante a extração.

## Estratégia

O Morrow nasce por extração de padrões já exercitados em outros ambientes, mas não publica a identidade, os dados, os contratos ou o conhecimento proprietário desses ambientes.

Peças a estudar e portar de forma genérica:
- invariantes de papéis;
- molde de contrato, mapa e pedido;
- registro de recusas e mapas de erro;
- disparo headless de agentes;
- locks, budgets, retries, observabilidade e wake por evento;
- revisão independente e auditoria por contraprova.

## O que NÃO copiar para um repositório público

- nomes de clientes, telefones, dados de atendimento ou banco;
- chaves, tokens, IDs de conta e segredos;
- regras específicas de qualquer produto de origem;
- caminhos locais pessoais;
- contratos reais de produto;
- logs ou diagnósticos operacionais desnecessários;
- histórico bruto de erros de outro sistema;
- nomes internos de projetos de origem quando não forem necessários ao Morrow.

O mecanismo pode ser portado; o conteúdo histórico e a identidade da origem não.
