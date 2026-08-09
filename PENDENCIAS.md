# Pendências reais

Atualizado em **2026-08-08**. A implementação local passou em **20/20 testes de núcleo** e **1/1 cenário integrado em Chrome real**. Esta lista contém somente lacunas ainda abertas ou procedimentos cujo alcance completo não foi testado.

## Antes da publicação

- [ ] Criar e validar ícone 192×192 e arte `maskable`; o repositório possui apenas `logo.png` 512×512 com finalidade `any`.
- [ ] Decidir se o backup criptografado por senha será incluído nesta versão; ele ainda não foi implementado. Se for incluído, usar Web Crypto, AES-GCM, PBKDF2, salt e IV aleatórios e formato versionado — nunca criptografia artesanal.
- [ ] Concluir a curadoria audiovisual individual ou manter todos os cards honestamente em “Vídeo pendente de curadoria.”.
- [ ] Revisar o diff completo, registrar o commit final e garantir que alterações concorrentes não tenham sido perdidas.
- [ ] Verificar a cópia de segurança do projeto original e registrar caminho/hash antes e depois.
- [ ] Publicar somente o artefato aprovado localmente; depois verificar URL pública, versão, cache, instalação e atualização.

Estado de publicação: **não realizada**.

## Dados e migração

Já coberto por testes automatizados: esquema 9→10→11, duas ocorrências, aliases e ambiguidades, metadados antigos, ciclos arquivados, IDs desconhecidos/estáveis, até três cópias automáticas antigas, preservação da fonte bruta, esquema futuro, staging, conflito de revisão, prototype pollution, profundidade excessiva e normalização de medidas.

Ainda pendente:

- [ ] Executar prévia e importação de um backup real do usuário, mantendo uma cópia externa antes da tentativa.
- [ ] Executar ida e volta pela interface: exportar JSON, importar o mesmo JSON, comparar contagens e restaurar snapshot.
- [ ] Executar download CSV pela interface e comparar integralmente com o cabeçalho de 27 colunas.
- [ ] Testar arquivo acima de 5 MiB, quota esgotada e falha real de IndexedDB.
- [ ] Testar campos inesperados do esquema 11, textos no limite e um documento corrompido não futuro.
- [ ] Testar recuperação/exportação do bruto, restauração de snapshot e restauração de cópia automática pela interface.
- [ ] Testar o fallback completo sem IndexedDB e uma edição concorrente real em duas abas.

## Vídeos

- [ ] Selecionar candidatos adequados para os 34 itens do catálogo novo.
- [ ] Abrir e assistir integralmente cada candidato.
- [ ] Registrar título, canal, duração, idioma, disponibilidade, embed, correspondência, cobertura, limitações e decisão.
- [ ] Verificar equipamento, pegada, posição, trajetória, amplitude e lateralidade.
- [ ] Não reutilizar supino com barra em card de máquina nem qualquer conteúdo de stiff em flexora/terra.
- [ ] Testar `youtube-nocookie.com` e abertura externa somente depois de aprovar um candidato.

Estado atual: **0 vídeos assistidos; 0 aprovados; 37 IDs únicos legados inventariados**. Os 34 registros da versão 3 permanecem pendentes. Consulte `CURADORIA-DE-VIDEOS.md`.

## Funcional e interface

Já coberto em Chrome real: 13 abas, início de treino, preenchimento e conclusão de série, timer iniciado apenas por ação explícita, desfazer série, modal Escape/retorno de foco, service worker/offline e ausência de overflow global em 320, 360, 430 e 1280 px.

Ainda pendente:

- [ ] Testar em navegador os fluxos de pausar, retomar, concluir treino, concluir parcialmente, pular, cancelar, reabrir e confirmar remarcação.
- [ ] Testar modo sequência com sessões atrasadas e garantir que nada avance ou seja reorganizado sem confirmação.
- [ ] Testar alteração de semana e zerar periodização, incluindo snapshot e restauração.
- [ ] Testar descanso personalizado e configuração de início automático após confirmação.
- [ ] Testar salvamento completo de caminhada, vacuum e todos os estados de desconforto.
- [ ] Testar filtros e gráficos com máquinas, variações, lados e faixas diferentes em dados reais.
- [ ] Repetir fluxos completos, não apenas a ausência de overflow, em cada largura móvel.

## Acessibilidade e segurança

Já coberto: roving tabindex, ArrowRight + Enter, Escape e retorno de foco no modal, 0 IDs duplicados, 0 manipuladores inline, 0 controles sem rótulo e 0 errors/warnings no Browser integrado.

Ainda pendente:

- [ ] Testar Home, End, Espaço, percurso completo com Tab e retenção cíclica de foco no modal.
- [ ] Testar com leitor de tela real e conferir regiões vivas e ordem de leitura.
- [ ] Medir contraste de todas as combinações e testar zoom 200%, texto ampliado e movimento reduzido.
- [ ] Testar injeção HTML/script por notas e feedback na interface, além dos bloqueios estruturais já automatizados.
- [ ] Testar a CSP com um vídeo eventualmente aprovado e incorporado em `youtube-nocookie.com`.

## Documentação e liberação

- [ ] Preencher em `TESTES.md` qualquer resultado manual adicional com ambiente e evidência.
- [ ] Atualizar contagens e decisões em `CURADORIA-DE-VIDEOS.md` somente depois de assistir aos vídeos.
- [ ] Inserir o hash/ID do commit aprovado em `TESTES.md` e `CHANGELOG.md`.
- [ ] Publicar a versão 3.0 e verificar a página pública, o service worker, a atualização e o modo offline servido.
