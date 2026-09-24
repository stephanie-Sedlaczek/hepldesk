// Importa Firebase e funcoes compartilhadas usadas na tela do chamado.
import { db } from "./firebase.js";
import {
  authReady,
  downloadAttachment,
  firebaseErrorMessage,
  formatDate,
  formatFileSize,
  getUserName,
  isAdmin,
  priorityLabel,
  setLoading,
  statusInfo,
  ticketDisplayId,
  toast
} from "./auth.js";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Pega o ID do chamado enviado pela URL.
const params = new URLSearchParams(window.location.search);
const ticketId = params.get("id");
// Centraliza todos os elementos da pagina usados pelo JavaScript.
const elements = {
  title: document.querySelector("#ticketTitle"),
  description: document.querySelector("#ticketDescription"),
  error: document.querySelector("#ticketError"),
  longDetails: document.querySelector("#ticketLongDetails"),
  id: document.querySelector("#ticketId"),
  status: document.querySelector("#ticketStatus"),
  opened: document.querySelector("#ticketOpened"),
  updated: document.querySelector("#ticketUpdated"),
  priority: document.querySelector("#ticketPriority"),
  technician: document.querySelector("#ticketTechnician"),
  timeline: document.querySelector("#ticketTimeline"),
  attachments: document.querySelector("#attachmentsList"),
  updateForm: document.querySelector("#updateForm"),
  downloadAll: document.querySelector("#downloadAllBtn"),
  adminControls: document.querySelector("#adminControls"),
  adminStatus: document.querySelector("#adminStatus"),
  adminPriority: document.querySelector("#adminPriority"),
  adminTechnician: document.querySelector("#adminTechnician"),
  adminSave: document.querySelector("#adminSaveBtn"),
  adminClose: document.querySelector("#adminCloseBtn")
};

// Guarda o usuario atual, o chamado carregado e as atualizacoes da timeline.
let currentUser = null;
let currentTicket = null;
let timelineUpdates = [];

// Depois do login, carrega o chamado e configura a tela.
authReady.then((user) => {
  currentUser = user;

  if (!user) return;

  if (!ticketId) {
    toast("Chamado n\u00e3o informado.", "error");
    window.location.href = "/html/paginaChamados.html";
    return;
  }

  subscribeToTicket(user);
  subscribeToUpdates();
  setupUpdateForm(user);
  setupDownloadAll();
  setupAdminControls();
});

// Escuta os dados principais do chamado em tempo real.
function subscribeToTicket(user) {
  const ticketRef = doc(db, "chamados", ticketId);

  onSnapshot(ticketRef, (snapshot) => {
    if (!snapshot.exists()) {
      toast("Chamado n\u00e3o encontrado.", "error");
      window.location.href = "/html/paginaChamados.html";
      return;
    }

    const ticket = {
      id: snapshot.id,
      ...snapshot.data()
    };

    if (!canAccessTicket(user, ticket)) {
      toast("Voc\u00ea n\u00e3o tem permiss\u00e3o para visualizar este chamado.", "error");
      window.location.href = "/html/paginaChamados.html";
      return;
    }

    currentTicket = ticket;
    renderTicket();
  }, (error) => {
    toast(firebaseErrorMessage(error), "error");
  });
}

// Escuta as atualizacoes do chamado em tempo real.
function subscribeToUpdates() {
  const updatesQuery = query(
    collection(db, "chamados", ticketId, "updates"),
    orderBy("data", "asc")
  );

  onSnapshot(updatesQuery, (snapshot) => {
    timelineUpdates = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    renderTimeline();
  }, (error) => {
    toast(firebaseErrorMessage(error), "error");
  });
}

// Preenche os campos visuais com os dados do chamado carregado.
function renderTicket() {
  if (!currentTicket) return;

  const status = statusInfo(currentTicket.status);
  const attachments = currentTicket.anexos || [];

  elements.title.textContent = currentTicket.titulo || "Sem motivo informado";
  elements.description.textContent = currentTicket.descricao || "Sem descri\u00e7\u00e3o.";
  elements.error.textContent = currentTicket.erro || "Sem erro destacado.";
  elements.longDetails.textContent = [
    currentTicket.tipo ? `Tipo: ${currentTicket.tipo}.` : "",
    currentTicket.natureza ? `Natureza: ${currentTicket.natureza}.` : ""
  ].filter(Boolean).join(" ");

  elements.id.textContent = ticketDisplayId(currentTicket);
  elements.status.className = `status-badge ${status.className}`;
  elements.status.textContent = status.label;
  elements.opened.textContent = formatDate(currentTicket.dataAbertura);
  elements.updated.textContent = formatDate(currentTicket.ultimaAtualizacao);
  elements.priority.replaceChildren();

  const dot = document.createElement("span");
  dot.className = "priority-dot";
  elements.priority.append(dot, ` ${priorityLabel(currentTicket.prioridade)}`);
  updateDisplayedTechnician();

  renderAttachments(attachments);
  syncAdminControls();

  if (!timelineUpdates.length) {
    renderTimeline();
  }
}

