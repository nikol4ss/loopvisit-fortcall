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

  // Event listeners para busca de empresa
  document.getElementById("searchBtn").addEventListener("click", buscarEmpresas)
  document.getElementById("empresaSearch").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      buscarEmpresas()
    }
  })

  // Event listener para o formulário
  document.getElementById("visitaForm").addEventListener("submit", handleSubmit)

  // Event listener para mudança no tipo de visita
  document.getElementById("type").addEventListener("change", handleTipoVisitaChange)

  // Adicionar uma validação mais flexível que apenas avisa sobre datas passadas:
  document.getElementById("date").addEventListener("change", (e) => {
    const selectedDate = new Date(e.target.value)
    const now = new Date()

    if (selectedDate < now) {
      const confirmMsg =
        "⚠️ ATENÇÃO: Você está agendando uma visita com data no PASSADO.\n\nIsso é permitido para lançamento de visitas históricas.\n\nDeseja continuar?"
      if (!confirm(confirmMsg)) {
        e.target.value = ""
      }
    }
  })
})

const handleTipoVisitaChange = (e) => {
  const tipoVisita = e.target.value
  const trabalhoInternoInfo = document.getElementById("trabalhoInternoInfo")

  if (tipoVisita === "TRABALHO INTERNO") {
    trabalhoInternoInfo.style.display = "block"

    // Sugerir objetivo padrão para trabalho interno
    const objetivoField = document.getElementById("objetivo")
    if (!objetivoField.value.trim()) {
      objetivoField.placeholder = "Ex: REUNIÃO INTERNA, TREINAMENTO, PLANEJAMENTO ESTRATÉGICO, ANÁLISE DE PROCESSOS..."
    }
  } else {
    trabalhoInternoInfo.style.display = "none"

    // Restaurar placeholder padrão
    const objetivoField = document.getElementById("objetivo")
    objetivoField.placeholder = "DESCREVA O OBJETIVO DA VISITA..."
  }
}

const buscarEmpresas = async () => {
  const searchTerm = document.getElementById("empresaSearch").value.trim()
  const resultsContainer = document.getElementById("empresaResults")

  if (searchTerm.length < 2) {
    window.showError("DIGITE PELO MENOS 2 CARACTERES PARA BUSCAR")
    return
  }

  try {
    const searchBtn = document.getElementById("searchBtn")
    const originalText = searchBtn.textContent
    searchBtn.disabled = true
    searchBtn.textContent = "BUSCANDO..."

    const response = await window.apiCall(`/empresas.php?search=${encodeURIComponent(searchTerm)}&limit=20`)

    if (response.success && response.data && response.data.length > 0) {
      mostrarResultados(response.data)
    } else {
      resultsContainer.innerHTML = '<div class="search-result-item">NENHUMA EMPRESA ENCONTRADA</div>'
      resultsContainer.style.display = "block"
    }

    searchBtn.disabled = false
    searchBtn.textContent = originalText
  } catch (error) {
    console.error("Erro ao buscar empresas:", error)
    window.showError("ERRO AO BUSCAR EMPRESAS")

    const searchBtn = document.getElementById("searchBtn")
    searchBtn.disabled = false
    searchBtn.textContent = "BUSCAR"
  }
}

const mostrarResultados = (empresas) => {
  const resultsContainer = document.getElementById("empresaResults")

  resultsContainer.innerHTML = empresas
    .map(
      (empresa) => `
    <div class="search-result-item" onclick="selecionarEmpresa(${JSON.stringify(empresa).replace(/"/g, "&quot;")})">
      <div class="result-name">${empresa.name}</div>
      <div class="result-details">
        ${empresa.cnpj ? `CNPJ: ${empresa.cnpj} | ` : ""}
        ${empresa.address ? `${empresa.address} | ` : ""}
        ${empresa.responsible ? `Resp: ${empresa.responsible}` : ""}
        ${empresa.cidade_nome ? `| ${empresa.cidade_nome}` : ""}
      </div>
    </div>
  `,
    )
    .join("")

  resultsContainer.style.display = "block"
}

