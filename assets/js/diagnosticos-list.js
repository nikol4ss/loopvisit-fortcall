// ========================================
// DIAGNÓSTICOS LIST - SISTEMA INDEPENDENTE
// ========================================

// Configuração da API
const API_BASE = "../api"

// Variáveis globais
let currentUser = null
let currentPage = 1
let totalPages = 1
let isLoading = false

// ========================================
// SISTEMA DE AUTENTICAÇÃO INDEPENDENTE
// ========================================

const DiagnosticosAuth = {
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

const DiagnosticosAPI = {
  async call(endpoint, options = {}) {
    const token = DiagnosticosAuth.getToken()
    if (!token) {
      DiagnosticosAuth.redirectToLogin()
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
        DiagnosticosAuth.logout()
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

const DiagnosticosNotify = {
  show(message, type = "info") {
    const existing = document.querySelector(".diagnosticos-notification")
    if (existing) {
      existing.remove()
    }

    const notification = document.createElement("div")
    notification.className = `diagnosticos-notification ${type}`
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

const setCurrentMonthDates = () => {
  const hoje = new Date()
  const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  document.getElementById("dataInicio").value = primeiroDiaDoMes.toISOString().split("T")[0]
  document.getElementById("dataFim").value = ultimoDiaDoMes.toISOString().split("T")[0]
}

// ========================================
// INICIALIZAÇÃO DO SISTEMA
// ========================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📋 Diagnósticos List carregado")

  // Verificar autenticação
  if (!DiagnosticosAuth.checkAuth()) {
    return
  }

  const user = DiagnosticosAuth.getUser()
  document.getElementById("userName").textContent = user.name

  // Mostrar menu de relatórios para gestores
  if (user.role === "GESTOR") {
    document.getElementById("relatoriosLink").style.display = "block"
  }

  // Definir datas do mês vigente
  setCurrentMonthDates()

  // Event listeners
  document.getElementById("logoutBtn").addEventListener("click", () => {
    DiagnosticosAuth.logout()
  })

  document.getElementById("applyFilters").addEventListener("click", () => {
    currentPage = 1
    loadDiagnosticos()
  })

  document.getElementById("clearFilters").addEventListener("click", () => {
    setCurrentMonthDates()
    currentPage = 1
    loadDiagnosticos()
  })

  document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--
      loadDiagnosticos()
    }
  })

  document.getElementById("nextPage").addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++
      loadDiagnosticos()
    }
  })

  // Enter nos filtros
  document.getElementById("dataInicio").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      currentPage = 1
      loadDiagnosticos()
    }
  })

  document.getElementById("dataFim").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      currentPage = 1
      loadDiagnosticos()
    }
  })

  // Carregar diagnósticos iniciais
  await loadDiagnosticos()

  console.log("✅ Diagnósticos List configurado com sucesso")
})

// ========================================
// FUNÇÕES PRINCIPAIS
// ========================================

const loadDiagnosticos = async () => {
  if (isLoading) return

  try {
    isLoading = true
    showLoading()

    const filters = getFilters()
    const queryParams = new URLSearchParams({
      tipo: "diagnosticos",
      page: currentPage,
      limit: 10,
      ...filters,
    })

    console.log("🔄 Carregando diagnósticos com filtros:", filters)

    const response = await DiagnosticosAPI.call(`/diagnosticos-list.php?${queryParams}`)
    console.log("📊 Resposta da API:", response)

    if (response && response.success && response.data) {
      renderDiagnosticos(response.data)
      updatePagination(response.pagination || { total: response.data.length, pages: 1 })
      updateResultsCount(response.data.length)
      console.log(`✅ ${response.data.length} diagnósticos carregados`)
    } else {
      showEmptyState()
    }
  } catch (error) {
    console.error("❌ Erro ao carregar diagnósticos:", error)
    showErrorState(error.message)
  } finally {
    isLoading = false
  }
}

const getFilters = () => {
  const filters = {}

  const dataInicio = document.getElementById("dataInicio").value
  const dataFim = document.getElementById("dataFim").value

  if (dataInicio) filters.data_inicio = dataInicio
  if (dataFim) filters.data_fim = dataFim

  return filters
}

