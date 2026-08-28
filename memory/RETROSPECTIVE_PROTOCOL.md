# Protocolo de retrospectiva

Roda ao final de cada objetivo concluído e obrigatoriamente no fechamento do contrato.

## Rodada por papel

Cada papel responde, separado:

1. principal acerto;
2. principal dificuldade;
3. erros próprios observados;
4. erros de pedido/contexto recebidos;
5. informação que faltou;
6. instrumento/gate que ajudou;
7. instrumento/gate que falhou ou não acendeu;
8. sugestão concreta de REGRA, REMOÇÃO ou CERCA;
9. algo que não conseguiu medir.

## Consolidação

O supervisor compara a rodada com histórico de erros e recusas. Não promove aprendizado automaticamente.

Classificação inicial:
- `EPHEMERAL`: evento pontual sem valor futuro;
- `CONTRACT_LESSON`: útil somente ao contrato/projeto;
- `CANDIDATE_LEARNING`: potencialmente geral, ainda não canônico;
- `PROMOTED`: passou pelo gate de promoção institucional.

## Regra de evidência

Erro admitido pelo próprio papel é dado útil, mas fonte fraca. Sempre que possível, associe evidência externa, reprodução, PR, comando, log ou confirmação independente.

## Métrica mínima

Registrar por contrato: intervenções humanas, voltas por defeito de pedido, voltas por defeito de execução, achados reais, custo, duração e regressões escapadas.
