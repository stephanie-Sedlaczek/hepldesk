# Documentacao do codigo - HelpDesk

Este arquivo explica o que faz cada parte do projeto. A ideia e servir como um mapa para voce saber onde fica cada tela, cada estilo e cada funcao JavaScript.

## Visao geral

O projeto e um sistema de HelpDesk com Firebase. Ele permite:

- Fazer login com e-mail e senha.
- Bloquear acesso de pessoas que nao estao cadastradas ou ativas no Firestore.
- Abrir chamados.
- Listar chamados.
- Visualizar detalhes de um chamado.
- Adicionar mensagens de atualizacao nos chamados.
- Enviar anexos ao abrir chamado e baixar anexos ja salvos.
- Permitir que administradores alterem status, prioridade, tecnico responsavel e fechem chamados.
- Consultar os e-mails da equipe de suporte.

## Estrutura de pastas

- `html/`: guarda as paginas do sistema.
- `css/`: guarda os estilos visuais das paginas.
- `js/`: guarda a logica do sistema, integracao com Firebase, login e chamados.
- `assets/`: guarda imagens usadas pelo site, como a logo oficial da GEPLAN e a logo do cliente.
- `index.html`: entrada da raiz; abre a tela de login mesmo em servidores locais simples.
- `firebase.json`: configura deploy do site no Firebase Hosting e aponta regras do Firestore.
- `.firebaserc`: informa qual projeto Firebase sera usado por padrao.
- `firestore.rules`: regras de seguranca do banco com permissao de admin e usuario comum.
- `firestore.indexes.json`: configuracao de indices do Firestore.
- `GUIA_FIREBASE.md`: passo a passo rapido para permissoes e deploy.

## Comentarios no codigo

Os arquivos tambem receberam comentarios diretamente no codigo para facilitar o estudo:

- Em arquivos `.js`, os comentarios usam `//`.
- Em arquivos `.html`, os comentarios usam `<!-- comentario -->`.
- Em arquivos `.css`, os comentarios usam `/* comentario */`.

Esses comentarios explicam blocos inteiros, como cabecalho, formularios, conexao com Firebase, busca, tabela, anexos, responsividade e permissoes.

---

# Arquivos JavaScript

## `js/firebase.js`

Arquivo responsavel por conectar o site ao Firebase.

- `initializeApp`: funcao importada do Firebase para iniciar o app.
- `getAuth`: funcao importada para usar autenticacao/login.
- `setPersistence`: define como a sessao do usuario sera mantida.
- `browserLocalPersistence`: faz o login continuar salvo no navegador.
- `getFirestore`: permite usar o banco de dados Firestore.
- `firebaseConfig`: objeto com as credenciais e configuracoes do projeto Firebase.
- `app`: instancia principal do Firebase no site.
- `auth`: objeto usado para login, logout e verificacao de usuario.
- `db`: objeto usado para acessar o Firestore.
- `persistenceReady`: promessa que configura a persistencia local do login.

## `js/auth.js`

Arquivo central de autenticacao, permissoes e funcoes utilitarias usadas por outras telas.

### Constantes e estados

- `LOGIN_URL`: caminho da pagina de login.
- `HOME_URL`: caminho da pagina principal de chamados.
- `pageName`: pega o valor de `data-page` no `body` para saber em qual tela esta.
- `isLoginPage`: identifica se a pagina atual e a tela de login.
- `currentUser`: guarda o usuario logado no momento.
- `currentUserProfile`: guarda dados extras do usuario vindos da colecao `usuarios`.
- `authResolved`: indica se o Firebase ja terminou de verificar o login.
- `authReady`: promessa que so termina quando o estado de login foi carregado.

### Funcoes exportadas

