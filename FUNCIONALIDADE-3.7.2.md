# Fluxos funcionais — 3.7.2

Rodada de 2026-10-23, autorizada para aprimorar o aplicativo mantendo a
periodização e o formato estabelecido. Não altera a prescrição.

## Entregas

1. **Hoje por estado:** sessão iniciada oferece Continuar; pausada oferece Abrir
   treino pausado, sem retomar automaticamente; concluída, parcial ou pulada
   oferece Consultar treino encerrado, com indicação de somente leitura.
2. **Próxima ação:** atalho no resumo da sessão encontra o primeiro item pendente
   na ordem da ficha. Continuar em Hoje usa o mesmo destino. O foco chega à série
   não confirmada; quando necessário, seleciona apenas o lado ainda pendente.
   Aquecimentos e vídeos continuam no cartão, acima das séries de trabalho.
   Navegar não grava carga, confirma séries, muda a prescrição nem inicia a sessão.
3. **Mobilidade alcançável:** cartões de mobilidade recebem âncoras iguais às dos
   exercícios de força. Ir para o próximo também funciona ao retornar à mobilidade
   inicial ainda pendente. Nada é pulado ou marcado automaticamente.
4. **Navegação com foco:** clique numa aba mantém o foco na aba recriada. Atalhos
   internos, como Registrar caminhada, levam o foco ao painel de destino. O
   redesenho por salvamento continua preservando o campo em uso e a rolagem.
5. **Medidas sem perda em troca de aba:** rascunho somente em memória, restaurado
   após navegação/redesenho, com aviso explícito de não salvo. Não entra no
   histórico até Salvar medidas. Limpar formulário exige confirmação e não apaga
   medições. Falha de gravação mantém os valores; submissão repetida é bloqueada;
   texto digitado durante uma gravação lenta não é apagado pelo retorno dela.
6. **Atualização sem descartar rascunho:** a PWA exige salvar ou descartar Medidas
   antes de atualizar, inclusive se o rascunho surgir durante uma gravação pendente
   ou entre a confirmação e a ativação do worker. Fechar/recarregar manualmente
   também aciona a proteção de saída quando o navegador a oferece. O rascunho não
   é persistido: fechar o app pode perdê-lo; a própria tela informa essa limitação.
7. **Descanso contextual:** Desfazer série na barra só corresponde ao registro
   que iniciou aquele intervalo. Desfazer no cartão não interrompe um descanso de
   outro exercício. Concluir/parcial/pular/cancelar/remarcar interrompem somente
   o intervalo da própria sessão, depois de salvar com sucesso. Novo intervalo
   limpa o anúncio anterior de término.

## Invariantes

- `js/workouts.js`, `js/legacy-v12.js` e `js/measurements.js` sem alterações.
- Ficha 3.6.10, tradicionais, mesmos exercícios, ordem, séries, aquecimentos,
  alternativas e vídeos; progressão e separação dos históricos preservadas.
- `SCHEMA_VERSION=13`; sem migração nova ou novos campos no documento persistido.
- `APP_VERSION=3.7.2`; cache `treino-hard-v3.7.2`.
- Identidade grafite, logo, cartões e seletor de oito semanas preservados.

## Validação

Os resultados finais, publicação e limites ficam no início de `TESTES.md`.
Testes com dados fictícios e Chrome não substituem iPhone físico, leitor de tela
real nem instalação nativa. A rodada não certifica acessibilidade integral ou
reprodução de todo o catálogo no YouTube.
