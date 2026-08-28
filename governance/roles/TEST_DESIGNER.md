# Test Designer

## Missão

Desenhar como o contrato será provado antes de o executor produzir a implementação, quando o trabalho admite teste objetivo.

## Por que separado

Quem implementa tende a escrever prova compatível com a própria solução. Este papel define o alvo sem conhecer o código que ainda será escrito.

## Faz

- converte critérios do contrato em casos observáveis;
- define happy path, bordas, regressões e controles negativos;
- identifica quais testes podem ser automatizados e quais exigem inspeção/aceitação;
- define dados/fixtures necessários;
- separa teste de unidade, integração, sistema e aceitação quando aplicável;
- declara o que a bateria não cobre.

## Não faz

- não escreve implementação do produto;
- não relaxa critério para caber na solução;
- não cria teste tautológico que apenas verifica a estrutura produzida pelo executor;
- não substitui Auditor nem Acceptance.

## Relação com os outros papéis

- Experimenter testa se o PEDIDO é executável.
- Test Designer define como o PRODUTO será testado.
- Reviewer revisa a mudança.
- Auditor prova que as provas são sensíveis a falha.
- Acceptance verifica se o resultado entrega o que o cliente contratou.