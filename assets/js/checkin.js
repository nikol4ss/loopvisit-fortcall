let visitaId = null
let checkinData = {}
let isReadonly = false
let currentAttachment = null

document.addEventListener("DOMContentLoaded", async () => {
  // Verificar autenticação
  if (!window.checkAuth()) return

  const user = window.TokenManager.getUser()
  document.getElementById("userName").textContent = user.name

  if (user.role === "GESTOR") {
    document.getElementById("relatoriosLink").style.display = "block"
  }

  // Extrair ID da visita da URL
  const urlParams = new URLSearchParams(window.location.search)
  visitaId = urlParams.get("id")
  const readonly = urlParams.get("readonly")

  if (!visitaId) {
    window.showError("ID DA VISITA NÃO ENCONTRADO")
    return
  }

  // Event listeners
  document.getElementById("logoutBtn").addEventListener("click", window.logout)

  // Tabs - sempre permitir navegação entre abas
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab))
  })

  // Carregar dados existentes
  await loadCheckinData()

  // Verificar se é readonly ou se check-in já foi finalizado
  if (readonly === "true" || (checkinData && checkinData.is_draft == 0)) {
    setReadonlyMode()
  } else {
    setEditMode()
  }

  updateProgress()
  updateRelationshipProgress()
})

const setReadonlyMode = () => {
  isReadonly = true

  // Desabilitar todos os campos de entrada (mas manter visíveis e copiáveis)
  document.querySelectorAll("input, select, textarea").forEach((field) => {
    field.disabled = true
    // Permitir seleção de texto para cópia
    field.style.userSelect = "text"
    field.style.cursor = "text"
    // Manter aparência mais legível
    field.style.backgroundColor = "#f8f9fa"
    field.style.color = "#495057"
  })

  // Esconder apenas os botões de ação de edição
  document.getElementById("formActions").style.display = "none"

  // Mostrar botões específicos para modo readonly
  showReadonlyActions()

  // Adicionar indicador visual no título
  const titulo = document.querySelector("h1")
  if (titulo && !titulo.textContent.includes("(FINALIZADO)")) {
    titulo.textContent = titulo.textContent.replace("CHECK-IN", "CHECK-IN (FINALIZADO)")
  }

  // Mostrar informações do anexo se existir
  if (checkinData && (checkinData.has_attachment == 1 || checkinData.attachment)) {
    showAttachmentInfo()
  }
}

const setEditMode = () => {
  isReadonly = false

  // Habilitar todos os campos
  document.querySelectorAll("input, select, textarea").forEach((field) => {
    field.disabled = false
    field.style.userSelect = "auto"
    field.style.cursor = "auto"
    field.style.backgroundColor = ""
    field.style.color = ""
  })

  // Mostrar botões de ação
  document.getElementById("formActions").style.display = "flex"

  // Configurar upload de arquivo
  setupFileUpload()

  // Configurar event listeners para campos que afetam o progresso
  const progressFields = [
    "summary",
    "opportunity",
    "attachment",
    "tipo_equipamento",
    "marca_equipamento",
    "modelo_equipamento",
    "status_equipamento",
    "tipo_operacao",
    "tipo_sucata",
    "qtd_producao_mes",
    "ton_vendida",
    "fundo_baia",
    "qtd_crescimento",
    "cliente_fornece_para",
    "preco_venda_ton",
    "tipo_cliente",
    "expansao_equipamentos",
    "prazo_expansao",
    "tipo_equipamento_interesse",
  ]

  progressFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      field.addEventListener("input", updateProgress)
      field.addEventListener("change", updateProgress)
    }
  })

  // Checkboxes de relacionamento
  const relationshipFields = ["contato_comprador", "contato_operador", "contato_encarregado", "contato_diretor"]
  relationshipFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      field.addEventListener("change", updateRelationshipProgress)
    }
  })

  // Mostrar informações do anexo se existir
  if (checkinData && (checkinData.has_attachment == 1 || checkinData.attachment)) {
    showAttachmentInfo()
  }
}

const setupFileUpload = () => {
  const attachmentField = document.getElementById("attachment")
  if (attachmentField) {
    attachmentField.addEventListener("change", handleFileSelect)
  }
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (!file) {
    currentAttachment = null
    hideAttachmentInfo()
    return
  }

  // Validar tipo de arquivo
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ]

  if (!allowedTypes.includes(file.type)) {
    window.showError("TIPO DE ARQUIVO NÃO PERMITIDO. USE: IMAGENS, PDF, DOC, XLS OU TXT")
    event.target.value = ""
    return
  }

  // Validar tamanho (máximo 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    window.showError("ARQUIVO MUITO GRANDE. MÁXIMO 5MB")
    event.target.value = ""
    return
  }

  currentAttachment = file
  showFilePreview(file)
  updateProgress()
}

