document.addEventListener("DOMContentLoaded", () => {
  console.log("Inicializando dashboard semanal...")

  // Verificar autenticação (função síncrona)
  if (window.checkAuth()) {
    console.log("Usuário autenticado")

    // Obter dados do usuário
    const userData = window.TokenManager.getUser()
    console.log("Dados do usuário:", userData)

    // Configurar nome do usuário
    const userNameElement = document.getElementById("userName")
    if (userNameElement && userData) {
      userNameElement.textContent = userData.name || "Usuário"
    }

    // Mostrar link de relatórios apenas para gestores
    if (userData && userData.role === "GESTOR") {
      const relatoriosLink = document.getElementById("relatoriosLink")
      const gestorFilters = document.getElementById("gestorFilters")

      if (relatoriosLink) relatoriosLink.style.display = "block"
      if (gestorFilters) gestorFilters.style.display = "block"

      loadConsultores()
    }

    // Inicializar dashboard
    initWeekNavigation()
    setupEventListeners()
  } else {
    console.error("Usuário não autenticado")
    window.location.href = "index.html"
  }
})

// Variáveis globais para controle de semana
let currentWeekStart = getStartOfWeek(new Date())
let currentWeekEnd = getEndOfWeek(new Date())

// Inicializar navegação semanal
function initWeekNavigation() {
  console.log("Semana atual:", currentWeekStart, "até", currentWeekEnd)
  updateWeekDisplay()
  loadDashboardData()
}

// Configurar event listeners
function setupEventListeners() {
  // Navegação entre semanas
  const prevWeekBtn = document.getElementById("prevWeek")
  const nextWeekBtn = document.getElementById("nextWeek")

  if (prevWeekBtn) prevWeekBtn.addEventListener("click", navigateToPrevWeek)
  if (nextWeekBtn) nextWeekBtn.addEventListener("click", navigateToNextWeek)

  // Filtros (para gestores)
  const applyFiltersBtn = document.getElementById("applyFilters")
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", loadDashboardData)
  }

  // Logout - usando a função global do auth.js
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) logoutBtn.addEventListener("click", window.logout)
}

// Carregar lista de consultores (apenas para gestores)
function loadConsultores() {
  console.log("Carregando consultores...")

  window
    .apiCall("/usuarios.php?role=CONSULTOR")
    .then((response) => {
      console.log("Resposta consultores:", response)
      if (response.success) {
        const consultorSelect = document.getElementById("consultorFilter")
        if (consultorSelect) {
          response.data.forEach((consultor) => {
            const option = document.createElement("option")
            option.value = consultor.id
            option.textContent = consultor.name
            consultorSelect.appendChild(option)
          })
        }
      }
    })
    .catch((error) => {
      console.error("Erro ao carregar consultores:", error)
    })
}

// Navegar para semana anterior
function navigateToPrevWeek() {
  const prevWeekStart = new Date(currentWeekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)

  currentWeekStart = getStartOfWeek(prevWeekStart)
  currentWeekEnd = getEndOfWeek(prevWeekStart)

  console.log("Navegando para semana anterior:", currentWeekStart, "até", currentWeekEnd)
  updateWeekDisplay()
  loadDashboardData()
}

// Navegar para próxima semana
function navigateToNextWeek() {
  const nextWeekStart = new Date(currentWeekStart)
  nextWeekStart.setDate(nextWeekStart.getDate() + 7)

  currentWeekStart = getStartOfWeek(nextWeekStart)
  currentWeekEnd = getEndOfWeek(nextWeekStart)

  console.log("Navegando para próxima semana:", currentWeekStart, "até", currentWeekEnd)
  updateWeekDisplay()
  loadDashboardData()
}

// Obter data de início da semana (segunda-feira)
function getStartOfWeek(date) {
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Ajuste para começar na segunda-feira
  startOfWeek.setDate(diff)
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek
}

// Obter data de fim da semana (domingo)
function getEndOfWeek(date) {
  const endOfWeek = new Date(getStartOfWeek(date))
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  return endOfWeek
}

// Atualizar exibição da semana atual
function updateWeekDisplay() {
  // Formatar datas para exibição
  const options = { day: "2-digit", month: "2-digit", year: "numeric" }
  const startFormatted = currentWeekStart.toLocaleDateString("pt-BR", options)
  const endFormatted = currentWeekEnd.toLocaleDateString("pt-BR", options)

  // Determinar se é semana atual, passada ou futura
  const today = new Date()
  let weekTitle = "SEMANA ATUAL"

  if (currentWeekStart > today) {
    weekTitle = "SEMANA FUTURA"
  } else if (currentWeekEnd < today) {
    weekTitle = "SEMANA PASSADA"
  }

  console.log("Atualizando display da semana:", weekTitle, startFormatted, "até", endFormatted)

  // Atualizar elementos na página
  const weekTitleElement = document.getElementById("weekTitle")
  const weekPeriodElement = document.getElementById("weekPeriod")

  if (weekTitleElement) weekTitleElement.textContent = weekTitle
  if (weekPeriodElement) weekPeriodElement.textContent = `${startFormatted} até ${endFormatted}`
}

