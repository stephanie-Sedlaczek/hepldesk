// Importa Firebase e helpers compartilhados da aplicacao.
import { db } from "./firebase.js";
import {
  authReady,
  firebaseErrorMessage,
  isAdmin,
  statusInfo,
  ticketDisplayId,
  toast
} from "./auth.js";
import {
  collection,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Seleciona os elementos da tabela, busca e paginacao.
const tableBody = document.querySelector("#ticketsTableBody");
const tableFrame = document.querySelector(".table-frame");
const tableSummary = document.querySelector("#tableSummary");
const tableFooter = document.querySelector(".table-footer");
const appFooter = document.querySelector(".app-footer");
const pagination = document.querySelector("#pagination");
const searchInput = document.querySelector("#ticketSearch");

// Guarda os chamados carregados, filtrados e controle de pagina.
let tickets = [];
let filteredTickets = [];
let unsubscribeTickets = null;
const userTicketSources = new Map();

let currentPage = 1;
let pageSize = getPageSize();

// Depois do login, inicia a escuta dos chamados do usuario.
authReady.then((user) => {
  if (!user || !tableBody) return;
  subscribeToTickets(user);
});

// Aplica o filtro sempre que o usuario digita no campo de busca.
searchInput?.addEventListener("input", () => {
  currentPage = 1;
  applyFilter();
});

// Ajusta quantos chamados aparecem conforme o espaco real da tela.
// Ao redimensionar, recalcula a pagina e a altura visual das linhas.
window.addEventListener("resize", () => {
  const nextPageSize = getPageSize();

  if (nextPageSize === pageSize) {
    renderTable();
    return;
  }

  pageSize = nextPageSize;
  currentPage = 1;
  applyFilter();
});

// Decide se carrega todos os chamados ou apenas os chamados do usuario.
function subscribeToTickets(user) {
  if (unsubscribeTickets) {
    unsubscribeTickets();
    unsubscribeTickets = null;
  }

  tickets = [];
  filteredTickets = [];
  userTicketSources.clear();

  if (isAdmin()) {
    const ticketsQuery = query(collection(db, "chamados"));

    unsubscribeTickets = onSnapshot(ticketsQuery, (snapshot) => {
      tickets = sortTickets(snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })));

      applyFilter();
    }, handleLoadError);

    return;
  }

  const unsubscribeByUid = listenUserTickets(
    "uid",
    query(collection(db, "chamados"), where("usuarioUid", "==", user.uid))
  );

  const unsubscribeByEmail = user.email
    ? listenUserTickets(
        "email",
        query(collection(db, "chamados"), where("usuarioEmail", "==", user.email))
      )
    : null;

  unsubscribeTickets = () => {
    unsubscribeByUid?.();
    unsubscribeByEmail?.();
  };
}

// Escuta uma consulta especifica de chamados em tempo real.
function listenUserTickets(sourceId, ticketsQuery) {
  return onSnapshot(ticketsQuery, (snapshot) => {
    const incomingTickets = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    userTicketSources.set(sourceId, incomingTickets);
    rebuildUserTickets();
    applyFilter();
  }, handleLoadError);
}

// Junta os resultados por UID e e-mail sem duplicar chamados.
function rebuildUserTickets() {
  const map = new Map();

  userTicketSources.forEach((sourceTickets) => {
    sourceTickets.forEach((ticket) => {
      map.set(ticket.id, ticket);
    });
  });

  tickets = sortTickets(Array.from(map.values()));
}

// Mostra mensagem na tabela se houver erro ao carregar dados.
function handleLoadError(error) {
  if (tableBody) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">N&atilde;o foi poss&iacute;vel carregar os chamados.</td>
      </tr>
    `;
  }

  balanceTableRows(0);
  toast(firebaseErrorMessage(error), "error");
}

// Filtra chamados pelo termo pesquisado e atualiza tabela/paginacao.
function applyFilter() {
  const term = normalizeText(searchInput?.value || "");

  filteredTickets = tickets.filter((ticket) => {
    const values = [
      ticketDisplayId(ticket),
      ticket.id,
      ticket.status,
      ticket.titulo,
      formatTicketDate(ticket.dataAbertura).full,
      getTechnicianName(ticket),
      ticket.usuarioNome,
      ticket.usuarioEmail
    ].join(" ");

    return normalizeText(values).includes(term);
  });

  renderTable();
  renderPagination();
}

// Renderiza as linhas da tabela ou mensagem vazia.
function renderTable() {
  if (!tableBody) return;

  if (!filteredTickets.length) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">Nenhum chamado encontrado.</td>
      </tr>
    `;

    if (tableSummary) {
      tableSummary.textContent = "Mostrando 0 chamados";
    }

    balanceTableRows(0);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * pageSize;
  const pageItems = filteredTickets.slice(start, start + pageSize);

  tableBody.replaceChildren();

  pageItems.forEach((ticket) => {
    const row = document.createElement("tr");
    row.className = "ticket-row";

    row.addEventListener("click", () => {
      window.location.href = `./paginaVisualizarchamado.html?id=${encodeURIComponent(ticket.id)}`;
    });

    const status = statusInfo(ticket.status);
    const ticketDate = formatTicketDate(ticket.dataAbertura);
    const labels = ["ID", "Status", "Motivo", "Data", "T\u00e9cnico"];

    const cells = [
      ticketDisplayId(ticket),
      "",
      ticket.titulo || "Sem motivo informado",
      "",
      getTechnicianName(ticket)
    ];

    cells.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.dataset.label = labels[index];

      if (index === 1) {
        const badge = document.createElement("span");
        badge.className = `status-badge ${status.className}`;
        badge.textContent = status.label;
        cell.appendChild(badge);
      } else if (index === 3) {
        const dateStack = document.createElement("span");
        dateStack.className = "date-stack";

        const day = document.createElement("span");
        day.className = "date-day";
        day.textContent = ticketDate.date;

        const hour = document.createElement("span");
        hour.className = "date-hour";
        hour.textContent = ticketDate.time;

        dateStack.append(day, hour);
        cell.appendChild(dateStack);
      } else {
        cell.textContent = value;
      }

      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });

  const end = Math.min(start + pageItems.length, filteredTickets.length);

  if (tableSummary) {
    tableSummary.textContent = `Mostrando ${start + 1} a ${end} de ${filteredTickets.length} chamados`;
  }

  balanceTableRows(pageItems.length);
}