// Função para normalizar texto (remover acentos)
const normalizeText = (text) => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
}

// Cache de estados para evitar múltiplas consultas
let estadosCache = null

// Buscar todos os estados disponíveis (otimizado)
const buscarTodosEstados = async () => {
  if (estadosCache) {
    console.log("📋 Usando cache de estados:", estadosCache)
    return estadosCache
  }

  try {
    console.log("🔍 Buscando todos os estados disponíveis...")

    // Lista completa de estados brasileiros por ID
    const estadosBrasil = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
    ]

    console.log("📍 Estados do Brasil:", estadosBrasil.length)
    estadosCache = estadosBrasil
    return estadosBrasil
  } catch (error) {
    console.error("Erro ao buscar estados:", error)
    // Fallback com estados conhecidos
    const fallback = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
    estadosCache = fallback
    return fallback
  }
}

const buscarCityIdPorNome = async (cidadeNome) => {
  try {
    console.log("🔍 Buscando city_id para cidade:", cidadeNome)
    const cidadeNormalizada = normalizeText(cidadeNome)
    console.log("🔤 Cidade normalizada:", cidadeNormalizada)

    // Buscar em todos os estados disponíveis
    const estadosIds = await buscarTodosEstados()
    console.log("🗺️ Buscando em", estadosIds.length, "estados")

    // Estados prioritários (onde há mais empresas)
    const estadosPrioritarios = [14, 1, 2, 3, 4, 5] // GO, MG, SP, RJ, etc.
    const estadosRestantes = estadosIds.filter((id) => !estadosPrioritarios.includes(id))
    const ordemBusca = [...estadosPrioritarios, ...estadosRestantes]

    for (const estadoId of ordemBusca) {
      try {
        console.log(`🔍 Buscando em estado ${estadoId}...`)
        const response = await window.apiCall(`/estados-cidades.php?estado_id=${estadoId}`)

        if (response.success && response.data && response.data.length > 0) {
          console.log(`📍 Estado ${estadoId}: ${response.data.length} cidades`)

          // Buscar cidade normalizada
          const cidade = response.data.find((c) => {
            const cidadeDbNormalizada = normalizeText(c.nome)
            return cidadeDbNormalizada === cidadeNormalizada
          })

          if (cidade) {
            console.log("✅ Cidade encontrada no estado", estadoId, ":", cidade.nome, "ID:", cidade.id)
            return cidade.id
          }
        }
      } catch (error) {
        console.log(`❌ Erro ao buscar no estado ${estadoId}:`, error.message)
        continue
      }
    }

    console.log("❌ Cidade", cidadeNome, "não encontrada em nenhum estado")
    return null
  } catch (error) {
    console.error("Erro geral ao buscar city_id:", error)
    return null
  }
}

const buscarCityIdValido = async () => {
  try {
    console.log("🔍 Buscando um city_id válido...")

    // Buscar cidades de MG (estado_id = 1)
    const response = await window.apiCall("/estados-cidades.php?estado_id=1")

    if (response.success && response.data && response.data.length > 0) {
      // Pegar a primeira cidade de MG
      const primeiraCidade = response.data[0]
      console.log("✅ Primeira cidade de MG encontrada:", primeiraCidade.nome, "ID:", primeiraCidade.id)
      return primeiraCidade.id
    }
  } catch (error) {
    console.error("Erro ao buscar city_id válido:", error)
  }

  return 407 // Fallback conhecido
}