- `getCurrentUser()`: retorna o usuario logado.
- `getCurrentUserProfile()`: retorna o perfil do usuario logado.
- `isAdmin(profile)`: verifica se o perfil do usuario e `admin`.
- `isActiveProfile(profile)`: confirma se o usuario esta cadastrado e ativo na colecao `usuarios`.
- `getUserName(user)`: retorna o melhor nome para mostrar na interface.
- `toast(message, type)`: mostra uma mensagem visual na tela, de sucesso ou erro.
- `setLoading(button, loading, fallbackLabel)`: muda um botao para estado de carregamento.
- `formatDate(value)`: formata uma data para o padrao brasileiro.
- `statusInfo(status)`: transforma o status em texto e classe CSS.
- `priorityLabel(priority)`: transforma o valor da prioridade em texto legivel.
- `ticketDisplayId(ticket)`: cria o ID exibido do chamado.
- `filesToAttachments(fileGroups, maxFileSize, maxTotalSize)`: transforma arquivos enviados em anexos salvos no chamado.
- `downloadAttachment(attachment)`: baixa um anexo.
- `formatFileSize(bytes)`: transforma tamanho em bytes para B, KB ou MB.
- `firebaseErrorMessage(error)`: traduz erros do Firebase para mensagens mais claras.

### Funcoes internas

- `loadUserProfile(user)`: busca o perfil do usuario na colecao `usuarios`; se nao existir cadastro ativo, o acesso e bloqueado.
- `setupGlobalUi()`: configura logout, menu ativo e botao de mostrar/ocultar senha.
- `setupLoginForm()`: controla o envio do formulario de login, autentica no Firebase e confirma se existe cadastro ativo em `usuarios/{UID}`.
- `updateUserInterface(user)`: atualiza nome do usuario e visibilidade do botao sair.
- `updatePermissionUi()`: mostra ou esconde elementos marcados como admin ou usuario.
- `protectCurrentRoute(user)`: protege paginas que precisam de login, cadastro ativo e permissao de admin quando necessario.
- `redirectTo(url)`: redireciona o navegador para outra pagina.
- `readFileAsDataUrl(file)`: converte arquivo em texto base64 para salvar como anexo.
- `normalize(value)`: remove acentos, deixa minusculo e tira espacos extras.
- `titleCase(value)`: transforma um texto em formato de nome proprio.

## `js/abrirchamados.js`

Arquivo responsavel pela tela de abertura de chamados.

### Estados

- `form`: pega o formulario `#openTicketForm`.
- `invalidToastVisible`: evita mostrar varias mensagens de erro repetidas ao mesmo tempo.

### Fluxo inicial

- `authReady.then(...)`: espera o login carregar. Se houver usuario logado e formulario na pagina, chama `setupForm(user)`.

### Funcoes

- `setupForm(user)`: configura os eventos do formulario de abertura de chamado.
  - Escuta campos invalidos.
  - Escuta o envio do formulario.
  - Pega os dados digitados pelo usuario.
  - Valida campos obrigatorios.
  - Converte anexos com `filesToAttachments`.
  - Cria um novo documento na colecao `chamados`.
  - Cria a primeira atualizacao na subcolecao `updates`.
  - Salva tudo usando `writeBatch`.
  - Redireciona para a pagina de visualizacao do chamado criado.
- `showRequiredFieldsToast()`: mostra aviso quando campos obrigatorios nao foram preenchidos.

## `js/chamados.js`

Arquivo responsavel pela listagem de chamados.

### Elementos da tela

- `tableBody`: corpo da tabela de chamados.
- `tableFrame`: moldura visual usada para medir a altura disponivel da tabela.
- `tableSummary`: texto que mostra quantos chamados estao aparecendo.
- `tableFooter`: rodape interno da tabela, usado para calcular o espaco que sobra para os chamados.
- `appFooter`: rodape fixo do sistema, usado no calculo de altura disponivel.
- `pagination`: area dos botoes de paginacao.
- `searchInput`: campo de busca.

### Estados

- `tickets`: lista completa de chamados carregados.
- `filteredTickets`: lista filtrada pela busca.
- `unsubscribeTickets`: funcao para parar de escutar atualizacoes do Firestore.
- `userTicketSources`: mapa usado para juntar chamados encontrados por UID e por e-mail.
- `currentPage`: pagina atual da tabela.
- `pageSize`: quantidade de chamados por pagina; calcula pela altura real da tabela e mantem poucos cards em telas compactas.

### Fluxo inicial

- `authReady.then(...)`: depois do login, carrega os chamados do usuario.
- `searchInput.addEventListener("input", ...)`: aplica filtro quando o usuario digita na busca.

### Funcoes

