# Revisão de vídeos — 2026-10-23

## Lote 3.6.9 — inspeção individual e integração validada

Quatro novos IDs tiveram reprodução real confirmada pelo IFrame Player API em origem localhost, host `youtube-nocookie.com`, estado 1 e sem erro. As páginas Sobre dos próprios canais declaram país Brasil; títulos, nomes atuais e durações foram reconferidos no player. A aprovação é da execução nos recortes inspecionados, não de todas as afirmações dos vídeos completos.

| Associação | Vídeo e origem primária | Duração / recorte | Conferência visual e limites |
|---|---|---|---|
| Panturrilha unilateral no leg press 45° | [GUSTAVO PERSONAL — m4ky4df0t4Y](https://www.youtube.com/watch?v=m4ky4df0t4Y), [@personalconectado/about](https://www.youtube.com/@personalconectado/about) | 1:47 / 0:25–0:55 | Quadros 15, 25, 40, 45, 50, 55, 75 e 105 s: trilhos inclinados, antepé, uma perna por vez e troca de lado. O recorte inclui preparação bilateral antes da demonstração unilateral; as partes posteriores de erros não foram usadas como execução-alvo. Aparelho deve permitir unilateral estável; não copiar a contagem do vídeo. O canal identifica Gustavo Rodrigues Pereira, CREF14255G/MG e formação UNIBH. |
| Panturrilha sentada unilateral | [Personal TAF @personaltaf.oficial — MhUzkSK2Slk](https://www.youtube.com/watch?v=MhUzkSK2Slk), [@personaltaf/about](https://www.youtube.com/@personaltaf/about) | 0:16 / 0:00–0:10 | Quadros 3 e 8 s mostram apoio na coxa, um antepé na plataforma e a outra perna no chão; em 12 s já há vinheta. Demonstração breve sem explicar regulagem. Canal também aponta para `personaltaf.com`. |
| Mobilidade de quadril em borboleta | [Matheus Nascimento - Emagrecimento Feminino — VFd1fO_H7do](https://www.youtube.com/watch?v=VFd1fO_H7do), [@MatheusPersonalNutri/about](https://www.youtube.com/@MatheusPersonalNutri/about) | 0:18 / 0:00–0:17 | Quadros 2, 4, 5, 6, 8 e 12 s: posição sentada, solas juntas e abertura repetida leve dos joelhos, de frente e de lado. Substitui a demonstração apenas estática nesse cartão; não forçar joelhos/tronco. |
| Remada unilateral articulada com anilhas e apoio | [Emmanuel Cony — rXAP7YQF6ps](https://www.youtube.com/watch?v=rXAP7YQF6ps), [@emmanuelcony6308/about](https://www.youtube.com/@emmanuelcony6308/about) | 0:55 / 0:03–0:15 | Quadros 3, 8 e 12 s confirmam um braço por vez, pegada neutra, apoio peitoral e anilhas. O usuário confirmou execução unilateral na máquina da foto. A geometria das alavancas não é idêntica; aprovado para o mesmo tipo de execução, não como manual da máquina fotografada. |

Na remada, a variante `plate_loaded` recebeu `videoKey` próprio, sem renomear IDs ou mudar o padrão `machine_left_right`. O vídeo `1p0fvh2USMY` do Foco30Dias corresponde à máquina da foto, mas mostra execução bilateral; não foi apresentado como guia unilateral. `wUpH4v7VOUE`, Marcio Moura, também foi inspecionado, mas não traz vantagem clara de correspondência do aparelho; não integrado. O candidato de remada sem apoio `yA2kby99f2U` não teve mecanismo confirmado como equivalente à variante e não foi promovido. Vacuum em cadeira continua sem nova demonstração aprovada.

Correção de compatibilidade: `renderVideoStatus` consulta o vínculo atual somente quando exercício e variação do vídeo coincidem exatamente com os da sessão. A prescrição histórica continua vindo do snapshot; nenhuma regravação dele é necessária para receber curadoria nova. Teste de regressão com sessão anterior iniciada, carga 45 e snapshot sem a chave nova cobre esse caso.

Inventário conferido executando o catálogo: **47 associações, 40 vídeos únicos, 42 correspondências de execução e 5 guias-base**. Quadros locais em `output/playwright/`, ignorados pelo Git. Testes de integração com YouTube interceptado não são usados como prova de reprodução real. Publicação e gate final são registrados em `TESTES.md`.

## Lote 3.6.8 — publicado e verificado

- Leg press 45° unilateral: `ausscKK91R8`, Fernando Maradona, 5:53, recorte 1:55–2:45. Inspeção individual confirmou trilhos inclinados, banco com apoio, perna única na plataforma e orientação de alinhamento de joelho/tornozelo. Quadros conferidos em 0:35, 1:20, 2:20, 3:20 e 4:20. O vídeo também contém contagens e estratégias próprias de treino; elas não alteram a ficha do app. Origem: evento do CREF22/ES lista Prof. Fernando Maradona, CREF006152-G/MG: https://www.sympla.com.br/evento/conferencia-da-educacao-fisica-capixaba/2633822 .
- Vacuum em pé: `TU9XSn6TYxs`, Treino Mestre, 4:13, recorte 2:18–2:33. Mostra a retração abdominal em pé com vista lateral. Origem brasileira já documentada pelo site oficial https://treinomestre.com.br/sobre/ .
- Vacuum quatro apoios: mesmo vídeo, recorte independente 2:34–2:47, mostrando mãos e joelhos apoiados e retração abdominal. Conferidos quadros em 2:34, 2:39 e 2:45. A posição ajoelhada sobre os calcanhares que aparece antes NÃO equivale a sentado em cadeira: `vacuum_seated` continua guia-base. A aprovação é dos recortes, não uma revisão integral de todas as afirmações do vídeo.
- Incorporação real confirmada pelo IFrame Player API em origem localhost, host youtube-nocookie.com, estado 1 e sem erro para `ausscKK91R8`, `TU9XSn6TYxs`, `fSQ5LGWfnYU` e `7HcK7fmYJP0`. Os dois últimos deixam de ser apenas externos. A duração do vídeo de panturrilha em pé foi reconferida como 0:18 pelo player.
- Registro de revisão: 2026-10-23. Quadros de apoio locais em `output/playwright/`, fora do pacote publicado. Testes que simulam YouTube verificam somente a integração, não foram usados como prova de reprodução.
- Inventário do lote: 46 associações para 36 vídeos únicos, 38 correspondências exatas e 8 guias-base. Permanecem guias-base: panturrilha unilateral no leg press, panturrilha sentada unilateral, remada unilateral com geometria diferente, remada genérica/sem apoio, mobilidade de quadril, vacuum genérico e vacuum sentado.

## Pesquisa anterior ao lote — candidatos de panturrilha unilateral no leg press

- `qSiie2WYykc`, Gustavo Sá personal trainer, 1:53, https://www.youtube.com/watch?v=qSiie2WYykc . Página e introdução em português conferidas; o aparelho mostrado é inclinado. Ao avançar para conferir a execução, o player exibiu “Algo deu errado. Atualize ou tente de novo depois”. Não aprovado: inspeção da execução não concluída. A falha desta sessão não comprova remoção nem bloqueio de incorporação.
- `-71eOdpGbwc`, Rubens Munhoz Personal, 0:20, https://www.youtube.com/watch?v=-71eOdpGbwc . Reprodução e quadro em 5 s conferidos: demonstração unilateral em leg press, tronco apoiado e instrução textual em português. Não aprovado para substituir automaticamente a variante `leg_press_45_unilateral`: a geometria do equipamento não foi confirmada como correspondente ao leg press 45° do catálogo; origem brasileira do canal também precisa de confirmação individual. O registro profissional encontrado por nome semelhante não foi usado como prova de identidade.
- Naquela pesquisa inicial, nenhum vídeo do app havia sido substituído e ainda havia 11 guias-base. Esse retrato foi superado pelo lote descrito no topo; não representa o inventário atual.

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