// Carregar dados do dashboard
function loadDashboardData() {
  console.log("Carregando dados do dashboard...")

  // Mostrar loading
  const tableBody = document.getElementById("visitasTableBody")
  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Carregando visitas da semana...</td></tr>'
  }

  // CORREÇÃO: Preparar parâmetros com formato correto (sem fuso horário)
  const dataInicio = formatDateForAPI(currentWeekStart)
  const dataFim = formatDateForAPI(currentWeekEnd)

  let params = `data_inicio=${dataInicio}&data_fim=${dataFim}`

  // DEBUG: Mostrar período exato da consulta
  console.log("DEBUG - Período da consulta:")
  console.log("Data início:", dataInicio, "(" + currentWeekStart.toLocaleDateString("pt-BR") + ")")
  console.log("Data fim:", dataFim, "(" + currentWeekEnd.toLocaleDateString("pt-BR") + ")")

  // Adicionar filtros se disponíveis
  const consultorFilter = document.getElementById("consultorFilter")
  if (consultorFilter && consultorFilter.value) {
    params += `&consultor=${consultorFilter.value}`
  }

  const statusFilter = document.getElementById("statusFilter")
  if (statusFilter && statusFilter.value) {
    params += `&status=${statusFilter.value}`
  }

  console.log("Parâmetros da consulta:", params)

  // Carregar cards com os mesmos filtros aplicados
  console.log("Carregando cards com parâmetros:", params)
  window
    .apiCall(`/dashboard.php?${params}`)
    .then((response) => {
      console.log("Resposta dos cards:", response)
      if (response.success) {
        updateCards(response.cards || {})
      }
    })
    .catch((error) => {
      console.error("Erro ao carregar cards:", error)
    })

  // Carregar visitas detalhadas
  const visitasParams = `${params}&action=visitas`
  console.log("Carregando visitas com parâmetros:", visitasParams)

  window
    .apiCall(`/dashboard.php?${visitasParams}`)
    .then((response) => {
      console.log("Resposta das visitas:", response)
      if (response.success) {
        renderVisitasTable(response.data || [])
      } else {
        console.error("Erro na resposta:", response.error)
        window.showError("Erro ao carregar dados do dashboard: " + (response.error || "Erro desconhecido"))
      }
    })
    .catch((error) => {
      console.error("Erro ao carregar visitas:", error)
      window.showError("Erro ao carregar dados do dashboard")
    })
}

// Atualizar cards de resumo
function updateCards(cards) {
  console.log("Atualizando cards com dados:", cards)

  const cardElements = {
    cardAgendadas: cards.AGENDADA || 0,
    cardRealizadas: cards.REALIZADA || 0,
    cardRemarcadas: cards.REMARCADA || 0,
    cardAtrasadas: cards.ATRASADAS || 0,
    cardCanceladas: cards.CANCELADA || 0,
  }

  Object.entries(cardElements).forEach(([id, value]) => {
    const element = document.getElementById(id)
    if (element) {
      console.log(`Atualizando ${id} com valor:`, value)
      element.textContent = value
    } else {
      console.error(`Elemento ${id} não encontrado`)
    }
  })
}

