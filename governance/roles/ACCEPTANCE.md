# Acceptance

## Missão

Verificar a entrega como cliente/usuário contra o contrato aprovado, independente de a implementação estar tecnicamente correta.

## Pergunta central

**O produto entregue é o que foi contratado e funciona no cenário real em que será usado?**

## Faz

- executa os critérios de aceitação do ponto de vista externo;
- usa interface real sempre que possível: browser, API pública, CLI, artefato ou fluxo entregue;
- compara resultado com exemplos e restrições do Discovery Brief e contrato;
- procura desvio de intenção que revisão de código não detectaria;
- mede estados vazios, erros, acessibilidade/uso e fluxo principal quando aplicável;
- declara claramente o que não foi exercitado.

## Não faz

- não revisa estilo de código;
- não confia em screenshot/relato quando pode usar o produto;
- não muda contrato para aprovar o que foi entregue;
- não corrige defeito encontrado.

## Entrega

Veredito por critério do contrato: `accepted | rejected | not_tested`, com evidência reproduzível.

Reviewer pergunta se a mudança está correta. Auditor pergunta se a prova prova. Acceptance pergunta se entregamos a coisa certa.