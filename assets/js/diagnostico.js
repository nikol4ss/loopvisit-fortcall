// ========================================
// DIAGNÓSTICO - SISTEMA INDEPENDENTE
// ========================================

// ✅ CORREÇÃO: Configuração da API baseada no arquivo auth.js que funcionou
const API_BASE = window.location.pathname.includes("/diagnostico/") ? "../api" : "./api"

// Variáveis globais
let empresaId = null
let diagnosticoData = {
  parque: [],
  operacao: {},
  previsao: {},
  relacionamento: {},
}
let nextTempId = 1
let autosaveTimer = null
let currentUser = null
let isProcessingSave = false

// ========================================
// SISTEMA DE AUTENTICAÇÃO INDEPENDENTE
// ========================================

const DiagnosticoAuth = {
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
// SISTEMA DE API CORRIGIDO (baseado no auth.js que funcionou)
// ========================================

const DiagnosticoAPI = {
  async call(endpoint, options = {}, retryCount = 0) {
    const token = DiagnosticoAuth.getToken()
    if (!token) {
      DiagnosticoAuth.redirectToLogin()
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

    // ✅ CORREÇÃO: Aplicar cache buster igual ao auth.js
    const method = config.method || "GET"
    const isDataQuery = method === "GET" && !endpoint.includes("auth.php")

    let finalEndpoint = endpoint
    if (isDataQuery) {
      // ✅ CORREÇÃO: Cache buster apenas para consultas GET (não para POST/login)
      const separator = endpoint.includes("?") ? "&" : "?"
      const cacheBuster = `_t=${Date.now()}`
      finalEndpoint = `${endpoint}${separator}${cacheBuster}`

      // ✅ CORREÇÃO: Headers anti-cache apenas para consultas
      config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
      config.headers["Pragma"] = "no-cache"
      config.cache = "no-store"

      console.log("🔄 Consulta com cache buster:", `${API_BASE}${finalEndpoint}`)
    } else {
      console.log("🔐 Requisição sem cache buster:", `${API_BASE}${finalEndpoint}`)
    }

    // ✅ CORREÇÃO: Garantir que o body seja string JSON
    if (config.body && typeof config.body !== "string") {
      config.body = JSON.stringify(config.body)
    }

    // ✅ NOVO: Timeout personalizado para POST
    if (config.method === "POST") {
      const controller = new AbortController()
      config.signal = controller.signal
      setTimeout(() => controller.abort(), 30000)
    }

    try {
      const response = await fetch(`${API_BASE}${finalEndpoint}`, config)

      if (response.status === 401) {
        DiagnosticoAuth.logout()
        return
      }

      // ✅ CORREÇÃO: Primeiro pegar texto, depois tentar JSON (igual ao auth.js)
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
      console.error(`Erro na API (tentativa ${retryCount + 1}):`, error)

      // ✅ NOVO: Sistema de retry para erros de conexão
      if (
        retryCount < 2 &&
        (error.name === "TypeError" ||
          error.message.includes("Failed to fetch") ||
          error.message.includes("ERR_SOCKET_NOT_CONNECTED") ||
          error.name === "AbortError")
      ) {
        console.log(`Tentando novamente em ${(retryCount + 1) * 2} segundos...`)
        await new Promise((resolve) => setTimeout(resolve, (retryCount + 1) * 2000))
        return this.call(endpoint, options, retryCount + 1)
      }

      throw error
    }
  },
}

// ========================================
// SISTEMA DE NOTIFICAÇÕES MELHORADO
// ========================================

const DiagnosticoNotify = {
  show(message, type = "info") {
    // Remove notificação anterior se existir
    const existing = document.querySelector(".diagnostico-notification")
    if (existing) {
      existing.remove()
    }

    const notification = document.createElement("div")
    notification.className = `diagnostico-notification ${type}`
    notification.textContent = message

    // ✅ CORREÇÃO: Estilos melhorados baseados no auth.js
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

    // Remove após 5 segundos
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
// INICIALIZAÇÃO DO SISTEMA
// ========================================

document.addEventListener("DOMContentLoaded", async () => {
  // Verificar autenticação
  if (!DiagnosticoAuth.checkAuth()) {
    return
  }

  const user = DiagnosticoAuth.getUser()
  document.getElementById("userName").textContent = user.name

  if (user.role === "GESTOR") {
    document.getElementById("relatoriosLink").style.display = "block"
  }

  // Extrair ID da empresa da URL
  const urlParams = new URLSearchParams(window.location.search)
  empresaId = urlParams.get("empresa_id")

  if (!empresaId) {
    DiagnosticoNotify.error("ID DA EMPRESA NÃO ENCONTRADO")
    return
  }

  // Event listeners
  document.getElementById("logoutBtn").addEventListener("click", () => {
    DiagnosticoAuth.logout()
  })

  // Tabs
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab))
  })

  // Carregar dados
  await loadEmpresaInfo()
  await loadDiagnosticoData()

  // Configurar event listeners para campos
  setupFormListeners()

  startAutosave()

  updateProgress()
})