- `subscribeToTickets(user)`: decide quais chamados carregar.
  - Admin carrega todos os chamados.
  - Usuario comum carrega apenas chamados do proprio UID ou e-mail.
- `listenUserTickets(sourceId, ticketsQuery)`: escuta chamados do usuario em tempo real.
- `rebuildUserTickets()`: junta resultados de mais de uma busca sem duplicar chamados.
- `handleLoadError(error)`: mostra mensagem de erro se o Firestore falhar.
- `applyFilter()`: filtra chamados conforme o texto digitado.
- `renderTable()`: monta a tabela HTML com os chamados filtrados.
- `renderPagination()`: monta botoes de pagina anterior, paginas numericas e proxima.
- `createPageButton(label, page)`: cria um botao de paginacao.
- `getPageSize()`: define quantos chamados cabem melhor na tela de acordo com largura e altura.
- `balanceTableRows(rowCount)`: ajusta a altura das linhas no desktop para a tabela ocupar melhor o espaco disponivel.
- `clampNumber(value, min, max)`: limita numeros para evitar linhas grandes ou pequenas demais.
- `sortTickets(items)`: ordena chamados do mais recente para o mais antigo.
- `getTechnicianName(ticket)`: mostra o tecnico salvo no chamado; se ainda estiver sem tecnico, usa o ultimo tecnico encontrado no historico antigo.
- `getDateTime(value)`: transforma uma data em numero para comparacao.
- `formatTicketDate(value)`: separa data e hora para mostrar na tabela.
- `normalizeText(value)`: remove acentos e padroniza texto para busca.

## `js/visualizarchamados.js`

Arquivo responsavel pela tela de detalhes do chamado.

### Constantes e elementos

- `params`: le os parametros da URL.
- `ticketId`: pega o `id` do chamado na URL.
- `elements`: objeto que guarda todos os elementos importantes da tela.

### Estados

- `currentUser`: usuario logado.
- `currentTicket`: chamado carregado atualmente.
- `timelineUpdates`: lista de atualizacoes do chamado.

### Fluxo inicial

- `authReady.then(...)`: espera o login carregar.
  - Se nao houver usuario, para.
  - Se nao houver `ticketId`, volta para a lista.
  - Carrega o chamado.
  - Carrega as atualizacoes.
  - Configura formulario de resposta.
  - Configura download de anexos.
  - Configura controles de admin.

### Funcoes

- `subscribeToTicket(user)`: escuta em tempo real os dados do chamado.
- `subscribeToUpdates()`: escuta em tempo real as atualizacoes da subcolecao `updates`.
- `renderTicket()`: preenche a tela com titulo, descricao, erro, status, datas, prioridade, tecnico e anexos.
- `renderTimeline()`: monta o historico de atualizacoes.
- `updateDisplayedTechnician()`: atualiza o campo "Tecnico responsavel" na tela.
- `getDisplayedTechnicianName()`: decide se mostra o tecnico salvo ou o ultimo tecnico que respondeu na timeline.
- `renderAttachments(attachments)`: monta a lista visual de anexos.
- `setupUpdateForm(user)`: permite enviar uma nova mensagem no chamado.
- `setupAdminControls()`: ativa botoes administrativos para usuarios admin.
- `syncAdminControls()`: coloca os valores atuais do chamado nos campos de admin.
- `refreshAdminControls()`: atualiza selects e botoes depois que o chamado muda.
- `hideSelectedOption(select)`: esconde a opcao que ja esta escolhida, evitando clicar no mesmo status ou prioridade.
- `updateAdminActionState()`: desativa o botao de salvar quando nao existe alteracao real.
- `saveAdminChanges(button, options)`: salva alteracoes administrativas no chamado.
- `collectAdminChanges(nextStatus, nextPriority, nextTechnician)`: cria texto explicando quais campos mudaram.
- `setupDownloadAll()`: configura o botao "baixar todos".
- `canAccessTicket(user, ticket)`: verifica se o usuario pode acessar o chamado.
- `normalizeStatusValue(value)`: padroniza status para valores esperados.
- `normalizePriorityValue(value)`: padroniza prioridade para valores esperados.
- `normalizeText(value)`: remove acentos e padroniza texto.
- `initials(name)`: gera iniciais do nome para avatar do historico.

