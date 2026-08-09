# Plano e evidências de teste

## Estado

Atualizado em **2026-08-08**, versão do app **3.1.0**, esquema **11**, commit publicado
`b877d1f`, URL `https://waubinet.github.io/treino-hard/`.

Resultados atuais:

- `node --check` em `js/workouts.js`, `js/core.js`, `js/storage.js`, `js/measurements.js`, `js/app.js` e `sw.js`: **6/6 aprovados**;
- `node --test tests/app.test.cjs`: **34/34 aprovados, 0 falhas** (20 originais + 14 de conformidade da ficha);
- `node --test tests/browser.test.cjs`: **26/26 aprovados, 0 falhas**, em Chrome real via Playwright;
- capturas visuais em 360×800, 430×900 e 1280×800 para Hoje, Empurrar A, Pernas A, Evolução e Ajustes: **0 transbordamentos e 0 erros de console**;
- console/page errors nos cenários automatizados: **0**;
- smoke test no app publicado: **42/42 verificações aprovadas, 0 erros de console**.

Legenda:

- `PENDENTE`: ainda não executado ou sem evidência anexada;
- `PASSOU`: executado com procedimento e evidência registrados;
- `PARCIAL`: a parte descrita na evidência passou, mas o procedimento completo ainda tem etapas pendentes;
- `FALHOU`: falha reproduzida e ainda aberta;
- `N/A JUSTIFICADO`: inaplicável com justificativa técnica explícita.

## Ambiente

| Item | Valor |
|---|---|
| commit testado e publicado | `b877d1f` |
| URL pública | `https://waubinet.github.io/treino-hard/` (GitHub Pages, branch `main`, raiz) |
| navegador | Google Chrome via Playwright 1.61.1, executável local |
| sistema/tela | Windows; viewports 320, 360, 430, 640 e 1280 px |
| dependência de teste | Playwright fora do repositório; use `NODE_PATH` apontando para um `node_modules` com `playwright` |
| data | 2026-08-08 |

## Cobertura automatizada por cenário

| Cenário de `tests/browser.test.cjs` | Estado |
|---|---|
| Fluxos essenciais, responsivo e offline | PASSOU |
| Ciclo de vida da sessão com reload em cada estado | PASSOU |
| Modo sequência sem avanço, conclusão ou reordenação automática | PASSOU |
| Treze abas montam o próprio painel sem erro | PASSOU |
| Descanso padrão, personalizado, manual, automático, +30 s e desfazer | PASSOU |
| Caminhada e vacuum com todos os campos e reload | PASSOU |
| Semana, deload, arquivamento e snapshot | PASSOU |
| Exportação JSON, reimportação, snapshot e CSV de 27 colunas | PASSOU |
| Backup criptografado: ida e volta, senha errada, adulteração de ciphertext, IV, salt e truncamento | PASSOU |
| Importações hostis, malformadas, de esquema futuro e com chaves proibidas | PASSOU |
| Cópias automáticas e recuperação bruta listadas, restauradas e exportadas | PASSOU |
| Conflito de revisão entre duas abas | PASSOU |
| Fallback para `localStorage` e falha de gravação por quota | PASSOU |
| Injeção de HTML em notas, feedback, máquina, caminhada, vacuum e medidas | PASSOU |
| CSP bloqueando script inline | PASSOU |
| Teclado completo nas abas e retenção cíclica de foco no modal | PASSOU |
| Papéis, relações ARIA, regiões vivas e rótulos | PASSOU |
| Contraste medido em nove abas contra o mínimo do WCAG AA | PASSOU |
| 320, 360, 430, 640 e 1280 px, texto ampliado e movimento reduzido | PASSOU |
| Manifesto, ícones e zona segura do maskable | PASSOU |
| Offline: recarregar, registrar série, salvar caminhada, fechar e reabrir | PASSOU |
| Atualização entre duas versões de cache com confirmação do usuário | PASSOU |
| Falha de cache do service worker avisada | PASSOU |
| Ficha canônica na interface dos seis treinos | PASSOU |
| Versão do app e esquema em Ajustes e no rodapé | PASSOU |
| Atualização de quem tem a 2.2 instalada, com histórico legado preservado | PASSOU |

## Conformidade da ficha

Os 14 testes de conformidade em `tests/app.test.cjs` falham se qualquer exercício,
ordem, número de séries, categoria, descanso, aquecimento, variação ou faixa semanal
divergir da ficha. Cobrem os seis treinos, os totais 17/15/14/15/14/14, a periodização
das oito semanas por categoria, a faixa alta 12–20, os descansos 120/150/180/90 s,
a remada unilateral por lado, as duas execuções do tríceps de Empurrar B, a ausência
de stiff e terra romeno, o terra restrito a Pernas B, a mobilidade idêntica em
Pernas A/B, o domingo sem sessão e a independência entre versão do app e esquema.

## Ainda não testado

| Item | Estado | Motivo |
|---|---|---|
| Leitor de tela real | PENDENTE | nenhum leitor de tela foi executado; apenas papéis, nomes e regiões vivas foram auditados por código |
| Vídeos de apoio | PENDENTE | nenhum candidato assistido; todos os 34 itens permanecem `pending` |
| Instalação da PWA pelo prompt do sistema | PENDENTE | `beforeinstallprompt` não é disparado em Chrome headless |
| Conferência das colunas da ficha contra o PDF | PENDENTE | `Ficha_de_Treino_Hipertrofia_Waubin.pdf` é um placeholder do iCloud e não pôde ser hidratado |

## Modelo de evidência


Para converter um item em `PASSOU` ou `FALHOU`, registrar:

```text
Teste:
Data/hora:
Commit:
Ambiente:
Preparação:
Passos:
Resultado esperado:
Resultado observado:
Console/rede:
Artefato (captura/log):
Estado:
Correção/reteste:
```
