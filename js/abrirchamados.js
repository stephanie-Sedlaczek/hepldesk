// Importa Firebase, helpers de autenticacao e funcoes para salvar anexos.
import { db } from "./firebase.js";
import {
  authReady,
  filesToAttachments,
  firebaseErrorMessage,
  getUserName,
  setLoading,
  toast
} from "./auth.js";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Pega o formulario da pagina de abertura de chamado.
const form = document.querySelector("#openTicketForm");
let invalidToastVisible = false;

// Espera o login carregar antes de permitir criar chamados.
authReady.then((user) => {
  if (!user || !form) return;
  setupForm(user);
});

// Configura validacao e envio do formulario de abertura.
function setupForm(user) {
  form.addEventListener("invalid", () => {
    showRequiredFieldsToast();
  }, true);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Coleta os campos preenchidos pelo usuario.
    const button = form.querySelector("[type='submit']");
    const titulo = form.titulo.value.trim();
    const tipo = form.tipo.value;
    const natureza = form.natureza.value;
    const prioridade = form.prioridade.value;
    const descricao = form.descricao.value.trim();
    const erro = form.erro.value.trim();

    // Bloqueia o envio se faltar algum campo obrigatorio.
    if (!titulo || !tipo || !natureza || !prioridade || !descricao) {
      showRequiredFieldsToast();
      form.reportValidity();
      return;
    }

    // Cria uma referencia nova no Firestore e prepara os anexos enviados.
    const ticketRef = doc(collection(db, "chamados"));
    const attachments = await filesToAttachments([
      form.ticketFiles?.files,
      form.ticketImages?.files
    ]);

    // Monta o objeto principal do chamado que sera salvo no banco.
    const ticket = {
      id: ticketRef.id,
      titulo,
      descricao,
      erro,
      tipo,
      natureza,
      status: "Aberto",
      prioridade,
      tecnicoResponsavel: "N\u00e3o atribu\u00eddo",
      usuarioUid: user.uid,
      usuarioNome: getUserName(user),
      usuarioEmail: user.email,
      dataAbertura: serverTimestamp(),
      ultimaAtualizacao: serverTimestamp(),
      anexos: attachments,
      // Mantem um historico inicial simples no documento para compatibilidade.
      // As novas mensagens ficam principalmente em chamados/{id}/updates.
      atualizacoes: [
        {
          mensagem: "Chamado aberto pelo solicitante.",
          autor: getUserName(user),
          tipoAutor: "solicitante",
          tipo: "Abertura",
          data: new Date().toISOString()
        }
      ]
    };

    try {
      setLoading(button, true, "ENVIANDO...");

      // Usa batch para salvar chamado e primeira atualizacao juntos.
      const firstUpdateRef = doc(collection(db, "chamados", ticketRef.id, "updates"));
      const batch = writeBatch(db);

      batch.set(ticketRef, ticket);
      batch.set(firstUpdateRef, {
        mensagem: ticket.descricao,
        autor: getUserName(user),
        tipoAutor: "solicitante",
        tipo: "Abertura",
        anexos: attachments,
        data: serverTimestamp()
      });

      await batch.commit();
      toast("Chamado enviado com sucesso.");
      window.location.href = `/html/paginaVisualizarchamado.html?id=${encodeURIComponent(ticketRef.id)}`;
    } catch (error) {
      toast(firebaseErrorMessage(error), "error");
    } finally {
      setLoading(button, false);
    }
  });
}

// Mostra aviso de campos obrigatorios sem repetir varias mensagens seguidas.
function showRequiredFieldsToast() {
  if (invalidToastVisible) return;

  invalidToastVisible = true;
  toast("Preencha todos os campos obrigat\u00f3rios.", "error");

  window.setTimeout(() => {
    invalidToastVisible = false;
  }, 900);
}