const showFilePreview = (file) => {
  const previewDiv = document.getElementById("filePreview") || createFilePreviewDiv()

  const sizeInMB = (file.size / (1024 * 1024)).toFixed(2)

  previewDiv.innerHTML = `
    <div class="file-preview">
      <div class="file-info">
        <strong>📎 ARQUIVO SELECIONADO:</strong><br>
        <span class="file-name">${file.name}</span><br>
        <span class="file-details">Tamanho: ${sizeInMB} MB | Tipo: ${file.type}</span>
      </div>
      <button type="button" class="btn-danger btn-sm" onclick="removeFile()">REMOVER</button>
    </div>
  `
  previewDiv.style.display = "block"
}

const createFilePreviewDiv = () => {
  const previewDiv = document.createElement("div")
  previewDiv.id = "filePreview"
  previewDiv.className = "file-preview-container"

  const attachmentField = document.getElementById("attachment")
  attachmentField.parentNode.appendChild(previewDiv)

  return previewDiv
}

const removeFile = () => {
  const attachmentField = document.getElementById("attachment")
  attachmentField.value = ""
  currentAttachment = null
  hideAttachmentInfo()
  updateProgress()
}

const showAttachmentInfo = () => {
  if (!checkinData || !checkinData.attachment) return

  const previewDiv = document.getElementById("filePreview") || createFilePreviewDiv()

  const originalName = checkinData.attachment_original_name || checkinData.attachment
  const sizeText = checkinData.attachment_size
    ? `Tamanho: ${(checkinData.attachment_size / (1024 * 1024)).toFixed(2)} MB`
    : ""

  previewDiv.innerHTML = `
    <div class="file-preview attached">
      <div class="file-info">
        <strong>📎 ANEXO SALVO:</strong><br>
        <span class="file-name">${originalName}</span><br>
        ${sizeText ? `<span class="file-details">${sizeText}</span>` : ""}
      </div>
      <button type="button" class="btn-primary btn-sm" onclick="baixarAnexo()">BAIXAR</button>
    </div>
  `
  previewDiv.style.display = "block"
}

const hideAttachmentInfo = () => {
  const previewDiv = document.getElementById("filePreview")
  if (previewDiv) {
    previewDiv.style.display = "none"
  }
}

