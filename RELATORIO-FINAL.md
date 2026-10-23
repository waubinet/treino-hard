# Relatório de entrega — Treino Hard (Fofo)

## Rodada 3.7.0 — aparência grafite, 2026-10-23

Identidade visual refeita em grafite, cinza e prata, incluindo ursinho e ícones da PWA. Revisados cartões, navegação, botões, campos, séries, gráficos, silhueta e cronômetro; contraste e foco receberam atenção específica. Cores semânticas continuam distintas. Não houve alteração de prescrição, vídeos, progressão ou esquema de dados.

Gate aprovado: 156/156 testes de lógica/dados/cache, 68/68 em Chrome e nove capturas finais inspecionadas. Migração, backup, autosave, responsividade e offline passaram sem erros de página/console; hashes dos quatro assets conferidos. Pages confirmou `947ef3bc601b348e984a5a764d88c92f4dd0952c`; smoke público repetiu as verificações com sucesso, e o IAB confirmou o novo tema e cache após a atualização explícita. Prova no topo de `TESTES.md`. Auditoria visual, paleta, capturas e origem da arte em `DESIGN-3.7.0.md`.

## Rodada 3.6.10 — opções nos supinos, 2026-10-23

Supino reto oferece máquina/convencional com barra e inclinado oferece máquina/halteres nos dois treinos de peito. Nomes neutros dos cartões, instruções de unidade de carga e vídeos específicos por opção. Séries, aquecimento, ordem e periodização mantidos. A máquina continua padrão.

Esquema 13 preservado; ficha, versão e cache 3.6.10. Catálogo com 49 associações para 42 vídeos, 44 correspondências de execução e 5 guias-base. Gate aprovado: 156/156 testes de lógica/dados/cache, 67/67 em Chrome e sete capturas revisadas; migração, backup, autosave e offline sem erros de página/console. Pages publicou o commit funcional `a0ccc7ec6982da5d874a6d144c565cb0ebe8cf80`; smoke público confirmou as alternativas, vídeos e versão. Evidências no topo de `TESTES.md`.

## Rodada 3.6.9 — curadoria e compatibilidade, 2026-10-23

Implementados vídeos específicos de panturrilha unilateral no leg press 45°, panturrilha sentada unilateral, borboleta dinâmica e remada unilateral com anilhas/apoio peitoral. A remada foi separada da máquina seletorizada a partir da foto e confirmação do usuário; as alavancas do vídeo não são idênticas às da foto. A variação deve ser escolhida explicitamente no cartão; não houve mudança automática de aparelho.

Corrigida a resolução da curadoria em sessões anteriores: um vínculo novo com exercício e variação exatos pode ser exibido sem reescrever a prescrição ou os registros históricos. Catálogo: 47 associações, 40 vídeos únicos, 42 correspondências de execução e 5 guias-base, incluindo dois fallbacks genéricos legados.

Gate aprovado: 154/154 testes de lógica/dados/cache, 66/66 cenários em Chrome e cinco capturas inspecionadas; migração, backup, autosave e offline sem erros de página/console. Pages confirmou o commit funcional `679ee27c6a6ffc83e6c2b19dcdad7d51bda55a07`; smoke público aprovado, incluindo os nove registros de vídeo e a variação com anilhas. Evidências no topo de `TESTES.md`. Esquema 13, séries, ordem, aquecimento e periodização preservados. Fontes e inspeção: `REVISAO-VIDEOS-2026-10-23.md`.

## Rodada 3.6.8 — lote de curadoria, 2026-10-23

Leg press 45° unilateral, vacuum em pé e quatro apoios receberam demonstrações específicas brasileiras e recortes separados. Extensora unilateral e panturrilha unilateral em pé tiveram reprodução incorporada confirmada e agora respeitam a preferência de assistir dentro do app. Catálogo: 46 associações para 36 vídeos, 38 correspondências exatas e 8 guias-base.

Gate local: 154/154 testes de lógica/dados/cache e 65/65 cenários em Chrome, revisão visual, migração, backup, autosave e offline aprovados sem erros de página/console. A reprodução real dos quatro IDs foi confirmada pelo player oficial; o teste de integração simula o YouTube e verifica apenas a ligação correta de variante/posição/recorte.

