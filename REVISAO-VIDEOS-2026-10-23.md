# Revisão de vídeos — 2026-10-23

## Continuação — candidatos de panturrilha unilateral no leg press

- `qSiie2WYykc`, Gustavo Sá personal trainer, 1:53, https://www.youtube.com/watch?v=qSiie2WYykc . Página e introdução em português conferidas; o aparelho mostrado é inclinado. Ao avançar para conferir a execução, o player exibiu “Algo deu errado. Atualize ou tente de novo depois”. Não aprovado: inspeção da execução não concluída. A falha desta sessão não comprova remoção nem bloqueio de incorporação.
- `-71eOdpGbwc`, Rubens Munhoz Personal, 0:20, https://www.youtube.com/watch?v=-71eOdpGbwc . Reprodução e quadro em 5 s conferidos: demonstração unilateral em leg press, tronco apoiado e instrução textual em português. Não aprovado para substituir automaticamente a variante `leg_press_45_unilateral`: a geometria do equipamento não foi confirmada como correspondente ao leg press 45° do catálogo; origem brasileira do canal também precisa de confirmação individual. O registro profissional encontrado por nome semelhante não foi usado como prova de identidade.
- Nenhum vídeo do app foi substituído nesta continuação. Os 11 guias-base permanecem corretamente identificados. Branch de trabalho: `feat/curadoria-lote-3.6.8`; não há versão 3.6.8 implementada/publicada.

## Extensora unilateral — rodada 3.6.7

- Vídeo: https://www.youtube.com/watch?v=7HcK7fmYJP0 , Cadeira extensora unilateral, Foco30Dias (`@Foco30Dias`), duração no player 31,621 s (exibida como 0:32).
- Inspeção visual em 5, 15 e 22 segundos confirmou banco, apoio do tronco, mãos nos pegadores, uma perna fora do rolete e extensão unilateral do joelho. Não há explicação detalhada de regulagem.
- Origem brasileira: perfil profissional de Anderson Santos, FOCO30dias, Recife/PE, https://br.linkedin.com/in/anderson-santos-a0687636 . Nome e identidade do programa conferidos na página do vídeo e do canal.
- Integrado em `leg_extension_unilateral`, como demonstração específica. Reprodução na página do YouTube conferida; incorporação ainda não confirmada, com abertura externa.
- Leg press unilateral continua com guia-base: nenhum candidato específico foi aprovado nesta rodada.

## Panturrilha unilateral em pé na máquina

- Candidato: https://www.youtube.com/watch?v=fSQ5LGWfnYU
- Título: PANTURRILHA UNILATERAL EM PÉ NA MÁQUINA.
- Canal atual: GR Treinamento Físico - João Gomes (`@grjoãogomes`); a busca ainda o identifica pelo nome antigo Treinando Online.
- Duração conferida no player: 17 segundos.
- Origem: página Sobre do canal, https://www.youtube.com/@grjo%C3%A3ogomes/about, informa Brasil; consultada em 2026-10-23.
- Inspeção visual: demonstração em máquina com apoio nos ombros, uma perna apoiada na plataforma e a outra flexionada; flexão plantar unilateral. Quadros em 5 e 12 segundos conferidos, com instrução em português para amplitude completa e movimento lento/controlado.
- Limitação: demonstração breve, sem explicação da regulagem; o desenho e a estabilidade da máquina precisam permitir a execução unilateral.
- Reprodução na página do YouTube confirmada. A abertura direta de `/embed/` retornou erro 153 por configuração/referência; isso não comprova bloqueio do proprietário. Incorporação no contexto do app ainda precisa de verificação.
- Integrado em `calf_standing_unilateral` na versão 3.6.6. Gate local passou; a publicação é registrada em `TESTES.md`.

## Auditoria inicial

Os 154 testes de lógica/dados/cache e os 64 cenários de navegador passaram em 2026-10-23. As suítes de navegador foram executadas separadamente. O teste de atualização da 2.2 recebeu correção da condição de ativação automática; detalhes em `TESTES.md`.
