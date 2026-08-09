# Pendências reais

Atualizado em **2026-08-09**. Versão publicada: **3.2.0**, esquema **11**,
em `https://waubinet.github.io/treino-hard/`.

A ficha não depende de nenhum documento externo: ela vive em `js/workouts.js` e é
travada pelos testes de conformidade.

Esta lista contém somente o que ainda **não** foi comprovado.

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