Fontes, limitações e inspeção estão em `REVISAO-VIDEOS-2026-10-23.md`; publicação e evidências em `TESTES.md`. A posição sentada em cadeira e os demais oito guias-base ainda não têm demonstração exata. Prescrição e esquema 13 preservados.

## Rodada 3.6.7 — 2026-10-23

Extensora unilateral recebeu demonstração específica do canal brasileiro Foco30Dias, substituindo o guia bilateral. Inventário: 46 associações, 34 vídeos únicos, 35 correspondências exatas e 11 guias-base. Leg press unilateral permanece com guia-base; incorporação do novo vídeo ainda não confirmada, com abertura externa.

Validação: 154/154 testes de lógica/dados/cache; suíte completa com 63/64 e repetição dirigida aprovada do único cenário cuja expectativa ficou obsoleta com o novo vídeo. Revisão visual, migração, backup, autosave e offline passaram sem erros. Evidências em `TESTES.md`.

## Rodada 3.6.6 — 2026-10-23

Adicionada demonstração brasileira específica para panturrilha unilateral em pé na máquina, substituindo a demonstração bilateral dessa opção. O vídeo abre no YouTube até confirmar incorporação no app. Catálogo: 46 associações para 33 vídeos únicos, 34 correspondências exatas e 12 guias de movimento-base.

Auditoria com 154/154 testes de lógica/dados/cache e 64/64 cenários em Chrome aprovados, revisão visual e offline sem erros. Corrigida uma condição instável no teste de atualização da 2.2, que fechava o último cliente antes de exigir atualização em espera. Nenhum novo defeito funcional foi reproduzido nos cenários auditados. Evidências e publicação em `TESTES.md`.

## Rodada 3.6.5 — persistência, cache e vídeos, 2026-09-21

Corrigida a perda de carga digitada quando a página era recarregada sem sair do campo. O autosave sinaliza alterações pendentes, aguarda a gravação mais recente antes de indicar sucesso e mantém o texto com opção de nova tentativa em caso de falha. Atualização, importação e restauração aguardam as escritas pendentes.

O service worker agora preserva a resposta válida da internet mesmo se a cópia offline não puder ser atualizada. Falha de cache deixa de provocar falso fallback de rede. Três vídeos cuja incorporação não havia sido confirmada agora respeitam a preferência de reprodução interna, após teste real do player.

Gate local: 154/154 testes de lógica/dados/cache e 64/64 cenários no navegador; revisão de quatro capturas, migração, backup, autosave sem blur e recarga offline, sem erros de página/console. O Pages confirmou `a04d99ade864537cdd562d1c0d9a42aee0e24b1d` como `built`; os mesmos smoke checks de versão, migração, backup, autosave e offline passaram na URL pública. Evidências consolidadas em `TESTES.md`.

A ficha e a periodização não mudaram; esquema 13 preservado. Não há garantia de ausência absoluta de defeitos: testes em iPhone físico, leitor de tela e instalação nativa seguem pendentes, assim como tornar mais específicas as 13 associações de vídeo classificadas como movimento-base.

## Rodada 3.6.4 — auditoria corretiva, 2026-09-18

Corrigidas quatro associações que eram apenas aproximadas: supino inclinado, remada unilateral, alongamento posterior sentado e bracing agora usam demonstrações específicas. Título, duração ou recorte também foram corrigidos em desenvolvimento na máquina, remada sentada, crossover e voador inverso. As novas fontes têm proveniência brasileira registrada; quando a incorporação não foi comprovada, o cartão abre no YouTube sem oferecer prévia interna.

A navegação móvel recebeu margem de rolagem para que cartões abertos por atalho não fiquem escondidos sob as abas fixas. A ficha, as séries, os aquecimentos, a periodização, o esquema 13 e todos os registros históricos permaneceram inalterados.

Evidências locais: 124/124 testes de lógica/dados, 60/60 cenários em Chrome, sintaxe e manifesto aprovados, quatro capturas inspecionadas, cache `treino-hard-v3.6.4`, recarga offline e zero erros de página/console.

O GitHub Pages publicou o commit funcional `879e9b992f475b382d29e9ef397ff31fb533b1d1`. O smoke na URL pública, em contexto limpo e com cache-busting, confirmou a versão 3.6.4, esquema 13, migração física, backup, cache correto, recarga offline e zero erros.

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
