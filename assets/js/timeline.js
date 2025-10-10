// ========================================
// TIMELINE DA EMPRESA - SISTEMA INDEPENDENTE
// ========================================

// Configuração da API
const API_BASE = "../api"

// Variáveis globais
let currentUser = null
let currentPage = 1
let totalPages = 1
let isLoading = false
let empresaId = null
let empresaInfo = null

// ========================================
// SISTEMA DE AUTENTICAÇÃO INDEPENDENTE
// ========================================

const TimelineAuth = {
  // Verificar se está autenticado
  checkAuth() {
    const token = localStorage.getItem("auth_token")
    if (!token) {
      this.redirectToLogin()
      return false
    }

    try {
      const parts = token.split(".")
      if (parts.length !== 3) {
        this.logout()
        return false
      }

      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))

      if (payload.exp < Date.now() / 1000) {
        this.logout()
        return false
      }

      currentUser = {
        id: payload.user_id,
        name: payload.name,
        role: payload.role,
      }

      return true
    } catch (error) {
      this.logout()
      return false
    }
  },

  // Fazer logout
  logout() {
    localStorage.removeItem("auth_token")
    this.redirectToLogin()
  },

  // Redirecionar para login
  redirectToLogin() {
    window.location.href = "../index.html"
  },

  // Obter token
  getToken() {
    return localStorage.getItem("auth_token")
  },

  // Obter usuário atual
  getUser() {
    return currentUser
  },
}

// ========================================
// SISTEMA DE API
// ========================================

const TimelineAPI = {
  async call(endpoint, options = {}) {
    const token = TimelineAuth.getToken()
    if (!token) {
      TimelineAuth.redirectToLogin()
      return
    }

    const config = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...options,
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config)

      if (response.status === 401) {
        TimelineAuth.logout()
        return
      }

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error("Resposta não é JSON válido:", text.substring(0, 500))
        throw new Error("RESPOSTA INVÁLIDA DO SERVIDOR")
      }

      if (!response.ok) {
        throw new Error(data.error || `ERRO HTTP ${response.status}`)
      }

      return data
    } catch (error) {
      console.error("Erro na API:", error)
      throw error
    }
  },
}

// ========================================
// SISTEMA DE NOTIFICAÇÕES
// ========================================