// Monta a linha do tempo com as mensagens e historico do chamado.
function renderTimeline() {
  if (!elements.timeline) return;

  const fallback = (currentTicket?.atualizacoes || []).map((item) => ({
    ...item,
    data: item.data || currentTicket?.dataAbertura
  }));

  const updates = timelineUpdates.length ? timelineUpdates : fallback;
  elements.timeline.replaceChildren();

  if (!updates.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Nenhuma atualiza\u00e7\u00e3o registrada.";
    elements.timeline.appendChild(empty);
    return;
  }

  updates.forEach((update) => {
    const item = document.createElement("article");
    const isTechnician = update.tipoAutor === "tecnico";
    item.className = `timeline-item ${isTechnician ? "technician" : "user"}`;

    const dot = document.createElement("span");
    dot.className = "timeline-dot";

    const main = document.createElement("div");
    main.className = "timeline-main";

    const head = document.createElement("div");
    head.className = "timeline-head";

    const avatar = document.createElement("span");
    avatar.className = "timeline-avatar";
    avatar.textContent = initials(update.autor);

    const author = document.createElement("strong");
    author.textContent = `${update.autor || "Usu\u00e1rio"} (${isTechnician ? "T\u00e9cnico" : "Solicitante"})`;

    const time = document.createElement("time");
    time.textContent = formatDate(update.data);

    head.append(avatar, author, time);

    const message = document.createElement("p");
    message.textContent = update.mensagem || "Atualiza\u00e7\u00e3o sem mensagem.";

    main.append(head, message);

    if (update.anexos?.length) {
      const attachmentNote = document.createElement("p");
      attachmentNote.className = "muted";
      attachmentNote.textContent = `${update.anexos.length} anexo(s) enviado(s).`;
      main.appendChild(attachmentNote);
    }

    const type = document.createElement("span");
    type.className = "timeline-type";
    type.textContent = update.tipo || "Atualiza\u00e7\u00e3o";

    item.append(dot, main, type);
    elements.timeline.appendChild(item);
  });

  updateDisplayedTechnician();
}

// Atualiza o campo visual "Tecnico responsavel" sempre que o chamado ou timeline muda.
function updateDisplayedTechnician() {
  if (!elements.technician) return;
  elements.technician.textContent = getDisplayedTechnicianName();
}

// Decide qual nome deve aparecer como tecnico responsavel na tela.
// Prioridade: campo salvo no chamado; depois, ultima resposta feita por tecnico.
function getDisplayedTechnicianName() {
  const assigned = currentTicket?.tecnicoResponsavel || "";

  if (assigned && normalizeText(assigned) !== "nao atribuido") {
    return assigned;
  }

  const updates = timelineUpdates.length
    ? timelineUpdates
    : Array.isArray(currentTicket?.atualizacoes)
      ? currentTicket.atualizacoes
      : [];

  const technicianUpdate = updates
    .slice()
    .reverse()
    .find((update) => update?.tipoAutor === "tecnico" && update?.autor);

  return technicianUpdate?.autor || "N\u00e3o atribu\u00eddo";
}

// Mostra os anexos do chamado e cria botoes de download.
function renderAttachments(attachments) {
  elements.attachments.replaceChildren();

  if (!attachments.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Nenhum anexo.";
    elements.attachments.appendChild(empty);
    return;
  }

  attachments.forEach((attachment) => {
    const item = document.createElement("div");
    item.className = "attachment-item";

    const icon = document.createElement("span");
    icon.className = "file-icon";

    const meta = document.createElement("div");
    meta.className = "attachment-meta";
    const name = document.createElement("strong");
    name.textContent = attachment.nome || "Arquivo";
    const date = document.createElement("span");
    date.textContent = `${formatDate(attachment.dataEnvio)} \u2022 ${formatFileSize(attachment.tamanho)}`;
    meta.append(name, date);

    const download = document.createElement("button");
    download.type = "button";
    download.className = "download-link";
    download.textContent = "\u2193";
    download.addEventListener("click", () => downloadAttachment(attachment));

    item.append(icon, meta, download);
    elements.attachments.appendChild(item);
  });
}

