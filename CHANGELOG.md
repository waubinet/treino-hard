# Changelog

As mudanças relevantes deste projeto são registradas aqui. Este arquivo distingue implementação observada no código de validação final.

## [3.2.0] — cartão de exercício da referência 2.2 — 2026-08-09

Continuação do trabalho recebido do Codex, preservado integralmente. Esquema de
dados continua **11**; nenhuma migração foi criada.

### Cartão de exercício reconstruído sobre a referência

- Ordem fixa: nome + botão **Marcar**, subtítulo, selo, bloco **Alvo · S1** com
  `3 × 12–15 reps · RIR 3 · 1:30`, bloco do vídeo, cabeçalho das séries com o
  alvo, ações rápidas, linhas de série, "Como me senti" e o descanso.
- As séries deixaram de ser cartões dentro do cartão: agora são linhas do
  exercício, separadas por espaço e um filete discreto.
- Cada série mostra `[n] [carga kg] × [reps] [RIR] [✓]` com carga, repetições e
  RIR sempre visíveis. Status, descanso e observação continuam registrados em
  "Mais". A confirmação da série é o botão ✓ e nada mais.
- Aquecimento em bloco próprio, com selo `A1`/`A2` azul, fora do volume.
- Ações rápidas de volta no cartão: **Copiar anterior**, **Repetir 1ª série** e
  **Desfazer**, mais a referência do último treino e o placeholder com a carga
  anterior.
- Exercício unilateral em **um único cartão**, com chips Direito/Esquerdo. O
  histórico continua separado por lado e o volume conta o exercício uma vez.
- Variações como chips sob "Equipamento desta ocorrência".
- "Como me senti" recolhido, com 🙂/😕/⚠️/🔄, observação e **Copiar feedback
  para revisão**.
- Descanso em largura total ao final do cartão; mobilidade com **Marcar feito**
  em largura total.
- "Finalizar treino do dia" em destaque no cabeçalho da sessão.
- Em 320 px a linha da série quebra em duas sem esconder nenhum campo.

### Vídeos

- Catálogo de 41 entradas com título, canal, duração, idioma, data da revisão,
  disponibilidade, pontos positivos, limitações e decisão.
- O cartão mostra `Ver demonstração`, o canal com a data da revisão, a
  classificação e a cobertura com a duração.
- Preferência em Ajustes: abrir no YouTube (padrão), assistir dentro do app ou
  perguntar. A prévia interna continua restrita a `youtube-nocookie.com`.

### Preservado do trabalho anterior

Confirmação explícita da série (`isSetConfirmed`), limites de armazenamento sem
truncamento silencioso, ciclos arquivados presentes nos gráficos, PBKDF2-SHA-256
com 600 000 iterações em arquivos novos com leitura dos antigos de 310 000, e o
cabeçalho do backup criptografado autenticado a partir do próprio arquivo.

## [3.1.0] — restauração da identidade visual clássica — 2026-08-08

A interface da v3 foi reprojetada sobre a linguagem visual da versão 2.2,
preservando a arquitetura, ficha, dados, segurança e funcionalidades da versão 3.
Esquema de dados continua **11**; nenhuma migração foi criada.

### Identidade restaurada

- Paleta preto + rosa empoeirado da logo, com as variáveis originais de fundo,
  elevação, cartão e borda.
- Largura principal de volta a 760 px, pensada primeiro para o celular e
  centralizada no desktop.
- Cabeçalho compacto com a logo protagonista; versão e estado de salvamento
  deixam de competir com o título.
- As oito semanas voltam a ser botões visíveis (4 + 4 em telas pequenas), com
  deload diferenciado, em vez de um seletor escondido.
- Resumo unificado da semana com valores grandes e rótulos pequenos, no lugar de
  quatro cartões separados.
- Abas em cápsula, horizontais, roláveis e fixas no topo, com toda a semântica
  ARIA e a navegação por teclado da v3 preservadas.
- Cada exercício volta a ser percebido como um cartão próprio, com borda lateral
  por categoria: mobilidade roxo, terra azul, compostos rosa, acessórios laranja
  e concluído verde.
