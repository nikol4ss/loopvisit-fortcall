document.addEventListener("DOMContentLoaded", async () => {
  // Verificar autenticação
  if (!window.checkAuth()) return

  const user = window.TokenManager.getUser()
  document.getElementById("userName").textContent = user.name

  if (user.role === "GESTOR") {
    document.getElementById("relatoriosLink").style.display = "block"
  }

  // Event listeners
  document.getElementById("logoutBtn").addEventListener("click", window.logout)
  document.getElementById("applyFilters").addEventListener("click", loadVisitas)
  document.getElementById("clearFilters").addEventListener("click", clearFilters)

  // Carregar visitas inicialmente
  await loadVisitas()
})

const loadVisitas = async () => {
  try {
    const params = new URLSearchParams()

    const dataInicio = document.getElementById("dataInicio").value
    const dataFim = document.getElementById("dataFim").value
    const status = document.getElementById("statusFilter").value
    const tipo = document.getElementById("tipoFilter").value

    if (dataInicio) params.append("data_inicio", dataInicio)
    if (dataFim) params.append("data_fim", dataFim)
    if (status) params.append("status", status)
    if (tipo) params.append("type", tipo)

    const response = await window.apiCall(`/visitas.php?${params}`)
    const tbody = document.getElementById("visitasTableBody")
    tbody.innerHTML = ""

    if (response.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">NENHUMA VISITA ENCONTRADA</td></tr>'
      return
    }

    response.data.forEach((visita) => {
      const row = document.createElement("tr")

      const statusClass = visita.status_calculado.toLowerCase().replace("ç", "c").replace("ã", "a")
      const statusBadge = `<span class="status-badge status-${statusClass}">${visita.status_calculado}</span>`

      const dataFormatada = new Date(visita.date).toLocaleString("pt-BR")

      const actions = []

      // Lógica de ações baseada no status
      if (visita.status === "AGENDADA") {
        actions.push(`<button class="btn-success btn-sm" onclick="checkin(${visita.id})">CHECK-IN</button>`)
        actions.push(`<button class="btn-secondary btn-sm" onclick="remarcar(${visita.id})">REMARCAR</button>`)
        actions.push(`<button class="btn-danger btn-sm" onclick="cancelar(${visita.id})">CANCELAR</button>`)
      } else if (visita.status === "REMARCADA") {
        // Visitas remarcadas podem ser realizadas (check-in) ou canceladas, mas NÃO remarcadas novamente
        actions.push(`<button class="btn-success btn-sm" onclick="checkin(${visita.id})">CHECK-IN</button>`)
        actions.push(`<button class="btn-danger btn-sm" onclick="cancelar(${visita.id})">CANCELAR</button>`)
      } else if (visita.status === "REALIZADA") {
        actions.push(`<button class="btn-primary btn-sm" onclick="verCheckin(${visita.id})">VER CHECK-IN</button>`)
      }
      // Visitas canceladas não têm ações disponíveis

      row.innerHTML = `
        <td>${visita.empresa_nome}</td>
        <td>${dataFormatada}</td>
        <td>${visita.type}</td>
        <td>${visita.visit_sequence}</td>
        <td>${visita.cidade_nome}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-buttons">
            ${actions.join("")}
          </div>
        </td>
      `

      tbody.appendChild(row)
    })
  } catch (error) {
    window.showError("ERRO AO CARREGAR VISITAS")
  }
}

const clearFilters = () => {
  document.getElementById("dataInicio").value = ""
  document.getElementById("dataFim").value = ""
  document.getElementById("statusFilter").value = ""
  document.getElementById("tipoFilter").value = ""
  loadVisitas()
}

const checkin = (visitaId) => {
  window.location.href = `visitas/checkin.html?id=${visitaId}`
}

const remarcar = (visitaId) => {
  window.location.href = `visitas/remarcar.html?id=${visitaId}`
}

const verCheckin = (visitaId) => {
  window.location.href = `visitas/checkin.html?id=${visitaId}&readonly=true`
}

const cancelar = async (visitaId) => {
  if (confirm("TEM CERTEZA QUE DESEJA CANCELAR ESTA VISITA?")) {
    try {
      await window.apiCall(`/visitas.php/${visitaId}/cancelar`, {
        method: "PATCH",
      })
      window.showSuccess("VISITA CANCELADA COM SUCESSO!")
      await loadVisitas()
    } catch (error) {
      window.showError("ERRO AO CANCELAR VISITA")
    }
  }
}

// Exportar funções para uso global
window.checkin = checkin
window.remarcar = remarcar
window.verCheckin = verCheckin
window.cancelar = cancelar