// Configura o formulario para adicionar nova mensagem ao chamado.
function setupUpdateForm(user) {
  const form = elements.updateForm;
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Garante que somente usuarios autorizados atualizem o chamado.
    if (!currentTicket || !canAccessTicket(user, currentTicket)) {
      toast("Voc\u00ea n\u00e3o tem permiss\u00e3o para atualizar este chamado.", "error");
      return;
    }

    // Coleta a mensagem digitada e define se ela veio de tecnico/admin.
    const button = form.querySelector("[type='submit']");
    const message = form.mensagem.value.trim();
    const userIsAdmin = isAdmin();

    if (!message) {
      toast("Digite uma mensagem para atualizar o chamado.", "error");
      return;
    }

    const update = {
      mensagem: message,
      autor: getUserName(user),
      tipoAutor: userIsAdmin ? "tecnico" : "solicitante",
      tipo: userIsAdmin ? "Atualiza\u00e7\u00e3o t\u00e9cnica" : "Atualiza\u00e7\u00e3o",
      data: new Date().toISOString()
    };

    try {
      setLoading(button, true, "ENVIANDO...");

      // Salva a atualizacao na subcolecao e atualiza a data do chamado.
      const ticketRef = doc(db, "chamados", ticketId);
      const updateRef = doc(collection(db, "chamados", ticketId, "updates"));
      const batch = writeBatch(db);
      const ticketUpdate = {
        ultimaAtualizacao: serverTimestamp()
      };

      batch.set(updateRef, {
        ...update,
        data: serverTimestamp()
      });
      batch.update(ticketRef, ticketUpdate);

      await batch.commit();
      form.reset();
      toast("Atualiza\u00e7\u00e3o adicionada.");
    } catch (error) {
      toast(firebaseErrorMessage(error), "error");
    } finally {
      setLoading(button, false);
    }
  });
}

// Mostra e configura os controles administrativos quando o usuario e admin.
// Os botoes so ficam uteis quando existe alguma mudanca real para salvar.
function setupAdminControls() {
  if (!elements.adminControls) return;

  elements.adminControls.hidden = !isAdmin();

  [elements.adminStatus, elements.adminPriority].forEach((select) => {
    select?.addEventListener("change", () => {
      hideSelectedOption(select);
      updateAdminActionState();
    });
  });

  elements.adminTechnician?.addEventListener("input", updateAdminActionState);

  elements.adminSave?.addEventListener("click", () => {
    saveAdminChanges(elements.adminSave);
  });

  elements.adminClose?.addEventListener("click", () => {
    saveAdminChanges(elements.adminClose, { closeTicket: true });
  });
}

// Atualiza os campos administrativos com os dados atuais do chamado.
// Se o chamado ainda nao tem tecnico, sugere o nome do admin logado.
function syncAdminControls() {
  const admin = isAdmin();

  if (!elements.adminControls) return;

  elements.adminControls.hidden = !admin;

  if (!admin || !currentTicket) return;

  if (elements.adminStatus) {
    elements.adminStatus.value = normalizeStatusValue(currentTicket.status);
  }

  if (elements.adminPriority) {
    elements.adminPriority.value = normalizePriorityValue(currentTicket.prioridade);
  }

  if (elements.adminTechnician) {
    const technician = currentTicket.tecnicoResponsavel || "";
    elements.adminTechnician.value = normalizeText(technician) === "nao atribuido" ? getUserName(currentUser) : technician;
  }

  refreshAdminControls();
}

// Atualiza selects e botoes administrativos conforme o estado atual do chamado.
function refreshAdminControls() {
  hideSelectedOption(elements.adminStatus);
  hideSelectedOption(elements.adminPriority);
  updateAdminActionState();
}

// Esconde e desabilita a opcao que ja esta escolhida no select.
// Assim o admin nao clica no mesmo status/prioridade que ja estava selecionado.
function hideSelectedOption(select) {
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    const isSelected = option.value === select.value;
    option.hidden = isSelected;
    option.disabled = isSelected;
  });
}

// Evita salvar/fechar quando nao ha mudanca real para aplicar.
// Tambem bloqueia "Fechar chamado" se ele ja estiver como resolvido.
function updateAdminActionState() {
  if (!currentTicket) return;

  const nextStatus = elements.adminStatus?.value || normalizeStatusValue(currentTicket.status);
  const nextPriority = elements.adminPriority?.value || normalizePriorityValue(currentTicket.prioridade);
  const nextTechnician = elements.adminTechnician?.value.trim() || getUserName(currentUser);
  const hasChanges = collectAdminChanges(nextStatus, nextPriority, nextTechnician).length > 0;
  const alreadyClosed = normalizeStatusValue(currentTicket.status) === "Resolvido";

  if (elements.adminSave) {
    elements.adminSave.disabled = !hasChanges;
  }

  if (elements.adminClose) {
    elements.adminClose.disabled = alreadyClosed;
  }
}