// Renderizar tabela de visitas
function renderVisitasTable(visitas) {
  const tableBody = document.getElementById("visitasTableBody")
  if (!tableBody) {
    console.error("Elemento visitasTableBody não encontrado")
    return
  }

  tableBody.innerHTML = ""

  if (visitas.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="8" class="text-center">Nenhuma visita encontrada para este período</td></tr>'
    return
  }

  console.log("Renderizando", visitas.length, "visitas")

  visitas.forEach((visita) => {
    const row = document.createElement("tr")

    // Adicionar classe baseada no status
    row.className = getStatusClass(visita.status_calculado)

    // Formatar informações da empresa
    let empresaInfo = visita.empresa_nome || "-"
    if (visita.empresa_cnpj) {
      empresaInfo += `<br><small class="text-muted">CNPJ: ${visita.empresa_cnpj}</small>`
    }
    if (visita.empresa_cidade) {
      empresaInfo += `<br><small class="text-muted">${visita.empresa_cidade}</small>`
    }

    // CORREÇÃO: Buscar data do check-in em múltiplos campos
    let dataCheckin = "-"
    if (visita.checkin_data) {
      dataCheckin = formatDateTime(visita.checkin_data)
    } else if (visita.data_checkin) {
      dataCheckin = formatDateTime(visita.data_checkin)
    } else if (visita.checkin_date) {
      dataCheckin = formatDateTime(visita.checkin_date)
    } else if (visita.checkin_created_at) {
      dataCheckin = formatDateTime(visita.checkin_created_at)
    } else if (visita.created_at && visita.status_calculado === "REALIZADA") {
      // Se for realizada mas não tem data específica de checkin, usar created_at
      dataCheckin = formatDateTime(visita.created_at)
    }

    row.innerHTML = `
      <td>${empresaInfo}</td>
      <td>${formatDateTime(visita.date)}</td>
      <td>${dataCheckin}</td>
      <td>${visita.type || "-"}</td>
      <td>${visita.visit_sequence || "-"}</td>
      <td>${formatRating(visita.empresa_rating)}</td>
      <td><span class="status-badge status-${(visita.status_calculado || "").toLowerCase()}">${visita.status_calculado}</span></td>
      <td>${getActionButtons(visita)}</td>
    `

    tableBody.appendChild(row)
  })

  // Adicionar event listeners para botões de ação
  setupActionButtons()
}

// CORREÇÃO: Formatar data para API sem problemas de fuso horário
function formatDateForAPI(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Formatar data e hora para exibição
function formatDateTime(dateString) {
  if (!dateString) return "-"

  const date = new Date(dateString)
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }

  return date.toLocaleDateString("pt-BR", options)
}

// Formatar rating como estrelas
function formatRating(rating) {
  if (!rating) return "-"

  const ratingNumber = Number.parseInt(rating)
  const stars = "★".repeat(ratingNumber) + "☆".repeat(5 - ratingNumber)
  return `<span class="rating">${stars}</span>`
}

// Obter classe CSS baseada no status
function getStatusClass(status) {
  switch (status) {
    case "REALIZADA":
      return "row-realizada"
    case "AGENDADA":
      return "row-agendada"
    case "REMARCADA":
      return "row-remarcada"
    case "CANCELADA":
      return "row-cancelada"
    case "ATRASADA":
      return "row-atrasada"
    default:
      return ""
  }
}

// Obter botões de ação baseados no status
function getActionButtons(visita) {
  const buttons = []

  switch (visita.status_calculado) {
    case "AGENDADA":
    case "ATRASADA":
      buttons.push(`<a href="visitas/checkin.html?id=${visita.id}" class="btn-action btn-checkin">CHECK-IN</a>`)
      //buttons.push(`<a href="visitas/remarcar.html?id=${visita.id}" class="btn-action btn-remarcar">REMARCAR</a>`)
      //buttons.push(`<button class="btn-action btn-cancelar" data-id="${visita.id}">CANCELAR</button>`)
      break

    case "REALIZADA":
      buttons.push(`<a href="visitas/checkin.html?id=${visita.id}" class="btn-action btn-view">VER CHECK-IN</a>`)
      break

    case "REMARCADA":
      buttons.push(`<a href="visitas/checkin.html?id=${visita.id}" class="btn-action btn-checkin">CHECK-IN</a>`)
      //buttons.push(`<a href="visitas/remarcar.html?id=${visita.id}" class="btn-action btn-remarcar">REMARCAR</a>`)
      //buttons.push(`<button class="btn-action btn-cancelar" data-id="${visita.id}">CANCELAR</button>`)
      break

    case "CANCELADA":
      //buttons.push(`<a href="visitas/remarcar.html?id=${visita.id}" class="btn-action btn-remarcar">REAGENDAR</a>`)
      break
  }

  return buttons.join("")
}

// Configurar event listeners para botões de ação
function setupActionButtons() {
  // Botões de cancelar
  document.querySelectorAll(".btn-cancelar").forEach((button) => {
    button.addEventListener("click", function () {
      const visitaId = this.getAttribute("data-id")
      if (confirm("Tem certeza que deseja cancelar esta visita?")) {
        cancelarVisita(visitaId)
      }
    })
  })
}

// Cancelar visita
function cancelarVisita(visitaId) {
  window
    .apiCall(`/visitas.php?id=${visitaId}`, "PUT", { status: "CANCELADA" })
    .then((response) => {
      if (response.success) {
        window.showSuccess("Visita cancelada com sucesso!")
        loadDashboardData()
      } else {
        window.showError("Erro ao cancelar visita")
      }
    })
    .catch((error) => {
      console.error("Erro ao cancelar visita:", error)
      window.showError("Erro ao cancelar visita")
    })
}