// Monta os botoes de paginacao da tabela.
function renderPagination() {
  if (!pagination) return;

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));

  pagination.replaceChildren();

  const prev = createPageButton("<", Math.max(1, currentPage - 1));
  prev.disabled = currentPage === 1;
  pagination.appendChild(prev);

  for (let page = 1; page <= Math.min(totalPages, 5); page += 1) {
    const button = createPageButton(String(page), page);
    button.classList.toggle("active", page === currentPage);
    pagination.appendChild(button);
  }

  const next = createPageButton(">", Math.min(totalPages, currentPage + 1));
  next.disabled = currentPage === totalPages;
  pagination.appendChild(next);
}

// Cria um botao individual de paginacao.
function createPageButton(label, page) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-btn";
  button.textContent = label;

  button.addEventListener("click", () => {
    currentPage = page;
    renderTable();
    renderPagination();
  });

  return button;
}

// Define a quantidade de linhas por pagina usando a altura real do quadro.
// Desktop mostra mais chamados; celulares mantem poucos cards para nao ficar confuso.
function getPageSize() {
  const width = window.innerWidth;
  const isCompactLayout = window.matchMedia("(max-width: 900px)").matches;

  if (isCompactLayout) {
    return width <= 520 ? 4 : 5;
  }

  const frameHeight = tableFrame?.getBoundingClientRect().height || 0;
  const tableHeaderHeight = 44;
  const targetRowHeight = width >= 1440 ? 52 : 56;

  if (frameHeight > 140) {
    const rowsByFrame = Math.floor((frameHeight - tableHeaderHeight) / targetRowHeight);
    return clampNumber(rowsByFrame, 5, 12);
  }

  const tableFrameTop = tableFrame?.getBoundingClientRect().top || 0;
  const footerHeight = appFooter?.getBoundingClientRect().height || 58;
  const tableFooterHeight = tableFooter?.getBoundingClientRect().height || 58;
  const bottomGap = 34;
  const availableHeight = window.innerHeight - tableFrameTop - footerHeight - tableFooterHeight - bottomGap;
  const rowsByViewport = Math.floor((availableHeight - tableHeaderHeight) / targetRowHeight);

  return clampNumber(rowsByViewport, 5, 12);
}

// Distribui a altura das linhas para evitar espaco vazio no quadro da tabela.
function balanceTableRows(rowCount) {
  if (!tableFrame) return;

  const isCompactLayout = window.matchMedia("(max-width: 900px)").matches;

  if (isCompactLayout || !rowCount) {
    tableFrame.style.removeProperty("--ticket-row-height");
    return;
  }

  window.requestAnimationFrame(() => {
    const headerHeight = tableFrame.querySelector("thead")?.getBoundingClientRect().height || 48;
    const frameHeight = tableFrame.getBoundingClientRect().height;
    const availableHeight = Math.max(0, frameHeight - headerHeight);
    const rowHeight = Math.floor(availableHeight / rowCount);

    tableFrame.style.setProperty("--ticket-row-height", `${clampNumber(rowHeight, 50, 78)}px`);
  });
}

// Limita um numero entre minimo e maximo para evitar linhas grandes ou pequenas demais.
function clampNumber(value, min, max) {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.min(Math.max(safeValue, min), max);
}

// Ordena os chamados pelos mais recentes primeiro.
function sortTickets(items) {
  return items.sort((a, b) => {
    const dateB = getDateTime(b.ultimaAtualizacao || b.dataAbertura);
    const dateA = getDateTime(a.ultimaAtualizacao || a.dataAbertura);

    return dateB - dateA;
  });
}

// Mostra na tabela o tecnico salvo no chamado.
// Se ainda estiver "Nao atribuido", tenta usar o ultimo tecnico do historico antigo.
function getTechnicianName(ticket) {
  const assigned = ticket.tecnicoResponsavel || "";

  if (assigned && normalizeText(assigned) !== "nao atribuido") {
    return assigned;
  }

  const updates = Array.isArray(ticket.atualizacoes) ? ticket.atualizacoes : [];
  const technicianUpdate = updates
    .slice()
    .reverse()
    .find((update) => update?.tipoAutor === "tecnico" && update?.autor);

  return technicianUpdate?.autor || "N\u00e3o atribu\u00eddo";
}

// Converte datas do Firebase/JS em timestamp para comparacao.
function getDateTime(value) {
  if (!value) return 0;

  const date = typeof value.toDate === "function"
    ? value.toDate()
    : new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

// Formata data e hora para exibir na tabela.
function formatTicketDate(value) {
  if (!value) {
    return {
      date: "Sem data",
      time: "--:--",
      full: "Sem data"
    };
  }

  const date = typeof value.toDate === "function"
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "Sem data",
      time: "--:--",
      full: "Sem data"
    };
  }

  const day = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);

  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

  return {
    date: day,
    time,
    full: `${day} ${time}`
  };
}

// Normaliza texto para busca sem acento e sem diferenca de maiusculas.
function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
