document.addEventListener("DOMContentLoaded", async () => {
  const empresaId = new URLSearchParams(window.location.search).get("id")
  const form = document.getElementById("empresaForm")
  const loadingIndicator = document.getElementById("loadingIndicator")
  const estadoSelect = document.getElementById("state_id")
  const cidadeSelect = document.getElementById("city_id")
  const consultorSelect = document.getElementById("consultant")
  const consultorSecundarioSelect = document.getElementById("consultant_secondary") // NOVO

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

  // NOVA FUNÇÃO: Atualizar opções do consultor secundário
  function updateConsultorSecundario() {
    const consultorPrincipalId = consultorSelect.value

    // Desabilitar a opção do consultor principal no select secundário
    Array.from(consultorSecundarioSelect.options).forEach((option) => {
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
    if (consultorSecundarioSelect.value === consultorPrincipalId) {
      consultorSecundarioSelect.value = ""
    }
  }

  // NOVA FUNÇÃO: Atualizar opções do consultor principal
  function updateConsultorPrincipal() {
    const consultorSecundarioId = consultorSecundarioSelect.value

    // Desabilitar a opção do consultor secundário no select principal
    Array.from(consultorSelect.options).forEach((option) => {
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

  // Verificar se temos um ID válido
  if (!empresaId) {
    alert("ID da empresa não fornecido!")
    window.location.href = "../empresas.html"
    return
  }

  console.log("Carregando empresa com ID:", empresaId)

  // Função para mostrar/ocultar loading
  function showLoading(show = true) {
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? "block" : "none"
    }
    if (form) {
      form.style.display = show ? "none" : "block"
    }
  }

  async function loadEmpresa(empresaId) {
    try {
      showLoading(true)
      console.log("Fazendo requisição para:", `empresas.php?id=${empresaId}`)

      const response = await window.apiCall(`/empresas.php?id=${empresaId}`)

      console.log("Dados recebidos:", response)

      if (!response.success || !response.data) {
        throw new Error(response.error || "Dados da empresa não encontrados")
      }

      const empresa = response.data

      // Preencher os campos do formulário
      const setFieldValue = (id, value) => {
        const element = document.getElementById(id)
        if (element) {
          element.value = value || ""
          console.log(`Campo ${id} preenchido com: ${value}`)
        } else {
          console.warn(`Elemento não encontrado: ${id}`)
        }
      }

      setFieldValue("name", empresa.name)
      setFieldValue("cnpj", empresa.cnpj)
      setFieldValue("address", empresa.address)
      setFieldValue("segment", empresa.segment)
      setFieldValue("sector", empresa.sector)
      setFieldValue("region", empresa.region)
      setFieldValue("phone", empresa.phone)
      setFieldValue("whatsapp", empresa.whatsapp)
      setFieldValue("email", empresa.email)
      setFieldValue("responsible", empresa.responsible)
      setFieldValue("rating", empresa.rating)
      setFieldValue("status", empresa.status || "ATIVA")

      // Carregar estados e selecionar o estado da empresa
      await loadEstados()
      if (empresa.state_id) {
        setFieldValue("state_id", empresa.state_id)
        // Carregar cidades do estado selecionado
        await loadCidadesPorEstado(empresa.state_id)
        if (empresa.city_id) {
          setFieldValue("city_id", empresa.city_id)
        }
      }

      // Carregar consultores e selecionar os consultores da empresa
      await loadConsultores()
      if (empresa.consultant) {
        setFieldValue("consultant", empresa.consultant)
      }
      // NOVO: Selecionar consultor secundário
      if (empresa.consultant_secondary) {
        setFieldValue("consultant_secondary", empresa.consultant_secondary)
      }

      // Preencher informações de auditoria
      const setTextContent = (id, value) => {
        const element = document.getElementById(id)
        if (element) {
          element.textContent = value || "-"
        }
      }

      setTextContent("createdBy", empresa.created_by_name)
      setTextContent("createdAt", new Date(empresa.created_at).toLocaleString("pt-BR"))
      setTextContent("updatedAt", new Date(empresa.updated_at).toLocaleString("pt-BR"))
      setTextContent("totalVisitas", "0") // Será implementado depois
      setupEventListeners()

      showLoading(false)
    } catch (error) {
      console.error("Erro ao carregar empresa:", error)
      alert("Erro ao carregar dados da empresa: " + error.message)
      showLoading(false)
    }
  }

  async function loadEstados() {
    try {
      console.log("Carregando estados...")
      const response = await window.apiCall("/estados-cidades.php")

      console.log("Resposta dos estados:", response)

      const estados = response.data || []

      if (estadoSelect) {
        estadoSelect.innerHTML = '<option value="">SELECIONE O ESTADO</option>'

        if (Array.isArray(estados)) {
          estados.forEach((estado) => {
            const option = document.createElement("option")
            option.value = estado.id
            option.textContent = estado.nome
            estadoSelect.appendChild(option)
          })
          console.log(`Carregados ${estados.length} estados`)
        }
      }
    } catch (error) {
      console.error("Erro ao carregar estados:", error)
    }
  }

  async function loadCidadesPorEstado(estadoId) {
    if (!cidadeSelect || !estadoId) return

    console.log(`Carregando cidades para o estado: ${estadoId}`)
    cidadeSelect.innerHTML = "<option value=''>CARREGANDO CIDADES...</option>"

    try {
      const response = await window.apiCall(`/estados-cidades.php?estado_id=${estadoId}`)

      console.log("Resposta das cidades para estado", estadoId, ":", response)

      const cidades = response.data || []

      cidadeSelect.innerHTML = "<option value=''>SELECIONE A CIDADE</option>"

      if (Array.isArray(cidades) && cidades.length > 0) {
        cidades.forEach((cidade) => {
          const option = document.createElement("option")
          option.value = cidade.id
          option.textContent = cidade.nome
          cidadeSelect.appendChild(option)
        })
        console.log(`Carregadas ${cidades.length} cidades para o estado ${estadoId}`)
      } else {
        console.warn("Nenhuma cidade encontrada para o estado:", estadoId)
        cidadeSelect.innerHTML = "<option value=''>NENHUMA CIDADE ENCONTRADA</option>"
      }
    } catch (error) {
      console.error("Erro ao carregar cidades:", error)
      cidadeSelect.innerHTML = "<option value=''>ERRO AO CARREGAR CIDADES</option>"
    }
  }

  async function loadConsultores() {
    try {
      const response = await window.apiCall("/usuarios.php?role=CONSULTOR")

      const consultores = response.data || []

      if (consultorSelect && consultorSecundarioSelect) {
        consultorSelect.innerHTML = '<option value="">SELECIONE O CONSULTOR PRINCIPAL</option>'
        consultorSecundarioSelect.innerHTML = '<option value="">SELECIONE O CONSULTOR SECUNDÁRIO (OPCIONAL)</option>'

        if (Array.isArray(consultores)) {
          consultores.forEach((consultor) => {
            // Consultor Principal
            const optionPrincipal = document.createElement("option")
            optionPrincipal.value = consultor.id
            optionPrincipal.textContent = consultor.name
            consultorSelect.appendChild(optionPrincipal)

            // Consultor Secundário
            const optionSecundario = document.createElement("option")
            optionSecundario.value = consultor.id
            optionSecundario.textContent = consultor.name
            consultorSecundarioSelect.appendChild(optionSecundario)
          })
        }
      }
    } catch (error) {
      console.error("Erro ao carregar consultores:", error)
    }
  }

  // Adicionar event listeners para formatação
  function setupEventListeners() {
    // Máscara para CNPJ
    const cnpjField = document.getElementById("cnpj")
    if (cnpjField) {
      cnpjField.addEventListener("input", (e) => {
        e.target.value = formatCNPJ(e.target.value)
      })
    }

    // Máscara para telefone
    const phoneField = document.getElementById("phone")
    if (phoneField) {
      phoneField.addEventListener("input", (e) => {
        e.target.value = formatPhone(e.target.value)
      })
    }

    // Máscara para WhatsApp
    const whatsappField = document.getElementById("whatsapp")
    if (whatsappField) {
      whatsappField.addEventListener("input", (e) => {
        e.target.value = formatPhone(e.target.value)
      })
    }

    // NOVO: Event listeners para consultores
    if (consultorSelect) {
      consultorSelect.addEventListener("change", updateConsultorSecundario)
    }

    if (consultorSecundarioSelect) {
      consultorSecundarioSelect.addEventListener("change", updateConsultorPrincipal)
    }
  }

  // Event listeners
  if (estadoSelect) {
    estadoSelect.addEventListener("change", (event) => {
      const estadoId = event.target.value
      console.log("Estado selecionado:", estadoId)

      // Limpar cidades quando estado muda
      if (cidadeSelect) {
        cidadeSelect.innerHTML = "<option value=''>SELECIONE A CIDADE</option>"
      }

      if (estadoId) {
        loadCidadesPorEstado(estadoId)
      }
    })
  }

  // Event listener para cidade (apenas para debug)
  if (cidadeSelect) {
    cidadeSelect.addEventListener("change", (event) => {
      const cidadeId = event.target.value
      console.log("Cidade selecionada:", cidadeId)
    })
  }

  if (form) {
    form.addEventListener("submit", handleSubmit)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    console.log("Iniciando atualização de empresa...")

    const data = {
      id: empresaId,
      name: document.getElementById("name").value.trim(),
      cnpj: document.getElementById("cnpj").value.trim(),
      address: document.getElementById("address").value.trim(),
      segment: document.getElementById("segment").value.trim(),
      sector: document.getElementById("sector").value.trim(),
      region: document.getElementById("region").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      whatsapp: document.getElementById("whatsapp").value.trim(),
      email: document.getElementById("email").value.trim(),
      responsible: document.getElementById("responsible").value.trim(),
      state_id: document.getElementById("state_id").value,
      city_id: document.getElementById("city_id").value,
      consultant: document.getElementById("consultant").value,
      consultant_secondary: document.getElementById("consultant_secondary").value, // NOVO
      rating: document.getElementById("rating").value,
      status: document.getElementById("status").value,
    }

    // Validações - manter apenas as solicitadas
    if (!data.name) {
      alert("NOME DA EMPRESA É OBRIGATÓRIO")
      return
    }

    if (!data.cnpj) {
      alert("CNPJ É OBRIGATÓRIO")
      return
    }

    if (!validarCNPJ(data.cnpj)) {
      alert("CNPJ INVÁLIDO")
      return
    }

    if (!data.segment) {
      alert("SEGMENTO É OBRIGATÓRIO")
      return
    }

    if (!data.address) {
      alert("ENDEREÇO É OBRIGATÓRIO")
      return
    }

    if (!data.state_id) {
      alert("ESTADO É OBRIGATÓRIO")
      return
    }

    if (!data.city_id) {
      alert("CIDADE É OBRIGATÓRIA")
      return
    }

    if (!data.consultant) {
      alert("CONSULTOR PRINCIPAL É OBRIGATÓRIO")
      return
    }

    // NOVA VALIDAÇÃO: Consultor secundário não pode ser igual ao principal
    if (data.consultant_secondary && data.consultant_secondary === data.consultant) {
      alert("CONSULTOR SECUNDÁRIO NÃO PODE SER O MESMO QUE O PRINCIPAL")
      return
    }

    if (!validarTelefone(data.phone)) {
      alert("TELEFONE INVÁLIDO")
      return
    }

    if (!validarTelefone(data.whatsapp)) {
      alert("WHATSAPP INVÁLIDO")
      return
    }

    if (!validarEmail(data.email)) {
      alert("EMAIL INVÁLIDO")
      return
    }

    // Limpar formatação dos campos
    data.cnpj = limparFormatacao(data.cnpj)
    data.phone = limparFormatacao(data.phone)
    data.whatsapp = limparFormatacao(data.whatsapp)

    // Converter campos numéricos
    if (data.state_id) data.state_id = Number.parseInt(data.state_id)
    if (data.city_id) data.city_id = Number.parseInt(data.city_id)
    if (data.consultant) data.consultant = Number.parseInt(data.consultant)
    if (data.consultant_secondary) {
      data.consultant_secondary = Number.parseInt(data.consultant_secondary)
    } else {
      data.consultant_secondary = null
    }
    if (data.rating) data.rating = Number.parseInt(data.rating)

    try {
      console.log("Enviando dados:", data)

      const response = await window.apiCall("/empresas.php", {
        method: "PUT",
        body: JSON.stringify(data),
      })

      console.log("Resultado:", response)

      if (response.success) {
        alert("Empresa atualizada com sucesso!")
        window.location.href = "../empresas.html"
      } else {
        throw new Error(response.error || "Erro ao atualizar empresa")
      }
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error)
      alert("Erro ao atualizar empresa: " + error.message)
    }
  }

  // Função para excluir empresa
  window.excluirEmpresa = async () => {
    if (confirm("Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita!")) {
      try {
        const response = await window.apiCall(`/empresas.php?id=${empresaId}`, {
          method: "DELETE",
        })

        if (response.success) {
          alert("Empresa excluída com sucesso!")
          window.location.href = "../empresas.html"
        } else {
          throw new Error(response.error || "Erro ao excluir empresa")
        }
      } catch (error) {
        console.error("Erro ao excluir empresa:", error)
        alert("Erro ao excluir empresa: " + error.message)
      }
    }
  }

  // Inicializar
  showLoading(true)

  try {
    await loadEstados()
    await loadConsultores()

    if (empresaId) {
      await loadEmpresa(empresaId)
    }
  } catch (error) {
    console.error("Erro na inicialização:", error)
    showLoading(false)
  }
})