- Bloco “Meta da semana” antes dos campos, com faixa, RIR e descanso.
- Séries redesenhadas: carga, repetições, RIR e concluir em destaque; status,
  descanso e observação continuam registrados dentro de “Mais”.
- Aquecimentos com borda azul e selo próprio, ainda fora do volume.
- Variações com poucas opções viram chips; o seletor fica só a partir de quatro.
- Vídeo pendente vira nota discreta; vídeo aprovado ganha botão largo no cartão.
- Barra de progresso simples com texto curto, no lugar do medidor nativo.
- Cronômetro compacto, fixo no rodapé, dentro da mesma largura do aplicativo.
- Tela “Hoje” simplificada: treino do dia, semana, meta e ação principal.

### Corrigido

- `registerPwa` quebrava com “Cannot read properties of undefined” em perfis que
  bloqueiam service worker; agora avisa e o aplicativo segue funcionando.
- Contraste ajustado apenas em luminosidade nos elementos claros da identidade
  (semana ativa, botão principal, selo de série, cronômetro e link de atalho),
  mantendo o rosa e atendendo ao mínimo aplicável do WCAG AA.

### Preservado

Ficha canônica, periodização, séries por lado, variantes, progressão dupla,
descansos, cronômetro, caminhada, vacuum, medidas, gráficos separados por
máquina/variação/lado/faixa, IndexedDB com fallback, migrações, backups, backup
criptografado, recuperação, PWA, service worker, CSP e acessibilidade.

## [3.0.1] — 2026-08-08

Lote 1: sincronização da ficha com a versão canônica aprovada. O esquema de dados
permanece **11**: nenhuma mudança de formato persistido foi necessária.

### Ficha sincronizada com a versão canônica

- **Remada unilateral na máquina** passa a ser registrada **por lado**: Puxar A e
  Puxar B criam um registro esquerdo e um direito, com duas séries cada, usando o
  campo `side` que o esquema 11 já possuía. O volume planejado continua contando o
  exercício uma única vez (15 e 14 séries), como na ficha.
- **Tríceps de Empurrar B** volta a ser uma escolha: “Tríceps testa ou extensão
  acima da cabeça”, com as duas variações selecionáveis e vídeos próprios. As
  cargas das duas execuções não são comparadas entre si.
- **Faixa alta opcional** de elevação lateral, crucifixo invertido e panturrilhas
  corrigida de 15–20 para **12–20** repetições.

### Adicionado

- `APP_VERSION`, independente de `SCHEMA_VERSION` e do nome do cache.
- Cartão “Sobre esta versão” em Ajustes com versão do app, esquema e cache em uso,
  e rodapé com a mesma identificação — para conferir no aparelho se a publicação
  nova chegou.
- Ícones `icon-192.png`, `icon-512.png` e `icon-maskable-512.png`, com o maskable
  preparado dentro da zona segura de 80%, e não uma cópia marcada como maskable.
- Backup criptografado por senha (AES-GCM 256, PBKDF2-SHA-256, salt e IV
  aleatórios, cabeçalho autenticado), preservando o JSON comum.
- Cópias automáticas e recuperação bruta passam a ser listadas, restauráveis e
  exportáveis pela interface.
- 14 testes de conformidade da ficha em `tests/app.test.cjs` e conferência dos
  seis treinos na interface real em `tests/browser.test.cjs`.

### Corrigido

- **Pernas A e Pernas B não abriam**: `renderVideoStatus` acessava `variants` em
  exercícios de mobilidade, lançava `TypeError` e o app permanecia em silêncio no
  painel anterior. Dois dos seis treinos estavam inacessíveis.
- Falha ao montar um painel deixava de ser silenciosa: agora aparece um aviso
  explícito no lugar do painel anterior.
- Service worker deixava de recarregar a página sozinho na primeira ativação; o
  reload só ocorre após o usuário confirmar a atualização.
- `aria-controls` das abas apontava para doze painéis inexistentes.
- `.split-row` transbordava horizontalmente em 320 px.

## [3.0.0] — validada localmente, não publicada — 2026-08-08

### Adicionado

