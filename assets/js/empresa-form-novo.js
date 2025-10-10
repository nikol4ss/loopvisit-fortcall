// Aguardar carregamento da página
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de nova empresa carregada")

  // Verificar autenticação
  if (!window.checkAuth()) {
    return
  }

  // Carregar dados iniciais
  await loadEstados()
  await loadConsultores()

  // Configurar event listeners
  setupEventListeners()
})

// Configurar event listeners
function setupEventListeners() {
  // Máscara para CNPJ
  document.getElementById("cnpj").addEventListener("input", (e) => {
    e.target.value = formatCNPJ(e.target.value)
  })

  // Máscara para telefone
  document.getElementById("phone").addEventListener("input", (e) => {
    e.target.value = formatPhone(e.target.value)
  })

  // Máscara para WhatsApp
  document.getElementById("whatsapp").addEventListener("input", (e) => {
    e.target.value = formatPhone(e.target.value)
  })

  // Mudança de estado
  document.getElementById("state_id").addEventListener("change", (e) => {
    const estadoId = e.target.value
    if (estadoId) {
      loadCidadesPorEstado(estadoId)
    } else {
      document.getElementById("city_id").innerHTML = '<option value="">SELECIONE A CIDADE</option>'
    }
  })

  // NOVO: Evitar que o mesmo consultor seja selecionado como principal e secundário
  document.getElementById("consultant").addEventListener("change", updateConsultorSecundario)
  document.getElementById("consultant_secondary").addEventListener("change", updateConsultorPrincipal)

  // Submit do formulário
  document.getElementById("empresaForm").addEventListener("submit", handleSubmit)
}

// Carregar estados
async function loadEstados() {
  try {
    console.log("Carregando estados...")
    const response = await window.apiCall("/estados-cidades.php")

    if (response.success && response.data) {
      const select = document.getElementById("state_id")
      select.innerHTML = '<option value="">SELECIONE O ESTADO</option>'

      response.data.forEach((estado) => {
        const option = document.createElement("option")
        option.value = estado.id
        option.textContent = `${estado.nome} - ${estado.sigla}`
        select.appendChild(option)
      })

      console.log(`${response.data.length} estados carregados`)
    }
  } catch (error) {
    console.error("Erro ao carregar estados:", error)
    window.showError("ERRO AO CARREGAR ESTADOS")
  }
}

// Carregar cidades por estado
async function loadCidadesPorEstado(estadoId) {
  try {
    console.log(`Carregando cidades do estado ${estadoId}...`)
    const response = await window.apiCall(`/estados-cidades.php?estado_id=${estadoId}`)

    if (response.success && response.data) {
      const select = document.getElementById("city_id")
      select.innerHTML = '<option value="">SELECIONE A CIDADE</option>'

      response.data.forEach((cidade) => {
        const option = document.createElement("option")
        option.value = cidade.id
        option.textContent = cidade.nome
        select.appendChild(option)
      })

      console.log(`${response.data.length} cidades carregadas`)
    }
  } catch (error) {
    console.error("Erro ao carregar cidades:", error)
    window.showError("ERRO AO CARREGAR CIDADES")
  }
}

// Carregar consultores - ATUALIZADO para ambos os selects
async function loadConsultores() {
  try {
    console.log("Carregando consultores...")
    const response = await window.apiCall("/usuarios.php?role=CONSULTOR")

    if (response.success && response.data) {
      const consultorPrincipal = document.getElementById("consultant")
      const consultorSecundario = document.getElementById("consultant_secondary")

      // Limpar ambos os selects
      consultorPrincipal.innerHTML = '<option value="">SELECIONE O CONSULTOR PRINCIPAL</option>'
      consultorSecundario.innerHTML = '<option value="">SELECIONE O CONSULTOR SECUNDÁRIO (OPCIONAL)</option>'

      // Adicionar consultores em ambos os selects
      response.data.forEach((consultor) => {
        // Consultor Principal
        const optionPrincipal = document.createElement("option")
        optionPrincipal.value = consultor.id
        optionPrincipal.textContent = consultor.name
        consultorPrincipal.appendChild(optionPrincipal)

        // Consultor Secundário
        const optionSecundario = document.createElement("option")
        optionSecundario.value = consultor.id
        optionSecundario.textContent = consultor.name
        consultorSecundario.appendChild(optionSecundario)
      })

      console.log(`${response.data.length} consultores carregados`)
    }
  } catch (error) {
    console.error("Erro ao carregar consultores:", error)
    window.showError("ERRO AO CARREGAR CONSULTORES")
  }
}

