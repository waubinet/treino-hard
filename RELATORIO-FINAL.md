# Relatório de entrega — Treino Hard (Fofo)

## Rodada 3.6.2 — vídeos brasileiros revisados, 2026-09-17

Adicionados guias revisados para supino reto na máquina, extensão acima da cabeça com halter, remada sentada em máquina com apoio e remada articulada com apoio. Todos são de criadores brasileiros, em português do Brasil, com fonte pública de origem e inspeção visual individual. O supino abre no YouTube porque o proprietário bloqueia incorporação; tríceps e remadas reproduzem dentro do app. Inventário: 46 entradas, 24 aprovadas e 22 pendentes.

Evidências locais: 124/124 testes de lógica/dados, 60/60 cenários em Chrome, revisão visual com cache 3.6.2 e funcionamento offline. Nenhum exercício, série, ordem, volume ou regra da periodização foi alterado nesta rodada.

## Rodada 3.6.1 — gate local aprovado, 2026-09-17

Corrigidas as prescrições que ainda apareciam com duas séries nos treinos A/B: tríceps na corda agora tem três séries, e remada unilateral na máquina tem três por lado. Totais atuais: Empurrar A/B 20, Puxar A/B 16 e Pernas A/B 15. Planos ainda não iniciados descartam preenchimentos de teste ao receber a nova revisão; sessões iniciadas ou terminais continuam protegidas. Gate local: 124/124 testes de lógica e 60/60 cenários em Chrome, com revisão visual e offline aprovados.

## Rodada 3.6.0 — gate local aprovado, 2026-09-17

Implementados registro por lado, modo por variante, retrato histórico por sessão, migração 12 → 13 preservando sessões/arquivos, feedback de execução, relato após pernas, comparações descritivas de medidas e mobilidade. Corrigidas perdas de configuração de faixa/descanso e recuperação de staging antigo.

Também foi corrigido o plano futuro preso à ficha antiga: sessões planejadas e completamente vazias são reconstruídas pela revisão atual, preservando IDs e preferências, enquanto qualquer sessão já executada permanece intocada. Os primeiros aparelhos mantêm seu aquecimento e os exercícios bilaterais em máquina usam três séries efetivas; unilaterais continuam com duas por lado e o deload com duas.

Inventário daquela rodada: 46 entradas, 20 aprovadas e 26 pendentes. O estado atual está consolidado na seção 3.6.2 acima.

Evidências: 124/124 testes de lógica/dados e 60/60 cenários em Chrome aprovados, além da revisão visual das telas desktop e móvel, sem erro de página/console. O GitHub Pages publicou o commit `99a5c67d4629b3e72ce2d898bef30a3ce812bc08`; o smoke público confirmou versão 3.6.0, esquema 13, cache correto, migração, backup e funcionamento offline. Resultado consolidado em `TESTES.md`.

## Publicação anterior — 3.5.1

## Estado

**Versão 3.5.1 integralmente validada e publicada em 2026-08-31.** Esquema de
dados **12**, cache `treino-hard-v3.5.1` e commit funcional
`6834706a33236ecedacb27524aad204ed238ad74`. O GitHub Pages confirmou o commit
com status `built`; o smoke público reproduziu a migração 11 → 12, preservou as
sessões e terminou em “Salvo neste aparelho”, com zero erros de console/página.

## Resultado da rodada

- Corrigida a falha de inicialização vista após atualizar no iPhone: a migração
  11 → 12 agora é confirmada no documento físico antes da cópia automática.
- A fonte 11 é preservada para recuperação antes da gravação, e sessões, medidas,
  histórico e configurações permanecem intactos.

- O degrau real pode ser configurado por exercício, variação e máquina nos
  detalhes do exercício, consultado/removido em Ajustes e é preservado no novo
  esquema 12. Os dois lados do mesmo aparelho compartilham o valor.
- A recomendação de progressão usa esse degrau somente para chegar a uma carga
  disponível; nenhuma carga é alterada automaticamente.
- Evolução mostra séries diretas confirmadas por grupo muscular contra a ficha
  planejada e mantém participações secundárias explicitamente separadas.
- Exercícios unilaterais não duplicam volume: dois lados formam uma série
  corporal equivalente e um único lado confirmado pode aparecer como fração.
- O gráfico reúne faixas diferentes da periodização na mesma linha quando
  exercício, variação, máquina e lado são iguais. A faixa permanece visível em
  cada ponto e continua fazendo parte da comparação estrita da progressão.
- Migração 11 → 12, validação profunda e deduplicação preservam os documentos
  anteriores e recusam configurações inválidas ou excessivas.

## O que não foi alterado

- ficha canônica, ordem dos seis treinos, número de séries e periodização;
- vídeos e seus estados de curadoria;
- progressão como recomendação, nunca como alteração automática de carga;
- arquitetura estática e local, sem conta e sem servidor de dados.

## Evidência técnica local

- sintaxe JavaScript e manifesto: aprovados;
- `git diff --check`: aprovado;
- núcleo: **82/82** testes aprovados;
- Chrome/Playwright: **52/52** cenários aprovados em uma única execução final,
  **0 falhas**, exit code 0, em **674.259,166 ms**;
- erros de console/página aceitos: **0**;
- GitHub Pages: commit funcional exato confirmado e smoke público aprovado;
- detalhes completos: `TESTES.md`;
- pendências honestas: `PENDENCIAS.md`.

## Pendências não bloqueantes

Faltam leitor de tela real, instalação pelo prompt nativo e importação de um
backup real do usuário após cópia externa. A revisão futura do mapa muscular é
necessária se a ficha canônica mudar. Nenhuma dessas lacunas foi promovida a
“aprovada”.
