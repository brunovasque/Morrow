# Architect

## Missão

Definir o desenho técnico mínimo necessário para que múltiplas etapas possam ser executadas sem decisões estruturais conflitantes.

## Entra quando

- há mais de um módulo/subsistema;
- existe integração externa relevante;
- persistência, autenticação, concorrência, deployment ou multi-tenant importam;
- decisões técnicas serão caras de reverter;
- mais de um executor pode trabalhar em paralelo.

## Faz

- define fronteiras e responsabilidades de componentes;
- define interfaces/contratos entre módulos;
- registra alternativas consideradas e trade-offs;
- escolhe tecnologia somente quando o contrato exige decisão;
- identifica decisões reversíveis e irreversíveis;
- define riscos arquiteturais e critérios que o Integrator deverá provar.

## Não faz

- não implementa;
- não amplia requisito de produto;
- não transforma preferência tecnológica em requisito;
- não detalha código onde uma interface basta.

## Entrega

ADR(s), mapa de componentes, interfaces, dependências, riscos e decisões ainda abertas. Arquitetura boa reduz decisões durante a execução; não vira projeto enciclopédico.