const selecionarEmpresa = async (empresa) => {
  console.log("🏢 Empresa selecionada:", empresa)

  // Definir empresa selecionada
  document.getElementById("company_id").value = empresa.id
  document.getElementById("empresaSearch").value = empresa.name

  let cityId = null

  // 1. Tentar usar o city_id da empresa se existir
  if (empresa.city_id) {
    cityId = empresa.city_id
    console.log("✅ Usando city_id da empresa:", cityId)
  }
  // 2. Se não tem city_id mas tem cidade_nome, buscar pelo nome
  else if (empresa.cidade_nome) {
    console.log("🔍 Empresa sem city_id, buscando pelo nome da cidade:", empresa.cidade_nome)
    cityId = await buscarCityIdPorNome(empresa.cidade_nome)
  }

  // 3. Se ainda não encontrou, usar uma cidade válida
  if (!cityId) {
    console.log("⚠️ Não foi possível encontrar city_id específico, buscando cidade padrão...")
    cityId = await buscarCityIdValido()
  }

  // 4. Fallback final
  if (!cityId) {
    cityId = 407
    console.log("🔄 Usando city_id padrão final:", cityId)
  }

  document.getElementById("city_id").value = cityId

  // Preencher informações da empresa
  document.getElementById("empresaNome").textContent = empresa.name
  document.getElementById("empresaCnpj").textContent = empresa.cnpj || "-"
  document.getElementById("empresaCidade").textContent = empresa.cidade_nome || "CIDADE PADRÃO"
  document.getElementById("empresaEndereco").textContent = empresa.address || "-"
  document.getElementById("empresaTelefone").textContent = empresa.phone || "-"
  document.getElementById("empresaWhatsapp").textContent = empresa.whatsapp || "-"
  document.getElementById("empresaResponsavel").textContent = empresa.responsible || "-"

  // Mostrar informações da empresa
  document.getElementById("empresaInfo").style.display = "block"

  // Ocultar resultados
  document.getElementById("empresaResults").style.display = "none"

  console.log("✅ City_id final definido:", cityId)
}

const handleSubmit = async (e) => {
  e.preventDefault()

  const companyId = document.getElementById("company_id").value
  if (!companyId) {
    window.showError("SELECIONE UMA EMPRESA ANTES DE AGENDAR A VISITA")
    return
  }

  const cityId = document.getElementById("city_id").value
  console.log("📝 City_id no submit:", cityId, "Tipo:", typeof cityId)

  if (!cityId || cityId === "" || cityId === "0") {
    window.showError("ERRO: CITY_ID NÃO DEFINIDO CORRETAMENTE")
    return
  }

  const formData = new FormData(e.target)
  const data = Object.fromEntries(formData.entries())

  // Validação especial para trabalho interno
  if (data.type === "TRABALHO INTERNO") {
    if (!data.objetivo || data.objetivo.trim().length < 10) {
      window.showError(
        "PARA TRABALHO INTERNO, É OBRIGATÓRIO DESCREVER DETALHADAMENTE O OBJETIVO (MÍNIMO 10 CARACTERES)",
      )
      return
    }
  }

  console.log("📋 Dados da visita:", data)

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]')
    const originalText = submitBtn.textContent
    submitBtn.disabled = true
    submitBtn.textContent = "AGENDANDO..."

    const response = await window.apiCall("/visitas.php", {
      method: "POST",
      body: JSON.stringify(data),
    })

    if (response.success) {
      let successMessage = "VISITA AGENDADA COM SUCESSO!"

      // 🔥 MENSAGENS ESPECIAIS
      if (response.consultor_secundario) {
        successMessage = "VISITA CRIADA COMO CONSULTOR SECUNDÁRIO!"
      }

      if (response.trabalho_interno) {
        successMessage = "TRABALHO INTERNO CHB AGENDADO COM SUCESSO!"
      }

      if (response.retroativa) {
        successMessage += " (VISITA RETROATIVA - DATA NO PASSADO)"
      }

      window.showSuccess(successMessage)
      setTimeout(() => {
        window.location.href = "../visitas.html"
      }, 2000)
    } else {
      throw new Error(response.message || "Erro ao agendar visita")
    }
  } catch (error) {
    console.error("Erro ao agendar visita:", error)
    window.showError(error.message || "ERRO AO AGENDAR VISITA")

    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.textContent = "AGENDAR VISITA"
  }
}