// NOVA FUNÇÃO: Atualizar opções do consultor secundário
function updateConsultorSecundario() {
  const consultorPrincipalId = document.getElementById("consultant").value
  const consultorSecundario = document.getElementById("consultant_secondary")

  // Desabilitar a opção do consultor principal no select secundário
  Array.from(consultorSecundario.options).forEach((option) => {
    if (option.value === consultorPrincipalId && option.value !== "") {
      option.disabled = true
      option.style.color = "#ccc"
      option.textContent = option.textContent.replace(" (PRINCIPAL)", "") + " (PRINCIPAL)"
    } else {
      option.disabled = false
      option.style.color = ""
      option.textContent = option.textContent.replace(" (PRINCIPAL)", "")
    }
  })

  // Se o consultor secundário atual é o mesmo que o principal, limpar
  if (consultorSecundario.value === consultorPrincipalId) {
    consultorSecundario.value = ""
  }
}

// NOVA FUNÇÃO: Atualizar opções do consultor principal
function updateConsultorPrincipal() {
  const consultorSecundarioId = document.getElementById("consultant_secondary").value
  const consultorPrincipal = document.getElementById("consultant")

  // Desabilitar a opção do consultor secundário no select principal
  Array.from(consultorPrincipal.options).forEach((option) => {
    if (option.value === consultorSecundarioId && option.value !== "") {
      option.disabled = true
      option.style.color = "#ccc"
      option.textContent = option.textContent.replace(" (SECUNDÁRIO)", "") + " (SECUNDÁRIO)"
    } else {
      option.disabled = false
      option.style.color = ""
      option.textContent = option.textContent.replace(" (SECUNDÁRIO)", "")
    }
  })
}

// Formatação de CNPJ
function formatCNPJ(value) {
  // Remove tudo que não é dígito
  value = value.replace(/\D/g, "")

  // Aplica a máscara
  if (value.length <= 2) {
    return value
  } else if (value.length <= 5) {
    return value.replace(/(\d{2})(\d+)/, "$1.$2")
  } else if (value.length <= 8) {
    return value.replace(/(\d{2})(\d{3})(\d+)/, "$1.$2.$3")
  } else if (value.length <= 12) {
    return value.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4")
  } else {
    return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, "$1.$2.$3/$4-$5")
  }
}

// Formatação de telefone
function formatPhone(value) {
  // Remove tudo que não é dígito
  value = value.replace(/\D/g, "")

  // Aplica a máscara
  if (value.length <= 2) {
    return value
  } else if (value.length <= 7) {
    return value.replace(/(\d{2})(\d+)/, "($1) $2")
  } else if (value.length <= 10) {
    return value.replace(/(\d{2})(\d{4})(\d+)/, "($1) $2-$3")
  } else {
    return value.replace(/(\d{2})(\d{5})(\d+)/, "($1) $2-$3")
  }
}

// Validação de CNPJ
function validarCNPJ(cnpj) {
  // Remove formatação
  cnpj = cnpj.replace(/\D/g, "")

  // Verifica se tem 14 dígitos
  if (cnpj.length !== 14) return false

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cnpj)) return false

  // Validação dos dígitos verificadores
  let soma = 0
  let peso = 2

  // Primeiro dígito verificador
  for (let i = 11; i >= 0; i--) {
    soma += Number.parseInt(cnpj.charAt(i)) * peso
    peso = peso === 9 ? 2 : peso + 1
  }

  let resto = soma % 11
  const digito1 = resto < 2 ? 0 : 11 - resto

  if (Number.parseInt(cnpj.charAt(12)) !== digito1) return false

  // Segundo dígito verificador
  soma = 0
  peso = 2

  for (let i = 12; i >= 0; i--) {
    soma += Number.parseInt(cnpj.charAt(i)) * peso
    peso = peso === 9 ? 2 : peso + 1
  }

  resto = soma % 11
  const digito2 = resto < 2 ? 0 : 11 - resto

  return Number.parseInt(cnpj.charAt(13)) === digito2
}