// Salva mudancas administrativas de status, prioridade, tecnico ou fechamento.
// Cada alteracao tambem entra na timeline para o solicitante acompanhar.
async function saveAdminChanges(button, options = {}) {
  if (!isAdmin()) {
    toast("Apenas administradores podem executar esta a\u00e7\u00e3o.", "error");
    return;
  }

  if (!currentTicket) {
    toast("Aguarde o chamado carregar.", "error");
    return;
  }

  const nextStatus = options.closeTicket ? "Resolvido" : elements.adminStatus?.value || normalizeStatusValue(currentTicket.status);
  const nextPriority = elements.adminPriority?.value || normalizePriorityValue(currentTicket.prioridade);
  const nextTechnician = elements.adminTechnician?.value.trim() || getUserName(currentUser);
  const changes = collectAdminChanges(nextStatus, nextPriority, nextTechnician);

  if (!options.closeTicket && !changes.length) {
    toast("Nenhuma altera\u00e7\u00e3o para salvar.", "error");
    return;
  }

  const update = {
    mensagem: options.closeTicket
      ? "Chamado fechado pelo administrador."
      : `Altera\u00e7\u00f5es administrativas: ${changes.join("; ")}.`,
    autor: getUserName(currentUser),
    tipoAutor: "tecnico",
    tipo: options.closeTicket ? "Fechamento" : "Administra\u00e7\u00e3o",
    data: new Date().toISOString()
  };

  try {
    setLoading(button, true, options.closeTicket ? "FECHANDO..." : "SALVANDO...");

    const ticketRef = doc(db, "chamados", ticketId);
    const updateRef = doc(collection(db, "chamados", ticketId, "updates"));
    const batch = writeBatch(db);

    batch.set(updateRef, {
      ...update,
      data: serverTimestamp()
    });
    batch.update(ticketRef, {
      status: nextStatus,
      prioridade: nextPriority,
      tecnicoResponsavel: nextTechnician,
      ultimaAtualizacao: serverTimestamp()
    });

    await batch.commit();
    toast(options.closeTicket ? "Chamado fechado." : "Chamado atualizado.");
  } catch (error) {
    toast(firebaseErrorMessage(error), "error");
  } finally {
    setLoading(button, false);
    updateAdminActionState();
  }
}

// Monta um texto informando quais campos administrativos foram alterados.
function collectAdminChanges(nextStatus, nextPriority, nextTechnician) {
  const changes = [];
  const currentStatus = normalizeStatusValue(currentTicket.status);
  const currentPriority = normalizePriorityValue(currentTicket.prioridade);
  const currentTechnician = currentTicket.tecnicoResponsavel || "N\u00e3o atribu\u00eddo";

  if (normalizeText(currentStatus) !== normalizeText(nextStatus)) {
    changes.push(`status para ${nextStatus}`);
  }

  if (normalizeText(currentPriority) !== normalizeText(nextPriority)) {
    changes.push(`prioridade para ${priorityLabel(nextPriority)}`);
  }

  if (normalizeText(currentTechnician) !== normalizeText(nextTechnician)) {
    changes.push(`t\u00e9cnico respons\u00e1vel para ${nextTechnician}`);
  }

  return changes;
}

// Baixa todos os anexos do chamado em sequencia.
function setupDownloadAll() {
  elements.downloadAll?.addEventListener("click", () => {
    const attachments = currentTicket?.anexos || [];

    if (!attachments.length) {
      toast("Este chamado n\u00e3o possui anexos.", "error");
      return;
    }

    attachments.forEach((attachment, index) => {
      window.setTimeout(() => downloadAttachment(attachment), index * 250);
    });
  });
}

// Verifica se o usuario atual pode visualizar/atualizar o chamado.
function canAccessTicket(user, ticket) {
  if (isAdmin()) return true;
  if (!user || !ticket) return false;

  const sameUid = ticket.usuarioUid && ticket.usuarioUid === user.uid;
  const sameEmail = ticket.usuarioEmail && user.email && normalizeText(ticket.usuarioEmail) === normalizeText(user.email);

  return Boolean(sameUid || sameEmail);
}

// Padroniza textos de status para os valores usados na tela.
function normalizeStatusValue(value = "") {
  const normalized = normalizeText(value);

  if (normalized.includes("andamento")) return "Em andamento";
  if (normalized.includes("aguardando")) return "Aguardando retorno";
  if (normalized.includes("resolvido") || normalized.includes("fechado")) return "Resolvido";
  return "Aberto";
}

// Padroniza textos de prioridade para os valores usados na tela.
function normalizePriorityValue(value = "") {
  const normalized = normalizeText(value);

  if (normalized.includes("crit")) return "critica";
  if (normalized.includes("alta")) return "alta";
  if (normalized.includes("baixa")) return "baixa";
  return "media";
}

// Normaliza texto para comparacoes sem acento e sem maiusculas.
function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Gera iniciais do nome para o avatar da timeline.
function initials(name = "Usu\u00e1rio") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";
}