---

# Arquivos HTML

## `html/paginaInicial.html`

Tela de login.

- `head`: define charset, responsividade, titulo, fonte Inter e CSS `inicial.css`.
- `body data-page="login"`: identifica a pagina como login para o `auth.js`.
- `.screen-shell`: container principal da tela.
- `.main-header`: cabecalho com logo, titulo Help Desk e area do usuario.
- `.client-logo`: exibe a logo do cliente no canto direito do cabecalho.
- `#loginForm`: formulario de login.
- `#email`: campo de e-mail.
- `#password`: campo de senha.
- `.password-toggle`: botao para mostrar ou ocultar senha.
- `#robotCheck`: checkbox "Nao sou robo".
- `.primary-action`: botao de entrar.
- `<script src="../js/auth.js">`: carrega a logica de login.

## `html/paginaChamados.html`

Tela que lista chamados.

- `body data-page="chamados"`: identifica a pagina no menu.
- `.main-header`: cabecalho comum do sistema.
- `.client-logo`: exibe a logo do cliente no canto direito do cabecalho.
- `.sidebar`: menu lateral.
- Link "Abrir chamado": vai para a tela de abertura.
- Link "Chamados": fica ativo nesta tela.
- Link "Contatar suporte": vai para a pagina de suporte.
- `#ticketSearch`: campo de busca.
- `.tickets-table`: tabela dos chamados.
- `#ticketsTableBody`: local onde o JavaScript insere as linhas da tabela.
- `#tableSummary`: texto com resumo da quantidade de chamados.
- `#pagination`: botoes de paginacao.
- `auth.js`: controla login, usuario e permissoes.
- `chamados.js`: carrega, filtra e renderiza chamados.

## `html/paginaAbrirChamado.html`

Tela para abrir novo chamado.

- `body data-page="abrir"`: identifica a tela no menu.
- `.sidebar`: menu lateral.
- `#openTicketForm`: formulario principal.
- `name="titulo"`: assunto ou motivo.
- `name="tipo"`: categoria do problema.
- `name="natureza"`: incidente ou requisicao.
- `name="prioridade"`: prioridade do chamado.
- `name="descricao"`: descricao detalhada.
- `name="erro"`: erro apresentado, opcional.
- `#ticketFiles`: anexos gerais.
- `#ticketImages`: imagens ou evidencias.
- Botao "Enviar chamado": envia os dados ao Firestore.
- `auth.js`: valida login.
- `abrirchamados.js`: salva o chamado.

## `html/paginaVisualizarchamado.html`

Tela para ver e atualizar um chamado.

- `body data-page="visualizar"`: identifica a tela.
- Botao "Voltar para chamados": retorna para a lista.
- `#ticketTitle`: titulo/motivo do chamado.
- `#ticketDescription`: descricao do chamado.
- `#ticketError`: erro informado.
- `#ticketLongDetails`: tipo e natureza do chamado.
- `#ticketTimeline`: historico de atualizacoes.
- `#updateForm`: formulario para adicionar nova atualizacao.
- `#updateMessage`: mensagem da atualizacao.
- `#ticketId`: ID exibido.
- `#ticketStatus`: status atual.
- `#ticketOpened`: data de abertura.
- `#ticketUpdated`: ultima atualizacao.
- `#ticketPriority`: prioridade.
- `#ticketTechnician`: tecnico responsavel.
- `#adminControls`: area visivel apenas para admin.
- `#adminStatus`: campo para alterar status.
- `#adminPriority`: campo para alterar prioridade.
- `#adminTechnician`: campo para alterar tecnico.
- `#adminSaveBtn`: salva alteracoes administrativas.
- `#adminCloseBtn`: fecha o chamado.
- `#attachmentsList`: lista de anexos.
- `#downloadAllBtn`: baixa todos os anexos.
- `auth.js`: valida login e admin.
- `visualizarchamados.js`: carrega e atualiza o chamado.

## `html/paginaSuporte.html`

Tela de contato com suporte.