// Validação de telefone
function validarTelefone(telefone) {
  if (!telefone) return true // Campo opcional

  const digits = telefone.replace(/\D/g, "")
  return digits.length >= 10 && digits.length <= 11
}

// Validação de email
function validarEmail(email) {
  if (!email) return true // Campo opcional

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

// Limpar formatação para envio
function limparFormatacao(value) {
  return value ? value.replace(/\D/g, "") : ""
}

// Handle submit do formulário - ATUALIZADO com consultor secundário
async function handleSubmit(e) {
  e.preventDefault()

  console.log("Iniciando cadastro de empresa...")

  // Coletar dados do formulário
  const formData = new FormData(e.target)
  const data = {}

  for (const [key, value] of formData.entries()) {
    data[key] = value.trim()
  }

  console.log("Dados coletados:", data)

  // Validações
  if (!data.name) {
    window.showError("NOME DA EMPRESA É OBRIGATÓRIO")
    return
  }

  if (!data.cnpj) {
    window.showError("CNPJ É OBRIGATÓRIO")
    return
  }

  if (!validarCNPJ(data.cnpj)) {
    window.showError("CNPJ INVÁLIDO")
    return
  }

  if (!data.segment) {
    window.showError("SEGMENTO É OBRIGATÓRIO")
    return
  }

  if (!data.address) {
    window.showError("ENDEREÇO É OBRIGATÓRIO")
    return
  }

  if (!data.state_id) {
    window.showError("ESTADO É OBRIGATÓRIO")
    return
  }

  if (!data.city_id) {
    window.showError("CIDADE É OBRIGATÓRIA")
    return
  }

  if (!data.region) {
    window.showError("REGIÃO É OBRIGATÓRIA")
    return
  }

  if (!data.consultant) {
    window.showError("CONSULTOR PRINCIPAL É OBRIGATÓRIO")
    return
  }

  // NOVA VALIDAÇÃO: Consultor secundário não pode ser igual ao principal
  if (data.consultant_secondary && data.consultant_secondary === data.consultant) {
    window.showError("CONSULTOR SECUNDÁRIO NÃO PODE SER O MESMO QUE O PRINCIPAL")
    return
  }

  if (!validarTelefone(data.phone)) {
    window.showError("TELEFONE INVÁLIDO")
    return
  }

  if (!validarTelefone(data.whatsapp)) {
    window.showError("WHATSAPP INVÁLIDO")
    return
  }

  if (!validarEmail(data.email)) {
    window.showError("EMAIL INVÁLIDO")
    return
  }

  // Limpar formatação dos campos
  data.cnpj = limparFormatacao(data.cnpj)
  data.phone = limparFormatacao(data.phone)
  data.whatsapp = limparFormatacao(data.whatsapp)

  // Converter campos numéricos
  data.state_id = Number.parseInt(data.state_id)
  data.city_id = Number.parseInt(data.city_id)
  data.consultant = Number.parseInt(data.consultant)

  // NOVO: Converter consultor secundário (se preenchido)
  if (data.consultant_secondary) {
    data.consultant_secondary = Number.parseInt(data.consultant_secondary)
  } else {
    data.consultant_secondary = null
  }

  if (data.rating) {
    data.rating = Number.parseInt(data.rating)
  }

  console.log("Dados para envio:", data)

  try {
    // Usar fetch diretamente com headers corretos
    const response = await fetch("../api/empresas.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${window.TokenManager.get()}`,
      },
      body: JSON.stringify(data),
    })

    console.log("Status da resposta:", response.status)

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`)
    }

    const result = await response.json()
    console.log("Resposta da API:", result)

    if (result.success) {
      window.showSuccess("EMPRESA CADASTRADA COM SUCESSO!")

      // Aguardar um pouco e redirecionar
      setTimeout(() => {
        window.location.href = "../empresas.html"
      }, 2000)
    } else {
      window.showError(result.error || result.message || "ERRO AO CADASTRAR EMPRESA")
    }
  } catch (error) {
    console.error("Erro ao cadastrar empresa:", error)
    window.showError("ERRO AO CADASTRAR EMPRESA: " + error.message)
  }
}
