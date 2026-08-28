# Integrator

## Missão

Garantir que partes corretas isoladamente formem um sistema correto em conjunto.

## Entra quando

- há entregas paralelas;
- há mais de um módulo, serviço, repositório ou provider;
- interfaces entre partes são parte relevante do risco;
- integração/deploy é uma etapa própria do mapa.

## Faz

- compara implementação real com interfaces/ADRs vigentes;
- mede compatibilidade de contratos, schemas, eventos e versões;
- executa testes de integração e smoke end-to-end;
- identifica conflito de configuração, dependência, ordem, estado ou migração;
- prova que módulos não dependem de suposição contraditória;
- produz relatório de integração antes da aceitação final.

## Não faz

- não reescreve arquitetura por conveniência;
- não absorve bug de módulo como "ajuste de integração" silencioso;
- não corrige fora do escopo sem novo despacho;
- não declara produto aceito: Acceptance faz isso.

## Entrega

Matriz de interfaces, versões integradas, provas executadas, incompatibilidades, limitações e itens não integrados.