- `body data-page="suporte"`: identifica a tela no menu.
- `.support-panel`: painel principal.
- `.support-intro`: titulo e texto de orientacao.
- `.support-grid`: divide o conteudo em duas colunas.
- "Informacoes importantes": lista o que enviar ao suporte.
- "Modelo de e-mail": exemplo de mensagem.
- `.support-emails`: mostra os e-mails oficiais de suporte como texto.
- E-mails exibidos: `matheus.fernandes@geplangerenciamento.com.br` e `stephanie@geplangerenciamento.com.br`.
- `auth.js`: mantem login, logout e nome do usuario.

---

# Arquivos CSS

## `css/inicial.css`

CSS base do projeto. Ele e usado no login e tambem nas paginas internas.

### Partes principais

- `:root`: define variaveis globais de cores, tamanhos, sombras e medidas.
- `*`: aplica `box-sizing: border-box` para facilitar calculos de tamanho.
- `html, body`: remove margens e ocupa a tela inteira.
- `body`: define fonte, cor do texto e fundo.
- `button, input, select, textarea`: herdam a fonte do projeto.
- `a`: remove sublinhado dos links.
- `.screen-shell`: container de tela cheia com fundo escuro tecnologico.
- `.screen-shell::before`: cria grade sutil no fundo.
- `.circuit-bg::after`: adiciona efeito visual de circuito na tela de login.
- `.main-header`: cabecalho principal.
- `.geplan-logo`: exibe a imagem oficial da GEPLAN no canto esquerdo do cabecalho.
- `.header-center`: titulo central "Help Desk".
- `.headset-icon`: icone de headset feito com CSS.
- `.header-right`: area da direita do cabecalho.
- `.client-logo`: bloco da logo Ricardo Amaral no lado direito do cabecalho.
- `.client-logo img`: imagem real da logo do cliente no cabecalho.
- `.user-block strong`: nome do usuario logado; no mobile aparece compacto com limite de largura.
- `.hex-logo`, `.mini-hex`: simbolos hexagonais.
- `.app-footer`: rodape fixo padrao, com formato visual parecido com a sidebar.
- `.login-page .screen-shell` e `.visualizar-page .screen-shell`: reservam espaco para o rodape fixo no mobile.
- `.app-page:not(.visualizar-page) .screen-shell`: reserva espaco para rodape e menu inferior nas paginas que usam sidebar.
- `.user-block`: bloco de usuario logado.
- `.logout-btn`: botao sair.
- `.tech-card`: card com visual escuro e borda azul.
- `.tech-card::before`: animacao de brilho passando pelo card.
- `.primary-action`: estilo dos botoes principais.
- `.secondary-action`: estilo dos botoes secundarios.
- `.status-badge`: etiquetas visuais dos status dos chamados.
- `.login-main`: centraliza o card de login.
- `.login-card`: card da tela de login.
- `.login-form`: organizacao do formulario de login.
- `.input-shell`: caixa dos inputs.
- Regras de `autofill`: mantem campos preenchidos com fundo escuro e texto branco.
- `.password-toggle`: botao de mostrar/ocultar senha.
- `.captcha-box`: bloco do "Nao sou robo".
- `.fake-check`: checkbox customizado.
- `.recaptcha-mark`: simulacao visual do reCAPTCHA.
- `.toast-host`: container das mensagens.
- `.toast`: mensagem visual.
- `.toast.success`: estilo de sucesso.
- `.toast.error`: estilo de erro.
- `.layout-with-sidebar`: layout das paginas internas com menu lateral.
- `.sidebar`: menu lateral no desktop e barra inferior no mobile.
- `.sidebar-nav`: lista de links do menu; no mobile vira uma grade com tres botoes iguais.
- `.nav-link`: link do menu com icone e texto.
- `.nav-link.active`: link ativo; no mobile fica destacado sem aumentar o tamanho do botao.
- `.content-area`: area principal da tela.
- `@media`: ajustes para telas menores, incluindo cabecalho compacto com logos proporcionais da GEPLAN/Ricardo Amaral, nome do usuario, menu inferior no mobile, rodape fixo e espacamento para nao cobrir conteudo.

## `css/chamados.css`

CSS da pagina de lista de chamados.