const uploadFile = async () => {
  if (!currentAttachment) return null

  try {
    const formData = new FormData()
    formData.append("attachment", currentAttachment)
    formData.append("visita_id", visitaId)

    const response = await fetch("../api/upload.php", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${window.TokenManager.get()}`,
      },
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Erro no upload")
    }

    return result
  } catch (error) {
    console.error("Erro no upload:", error)
    throw error
  }
}

const showReadonlyActions = () => {
  // Criar container para ações de readonly se não existir
  let readonlyActions = document.getElementById("readonlyActions")
  if (!readonlyActions) {
    readonlyActions = document.createElement("div")
    readonlyActions.id = "readonlyActions"
    readonlyActions.className = "readonly-actions"

    const hasAttachment = checkinData && (checkinData.attachment || checkinData.has_attachment == 1)

    readonlyActions.innerHTML = `
      <div class="readonly-actions-container">
        <button type="button" class="btn-secondary" onclick="voltarParaVisitas()">
          <span class="icon-back"></span> VOLTAR
        </button>
        <button type="button" class="btn-primary" onclick="copiarDados()">
          <span class="icon-copy"></span> COPIAR DADOS
        </button>
        ${
          hasAttachment
            ? `
          <button type="button" class="btn-info" onclick="baixarAnexo()">
            <span class="icon-attachment"></span> BAIXAR ANEXO
          </button>
        `
            : ""
        }
      </div>
    `

    // Inserir após o conteúdo das abas
    const tabContent = document.querySelector(".tab-content")
    tabContent.parentNode.insertBefore(readonlyActions, tabContent.nextSibling)
  }

  readonlyActions.style.display = "block"
}

const switchTab = (tabName) => {
  // SEMPRE permitir navegação entre abas (mesmo em readonly)

  // Remover active de todos os botões e painéis
  document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"))
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"))

  // Adicionar active ao botão e painel selecionados
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")
  document.getElementById(tabName).classList.add("active")
}

const loadCheckinData = async () => {
  try {
    const response = await window.apiCall(`/checkin.php/${visitaId}`)
    checkinData = response.data

    console.log("Dados carregados do check-in:", checkinData) // Debug

    // Preencher campos - EXCLUINDO campos de arquivo
    Object.keys(checkinData).forEach((key) => {
      const field = document.getElementById(key)
      if (field && field.type !== "file") {
        if (field.type === "checkbox") {
          field.checked = checkinData[key] == 1
        } else if (key === "opportunity") {
          // Tratamento especial para o campo opportunity
          field.value = checkinData[key] == 1 ? "SIM" : "NÃO"
        } else {
          field.value = checkinData[key] || ""
        }
      }
    })

    // Para campos de arquivo, apenas mostrar informação se existir anexo
    if (checkinData.attachment || checkinData.has_attachment == 1) {
      console.log("Anexo encontrado:", checkinData.attachment_original_name || checkinData.attachment)
    }
  } catch (error) {
    console.error("Erro ao carregar dados do check-in:", error)
  }
}

const updateProgress = () => {
  const progressFields = [
    "summary",
    "opportunity",
    "attachment",
    "tipo_equipamento",
    "marca_equipamento",
    "modelo_equipamento",
    "status_equipamento",
    "tipo_operacao",
    "tipo_sucata",
    "qtd_producao_mes",
    "ton_vendida",
    "fundo_baia",
    "qtd_crescimento",
    "cliente_fornece_para",
    "preco_venda_ton",
    "tipo_cliente",
    "expansao_equipamentos",
    "prazo_expansao",
    "tipo_equipamento_interesse",
  ]

  let filledFields = 0
  progressFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      if (field.type === "checkbox") {
        if (field.checked) filledFields++
      } else if (field.type === "file") {
        // Verificar se há arquivo selecionado ou anexo existente
        if (currentAttachment || (checkinData && (checkinData.attachment || checkinData.has_attachment == 1))) {
          filledFields++
        }
      } else if (field.value.trim() !== "") {
        filledFields++
      }
    }
  })

  const percentage = Math.round((filledFields / progressFields.length) * 100)
  document.getElementById("progressPercentage").textContent = `${percentage}%`
  document.getElementById("progressFill").style.width = `${percentage}%`
}

const updateRelationshipProgress = () => {
  const weights = {
    contato_comprador: 20,
    contato_operador: 10,
    contato_encarregado: 30,
    contato_diretor: 40,
  }

  let totalPercentage = 0
  Object.keys(weights).forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field && field.checked) {
      totalPercentage += weights[fieldId]
    }
  })

  document.getElementById("relationshipPercentage").textContent = `${totalPercentage}%`
  document.getElementById("relationshipFill").style.width = `${totalPercentage}%`
}

const collectFormData = () => {
  const formData = {}

  // TODOS os campos de texto e select
  const allFields = [
    // Aba 1 - Resumo
    "summary",
    "opportunity",

    // Aba 2 - Parque Instalado
    "tipo_equipamento",
    "marca_equipamento",
    "modelo_equipamento",
    "status_equipamento",

    // Aba 3 - Produtividade
    "tipo_operacao",
    "tipo_sucata",
    "qtd_producao_mes",
    "ton_vendida",
    "fundo_baia",
    "qtd_crescimento",
    "cliente_fornece_para",
    "preco_venda_ton",

    // Aba 4 - Previsão
    "tipo_cliente",
    "expansao_equipamentos",
    "prazo_expansao",
    "tipo_equipamento_interesse",
  ]

  // Coletar TODOS os campos
  allFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      if (fieldId === "opportunity") {
        // Tratamento especial para o campo opportunity
        formData[fieldId] = field.value === "SIM" ? "1" : "0"
      } else {
        const value = field.value.trim()
        formData[fieldId] = value
      }
    }
  })

  // Checkboxes de relacionamento (Aba 5)
  const checkboxFields = ["contato_comprador", "contato_operador", "contato_encarregado", "contato_diretor"]
  checkboxFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      formData[fieldId] = field.checked ? 1 : 0
    }
  })

  console.log("Dados coletados do formulário:", formData)
  return formData
}

const salvarRascunho = async () => {
  if (isReadonly) {
    window.showError("CHECK-IN FINALIZADO NÃO PODE SER EDITADO")
    return
  }

  try {
    // Validar apenas o campo obrigatório mínimo
    const summary = document.getElementById("summary").value.trim()
    if (!summary) {
      window.showError("RESUMO É OBRIGATÓRIO PARA SALVAR RASCUNHO")
      return
    }

    // PRIMEIRO: Coletar e salvar os dados do formulário
    const formData = collectFormData()
    formData.is_draft = 1

    console.log("Salvando rascunho com dados:", formData) // Debug

    await window.apiCall(`/checkin.php/${visitaId}`, {
      method: "POST",
      body: JSON.stringify(formData),
    })

    // SEGUNDO: Upload do arquivo se houver (após salvar os dados)
    if (currentAttachment) {
      try {
        await uploadFile()
        window.showSuccess("RASCUNHO E ARQUIVO SALVOS COM SUCESSO!")
        currentAttachment = null // Limpar após upload

        // Recarregar dados para mostrar o anexo salvo
        await loadCheckinData()
        showAttachmentInfo()
      } catch (error) {
        window.showError("RASCUNHO SALVO, MAS ERRO AO ENVIAR ARQUIVO: " + error.message)
        return
      }
    } else {
      window.showSuccess("RASCUNHO SALVO COM SUCESSO!")
    }
  } catch (error) {
    console.error("Erro ao salvar rascunho:", error)
    window.showError("ERRO AO SALVAR RASCUNHO: " + error.message)
  }
}

const concluirCheckin = async () => {
  if (isReadonly) {
    window.showError("CHECK-IN FINALIZADO NÃO PODE SER EDITADO")
    return
  }

  // Validar campos obrigatórios
  const summary = document.getElementById("summary").value.trim()
  if (!summary) {
    window.showError("RESUMO É OBRIGATÓRIO PARA CONCLUIR CHECK-IN")
    return
  }

  if (confirm("TEM CERTEZA QUE DESEJA CONCLUIR O CHECK-IN? ESTA AÇÃO NÃO PODE SER DESFEITA. VOCE SERA REDIRECIONADO PARA O DIAGNOSTICO DA EMPRESA")) {
    try {
      // PRIMEIRO: Coletar e salvar os dados do formulário
      const formData = collectFormData()
      formData.is_draft = 0

      console.log("Finalizando check-in com dados:", formData) // Debug

      // Salvar dados do formulário primeiro
      const response = await window.apiCall(`/checkin.php/${visitaId}`, {
        method: "POST",
        body: JSON.stringify(formData),
      })

      if (!response.success) {
        throw new Error(response.error || "Erro ao salvar dados do check-in")
      }

      // SEGUNDO: Upload do arquivo se houver (após salvar os dados)
      if (currentAttachment) {
        try {
          await uploadFile()
          currentAttachment = null // Limpar após upload
        } catch (error) {
          window.showError("CHECK-IN SALVO, MAS ERRO AO ENVIAR ARQUIVO: " + error.message)
          return
        }
      }

      window.showSuccess("CHECK-IN CONCLUÍDO COM SUCESSO!")
      setTimeout(() => {
        window.location.href = "../dashboard.html"
      }, 2000)
    } catch (error) {
      console.error("Erro ao concluir check-in:", error)
      window.showError("ERRO AO CONCLUIR CHECK-IN: " + (error.message || ""))
    }
  }
}

const cancelarCheckin = () => {
  if (confirm("TEM CERTEZA QUE DESEJA CANCELAR? TODAS AS ALTERAÇÕES NÃO SALVAS SERÃO PERDIDAS.")) {
    window.location.href = "../dashboard.html"
  }
}

// Funções para modo readonly
const voltarParaVisitas = () => {
  window.location.href = "../visitas.html"
}

const copiarDados = () => {
  try {
    // Coletar todos os dados visíveis
    const dados = []

    // Informações básicas
    dados.push("=== CHECK-IN DA VISITA ===")
    dados.push("")

    // Aba Resumo
    dados.push("RESUMO:")
    const summary = document.getElementById("summary").value
    if (summary) dados.push(summary)

    const opportunity = document.getElementById("opportunity").value
    dados.push(`OPORTUNIDADE IDENTIFICADA: ${opportunity}`)

    if (checkinData && checkinData.attachment) {
      dados.push(`ANEXO: ${checkinData.attachment_original_name || checkinData.attachment}`)
    }
    dados.push("")

    // Aba Parque Instalado
    dados.push("PARQUE INSTALADO:")
    const parqueFields = [
      { id: "tipo_equipamento", label: "Tipo de Equipamento" },
      { id: "marca_equipamento", label: "Marca" },
      { id: "modelo_equipamento", label: "Modelo" },
      { id: "status_equipamento", label: "Status" },
    ]

    parqueFields.forEach((field) => {
      const value = document.getElementById(field.id).value
      if (value) dados.push(`${field.label}: ${value}`)
    })
    dados.push("")

    // Aba Produtividade
    dados.push("PRODUTIVIDADE:")
    const prodFields = [
      { id: "tipo_operacao", label: "Tipo de Operação" },
      { id: "tipo_sucata", label: "Tipo de Sucata" },
      { id: "qtd_producao_mes", label: "Produção/Mês" },
      { id: "ton_vendida", label: "Toneladas Vendidas" },
      { id: "fundo_baia", label: "Tipo de Baia" },
      { id: "qtd_crescimento", label: "Crescimento" },
      { id: "cliente_fornece_para", label: "Cliente Fornece Para" },
      { id: "preco_venda_ton", label: "Preço Venda/Ton" },
    ]

    prodFields.forEach((field) => {
      const value = document.getElementById(field.id).value
      if (value) dados.push(`${field.label}: ${value}`)
    })
    dados.push("")

    // Aba Previsão
    dados.push("PREVISÃO:")
    const prevFields = [
      { id: "tipo_cliente", label: "Tipo de Cliente" },
      { id: "expansao_equipamentos", label: "Expansão de Equipamentos" },
      { id: "prazo_expansao", label: "Prazo para Expansão" },
      { id: "tipo_equipamento_interesse", label: "Equipamento de Interesse" },
    ]

    prevFields.forEach((field) => {
      const value = document.getElementById(field.id).value
      if (value) dados.push(`${field.label}: ${value}`)
    })
    dados.push("")

    // Aba Relacionamento
    dados.push("RELACIONAMENTO:")
    const relFields = [
      { id: "contato_comprador", label: "Contato com Comprador" },
      { id: "contato_operador", label: "Contato com Operador" },
      { id: "contato_encarregado", label: "Contato com Encarregado" },
      { id: "contato_diretor", label: "Contato com Diretor" },
    ]

    relFields.forEach((field) => {
      const checkbox = document.getElementById(field.id)
      if (checkbox.checked) dados.push(`${field.label}: SIM`)
    })

    // Copiar para clipboard
    const texto = dados.join("\n")
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        window.showSuccess("DADOS COPIADOS PARA A ÁREA DE TRANSFERÊNCIA!")
      })
      .catch(() => {
        // Fallback para navegadores mais antigos
        const textArea = document.createElement("textarea")
        textArea.value = texto
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)
        window.showSuccess("DADOS COPIADOS PARA A ÁREA DE TRANSFERÊNCIA!")
      })
  } catch (error) {
    console.error("Erro ao copiar dados:", error)
    window.showError("ERRO AO COPIAR DADOS")
  }
}

const baixarAnexo = async () => {
  if (!checkinData || (!checkinData.attachment && checkinData.has_attachment != 1)) {
    window.showError("NENHUM ANEXO ENCONTRADO")
    return
  }

  try {
    // Criar link temporário para download
    const downloadUrl = `../api/download.php?visita_id=${visitaId}`

    // Fazer requisição com autenticação
    const response = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${window.TokenManager.get()}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Erro ao baixar arquivo")
    }

    // Criar blob e fazer download
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)

    // Extrair nome do arquivo do header Content-Disposition
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = checkinData.attachment_original_name || checkinData.attachment || "anexo_checkin"

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }

    // Criar link temporário e fazer download
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()

    // Limpar
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    window.showSuccess("DOWNLOAD INICIADO COM SUCESSO!")
  } catch (error) {
    console.error("Erro ao baixar anexo:", error)
    window.showError("ERRO AO BAIXAR ANEXO: " + error.message)
  }
}

// Exportar funções para uso global
window.salvarRascunho = salvarRascunho
window.concluirCheckin = concluirCheckin
window.cancelarCheckin = cancelarCheckin
window.voltarParaVisitas = voltarParaVisitas
window.copiarDados = copiarDados
window.baixarAnexo = baixarAnexo
window.removeFile = removeFile
