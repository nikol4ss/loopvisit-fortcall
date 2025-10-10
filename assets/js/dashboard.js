document.addEventListener("DOMContentLoaded", async () => {
  // Verificar se as funções de autenticação estão disponíveis
  if (typeof window.TokenManager === "undefined" || typeof window.checkAuth === "undefined") {
    console.error("Funções de autenticação não encontradas. Verifique se auth.js foi carregado.")
    alert("Erro ao carregar funções de autenticação. Por favor, recarregue a página.")
    return
  }

  // Verificar autenticação
  if (!window.checkAuth()) return

  // Obter dados do usuário
  const user = window.TokenManager.getUser()
  if (!user) {
    console.error("Usuário não encontrado no token")
    window.location.href = "index.html"
    return
  }

  document.getElementById("userName").textContent = user.name || "Usuário"

  // Configurar interface baseada no role
  console.log("Role do usuário:", user.role)
  if (user.role === "GESTOR") {
    document.getElementById("relatoriosLink").style.display = "block"
    document.getElementById("consultorFilterGroup").style.display = "block"
    await loadConsultores()
  }

  // Event listeners
  document.getElementById("logoutBtn").addEventListener("click", window.logout)
  document.getElementById("applyFilters").addEventListener("click", loadDashboardData)

  // Carregar dados iniciais
  await loadDashboardData()
  await loadVisitas()
})

const loadConsultores = async () => {
  try {
    const response = await window.apiCall("/usuarios.php?role=CONSULTOR")
    const select = document.getElementById("consultorFilter")

    response.data.forEach((consultor) => {
      const option = document.createElement("option")
      option.value = consultor.id
      option.textContent = consultor.name
      select.appendChild(option)
    })
  } catch (error) {
    console.error("Erro ao carregar consultores:", error)
  }
}

const loadDashboardData = async () => {
  try {
    const params = new URLSearchParams()

    const dataInicio = document.getElementById("dataInicio").value
    const dataFim = document.getElementById("dataFim").value
    const consultor = document.getElementById("consultorFilter")?.value

    if (dataInicio) params.append("data_inicio", dataInicio)
    if (dataFim) params.append("data_fim", dataFim)
    if (consultor) params.append("consultor", consultor)

    const response = await window.apiCall(`/dashboard.php?${params}`)

    // Atualizar cards
    document.getElementById("cardAgendadas").textContent = response.cards.AGENDADA || 0
    document.getElementById("cardRealizadas").textContent = response.cards.REALIZADA || 0
    document.getElementById("cardRemarcadas").textContent = response.cards.REMARCADA || 0
    document.getElementById("cardAtrasadas").textContent = response.cards.ATRASADAS || 0
    document.getElementById("cardCanceladas").textContent = response.cards.CANCELADA || 0
  } catch (error) {
    window.showError("ERRO AO CARREGAR DADOS DO DASHBOARD")
  }
}

const loadVisitas = async () => {
  try {
    const params = new URLSearchParams()

    const dataInicio = document.getElementById("dataInicio").value
    const dataFim = document.getElementById("dataFim").value
    const status = document.getElementById("statusFilter").value
    const consultor = document.getElementById("consultorFilter")?.value

    if (dataInicio) params.append("data_inicio", dataInicio)
    if (dataFim) params.append("data_fim", dataFim)
    if (status) params.append("status", status)
    if (consultor) params.append("consultor", consultor)

    console.log("Carregando visitas com parâmetros:", params.toString())
    const response = await window.apiCall(`/visitas.php?${params}`)
    const tbody = document.getElementById("visitasTableBody")
    tbody.innerHTML = ""

    if (!response.data || response.data.length === 0) {
      const row = document.createElement("tr")
      row.innerHTML = `<td colspan="6" class="text-center">Nenhuma visita encontrada</td>`
      tbody.appendChild(row)
      return
    }

    response.data.forEach((visita) => {
      const row = document.createElement("tr")

      const statusClass = visita.status_calculado.toLowerCase().replace("ç", "c").replace("ã", "a")
      const statusBadge = `<span class="status-badge status-${statusClass}">${visita.status_calculado}</span>`

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
        <td>${new Date(visita.date).toLocaleString("pt-BR")}</td>
        <td>${visita.type}</td>
        <td>${visita.visit_sequence}</td>
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

const checkin = (visitaId) => {
  window.location.href = `visitas/checkin.html?id=${visitaId}`
}

const remarcar = (visitaId) => {
  window.location.href = `visitas/remarcar.html?id=${visitaId}`
}

const cancelar = async (visitaId) => {
  if (confirm("TEM CERTEZA QUE DESEJA CANCELAR ESTA VISITA?")) {
    try {
      await window.apiCall(`/visitas.php/${visitaId}/cancelar`, {
        method: "PATCH",
      })
      window.showSuccess("VISITA CANCELADA COM SUCESSO!")
      await loadDashboardData()
      await loadVisitas()
    } catch (error) {
      window.showError("ERRO AO CANCELAR VISITA")
    }
  }
}

const verCheckin = (visitaId) => {
  window.location.href = `visitas/ver_checkin.html?id=${visitaId}`
}

// Exportar funções para uso global
window.checkin = checkin
window.remarcar = remarcar
window.cancelar = cancelar
window.verCheckin = verCheckin
