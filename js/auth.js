// Importa a conexao com Firebase e os recursos de login/perfil.
import { auth, db, persistenceReady } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Define as paginas principais usadas para redirecionamento.
const LOGIN_URL = new URL("../html/paginaInicial.html", import.meta.url).href;
const HOME_URL = new URL("../html/paginaChamados.html", import.meta.url).href;
const pageName = document.body.dataset.page;
const isLoginPage = pageName === "login";

// Guarda o usuario e o perfil carregados durante a sessao atual.
let currentUser = null;
let currentUserProfile = null;
let authResolved = false;

// Espera o Firebase confirmar se existe usuario logado antes de liberar as telas.
export const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    currentUserProfile = user ? await loadUserProfile(user) : null;
    authResolved = true;

    updateUserInterface(user);
    updatePermissionUi();
    protectCurrentRoute(user);

    resolve(user);
  }, (error) => {
    authResolved = true;
    currentUser = null;
    currentUserProfile = null;
    updatePermissionUi();
    toast(firebaseErrorMessage(error), "error");
    resolve(null);
  });
});

// Ativa os comportamentos globais assim que este arquivo e carregado.
setupGlobalUi();
setupLoginForm();

// Retorna o usuario autenticado no momento.
export function getCurrentUser() {
  return currentUser;
}

// Retorna os dados extras do usuario carregados do Firestore.
export function getCurrentUserProfile() {
  return currentUserProfile;
}

// Verifica se o usuario tem perfil de administrador.
export function isAdmin(profile = currentUserProfile) {
  return isActiveProfile(profile) && String(profile?.perfil || "").toLowerCase().trim() === "admin";
}

// Confirma se o usuario esta cadastrado e ativo para usar o sistema.
export function isActiveProfile(profile = currentUserProfile) {
  return Boolean(profile?.cadastroEncontrado && profile?.ativo !== false);
}

// Escolhe o melhor nome para mostrar na interface.
export function getUserName(user = currentUser) {
  if (!user) return "Visitante";
  if (currentUserProfile?.nome) return currentUserProfile.nome;
  if (user.displayName) return user.displayName;
  if (user.email) return titleCase(user.email.split("@")[0].replace(/[._-]/g, " "));
  return "Usu\u00e1rio";
}

// Mostra mensagens temporarias de sucesso ou erro na tela.
export function toast(message, type = "success") {
  let host = document.querySelector(".toast-host");

  if (!host) {
    host = document.createElement("div");
    host.className = "toast-host";
    document.body.appendChild(host);
  }

  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  host.appendChild(item);

  window.setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(10px)";
    window.setTimeout(() => item.remove(), 180);
  }, 3600);
}

// Troca o texto do botao e bloqueia clique enquanto uma acao esta carregando.
export function setLoading(button, loading, fallbackLabel = "CARREGANDO...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = button.dataset.loadingLabel || fallbackLabel;
    button.disabled = true;
    button.classList.add("is-loading");
    return;
  }

  button.textContent = button.dataset.originalLabel || button.textContent;
  button.disabled = false;
  button.classList.remove("is-loading");
}

