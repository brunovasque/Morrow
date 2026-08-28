# Morrow

Codinome de laboratório para um kernel autônomo de execução de contratos de software.

## Estado

**Fase 1 — governança contratual portável.** O núcleo define papéis, memória, gates, routing, targets, conectores e fronteiras do runtime antes da implementação executável do V0.

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

## Regra operacional central

**Cumprir processo não significa seguir uma esteira rígida.** Se surgir evidência nova, o contrato pode voltar a debate, diagnóstico, mapa, execução, prova, review ou audit quantas vezes forem necessárias. O que permanece protegido é destino, escopo autorizado, regressão, permissões, evidência e autoridade.

## Próxima prova

O próximo marco é o Runtime V0: executar um contrato pequeno de ponta a ponta com event log, memória viva, workspace isolado, PRE_DISPATCH determinístico e pelo menos um runtime quota-session real, medindo intervenções humanas e loops necessários.