const renderDiagnosticos = (diagnosticos) => {
  const container = document.getElementById("diagnosticosContainer")

  if (!diagnosticos || diagnosticos.length === 0) {
    showEmptyState()
    return
  }

  const html = diagnosticos
    .map((diagnostico) => {
      // Data de criação
      const dataCriacao = formatDate(diagnostico.created_at)

      // Data de atualização
      const dataAtualizacao = formatDate(diagnostico.updated_at)

      // Status do diagnóstico baseado na completude
      const completude = calcularCompletude(diagnostico)
      const statusClass = getStatusClass(completude)
      const statusText = getStatusText(completude)

      return `
                <div class="diagnostico-card">
                    <div class="diagnostico-header">
                        <div>
                            <h3 class="diagnostico-empresa">${diagnostico.empresa_nome || "N/A"}</h3>
                            <div class="diagnostico-dates">
                                <div class="diagnostico-data">📅 Criado: ${dataCriacao}</div>
                                <div class="diagnostico-data">🔄 Atualizado: ${dataAtualizacao}</div>
                            </div>
                        </div>
                        <div class="diagnostico-actions">
                            <a href="../diagnostico/index.html?empresa_id=${diagnostico.empresa_id}" class="btn-view-diagnostico">
                                👁️ VER DIAGNÓSTICO
                            </a>
                        </div>
                    </div>
                    
                    <div class="diagnostico-info">
                        <div class="info-item">
                            <span class="info-label">Consultor</span>
                            <span class="info-value">
                                <span class="consultor-badge">
                                    👤 ${diagnostico.consultor_nome || "Não atribuído"}
                                </span>
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Cidade</span>
                            <span class="info-value">${diagnostico.cidade_nome || "N/A"}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Estado</span>
                            <span class="info-value">${diagnostico.estado_nome || "N/A"}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Status</span>
                            <span class="info-value">
                                <span class="status-badge ${statusClass}">
                                    ${statusText}
                                </span>
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Completude</span>
                            <span class="info-value">
                                <div class="progress-bar-small">
                                    <div class="progress-fill-small" style="width: ${completude}%"></div>
                                </div>
                                <span class="progress-text-small">${completude}%</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="diagnostico-resumo">
                        <h4>Resumo do Diagnóstico:</h4>
                        <div class="resumo-grid">
                            <div class="resumo-item">
                                <span class="resumo-label">Equipamentos:</span>
                                <span class="resumo-value">${diagnostico.total_equipamentos || 0}</span>
                            </div>
                            <div class="resumo-item">
                                <span class="resumo-label">Implementos:</span>
                                <span class="resumo-value">${diagnostico.total_implementos || 0}</span>
                            </div>
                            <div class="resumo-item">
                                <span class="resumo-label">Tipo Cliente:</span>
                                <span class="resumo-value">${diagnostico.tipo_cliente || "N/A"}</span>
                            </div>
                            <div class="resumo-item">
                                <span class="resumo-label">Tipo Operação:</span>
                                <span class="resumo-value">${diagnostico.tipo_operacao || "N/A"}</span>
                            </div>
                        </div>
                    </div>
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

const calcularCompletude = (diagnostico) => {
  let pontos = 0
  const total = 4

  // Parque instalado (25%)
  if (diagnostico.total_equipamentos > 0) pontos++

  // Operação (25%)
  if (diagnostico.tipo_operacao) pontos++

  // Previsão (25%)
  if (diagnostico.tipo_cliente) pontos++

  // Relacionamento (25%)
  if (diagnostico.tem_relacionamento) pontos++

  return Math.round((pontos / total) * 100)
}

const getStatusClass = (completude) => {
  if (completude >= 100) return "status-completo"
  if (completude >= 75) return "status-quase-completo"
  if (completude >= 50) return "status-parcial"
  if (completude >= 25) return "status-iniciado"
  return "status-vazio"
}

const getStatusText = (completude) => {
  if (completude >= 100) return "COMPLETO"
  if (completude >= 75) return "QUASE COMPLETO"
  if (completude >= 50) return "PARCIAL"
  if (completude >= 25) return "INICIADO"
  return "VAZIO"
}

const showLoading = () => {
  const container = document.getElementById("diagnosticosContainer")
  container.innerHTML = `
        <div class="loading-state">
            <p>⏳ CARREGANDO DIAGNÓSTICOS...</p>
        </div>
    `
}

const showEmptyState = () => {
  const container = document.getElementById("diagnosticosContainer")
  container.innerHTML = `
        <div class="empty-state">
            <p>📭 NENHUM DIAGNÓSTICO ENCONTRADO</p>
            <small>Tente ajustar os filtros ou verificar se há diagnósticos realizados no período selecionado.</small>
        </div>
    `
  document.getElementById("paginationContainer").style.display = "none"
}

const showErrorState = (message) => {
  const container = document.getElementById("diagnosticosContainer")
  container.innerHTML = `
        <div class="error-state">
            <p>❌ ERRO AO CARREGAR DIAGNÓSTICOS</p>
            <small>${message}</small>
        </div>
    `
  document.getElementById("paginationContainer").style.display = "none"
}

const updatePagination = (pagination) => {
  totalPages = pagination.pages || 1
  const paginationContainer = document.getElementById("paginationContainer")
  const prevBtn = document.getElementById("prevPage")
  const nextBtn = document.getElementById("nextPage")
  const pageInfo = document.getElementById("pageInfo")

  if (totalPages > 1) {
    paginationContainer.style.display = "flex"
    prevBtn.disabled = currentPage <= 1
    nextBtn.disabled = currentPage >= totalPages
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`
  } else {
    paginationContainer.style.display = "none"
  }
}

const updateResultsCount = (count) => {
  const resultsCount = document.getElementById("resultsCount")
  resultsCount.textContent = `${count} diagnóstico${count !== 1 ? "s" : ""} encontrado${count !== 1 ? "s" : ""}`
}