// ========================================
// FUNÇÕES DE CARREGAMENTO DE DADOS
// ========================================

const loadEmpresaInfo = async () => {
  try {
    console.log("Carregando empresa ID:", empresaId)
    const response = await DiagnosticoAPI.call(`/empresas.php?id=${empresaId}`)
    console.log("Resposta empresa:", response)

    if (response && response.data) {
      // ✅ CORREÇÃO: A API retorna um array, precisamos encontrar a empresa específica
      let empresa = null

      if (Array.isArray(response.data)) {
        // Procurar a empresa pelo ID no array
        empresa = response.data.find((emp) => emp.id == empresaId)
      } else {
        // Se for um objeto único
        empresa = response.data
      }

      if (empresa) {
        document.getElementById("empresaNome").textContent = empresa.name || empresa.nome || "Nome não encontrado"
        document.getElementById("empresaCnpj").textContent = empresa.cnpj || "N/A"
      } else {
        throw new Error("Empresa não encontrada no resultado da API")
      }
    } else {
      throw new Error("Dados da empresa não encontrados")
    }
  } catch (error) {
    console.error("Erro ao carregar empresa:", error)
    DiagnosticoNotify.error("ERRO AO CARREGAR DADOS DA EMPRESA: " + error.message)

    // Mostrar dados padrão
    document.getElementById("empresaNome").textContent = "Erro ao carregar"
    document.getElementById("empresaCnpj").textContent = "N/A"
  }
}

const loadDiagnosticoData = async () => {
  try {
    console.log("Carregando diagnóstico para empresa:", empresaId)
    const response = await DiagnosticoAPI.call(`/diagnosticos.php?empresa_id=${empresaId}`)
    console.log("Resposta diagnóstico:", response)

    console.log("=== DEBUG CARREGAMENTO ===")
    console.log("Response completa:", JSON.stringify(response, null, 2))
    console.log("Response.success:", response.success)
    console.log("Response.data:", response.data)
    if (response.data) {
      console.log("Parque data:", response.data.parque)
      console.log("Operacao data:", response.data.operacao)
      console.log("Previsao data:", response.data.previsao)
      console.log("Relacionamento data:", response.data.relacionamento)
    }

    if (response && response.success && response.data) {
      // ✅ NOVO: Limpar dados antigos antes de carregar novos
      diagnosticoData = {
        parque: [],
        operacao: {},
        previsao: {},
        relacionamento: {},
      }

      diagnosticoData = response.data

      if (diagnosticoData.parque && diagnosticoData.parque.length > 0) {
        let maxTempId = 0

        diagnosticoData.parque.forEach((item) => {
          if (!item.id_tmp) {
            item.id_tmp = nextTempId++
          }

          if (item.id_tmp > maxTempId) {
            maxTempId = item.id_tmp
          }

          if (item.id && !item.id_real) {
            item.id_real = item.id
            delete item.id
          }
        })

        nextTempId = maxTempId + 1

        console.log("Parque carregado:", diagnosticoData.parque)
        console.log("Próximo temp ID:", nextTempId)
      }

      // Garantir que são objects, não arrays
      if (Array.isArray(diagnosticoData.operacao)) {
        diagnosticoData.operacao = {}
      }
      if (Array.isArray(diagnosticoData.previsao)) {
        diagnosticoData.previsao = {}
      }
      if (Array.isArray(diagnosticoData.relacionamento)) {
        diagnosticoData.relacionamento = {}
      }

      // ✅ NOVO: Forçar repopulação do formulário
      setTimeout(() => {
        populateForm()
      }, 100)

      DiagnosticoNotify.success("DIAGNÓSTICO CARREGADO COM SUCESSO")
    } else {
      console.log("Diagnóstico não encontrado, iniciando novo")
      DiagnosticoNotify.info("INICIANDO NOVO DIAGNÓSTICO")
    }
  } catch (error) {
    console.log("Diagnóstico não encontrado, iniciando novo:", error.message)
    DiagnosticoNotify.info("INICIANDO NOVO DIAGNÓSTICO")
  }
}

