// ========================================
// CHECKINS LIST - SISTEMA INDEPENDENTE
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

const CheckinsAuth = {
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

const CheckinsAPI = {
  async call(endpoint, options = {}) {
    const token = CheckinsAuth.getToken()
    if (!token) {
      CheckinsAuth.redirectToLogin()
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
        CheckinsAuth.logout()
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

const CheckinsNotify = {
  show(message, type = "info") {
    const existing = document.querySelector(".checkins-notification")
    if (existing) {
      existing.remove()
    }

    const notification = document.createElement("div")
    notification.className = `checkins-notification ${type}`
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
  console.log("📋 Checkins List carregado")

  // Verificar autenticação
  if (!CheckinsAuth.checkAuth()) {
    return
  }

  const user = CheckinsAuth.getUser()
  document.getElementById("userName").textContent = user.name

  // Mostrar menu de relatórios para gestores
  if (user.role === "GESTOR") {
    document.getElementById("relatoriosLink").style.display = "block"
  }

  // Definir datas do mês vigente
  setCurrentMonthDates()

  // Event listeners
  document.getElementById("logoutBtn").addEventListener("click", () => {
    CheckinsAuth.logout()
  })

  document.getElementById("applyFilters").addEventListener("click", () => {
    currentPage = 1
    loadCheckins()
  })

  document.getElementById("clearFilters").addEventListener("click", () => {
    setCurrentMonthDates()
    currentPage = 1
    loadCheckins()
  })

  document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--
      loadCheckins()
    }
  })

  document.getElementById("nextPage").addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++
      loadCheckins()
    }
  })

  // Enter nos filtros
  document.getElementById("dataInicio").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      currentPage = 1
      loadCheckins()
    }
  })

  document.getElementById("dataFim").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      currentPage = 1
      loadCheckins()
    }
  })

  // Carregar checkins iniciais
  await loadCheckins()

  console.log("✅ Checkins List configurado com sucesso")
})

// ========================================
// FUNÇÕES PRINCIPAIS
// ========================================

const loadCheckins = async () => {
  if (isLoading) return

  try {
    isLoading = true
    showLoading()

    const filters = getFilters()
    const queryParams = new URLSearchParams({
      tipo: "checkins",
      page: currentPage,
      limit: 10,
      ...filters,
    })

    console.log("🔄 Carregando checkins com filtros:", filters)

    const response = await CheckinsAPI.call(`/relatorios-dados.php?${queryParams}`)
    console.log("📊 Resposta da API:", response)

    if (response && response.success && response.data) {
      renderCheckins(response.data)
      updatePagination(response.pagination || { total: response.data.length, pages: 1 })
      updateResultsCount(response.data.length)
      console.log(`✅ ${response.data.length} checkins carregados`)
    } else {
      showEmptyState()
    }
  } catch (error) {
    console.error("❌ Erro ao carregar checkins:", error)
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

const renderCheckins = (checkins) => {
  const container = document.getElementById("checkinsContainer")

  if (!checkins || checkins.length === 0) {
    showEmptyState()
    return
  }

  const html = checkins
    .map((checkin) => {
      // Buscar resumo corretamente
      const resumo = checkin.summary || checkin.resumo_visita || checkin.resumo || "Sem resumo disponível"
      const resumoTruncado = resumo.length > 200 ? resumo.substring(0, 200) + "..." : resumo

      // Data da visita
      const dataVisita = formatDate(checkin.date || checkin.data_visita)

      // Data do checkin
      const dataCheckin = formatDate(checkin.created_at || checkin.data_checkin)

      return `
                <div class="checkin-card">
                    <div class="checkin-header">
                        <div>
                            <h3 class="checkin-empresa">${checkin.empresa_nome || "N/A"}</h3>
                            <div class="checkin-dates">
                                <div class="checkin-data">📅 Visita: ${dataVisita}</div>
                                <div class="checkin-data">✅ Checkin: ${dataCheckin}</div>
                            </div>
                        </div>
                        <div class="checkin-actions">
                            <a href="../visitas/checkin.html?id=${checkin.visita_id}" class="btn-view-checkin">
                                👁️ VER CHECKIN
                            </a>
                        </div>
                    </div>
                    
                    <div class="checkin-info">
                        <div class="info-item">
                            <span class="info-label">Consultor</span>
                            <span class="info-value">${checkin.consultor_nome || "N/A"}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Cidade</span>
                            <span class="info-value">${checkin.cidade_nome || "N/A"}</span>
                        </div>
                    </div>
                    
                    <div class="checkin-resumo">
                        <h4>Resumo da Visita:</h4>
                        <p>${resumoTruncado}</p>
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

const showLoading = () => {
  const container = document.getElementById("checkinsContainer")
  container.innerHTML = `
        <div class="loading-state">
            <p>⏳ CARREGANDO CHECKINS...</p>
        </div>
    `
}

const showEmptyState = () => {
  const container = document.getElementById("checkinsContainer")
  container.innerHTML = `
        <div class="empty-state">
            <p>📭 NENHUM CHECKIN ENCONTRADO</p>
            <small>Tente ajustar os filtros ou verificar se há checkins realizados no período selecionado.</small>
        </div>
    `
  document.getElementById("paginationContainer").style.display = "none"
}

const showErrorState = (message) => {
  const container = document.getElementById("checkinsContainer")
  container.innerHTML = `
        <div class="error-state">
            <p>❌ ERRO AO CARREGAR CHECKINS</p>
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
  resultsCount.textContent = `${count} checkin${count !== 1 ? "s" : ""} encontrado${count !== 1 ? "s" : ""}`
}
