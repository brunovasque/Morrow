# Morrow

Codinome de laboratório para um kernel autônomo de execução de contratos de software.

## Estado

**Fase 2 — Runtime V0.** O núcleo de governança já possui um trilho executável e agora avança o worker local, sessões de agente observáveis e isolamento operacional.

## Princípios

1. O contrato define o destino; o mapa define a rota.
2. O kernel é mecânico nas cercas e flexível na rota: impede atalhos perigosos sem impedir raciocínio, debate, diagnóstico ou retrabalho válido.
3. Papel não é modelo, sessão, workspace nem target.
4. Skills fornecem especialização; não governam o kernel.
5. Evidência supera declaração. Gate verde não substitui critério de contrato.
6. Anti-regressão é invariante transversal: mudança nova não pode quebrar comportamento aceito que deve sobreviver.
7. Achado fora do objetivo vira débito; não vira melhoria oportunista silenciosa.
8. Memória institucional só nasce após validação e promoção, e volta aos contratos futuros por injeção governada.
9. Quota/session, API e local são modos de acesso; API não é requisito nem fallback silencioso.
10. O operador mantém override manual de access mode, runtime/modelo e effort.
11. Morrow pode governar repositórios-alvo externos e connectors sem morar dentro deles.
12. Novos papéis, skills e connectors podem ser adicionados por contratos de extensão sem reescrever o kernel.
13. Antes de reinventar capability/infra não trivial, consultar estado da arte e Tech Radar.
14. Nenhum segredo, dado de cliente ou conhecimento proprietário de produto-alvo entra no core público.
15. Terminais e projetos abertos pelo operador permanecem fora do ciclo de vida gerenciado pelo Morrow.
16. A interface observa sessões reais próprias dos agentes; chat com o Cérebro e sala de reunião são canais separados dos terminais.

## Regra operacional central

**Cumprir processo não significa seguir uma esteira rígida.** Se surgir evidência nova, o contrato pode voltar a debate, diagnóstico, mapa, execução, prova, review ou audit quantas vezes forem necessárias. O que permanece protegido é destino, escopo autorizado, regressão, permissões, evidência e autoridade.

## Próxima prova

O próximo marco é completar o Runtime V0: executar um contrato pequeno de ponta a ponta com event log, memória viva, workspace isolado, PRE_DISPATCH determinístico, pelo menos um runtime quota-session real e terminais de agentes observáveis ao vivo. A experiência canônica do operador está em [`runtime/OPERATOR_EXPERIENCE.md`](runtime/OPERATOR_EXPERIENCE.md).

## Contrato mestre ativo

A conclusão do primeiro Morrow capaz de operar é governada por [`contracts/morrow-minimum-operable-v0/README.md`](contracts/morrow-minimum-operable-v0/README.md). Toda nova aba/agente deve ler esse pacote e executar somente o próximo passo autorizado em `LIVE_STATUS.md`.