const populateForm = () => {
  console.log("=== POPULANDO FORMULÁRIO ===")
  console.log("diagnosticoData:", diagnosticoData)
  console.log("diagnosticoData.parque:", diagnosticoData.parque)
  console.log("diagnosticoData.operacao:", diagnosticoData.operacao)
  console.log("diagnosticoData.previsao:", diagnosticoData.previsao)
  console.log("diagnosticoData.relacionamento:", diagnosticoData.relacionamento)

  // ✅ NOVO: Limpar formulários antes de preencher
  clearAllForms()

  // Preencher parque instalado
  renderParqueTable()

  // ✅ CORREÇÃO: Preencher operação com tratamento especial para selects sim/não
  if (diagnosticoData.operacao && typeof diagnosticoData.operacao === "object") {
    Object.keys(diagnosticoData.operacao).forEach((key) => {
      const field = document.getElementById(key)
      if (field) {
        if (field.type === "checkbox") {
          field.checked = diagnosticoData.operacao[key] == 1
        } else {
          // ✅ NOVO: Tratamento especial para campos sim/não (0 e 1)
          const value = diagnosticoData.operacao[key]
          if (key === "fundo_baia" && (value === 0 || value === 1)) {
            field.value = value.toString()
          } else if (value !== null && value !== undefined && value !== "") {
            field.value = value
          } else {
            field.value = ""
          }
        }

        // ✅ NOVO: Disparar evento change para atualizar interface
        field.dispatchEvent(new Event("change"))
      }
    })
  }

  // ✅ CORREÇÃO: Preencher previsão com tratamento especial para selects sim/não
  if (diagnosticoData.previsao && typeof diagnosticoData.previsao === "object") {
    Object.keys(diagnosticoData.previsao).forEach((key) => {
      const field = document.getElementById(key)
      if (field) {
        if (field.type === "checkbox") {
          field.checked = diagnosticoData.previsao[key] == 1
        } else {
          // ✅ NOVO: Tratamento especial para campos sim/não (0 e 1)
          const value = diagnosticoData.previsao[key]
          if (key === "expansao_equip_implement" && (value === 0 || value === 1)) {
            field.value = value.toString()
          } else if (value !== null && value !== undefined && value !== "") {
            field.value = value
          } else {
            field.value = ""
          }
        }

        // ✅ NOVO: Disparar evento change para atualizar interface
        field.dispatchEvent(new Event("change"))
      }
    })
  }

  // Preencher relacionamento
  if (diagnosticoData.relacionamento && typeof diagnosticoData.relacionamento === "object") {
    Object.keys(diagnosticoData.relacionamento).forEach((key) => {
      const field = document.getElementById(key)
      if (field && field.type === "checkbox") {
        field.checked = diagnosticoData.relacionamento[key] == 1

        // ✅ NOVO: Disparar evento change para atualizar interface
        field.dispatchEvent(new Event("change"))
      }
    })
  }
}

// ========================================
// NOVA FUNÇÃO: LIMPAR FORMULÁRIOS
// ========================================

const clearAllForms = () => {
  // Limpar campos de operação
  const operacaoFields = [
    "tipo_operacao",
    "tipo_sucata",
    "qtd_producao_mes_ton",
    "ton_vendida",
    "qtd_cliente_quer_crescer",
    "cliente_fornece_para",
    "preco_venda_ton",
    "fundo_baia",
  ]

  operacaoFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      if (field.type === "checkbox") {
        field.checked = false
      } else {
        field.value = ""
      }
    }
  })

  // Limpar campos de previsão
  const previsaoFields = ["tipo_cliente", "prazo_expansao", "tipo_equip_interesse", "expansao_equip_implement"]

  previsaoFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      if (field.type === "checkbox") {
        field.checked = false
      } else {
        field.value = ""
      }
    }
  })

  // Limpar campos de relacionamento
  const relacionamentoFields = ["contato_comprador", "contato_operador", "contato_encarregado", "contato_diretor"]

  relacionamentoFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field && field.type === "checkbox") {
      field.checked = false
    }
  })
}

// ========================================
// FUNÇÕES DA TABELA DE PARQUE
// ========================================