- Estrutura estática separada em `index.html`, `styles.css` e módulos JavaScript locais.
- Catálogo de seis treinos: Empurrar A, Puxar A, Pernas A, Empurrar B, Puxar B e Pernas B.
- Prescrições de oito semanas por categoria, com RIR e deload.
- Modelo cronológico de sessão, exercício e série.
- Campos por série para carga, repetições, RIR, status, observação, tipo, conclusão e descanso seguinte.
- Chaves comparáveis por exercício, variação, máquina, lado e faixa de repetições.
- Progressão dupla como recomendação, sem alteração automática de carga.
- Modelo separado para caminhada e rotina de vacuum em casa.
- Medidas bilaterais e módulo de silhueta comparativa aproximada.
- IndexedDB com fallback em `localStorage`, snapshots, cópias automáticas e recuperação.
- Migrações versionadas 9→10→11 e aliases de IDs legados.
- Conversão de metadados de sessão, ciclos arquivados e até três cópias automáticas legadas, com preservação da fonte bruta.
- Catálogo de 34 necessidades de vídeo, todas explicitamente pendentes.
- CSP sem manipuladores de script inline e estrutura de abas WAI-ARIA na nova página.
- Documentação de auditoria, migração, testes, vídeos, pendências e relatório.
- Exemplos fictícios de backup do esquema 11 e CSV.
- Suíte de núcleo em `tests/app.test.cjs`.
- Cenário integrado com Chrome real em `tests/browser.test.cjs`.

### Alterado

- A grade antiga ABC com duas ocorrências semanais dá lugar a sessões cronológicas dos seis dias.
- Supinos padrão passam a usar máquinas; variações antigas permanecem apenas como histórico/legado.
- Aquecimento deixa de contar no volume de musculação.
- Bracing passa a ser orientação integrada, não exercício.
- Vacuum sai do treino da academia e passa para rotina em casa.
- Descanso passa a ser definido por exercício e iniciado por conclusão explícita da série.
- Registros antigos passam a ser preservados como ciclo legado quando não há equivalência segura.
- Vídeos antigos deixam de ser considerados confiáveis automaticamente.

### Segurança e privacidade

- Whitelist do documento do esquema 11.
- Rejeição de chaves ligadas a prototype pollution.
- Normalização e limites de campos, textos, sessões e séries.
- Separação entre documento corrente, snapshot, backup e recuperação.
- Detecção de conflito de revisão entre abas.
- Neutralização de fórmulas no CSV.
- Aviso explícito de que o armazenamento do navegador não é criptografado.

### Validação local realizada

- Sintaxe aprovada em `js/workouts.js`, `js/core.js`, `js/storage.js`, `js/measurements.js`, `js/app.js` e `sw.js`.
- `node --test tests\app.test.cjs`: **20/20 aprovados, 0 falhas**.
- `node --test tests\browser.test.cjs`: **1/1 aprovado, 0 falhas**, com Playwright e Chrome real.
- Cenário de navegador com 13 abas, roving tabindex, ArrowRight + Enter, modal fechado por Escape com retorno de foco, início de treino, conclusão de série, descanso explícito e desfazer.
- Viewports 320, 360, 430 e 1280 px sem overflow horizontal global.
- Service worker controlando a página e reload offline com aviso; 0 console/page errors no cenário.
- Browser integrado: 0 errors/warnings, seis sessões novas, formulários de caminhada/vacuum, medidas e silhueta finitas, 0 IDs duplicados, 0 manipuladores inline e 0 controles sem rótulo.

### Pendências declaradas

- Curadoria audiovisual: 0 de 34 candidatos novos assistidos e 0 aprovados; 37 IDs únicos legados apenas inventariados.
- Ícones 192×192 e `maskable` ainda não existem.
- Backup criptografado por senha com Web Crypto ainda não foi implementado.
- Fluxos manuais restantes estão discriminados em `TESTES.md` e `PENDENCIAS.md`, sem serem promovidos a “passou”.
- A versão 3.0 **ainda não foi publicada**; a URL pública e o fluxo de atualização após publicação não foram verificados.

Consulte `TESTES.md` e `PENDENCIAS.md`. A aprovação local não equivale a publicação ou a curadoria dos vídeos.
