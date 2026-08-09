# Pendências reais

Atualizado em **2026-08-08**. Versão publicada: **3.1.0**, esquema **11**, commit `b877d1f`,
em `https://waubinet.github.io/treino-hard/`.

Estado de publicação: **realizada e verificada no app real** (42/42 verificações do smoke test).

A identidade visual da 2.2 foi restaurada sobre a arquitetura da v3 na 3.1.0. O PDF
da ficha **não é e não volta a ser referência de interface**: serviu apenas para
definir o conteúdo do treino.

Esta lista contém somente o que ainda **não** foi comprovado.

## Bloqueio de origem: a ficha canônica em PDF

`C:\Users\waubi\iCloudDrive\Ficha_de_Treino_Hipertrofia_Waubin.pdf` é um placeholder
desidratado do iCloud. O provedor de arquivos da Apple não está em execução, então
qualquer leitura falha com "O provedor do arquivo de nuvem não está em execução".
Iniciar o aplicativo iCloud não resolveu.

A ficha foi sincronizada com a especificação canônica escrita pelo usuário, que cobre
estrutura semanal, exercícios, ordem, séries, totais, periodização, descansos e
mobilidade. Continuam **sem confronto com o PDF**:

- [ ] aquecimentos por exercício (hoje: supino reto 3, puxada supinada 2, agachamento 3, leg press 1, terra 3);
- [ ] variações permitidas além das citadas na especificação (remada sentada com triângulo, remada unilateral, flexora, extensora, leg press);
- [ ] variação padrão do agachamento (hoje: Smith);
- [ ] orientação técnica por exercício e o esforço "6–7/10" das mobilidades.

Para desbloquear: baixar o PDF pelo iCloud ("Manter sempre neste dispositivo") ou
copiá-lo para a pasta do projeto.

## Vídeos

- [ ] Selecionar e assistir candidatos para os 34 itens do catálogo.
- [ ] Registrar título, canal, duração, idioma, disponibilidade, incorporação, correspondência, cobertura, limitações e decisão.
- [ ] Testar `youtube-nocookie.com` e a abertura externa depois de aprovar ao menos um vídeo.
- [ ] Implementar a preferência "Abrir no YouTube / Assistir dentro do app / Perguntar toda vez" em Ajustes.

Estado atual: **0 vídeos assistidos, 0 aprovados, 34 itens `pending`**. Todos os cards
exibem "Vídeo pendente de curadoria." e nenhum bloqueia o registro do treino.

Nenhum vídeo pode ser aprovado sem que alguém assista à demonstração e confira
exercício, equipamento, pegada, posição, trajetória, amplitude e lateralidade. Isso
não foi feito e não será declarado como feito.

## Acessibilidade

- [ ] Teste com leitor de tela real (NVDA, JAWS ou Narrador), conferindo ordem de leitura e anúncios das regiões vivas.

Já coberto por teste automatizado: teclado completo nas abas (setas, Home, End, Enter,
Espaço, Tab e Shift+Tab), retenção cíclica de foco no modal em ambos os sentidos,
Escape com retorno ao acionador, papéis, `aria-selected`, `aria-controls` sem
referência quebrada, `aria-labelledby`, regiões vivas, contraste medido em nove abas,
zoom equivalente a 200%, texto ampliado e movimento reduzido.

## PWA

- [ ] Instalar pelo prompt do sistema em perfil limpo e conferir a aparência instalada
      (o `beforeinstallprompt` não é disparado em Chrome headless).

Já coberto: manifesto, ícones 192/512/maskable com dimensões e MIME conferidos, zona
segura do maskable medida pixel a pixel, service worker controlando a página, uso
offline completo, atualização entre duas versões de cache com confirmação do usuário,
remoção do cache antigo, descarte de cache incompleto e atualização a partir da 2.2
instalada com preservação do histórico legado.

## Dados

- [ ] Executar a importação de um backup real do usuário, mantendo cópia externa antes.

Já coberto: ida e volta do JSON pela interface, CSV com as 27 colunas, backup
criptografado com senha correta, incorreta, ciphertext adulterado, IV alterado, salt
alterado e truncamento, importações hostis e de esquema futuro, prototype pollution,
cópias automáticas restauradas, recuperação bruta exportada, conflito de revisão entre
abas, fallback para `localStorage` e falha de gravação por quota.

## Documentação

- [ ] Atualizar `CURADORIA-DE-VIDEOS.md` somente depois que houver vídeo assistido.