const renderParqueTable = () => {
  const tbody = document.getElementById("parqueTableBody")

  if (!diagnosticoData.parque || diagnosticoData.parque.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-state">
        <td colspan="5">
          <div class="empty-message">
            <span class="icon-equipment">⚙️</span>
            <p>NENHUM EQUIPAMENTO CADASTRADO</p>
            <small>CLIQUE EM "ADICIONAR EQUIPAMENTO" PARA COMEÇAR</small>
          </div>
        </td>
      </tr>
    `
    return
  }

  let html = ""
  const equipamentos = diagnosticoData.parque.filter((item) => item.tipo_item === "EQUIPAMENTO")

  console.log("Renderizando equipamentos:", equipamentos.length)

  equipamentos.forEach((equipamento) => {
    const implementos = diagnosticoData.parque.filter(
      (item) => item.tipo_item === "IMPLEMENTO" && item.parent_tmp === equipamento.id_tmp,
    )

    console.log(`Equipamento ${equipamento.id_tmp} tem ${implementos.length} implementos`)

    html += `
      <tr class="equipamento-row" data-id="${equipamento.id_tmp}">
        <td>
          <div class="tree-item equipamento">
            ${
              implementos.length > 0
                ? `<button class="tree-expand expanded" onclick="toggleImplementos(${equipamento.id_tmp})">▼</button>`
                : '<span style="width: 20px; display: inline-block;"></span>'
            }
            <span class="icon-equipment">⚙️</span>
            ${equipamento.equipamento_impl}
          </div>
        </td>
        <td>${equipamento.marca}</td>
        <td>${equipamento.modelo}</td>
        <td><span class="status-badge status-${equipamento.situacao.toLowerCase()}">${equipamento.situacao}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon add" onclick="adicionarImplemento(${equipamento.id_tmp})" title="Adicionar Implemento">
              +
            </button>
            <button class="btn-icon edit" onclick="editarEquipamento(${equipamento.id_tmp})" title="Editar">
              ✎
            </button>
            <button class="btn-icon delete" onclick="excluirEquipamento(${equipamento.id_tmp})" title="Excluir">
              🗑
            </button>
          </div>
        </td>
      </tr>
    `

    // Adicionar implementos
    implementos.forEach((implemento) => {
      html += `
        <tr class="implemento-row" data-parent="${equipamento.id_tmp}" data-id="${implemento.id_tmp}">
          <td>
            <div class="tree-item implemento">
              <span style="width: 20px; display: inline-block;"></span>
              <span class="icon-tool">🔧</span>
              ${implemento.equipamento_impl}
            </div>
          </td>
          <td>${implemento.marca}</td>
          <td>${implemento.modelo}</td>
          <td><span class="status-badge status-${implemento.situacao.toLowerCase()}">${implemento.situacao}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon edit" onclick="editarImplemento(${implemento.id_tmp})" title="Editar">
                ✎
              </button>
              <button class="btn-icon delete" onclick="excluirImplemento(${implemento.id_tmp})" title="Excluir">
                🗑
              </button>
            </div>
          </td>
        </tr>
      `
    })
  })

  tbody.innerHTML = html
}

const toggleImplementos = (equipamentoId) => {
  const implementoRows = document.querySelectorAll(`tr[data-parent="${equipamentoId}"]`)
  const expandButton = document.querySelector(`tr[data-id="${equipamentoId}"] .tree-expand`)

  const isExpanded = expandButton.textContent === "▼"

  implementoRows.forEach((row) => {
    row.style.display = isExpanded ? "none" : "table-row"
  })

  expandButton.textContent = isExpanded ? "▶" : "▼"
}

// ========================================
// FUNÇÕES DE NAVEGAÇÃO E PROGRESSO
// ========================================

const switchTab = (tabName) => {
  // Remover active de todos os botões e painéis
  document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"))
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"))

  // Adicionar active ao botão e painel selecionados
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")
  document.getElementById(tabName).classList.add("active")

  updateProgress()
}

const setupFormListeners = () => {
  // ✅ CORREÇÃO: Campos de operação incluindo os novos selects
  const operacaoFields = [
    "tipo_operacao",
    "tipo_sucata",
    "qtd_producao_mes_ton",
    "ton_vendida",
    "qtd_cliente_quer_crescer",
    "cliente_fornece_para",
    "preco_venda_ton",
    "fundo_baia", // ✅ NOVO: Agora é um select
  ]

  operacaoFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      // ✅ NOVO: Usar 'change' para selects e 'input' para outros campos
      const eventType = field.tagName.toLowerCase() === "select" ? "change" : "input"
      field.addEventListener(eventType, () => {
        // ✅ CORREÇÃO: Tratar valores 0 e 1 corretamente
        if (fieldId === "fundo_baia") {
          const value = field.value
          if (value === "0" || value === "1") {
            diagnosticoData.operacao[fieldId] = Number.parseInt(value)
          } else if (value === "") {
            diagnosticoData.operacao[fieldId] = null
          } else {
            diagnosticoData.operacao[fieldId] = value
          }
        } else {
          diagnosticoData.operacao[fieldId] = field.value
        }
        updateProgress()
        scheduleAutosave()
      })
    }
  })

  // ✅ CORREÇÃO: Campos de previsão incluindo os novos selects
  const previsaoFields = [
    "tipo_cliente",
    "prazo_expansao",
    "tipo_equip_interesse",
    "expansao_equip_implement", // ✅ NOVO: Agora é um select
  ]

  previsaoFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      // ✅ NOVO: Usar 'change' para selects e 'input' para outros campos
      const eventType = field.tagName.toLowerCase() === "select" ? "change" : "input"
      field.addEventListener(eventType, () => {
        // ✅ CORREÇÃO: Tratar valores 0 e 1 corretamente
        if (fieldId === "expansao_equip_implement") {
          const value = field.value
          if (value === "0" || value === "1") {
            diagnosticoData.previsao[fieldId] = Number.parseInt(value)
          } else if (value === "") {
            diagnosticoData.previsao[fieldId] = null
          } else {
            diagnosticoData.previsao[fieldId] = value
          }
        } else {
          diagnosticoData.previsao[fieldId] = field.value
        }
        updateProgress()
        scheduleAutosave()
      })
    }
  })

  // Campos de relacionamento (mantém igual)
  const relacionamentoFields = ["contato_comprador", "contato_operador", "contato_encarregado", "contato_diretor"]

  relacionamentoFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      field.addEventListener("change", () => {
        diagnosticoData.relacionamento[fieldId] = field.checked ? 1 : 0
        updateProgress()
        scheduleAutosave()
      })
    }
  })
}

const updateProgress = () => {
  let completedTabs = 0

  // Aba 1: Equipamentos (33.33%)
  if (diagnosticoData.parque && diagnosticoData.parque.length > 0) {
    completedTabs++
  }

  // Aba 2: Operação (33.33%) - campos obrigatórios
  const operacaoRequired = ["tipo_operacao", "tipo_sucata"]
  const operacaoCompleted = operacaoRequired.every(
    (field) => diagnosticoData.operacao[field] && diagnosticoData.operacao[field].trim() !== "",
  )
  if (operacaoCompleted) completedTabs++

  // Aba 3: Previsão (33.33%) - campo obrigatório
  if (diagnosticoData.previsao.tipo_cliente && diagnosticoData.previsao.tipo_cliente !== "") {
    completedTabs++
  }

  // Progresso baseado em 3 abas (não considera Relacionamento)
  const percentage = (completedTabs / 3) * 100
  document.getElementById("progressPercentage").textContent = `${Math.round(percentage)}%`
  document.getElementById("progressFill").style.width = `${percentage}%`
}

// ========================================
// FUNÇÕES PARA EQUIPAMENTOS
// ========================================

const adicionarEquipamento = () => {
  document.getElementById("equipamentoModalTitle").textContent = "ADICIONAR EQUIPAMENTO"
  document.getElementById("equipamentoForm").reset()
  document.getElementById("equipamento_id").value = ""
  showModal("equipamentoModal")
}

const editarEquipamento = (id) => {
  const equipamento = diagnosticoData.parque.find((item) => item.id_tmp === id)
  if (!equipamento) return

  document.getElementById("equipamentoModalTitle").textContent = "EDITAR EQUIPAMENTO"
  document.getElementById("equipamento_id").value = id
  document.getElementById("equipamento_impl").value = equipamento.equipamento_impl
  document.getElementById("equipamento_marca").value = equipamento.marca
  document.getElementById("equipamento_modelo").value = equipamento.modelo
  document.getElementById("equipamento_situacao").value = equipamento.situacao

  showModal("equipamentoModal")
}

const salvarEquipamento = () => {
  const form = document.getElementById("equipamentoForm")
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }

  const id = document.getElementById("equipamento_id").value
  const equipamentoData = {
    tipo_item: "EQUIPAMENTO",
    equipamento_impl: document.getElementById("equipamento_impl").value,
    marca: document.getElementById("equipamento_marca").value,
    modelo: document.getElementById("equipamento_modelo").value,
    situacao: document.getElementById("equipamento_situacao").value,
  }

  if (id) {
    // Editar existente
    const index = diagnosticoData.parque.findIndex((item) => item.id_tmp == id)
    if (index !== -1) {
      if (diagnosticoData.parque[index].id_real) {
        equipamentoData.id_real = diagnosticoData.parque[index].id_real
      }
      equipamentoData.id_tmp = Number.parseInt(id)
      diagnosticoData.parque[index] = equipamentoData
    }
  } else {
    // Adicionar novo
    equipamentoData.id_tmp = nextTempId++
    diagnosticoData.parque.push(equipamentoData)
  }

  console.log("Equipamento salvo:", equipamentoData)
  console.log("Estado atual do parque:", diagnosticoData.parque)

  renderParqueTable()
  updateProgress()
  scheduleAutosave()
  fecharModal("equipamentoModal")

  DiagnosticoNotify.success("EQUIPAMENTO SALVO COM SUCESSO!")
}

const excluirEquipamento = (id) => {
  if (!confirm("TEM CERTEZA QUE DESEJA EXCLUIR ESTE EQUIPAMENTO E TODOS OS SEUS IMPLEMENTOS?")) {
    return
  }

  console.log("Excluindo equipamento ID:", id)

  // Contar implementos filhos antes da exclusão
  const implementosFilhos = diagnosticoData.parque.filter((item) => item.parent_tmp === id)
  console.log("Implementos filhos encontrados:", implementosFilhos.length)

  // Remover equipamento e implementos filhos
  const itensAntes = diagnosticoData.parque.length
  diagnosticoData.parque = diagnosticoData.parque.filter((item) => {
    // Manter apenas itens que NÃO são o equipamento nem seus implementos
    return !(item.id_tmp === id || item.parent_tmp === id)
  })
  const itensDepois = diagnosticoData.parque.length

  console.log(`Itens removidos: ${itensAntes - itensDepois}`)
  console.log("Estado do parque após exclusão:", diagnosticoData.parque)

  renderParqueTable()
  updateProgress()
  scheduleAutosaveImediato()

  DiagnosticoNotify.success("EQUIPAMENTO E IMPLEMENTOS EXCLUÍDOS COM SUCESSO!")
}

// ========================================
// FUNÇÕES PARA IMPLEMENTOS
// ========================================

const adicionarImplemento = (parentId) => {
  console.log("Adicionando implemento para equipamento ID:", parentId)

  const equipamentoPai = diagnosticoData.parque.find(
    (item) => item.id_tmp === parentId && item.tipo_item === "EQUIPAMENTO",
  )
  if (!equipamentoPai) {
    DiagnosticoNotify.error("EQUIPAMENTO PAI NÃO ENCONTRADO!")
    return
  }

  document.getElementById("implementoModalTitle").textContent = "ADICIONAR IMPLEMENTO"
  document.getElementById("implementoForm").reset()
  document.getElementById("implemento_id").value = ""
  document.getElementById("implemento_parent_id").value = parentId
  showModal("implementoModal")
}

const editarImplemento = (id) => {
  console.log("Editando implemento ID:", id)

  const implemento = diagnosticoData.parque.find((item) => item.id_tmp === id && item.tipo_item === "IMPLEMENTO")
  if (!implemento) {
    DiagnosticoNotify.error("IMPLEMENTO NÃO ENCONTRADO!")
    return
  }

  console.log("Dados do implemento:", implemento)

  document.getElementById("implementoModalTitle").textContent = "EDITAR IMPLEMENTO"
  document.getElementById("implemento_id").value = id
  document.getElementById("implemento_parent_id").value = implemento.parent_tmp
  document.getElementById("implemento_impl").value = implemento.equipamento_impl
  document.getElementById("implemento_marca").value = implemento.marca
  document.getElementById("implemento_modelo").value = implemento.modelo
  document.getElementById("implemento_situacao").value = implemento.situacao

  showModal("implementoModal")
}

const salvarImplemento = () => {
  const form = document.getElementById("implementoForm")
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }

  const id = document.getElementById("implemento_id").value
  const parentId = Number.parseInt(document.getElementById("implemento_parent_id").value)

  console.log("Salvando implemento - ID:", id, "Parent ID:", parentId)

  const equipamentoPai = diagnosticoData.parque.find(
    (item) => item.id_tmp === parentId && item.tipo_item === "EQUIPAMENTO",
  )
  if (!equipamentoPai) {
    DiagnosticoNotify.error("EQUIPAMENTO PAI NÃO ENCONTRADO!")
    return
  }

  const implementoData = {
    tipo_item: "IMPLEMENTO",
    parent_tmp: parentId,
    equipamento_impl: document.getElementById("implemento_impl").value,
    marca: document.getElementById("implemento_marca").value,
    modelo: document.getElementById("implemento_modelo").value,
    situacao: document.getElementById("implemento_situacao").value,
  }

  console.log("Dados do implemento a salvar:", implementoData)

  if (id) {
    const index = diagnosticoData.parque.findIndex((item) => item.id_tmp == id)
    if (index !== -1) {
      if (diagnosticoData.parque[index].id_real) {
        implementoData.id_real = diagnosticoData.parque[index].id_real
      }
      implementoData.id_tmp = Number.parseInt(id)
      diagnosticoData.parque[index] = implementoData
      console.log("Implemento editado no índice:", index)
    } else {
      DiagnosticoNotify.error("IMPLEMENTO NÃO ENCONTRADO PARA EDIÇÃO!")
      return
    }
  } else {
    implementoData.id_tmp = nextTempId++
    diagnosticoData.parque.push(implementoData)
    console.log("Novo implemento adicionado com ID:", implementoData.id_tmp)
  }

  console.log("Estado atual do parque:", diagnosticoData.parque)

  renderParqueTable()
  updateProgress()
  scheduleAutosaveImediato()

  fecharModal("implementoModal")

  DiagnosticoNotify.success("IMPLEMENTO SALVO COM SUCESSO!")
}

const excluirImplemento = (id) => {
  console.log("Excluindo implemento ID:", id)

  if (!confirm("TEM CERTEZA QUE DESEJA EXCLUIR ESTE IMPLEMENTO?")) {
    return
  }

  const implementoIndex = diagnosticoData.parque.findIndex(
    (item) => item.id_tmp === id && item.tipo_item === "IMPLEMENTO",
  )

  if (implementoIndex === -1) {
    DiagnosticoNotify.error("IMPLEMENTO NÃO ENCONTRADO!")
    console.log("Implemento não encontrado. Estado atual:", diagnosticoData.parque)
    return
  }

  console.log("Implemento encontrado no índice:", implementoIndex)
  console.log("Implemento a ser excluído:", diagnosticoData.parque[implementoIndex])

  diagnosticoData.parque.splice(implementoIndex, 1)

  console.log("Estado do parque após exclusão:", diagnosticoData.parque)

  renderParqueTable()
  updateProgress()
  scheduleAutosaveImediato()

  DiagnosticoNotify.success("IMPLEMENTO EXCLUÍDO COM SUCESSO!")
}

// ========================================
// FUNÇÕES DE MODAL
// ========================================

const showModal = (modalId) => {
  const modal = document.getElementById(modalId)
  modal.style.display = "flex"
  modal.style.position = "fixed"
  modal.style.top = "0"
  modal.style.left = "0"
  modal.style.width = "100%"
  modal.style.height = "100%"
  modal.style.backgroundColor = "rgba(0,0,0,0.5)"
  modal.style.zIndex = "1000"
  modal.style.justifyContent = "center"
  modal.style.alignItems = "center"
}

const fecharModal = (modalId) => {
  const modal = document.getElementById(modalId)
  modal.style.display = "none"
}

// ========================================
// SISTEMA DE AUTOSAVE MELHORADO
// ========================================

const startAutosave = () => {
  // ✅ NOVO: Autosave menos frequente para evitar problemas de conexão
  setInterval(() => {
    if (
      !isProcessingSave &&
      (diagnosticoData.parque.length > 0 ||
        Object.keys(diagnosticoData.operacao).length > 0 ||
        Object.keys(diagnosticoData.previsao).length > 0 ||
        Object.keys(diagnosticoData.relacionamento).length > 0)
    ) {
      performAutosave()
    }
  }, 120000) // ✅ MUDANÇA: 2 minutos em vez de 1 minuto
}

const scheduleAutosave = () => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }
  autosaveTimer = setTimeout(() => {
    if (!isProcessingSave) {
      performAutosave()
    }
  }, 10000) // ✅ MUDANÇA: 10 segundos em vez de 5
}

const scheduleAutosaveImediato = () => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }
  autosaveTimer = setTimeout(() => {
    if (!isProcessingSave) {
      performAutosave()
    }
  }, 2000) // ✅ MUDANÇA: 2 segundos em vez de 500ms
}

const performAutosave = async () => {
  if (isProcessingSave) {
    console.log("Autosave já em andamento, pulando...")
    return
  }

  try {
    isProcessingSave = true
    DiagnosticoNotify.info("SALVANDO AUTOMATICAMENTE...")
    await salvarDiagnosticoData()
    console.log("Autosave realizado com sucesso")
    DiagnosticoNotify.success("SALVO AUTOMATICAMENTE!")
  } catch (error) {
    console.error("Erro no autosave:", error)
    DiagnosticoNotify.warning("ERRO NO SALVAMENTO AUTOMÁTICO - TENTE SALVAR MANUALMENTE")
  } finally {
    isProcessingSave = false
  }
}

// ========================================
// FUNÇÕES PRINCIPAIS
// ========================================

const salvarDiagnosticoData = async () => {
  // ✅ NOVO: Validar dados antes de enviar
  if (!empresaId || isNaN(Number.parseInt(empresaId))) {
    throw new Error("ID da empresa inválido")
  }

  const payload = {
    empresa_id: Number.parseInt(empresaId),
    parque: diagnosticoData.parque || [],
    operacao: diagnosticoData.operacao || {},
    previsao: diagnosticoData.previsao || {},
    relacionamento: diagnosticoData.relacionamento || {},
  }

  console.log("Salvando diagnóstico - payload:", payload)
  console.log("Parque items:", payload.parque.length)
  console.log("Operação keys:", Object.keys(payload.operacao))
  console.log("Previsão keys:", Object.keys(payload.previsao))
  console.log("Relacionamento keys:", Object.keys(payload.relacionamento))

  // ✅ NOVO: Verificar tamanho do payload
  const payloadSize = JSON.stringify(payload).length
  console.log("Tamanho do payload:", payloadSize, "bytes")

  if (payloadSize > 1000000) {
    // 1MB
    throw new Error("Payload muito grande para enviar")
  }

  const response = await DiagnosticoAPI.call("/diagnosticos.php", {
    method: "POST",
    body: payload, // Será convertido para JSON string no DiagnosticoAPI.call
  })

  console.log("Resposta do salvamento:", response)
  return response
}

const salvarDiagnostico = async () => {
  if (isProcessingSave) {
    DiagnosticoNotify.info("SALVAMENTO JÁ EM ANDAMENTO...")
    return
  }

  try {
    isProcessingSave = true
    DiagnosticoNotify.info("SALVANDO DIAGNÓSTICO...")
    await salvarDiagnosticoData()
    DiagnosticoNotify.success("DIAGNÓSTICO SALVO COM SUCESSO!")

    setTimeout(() => {
      window.location.href = "../empresas.html"
    }, 2000)
  } catch (error) {
    console.error("Erro ao salvar diagnóstico:", error)
    DiagnosticoNotify.error("ERRO AO SALVAR DIAGNÓSTICO: " + error.message)
  } finally {
    isProcessingSave = false
  }
}

const cancelarDiagnostico = () => {
  if (confirm("TEM CERTEZA QUE DESEJA CANCELAR? TODAS AS ALTERAÇÕES NÃO SALVAS SERÃO PERDIDAS.")) {
    window.location.href = "../empresas.html"
  }
}

// ========================================
// NOVA FUNÇÃO: RECARREGAR DADOS MANUALMENTE
// ========================================

const recarregarDados = async () => {
  if (isProcessingSave) {
    DiagnosticoNotify.warning("AGUARDE O SALVAMENTO TERMINAR...")
    return
  }

  try {
    DiagnosticoNotify.info("RECARREGANDO DADOS...")

    // ✅ CORREÇÃO: Limpar dados em memória primeiro
    diagnosticoData = {
      parque: [],
      operacao: {},
      previsao: {},
      relacionamento: {},
    }

    // Recarregar empresa
    await loadEmpresaInfo()

    // Recarregar diagnóstico
    await loadDiagnosticoData()

    DiagnosticoNotify.success("DADOS RECARREGADOS COM SUCESSO!")
  } catch (error) {
    console.error("Erro ao recarregar dados:", error)
    DiagnosticoNotify.error("ERRO AO RECARREGAR: " + error.message)
  }
}

// ========================================
// EXPORTAR FUNÇÕES GLOBAIS
// ========================================

window.adicionarEquipamento = adicionarEquipamento
window.editarEquipamento = editarEquipamento
window.excluirEquipamento = excluirEquipamento
window.adicionarImplemento = adicionarImplemento
window.editarImplemento = editarImplemento
window.excluirImplemento = excluirImplemento
window.salvarEquipamento = salvarEquipamento
window.salvarImplemento = salvarImplemento
window.fecharModal = fecharModal
window.toggleImplementos = toggleImplementos
window.salvarDiagnostico = salvarDiagnostico
window.cancelarDiagnostico = cancelarDiagnostico
window.recarregarDados = recarregarDados