// Formata datas do Firebase ou JavaScript para o padrao brasileiro.
export function formatDate(value) {
  if (!value) return "-";

  const date = typeof value.toDate === "function"
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

// Converte o status salvo no banco em texto e classe visual.
export function statusInfo(status = "") {
  const normalized = normalize(status);

  if (normalized.includes("andamento")) {
    return { label: "Em andamento", className: "status-andamento" };
  }

  if (normalized.includes("aguardando")) {
    return { label: "Aguardando retorno", className: "status-aguardando" };
  }

  if (normalized.includes("resolvido") || normalized.includes("fechado")) {
    return { label: "Resolvido", className: "status-resolvido" };
  }

  return { label: "Aberto", className: "status-aberto" };
}

// Converte a prioridade salva no banco em um texto legivel.
export function priorityLabel(priority = "") {
  const labels = {
    baixa: "Baixa",
    media: "M\u00e9dia",
    alta: "Alta",
    critica: "Cr\u00edtica"
  };

  return labels[normalize(priority)] || priority || "M\u00e9dia";
}

// Gera o identificador curto exibido para cada chamado.
export function ticketDisplayId(ticket) {
  if (!ticket) return "-";
  const id = ticket.id || "";
  if (ticket.numero) return ticket.numero;
  return id ? `#${id.slice(0, 6).toUpperCase()}` : "-";
}

// Le os arquivos enviados e prepara os anexos para salvar no Firestore.
export async function filesToAttachments(fileGroups, maxFileSize = 300 * 1024, maxTotalSize = 700 * 1024) {
  const files = Array.from(fileGroups || []).flatMap((group) => Array.from(group || []));
  const attachments = [];
  let totalSize = 0;

  for (const file of files) {
    if (file.size > maxFileSize) {
      toast(`Arquivo ignorado: ${file.name} excede 300 KB.`, "error");
      continue;
    }

    if (totalSize + file.size > maxTotalSize) {
      toast(`Arquivo ignorado: ${file.name} ultrapassa o limite total de anexos.`, "error");
      continue;
    }

    const dataUrl = await readFileAsDataUrl(file);
    totalSize += file.size;
    attachments.push({
      nome: file.name,
      tipo: file.type || "application/octet-stream",
      tamanho: file.size,
      dataUrl,
      dataEnvio: new Date().toISOString()
    });
  }

  return attachments;
}

// Cria um link temporario para baixar um anexo salvo.
export function downloadAttachment(attachment) {
  if (!attachment?.dataUrl) return;
  const link = document.createElement("a");
  link.href = attachment.dataUrl;
  link.download = attachment.nome || "anexo";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Converte bytes em B, KB ou MB para mostrar na tela.
export function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Traduz codigos de erro do Firebase para mensagens amigaveis.
export function firebaseErrorMessage(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "E-mail ou senha inv\u00e1lidos.",
    "auth/user-not-found": "Usu\u00e1rio n\u00e3o encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente em alguns minutos.",
    "permission-denied": "Permiss\u00e3o negada no Firebase. Revise as regras do Firestore.",
    "unavailable": "Firebase indispon\u00edvel no momento."
  };

  return messages[code] || error?.message || "Ocorreu um erro inesperado.";
}

// Busca o perfil do usuario na colecao "usuarios" do Firestore.
// O ID do documento precisa ser o UID real do Firebase Authentication.
async function loadUserProfile(user) {
  try {
    const profileRef = doc(db, "usuarios", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      return {
        uid: user.uid,
        nome: user.displayName || "",
        email: user.email || "",
        perfil: "sem-cadastro",
        ativo: false,
        cadastroEncontrado: false
      };
    }

    return {
      uid: user.uid,
      email: user.email || "",
      perfil: "usuario",
      ativo: true,
      cadastroEncontrado: true,
      ...profileSnap.data()
    };
  } catch (error) {
    console.warn("N\u00e3o foi poss\u00edvel carregar o perfil do usu\u00e1rio.", error);
    toast("N\u00e3o foi poss\u00edvel confirmar seu cadastro. Tente novamente.", "error");

    return {
      uid: user.uid,
      nome: user.displayName || "",
      email: user.email || "",
      perfil: "sem-cadastro",
      ativo: false,
      cadastroEncontrado: false
    };
  }
}

// Configura logout, menu ativo e botao de mostrar/ocultar senha.
function setupGlobalUi() {
  document.querySelectorAll(".js-logout").forEach((button) => {
    button.addEventListener("click", async () => {
      await signOut(auth);
      redirectTo(LOGIN_URL);
    });
  });

  const activePage = document.body.dataset.page;
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === activePage);
  });

  const toggle = document.querySelector(".password-toggle");
  const password = document.querySelector("#password");

  if (toggle && password) {
    toggle.addEventListener("click", () => {
      const visible = password.type === "text";
      password.type = visible ? "password" : "text";
      toggle.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
    });
  }
}

// Controla o envio do formulario de login e confirma cadastro ativo no Firestore.
function setupLoginForm() {
  const form = document.querySelector("#loginForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = form.querySelector("[type='submit']");
    const email = form.email.value.trim();
    const password = form.password.value;
    const robotCheck = form.querySelector("#robotCheck");

    if (!robotCheck?.checked) {
      toast("Confirme que voc\u00ea n\u00e3o \u00e9 rob\u00f4.", "error");
      return;
    }

    try {
      setLoading(button, true, "ENTRANDO...");
      await persistenceReady;

      // Primeiro autentica pelo Firebase Authentication.
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Depois busca o perfil em usuarios/{UID} para saber se pode entrar.
      const profile = await loadUserProfile(credential.user);
      currentUserProfile = profile;

      // Se nao existir cadastro ativo, encerra a sessao mesmo com senha correta.
      if (!isActiveProfile(profile)) {
        await signOut(auth);
        toast("Seu usuario ainda nao esta cadastrado ou esta inativo. Fale com o administrador.", "error");
        return;
      }

      toast("Login realizado com sucesso.");
      redirectTo(HOME_URL);
    } catch (error) {
      toast(firebaseErrorMessage(error), "error");
    } finally {
      setLoading(button, false);
    }
  });
}

// Atualiza textos e botoes que dependem do usuario logado.
function updateUserInterface(user) {
  document.querySelectorAll(".js-user-name").forEach((element) => {
    element.textContent = getUserName(user);
  });

  document.querySelectorAll(".js-logout").forEach((button) => {
    button.style.display = user ? "" : "none";
  });
}

// Mostra ou esconde elementos exclusivos de admin/usuario comum.
function updatePermissionUi() {
  const admin = isAdmin();

  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = !admin;
  });

  document.querySelectorAll("[data-user-only]").forEach((element) => {
    element.hidden = admin;
  });
}

// Protege paginas internas e impede acesso sem login, sem cadastro ativo ou sem permissao.
function protectCurrentRoute(user) {
  if (!authResolved) return;

  if (!user && !isLoginPage) {
    redirectTo(LOGIN_URL);
    return;
  }

  if (user && !isActiveProfile()) {
    toast("Seu usuario nao esta cadastrado ou esta inativo.", "error");
    signOut(auth).finally(() => redirectTo(LOGIN_URL));
    return;
  }

  if (user && isLoginPage) {
    redirectTo(HOME_URL);
    return;
  }

  if (user && document.body.dataset.requiresAdmin === "true" && !isAdmin()) {
    toast("Acesso restrito a administradores.", "error");
    redirectTo(HOME_URL);
  }
}

// Redireciona para outra pagina evitando recarregar a mesma URL.
function redirectTo(url) {
  if (window.location.href === url) return;
  window.location.assign(url);
}

// Converte um arquivo selecionado em Data URL para salvar como anexo.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Normaliza textos para comparacao sem acento e sem diferenca de maiusculas.
function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Transforma texto simples em formato de nome com iniciais maiusculas.
function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}