const TimelineNotify = {
  show(message, type = "info") {
    const existing = document.querySelector(".timeline-notification")
    if (existing) {
      existing.remove()
    }

    const notification = document.createElement("div")
    notification.className = `timeline-notification ${type}`
    notification.textContent = message

    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 9999;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            ${type === "success" ? "background-color: #28a745;" : ""}
            ${type === "error" ? "background-color: #dc3545;" : ""}
            ${type === "info" ? "background-color: #17a2b8;" : ""}
            ${type === "warning" ? "background-color: #ffc107; color: #212529;" : ""}
        `

    document.body.appendChild(notification)

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove()
      }
    }, 5000)
  },

  success(message) {
    this.show(message, "success")
  },

  error(message) {
    this.show(message, "error")
  },

  info(message) {
    this.show(message, "info")
  },

  warning(message) {
    this.show(message, "warning")
  },
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

const getEmpresaIdFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get("id")
}

const setCurrentMonthDates = () => {
  const hoje = new Date()
  const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  const dataInicioElement = document.getElementById("dataInicio")
  const dataFimElement = document.getElementById("dataFim")

  if (dataInicioElement) {
    dataInicioElement.value = primeiroDiaDoMes.toISOString().split("T")[0]
  }

  if (dataFimElement) {
    dataFimElement.value = ultimoDiaDoMes.toISOString().split("T")[0]
  }
}

// ========================================
// INICIALIZAÇÃO DO SISTEMA
// ========================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📅 Timeline da Empresa carregado")

  // Verificar autenticação
  if (!TimelineAuth.checkAuth()) {
    return
  }

  // Obter ID da empresa da URL
  empresaId = getEmpresaIdFromUrl()
  if (!empresaId) {
    TimelineNotify.error("ID da empresa não fornecido")
    setTimeout(() => {
      window.location.href = "../empresas.html"
    }, 2000)
    return
  }

  const user = TimelineAuth.getUser()
  const userNameElement = document.getElementById("userName")
  if (userNameElement) {
    userNameElement.textContent = user.name
  }

  // Mostrar menu de relatórios para gestores
  if (user.role === "GESTOR") {
    const relatoriosLink = document.getElementById("relatoriosLink")
    if (relatoriosLink) {
      relatoriosLink.style.display = "block"
    }
  }

  // Definir datas do mês vigente - CORRIGIDO para usar ano atual
  const hoje = new Date()
  const dataInicioElement = document.getElementById("dataInicio")
  const dataFimElement = document.getElementById("dataFim")

  if (dataInicioElement) {
    dataInicioElement.value = `${hoje.getFullYear()}-01-01` // Início do ano atual
  }

  if (dataFimElement) {
    dataFimElement.value = `${hoje.getFullYear()}-12-31` // Fim do ano atual
  }

  // Event listeners
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      TimelineAuth.logout()
    })
  }

  const applyFiltersBtn = document.getElementById("applyFilters")
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", () => {
      currentPage = 1
      loadTimeline()
    })
  }

  const clearFiltersBtn = document.getElementById("clearFilters")
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      // Limpar filtros - sem filtros de data
      if (dataInicioElement) dataInicioElement.value = ""
      if (dataFimElement) dataFimElement.value = ""
      currentPage = 1
      loadTimeline()
    })
  }

  const prevPageBtn = document.getElementById("prevPage")
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--
        loadTimeline()
      }
    })
  }

  const nextPageBtn = document.getElementById("nextPage")
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++
        loadTimeline()
      }
    })
  }

  // Enter nos filtros
  const dataInicioElementListener = document.getElementById("dataInicio")
  if (dataInicioElementListener) {
    dataInicioElementListener.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        currentPage = 1
        loadTimeline()
      }
    })
  }

  const dataFimElementListener = document.getElementById("dataFim")
  if (dataFimElementListener) {
    dataFimElementListener.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        currentPage = 1
        loadTimeline()
      }
    })
  }

  // Carregar informações da empresa e timeline
  await loadEmpresaInfo()
  await loadTimeline()

  console.log("✅ Timeline da Empresa configurado com sucesso")
})

// ========================================
// FUNÇÕES PRINCIPAIS
// ========================================

const loadEmpresaInfo = async () => {
  try {
    console.log("🏢 Carregando informações da empresa:", empresaId)

    const response = await TimelineAPI.call(`/empresas.php?id=${empresaId}`)
    console.log("📊 Resposta da API empresas:", response) // Debug adicional

    if (response && response.success && response.data) {
      empresaInfo = response.data
      renderEmpresaInfo(empresaInfo)
      console.log("✅ Informações da empresa carregadas:", empresaInfo)
    } else {
      throw new Error("Empresa não encontrada")
    }
  } catch (error) {
    console.error("❌ Erro ao carregar empresa:", error)
    TimelineNotify.error("Erro ao carregar informações da empresa")
    setTimeout(() => {
      window.location.href = "../empresas.html"
    }, 2000)
  }
}

const renderEmpresaInfo = (empresa) => {
  console.log("🎨 Renderizando informações da empresa:", empresa) // Debug

  const empresaNomeElement = document.getElementById("empresaNome")
  const empresaInfoSection = document.getElementById("empresaInfoSection")

  // Nome da empresa - tentar diferentes campos
  const nomeEmpresa = empresa.nome || empresa.name || empresa.company_name || "Empresa não identificada"

  if (empresaNomeElement) {
    empresaNomeElement.textContent = nomeEmpresa
  }

  // Mostrar seção da empresa
  if (empresaInfoSection) {
    empresaInfoSection.style.display = "block"
  }

  console.log("✅ Informações renderizadas:", {
    nome: nomeEmpresa,
  })
}

const loadTimeline = async () => {
  if (isLoading) return

  try {
    isLoading = true
    showLoading()

    const filters = getFilters()
    const queryParams = new URLSearchParams({
      empresa_id: empresaId,
      page: currentPage,
      limit: 10,
      ...filters,
    })

    console.log("🔄 Carregando timeline com filtros:", filters)

    const response = await TimelineAPI.call(`/timeline.php?${queryParams}`)
    console.log("📊 Resposta da API:", response)

    // Log adicional para debug
    if (response && response.debug_info) {
      console.log("🔍 Debug da API:", response.debug_info)
    }

    if (response && response.success && response.data) {
      renderTimeline(response.data)
      updatePagination(response.pagination || { total: response.data.length, pages: 1 })
      updateResultsCount(response.data.length)
      console.log(`✅ ${response.data.length} eventos carregados`)

      if (response.data.length === 0) {
        console.log("⚠️ Nenhum evento encontrado com os filtros aplicados:", filters)
      }
    } else {
      showEmptyState()
    }
  } catch (error) {
    console.error("❌ Erro ao carregar timeline:", error)
    showErrorState(error.message)
  } finally {
    isLoading = false
  }
}

const getFilters = () => {
  const filters = {}

  // Verificar se os elementos existem antes de acessar .value
  const dataInicioElement = document.getElementById("dataInicio")
  const dataFimElement = document.getElementById("dataFim")

  if (dataInicioElement && dataInicioElement.value) {
    filters.data_inicio = dataInicioElement.value
  }

  if (dataFimElement && dataFimElement.value) {
    filters.data_fim = dataFimElement.value
  }

  console.log("🔍 Filtros aplicados:", filters)
  return filters
}

const renderTimeline = (eventos) => {
  const container = document.getElementById("timelineContainer")

  if (!container) {
    console.error("❌ Container da timeline não encontrado")
    return
  }

  if (!eventos || eventos.length === 0) {
    showEmptyState()
    return
  }

  const html = eventos
    .map((evento) => {
      const isCheckin = evento.tipo === "checkin"
      const isVisita = evento.tipo === "visita"

      // Dados do evento
      const titulo = isCheckin ? "Check-in Realizado" : "Visita Comercial"
      const data = formatDate(evento.data)
      const consultor = evento.consultor_nome || "N/A"
      const status = evento.status || "N/A"

      // Resumo/Observações
      const resumo = evento.resumo || evento.observacoes || "Sem informações adicionais"
      const resumoTruncado = resumo.length > 200 ? resumo.substring(0, 200) + "..." : resumo

      // Botão apenas para checkins
      const botaoCheckin = isCheckin
        ? `
          <div class="event-actions">
            <a href="../visitas/checkin.html?id=${evento.visita_id}" class="btn-view-event checkin">
              👁️ VER CHECKIN
            </a>
          </div>
        `
        : ""

      return `
        <div class="event-card ${evento.tipo}">
          <div class="event-header">
            <div>
              <div class="event-type ${evento.tipo}">${isCheckin ? "✅ CHECKIN" : "📅 VISITA"}</div>
              <h3 class="event-title">${titulo}</h3>
              <div class="event-dates">
                <div class="event-data">📅 ${data}</div>
                <div class="event-data">👤 ${consultor}</div>
              </div>
            </div>
            ${botaoCheckin}
          </div>
          
          <div class="event-info">
            <div class="info-item">
              <span class="info-label">Status</span>
              <span class="info-value">
                <span class="status-badge status-${status.toLowerCase()}">${status}</span>
              </span>
            </div>
            ${
              isVisita && evento.sequencia_visita
                ? `
            <div class="info-item">
              <span class="info-label">Sequencial</span>
              <span class="info-value">${evento.sequencia_visita}</span>
            </div>
            `
                : ""
            }
            ${
              isVisita
                ? `
            <div class="info-item">
              <span class="info-label">Tipo</span>
              <span class="info-value">${evento.tipo_visita || "N/A"}</span>
            </div>
            `
                : ""
            }
            ${
              isCheckin && evento.oportunidade !== null && evento.oportunidade !== undefined
                ? `
            <div class="info-item">
              <span class="info-label">Oportunidade</span>
              <span class="info-value">${evento.oportunidade == 1 || evento.oportunidade === "SIM" ? "SIM" : "NÃO"}</span>
            </div>
            `
                : ""
            }
          </div>
          
          ${
            resumo !== "Sem informações adicionais"
              ? `
          <div class="event-summary">
            <div class="summary-label">${isCheckin ? "Resumo do Checkin" : "Observações da Visita"}</div>
            <div class="summary-text">${resumoTruncado}</div>
          </div>
          `
              : ""
          }
        </div>
      `
    })
    .join("")

  container.innerHTML = html
}

const formatDate = (dateString) => {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    return (
      date.toLocaleDateString("pt-BR") +
      " " +
      date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    )
  } catch (error) {
    return dateString
  }
}

const showLoading = () => {
  const container = document.getElementById("timelineContainer")
  if (container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="loading-placeholder">
          <div class="loading-icon">⏳</div>
          <p>CARREGANDO TIMELINE...</p>
        </div>
      </div>
    `
  }
}

