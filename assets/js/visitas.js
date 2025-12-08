// Armazenamento de motivos persistentes
const cancelReasons = JSON.parse(localStorage.getItem("cancelReasons") || "{}");
let visitasCache = []; // Armazena dados carregados para exportação

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.checkAuth()) return;

  const user = window.TokenManager.getUser();
  document.getElementById("userName").textContent = user.name;

  if (user.role === "GESTOR") {
    document.getElementById("relatoriosLink").style.display = "block";
  }

  document.getElementById("logoutBtn").addEventListener("click", window.logout);

  document
    .getElementById("applyFilters")
    .addEventListener("click", loadVisitas);
  document
    .getElementById("clearFilters")
    .addEventListener("click", clearFilters);
  document
    .getElementById("exportExcel")
    .addEventListener("click", exportarExcel);

  document
    .getElementById("confirmCancel")
    .addEventListener("click", confirmarCancelamento);
  document
    .getElementById("closeCancel")
    .addEventListener("click", fecharModalCancelamento);

  await carregarEmpresasFiltro();
  await loadVisitas();
});

const carregarEmpresasFiltro = async () => {
  try {
    const empresas = await window.apiCall("/empresas.php");

    const select = document.getElementById("empresaFilter");
    select.innerHTML = '<option value="">Todas</option>';

    empresas.data.forEach((e) => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.name;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error("Erro ao carregar empresas", error);
  }
};

const loadVisitas = async () => {
  try {
    const params = new URLSearchParams();

    const dataInicio = document.getElementById("dataInicio").value;
    const dataFim = document.getElementById("dataFim").value;
    const status = document.getElementById("statusFilter").value;
    const tipo = document.getElementById("tipoFilter").value;
    const empresa = document.getElementById("empresaFilter").value;

    if (empresa) params.append("company_id", empresa);
    if (dataInicio) params.append("data_inicio", dataInicio);
    if (dataFim) params.append("data_fim", dataFim);
    if (status) params.append("status", status);
    if (tipo) params.append("type", tipo);

    const response = await window.apiCall(`/visitas.php?${params}`);
    const tbody = document.getElementById("visitasTableBody");
    tbody.innerHTML = "";

    visitasCache = response.data;

    if (response.data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center">NENHUMA VISITA ENCONTRADA</td></tr>';
      return;
    }

    response.data.forEach((visita) => {
      const row = document.createElement("tr");

      const statusClass = visita.status_calculado
        .toLowerCase()
        .replace("ç", "c")
        .replace("ã", "a");

      let statusContent = `<span class="status-badge status-${statusClass}">${visita.status_calculado}</span>`;

      // Adicionar badge retroativa se a visita foi criada com data no passado
      if (visita.is_retroativa == 1) {
        statusContent += '<span class="retroativa-badge">RETROATIVA</span>';
      }

      if (visita.status === "CANCELADA" && cancelReasons[visita.id]) {
        statusContent += `<br><small class="cancel-motivo">${
          cancelReasons[visita.id]
        }</small>`;
      }

      const dataFormatada = new Date(visita.date).toLocaleString("pt-BR");

      const actions = [];
      if (visita.status === "AGENDADA") {
        actions.push(
          `<button class="btn-success btn-sm" onclick="checkin(${visita.id})">CHECK-IN</button>`
        );
        actions.push(
          `<button class="btn-secondary btn-sm" onclick="remarcar(${visita.id})">REMARCAR</button>`
        );
        actions.push(
          `<button class="btn-danger btn-sm" onclick="cancelar(${visita.id})">CANCELAR</button>`
        );
      } else if (visita.status === "REMARCADA") {
        actions.push(
          `<button class="btn-success btn-sm" onclick="checkin(${visita.id})">CHECK-IN</button>`
        );
        actions.push(
          `<button class="btn-danger btn-sm" onclick="cancelar(${visita.id})">CANCELAR</button>`
        );
      } else if (visita.status === "REALIZADA") {
        actions.push(
          `<button class="btn-primary btn-sm" onclick="verCheckin(${visita.id})">VER CHECK-IN</button>`
        );
      }

      row.innerHTML = `
        <td>${
          visita.is_prospeccao == 1 ? visita.empresa_livre : visita.empresa_nome
        }</td>
        <td>${dataFormatada}</td>
        <td>${visita.type}</td>
        <td>${visita.visit_sequence}</td>
        <td>${visita.cidade_nome}</td>
        <td>${statusContent}</td>
        <td><div class="action-buttons">${actions.join("")}</div></td>
      `;

      tbody.appendChild(row);
    });
  } catch (error) {
    window.showError("ERRO AO CARREGAR VISITAS");
  }
};

const clearFilters = () => {
  document.getElementById("dataInicio").value = "";
  document.getElementById("dataFim").value = "";
  document.getElementById("statusFilter").value = "";
  document.getElementById("tipoFilter").value = "";
  document.getElementById("empresaFilter").value = "";
  loadVisitas();
};

// CHECK-IN / REMARCAR / VER
const checkin = (visitaId) => {
  window.location.href = `visitas/checkin.html?id=${visitaId}`;
};

const remarcar = (visitaId) => {
  window.location.href = `visitas/remarcar.html?id=${visitaId}`;
};

const verCheckin = (visitaId) => {
  window.location.href = `visitas/checkin.html?id=${visitaId}&readonly=true`;
};

// CANCELAMENTO
let visitaParaCancelar = null;

const cancelar = (visitaId) => {
  visitaParaCancelar = visitaId;
  document.getElementById("cancelModal").style.display = "block";
};

const confirmarCancelamento = async () => {
  const motivo = document.getElementById("cancelMotivo").value.trim();
  if (!motivo) {
    window.showError("Informe o motivo do cancelamento");
    return;
  }

  try {
    await window.apiCall(`/visitas.php/${visitaParaCancelar}/cancelar`, {
      method: "PATCH",
      body: JSON.stringify({ motivo }),
      headers: { "Content-Type": "application/json" },
    });

    cancelReasons[visitaParaCancelar] = motivo;
    localStorage.setItem("cancelReasons", JSON.stringify(cancelReasons));

    window.showSuccess("VISITA CANCELADA COM SUCESSO!");
    fecharModalCancelamento();
    await loadVisitas();
  } catch (error) {
    window.showError("ERRO AO CANCELAR VISITA");
  }
};

const fecharModalCancelamento = () => {
  document.getElementById("cancelModal").style.display = "none";
  document.getElementById("cancelMotivo").value = "";
};

// EXPORTAÇÃO PARA EXCEL
const exportarExcel = () => {
  if (visitasCache.length === 0) {
    window.showError("NENHUMA VISITA PARA EXPORTAR");
    return;
  }

  const data = visitasCache.map((v) => ({
    Empresa:
      v.is_prospeccao == 1
        ? v.empresa_livre && v.empresa_livre.trim() !== ""
          ? v.empresa_livre
          : "PROSPECÇÃO"
        : v.empresa_nome || "NÃO INFORMADO",
    Data: new Date(v.date).toLocaleString("pt-BR"),
    Tipo: v.type,
    Sequencia: v.visit_sequence,
    Cidade: v.cidade_nome,
    Status: v.status_calculado,
    Retroativa: v.is_retroativa == 1 ? "SIM" : "NÃO",
  }));

  const XLSX = window.XLSX; // Declare the XLSX variable
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Visitas");
  XLSX.writeFile(wb, "visitas.xlsx");
};

// Exportar funções globais
window.checkin = checkin;
window.remarcar = remarcar;
window.verCheckin = verCheckin;
window.cancelar = cancelar;