- `.chamados-page .content-area`: define espacamento da pagina.
- `.table-card`: card principal da tabela.
- `.content-title-row`: linha com titulo e busca.
- `.search-field`: container do campo de busca.
- `.search-icon`: icone de lupa.
- `.table-frame`: moldura da tabela e variavel de altura das linhas.
- `.tickets-table`: tabela principal; no desktop usa linhas compactas para exibir mais chamados.
- `.tickets-table th`: cabecalhos da tabela.
- `.tickets-table td`: celulas da tabela.
- `.date-stack`: organiza data e hora em duas linhas.
- `.ticket-row`: linha clicavel do chamado.
- `.loading-row`: linha mostrada enquanto carrega.
- `.empty-row`: linha mostrada quando nao ha resultados.
- `.table-footer`: rodape com resumo e paginacao.
- `.pagination`: container dos botoes de pagina.
- `.page-btn`: botao de pagina.
- `.page-btn.active`: pagina selecionada.
- `@media`: transforma a tabela em cards em telas compactas, remove rolagem horizontal, evita quebra ruim de ID/status e adiciona espaco inferior para rodape/menu fixos.

## `css/abrirchamados.css`

CSS da pagina de abertura de chamado.

- `.abrir-page .layout-with-sidebar`: ajusta altura considerando rodape.
- `.abrir-page .content-area`: area do formulario.
- `.open-card`: card principal do formulario.
- `.open-heading`: cabecalho do formulario.
- `.form-columns`: divide o formulario em duas colunas.
- `.form-column`: coluna individual do formulario.
- `.field-block`: bloco de campo com label e input.
- `.field-block em`: asterisco dos campos obrigatorios.
- `.field-block input/select/textarea`: estilo dos campos.
- `.upload-box`: area clicavel para enviar arquivos.
- `.upload-copy`: textos dentro da area de upload.
- `.upload-icon`: icone de upload feito com CSS.
- `.send-ticket`: botao de enviar chamado.
- `@media`: em telas menores, transforma as colunas em uma coluna so e adiciona espaco inferior para rodape/menu fixos.

## `css/visualizarchamados.css`

CSS da pagina de visualizacao do chamado.

- `.visualizar-page .screen-shell`: fundo especifico da tela.
- `.visualizar-content`: container principal.
- `.view-header`: topo com botao voltar e titulo.
- `.back-button`: botao de voltar.
- `.visualizar-grid`: grade com detalhes, atualizacoes e informacoes.
- `.details-panel`: painel de detalhes do problema.
- `.updates-panel`: painel de historico e nova atualizacao.
- `.ticket-info`: painel de resumo do chamado.
- `.attachments-panel`: painel de anexos.
- `.readonly-field`: campo visual somente leitura.
- `.problem-description`: area da descricao.
- `.error-highlight`: destaque para o erro apresentado.
- `.timeline`: lista de atualizacoes.
- `.timeline::before`: linha vertical do historico.
- `.timeline-item`: item individual do historico.
- `.timeline-dot`: ponto da linha do tempo.
- `.timeline-avatar`: avatar com iniciais.
- `.timeline-item.technician`: estilo para atualizacao de tecnico.
- `.timeline-main`: conteudo da atualizacao.
- `.timeline-head`: autor e data da atualizacao.
- `.timeline-type`: tipo da atualizacao.
- `.update-box`: formulario de nova atualizacao.
- `.update-actions`: area do botao enviar da nova mensagem.
- `.right-stack`: coluna da direita.
- `.info-title-row`: titulo do resumo.
- `.info-chip`: etiqueta "Resumo".
- `.meta-item`: item de informacao do chamado.
- `.attachments-list`: lista de anexos.
- `.attachment-item`: item individual de anexo.
- `.file-icon`: icone de arquivo feito com CSS.
- `.download-link`: botao para baixar anexo.
- `.admin-controls`: area de controles administrativos.
- `.admin-field`: campos administrativos.
- `.admin-field-full`: faz o campo de tecnico ocupar a largura inteira da area administrativa.
- `.admin-actions`: botoes de admin.
- `@media`: reorganiza a tela para tablets e celulares, quebra informacoes/acoes administrativas em uma coluna e reserva espaco para o rodape fixo.

## `css/suporte.css`

CSS da pagina de contato com suporte.