const showEmptyState = () => {
  const container = document.getElementById("timelineContainer")
  const paginationContainer = document.getElementById("paginationContainer")

  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-placeholder">
          <div class="empty-icon">📭</div>
          <p>NENHUM EVENTO ENCONTRADO</p>
          <small>Não há visitas ou checkins registrados para esta empresa no período selecionado.</small>
          <br><br>
          <button onclick="document.getElementById('clearFilters').click()" class="btn-secondary">
            🗑️ LIMPAR FILTROS
          </button>
        </div>
      </div>
    `
  }

  if (paginationContainer) {
    paginationContainer.style.display = "none"
  }
}

const showErrorState = (message) => {
  const container = document.getElementById("timelineContainer")
  const paginationContainer = document.getElementById("paginationContainer")

  if (container) {
    container.innerHTML = `
      <div class="error-state">
        <p>❌ ERRO AO CARREGAR TIMELINE</p>
        <small>${message}</small>
      </div>
    `
  }

  if (paginationContainer) {
    paginationContainer.style.display = "none"
  }
}

const updatePagination = (pagination) => {
  totalPages = pagination.pages || 1
  const paginationContainer = document.getElementById("paginationContainer")
  const prevBtn = document.getElementById("prevPage")
  const nextBtn = document.getElementById("nextPage")
  const pageInfo = document.getElementById("pageInfo")

  if (totalPages > 1 && paginationContainer) {
    paginationContainer.style.display = "flex"

    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1
    }

    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages
    }

    if (pageInfo) {
      pageInfo.textContent = `Página ${currentPage} de ${totalPages}`
    }
  } else if (paginationContainer) {
    paginationContainer.style.display = "none"
  }
}

const updateResultsCount = (count) => {
  const resultsCount = document.getElementById("resultsCount")
  if (resultsCount) {
    resultsCount.textContent = `${count} evento${count !== 1 ? "s" : ""} encontrado${count !== 1 ? "s" : ""}`
  }
}