- `.suporte-page .layout-with-sidebar`: ajusta a altura da tela com rodape.
- `.support-content`: centraliza o painel de suporte.
- `.support-panel`: card principal.
- `.support-intro`: titulo e texto inicial.
- `.support-grid`: divide conteudo em duas colunas.
- `.support-card`: card de informacoes.
- `.support-card ul`: lista de itens importantes.
- `.support-card li::before`: circulo decorativo do item.
- `.support-card li::after`: check visual do item.
- `.email-model`: bloco do modelo de e-mail.
- `.support-emails`: bloco com os e-mails oficiais de suporte.
- `@media`: em telas menores, deixa os cards em uma coluna e adiciona espaco inferior para rodape/menu fixos.

---

# Como os arquivos se conectam

## Login

1. `paginaInicial.html` carrega `auth.js`.
2. `auth.js` usa `firebase.js`.
3. O usuario envia e-mail e senha.
4. `signInWithEmailAndPassword` autentica no Firebase.
5. `loadUserProfile` procura o cadastro em `usuarios/{UID}`.
6. Se `ativo` estiver como `true`, o usuario vai para `paginaChamados.html`.
7. Se nao existir cadastro ativo, o sistema faz logout e bloqueia o acesso.

## Abrir chamado

1. `paginaAbrirChamado.html` carrega `auth.js` e `abrirchamados.js`.
2. `auth.js` confirma que ha usuario logado.
3. `abrirchamados.js` pega os dados do formulario.
4. O chamado e salvo na colecao `chamados`.
5. A primeira atualizacao e salva em `chamados/{id}/updates`.
6. O usuario e levado para a tela de visualizacao.

## Listar chamados

1. `paginaChamados.html` carrega `auth.js` e `chamados.js`.
2. Admin ve todos os chamados.
3. Usuario comum ve apenas os proprios chamados.
4. A tabela atualiza em tempo real com `onSnapshot`.
5. A busca filtra os chamados ja carregados.

## Visualizar chamado

1. `paginaVisualizarchamado.html` recebe o ID pela URL.
2. `visualizarchamados.js` busca o chamado no Firestore.
3. A tela mostra detalhes, historico da subcolecao `updates` e anexos.
4. O usuario pode mandar uma nova mensagem.
5. Admin pode alterar status, prioridade, tecnico ou fechar o chamado.
6. Quando o admin responde, o nome dele aparece como tecnico responsavel se ainda nao houver tecnico salvo.
7. Os botoes administrativos ficam desativados quando nao existe mudanca real para aplicar.

## Contatar suporte

1. `paginaSuporte.html` mostra informacoes e modelo de e-mail.
2. A pagina exibe os e-mails `matheus.fernandes@geplangerenciamento.com.br` e `stephanie@geplangerenciamento.com.br`.
3. Os e-mails aparecem como texto, sem botao e sem clique.
4. Nao ha JavaScript proprio nessa pagina alem do `auth.js`.

## Firebase e permissoes

1. A colecao de usuarios deve se chamar exatamente `usuarios`, em minusculo.
2. Cada documento em `usuarios` precisa usar como ID o UID real do Firebase Authentication.
3. O campo `perfil` define o tipo de acesso: `admin` para administradores e `usuario` para usuarios comuns.
4. O campo `ativo` precisa ser booleano e ficar como `true` para permitir login.
5. Administradores veem todos os chamados e podem alterar status, prioridade e tecnico.
6. Usuarios comuns veem somente chamados ligados ao proprio UID ou ao proprio e-mail.
7. As mensagens novas do historico ficam em `chamados/{id}/updates`.

Exemplo de admin:

```txt
usuarios/{UID_REAL_DO_ADMIN}
nome: "Nome do administrador"
email: "admin@empresa.com"
perfil: "admin"
ativo: true
```

Exemplo de usuario comum:

```txt
usuarios/{UID_REAL_DO_USUARIO}
nome: "Nome do usuario"
email: "usuario@empresa.com"
perfil: "usuario"
ativo: true
```

## Publicacao

- Para publicar somente o site: `firebase deploy --only hosting`.
- Para publicar somente as regras do banco: `firebase deploy --only firestore:rules`.
- Para publicar site e regras juntos: `firebase deploy`.
- O link publicado atual e `https://helpdesk-raageplan.web.app`.
