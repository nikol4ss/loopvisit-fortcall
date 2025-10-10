let visitaId = null
let checkinData = {}
let visitaData = {}
let isReadonly = false
let currentAttachment = null

// URL do webhook Make.com - CONFIGURE AQUI
const WEBHOOK_URL = "https://webhook.v4arcos.com.br/webhook/84335aec-64d0-488e-b37c-e8448cd9722f"

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

  // Carregar dados da visita e check-in
  await loadVisitaData()
  await loadCheckinData()

  // Verificar se é readonly ou se check-in já foi finalizado
  if (readonly === "true" || (checkinData && checkinData.is_draft == 0)) {
    setReadonlyMode()
  } else {
    setEditMode()
  }
})

const loadVisitaData = async () => {
  try {
    console.log("🔍 Carregando dados da visita ID:", visitaId)

    // Adicionar cache buster para garantir dados frescos
    const timestamp = new Date().getTime()
    const response = await window.apiCall(`/visitas.php/${visitaId}?_t=${timestamp}`)

    console.log("📦 Resposta completa da API:", response)

    if (!response || !response.data) {
      throw new Error("Dados da visita não encontrados")
    }

    visitaData = response.data
    console.log("📋 Dados da visita extraídos:", visitaData)

    // Usar os nomes corretos dos campos conforme descoberto no debug
    const empresa = visitaData.empresa_nome || "N/A"
    const dataVisita = visitaData.date || "N/A"
    const consultor = visitaData.consultor_nome || "N/A"

    console.log("🏢 Empresa:", empresa)
    console.log("📅 Data:", dataVisita)
    console.log("👤 Consultor:", consultor)

    // Preencher informações da visita
    document.getElementById("empresaNome").textContent = empresa
    document.getElementById("visitaData").textContent = formatDate(dataVisita)
    document.getElementById("consultorNome").textContent = consultor

    // Debug final
    console.log("✅ Dados preenchidos com sucesso!")
    console.log("✅ Empresa exibida:", document.getElementById("empresaNome").textContent)
    console.log("✅ Data exibida:", document.getElementById("visitaData").textContent)
    console.log("✅ Consultor exibido:", document.getElementById("consultorNome").textContent)
  } catch (error) {
    console.error("❌ Erro ao carregar dados da visita:", error)
    window.showError("ERRO AO CARREGAR DADOS DA VISITA")
  }
}

const loadCheckinData = async () => {
  try {
    console.log("Carregando dados do check-in para visita ID:", visitaId)

    // Adicionar cache buster para garantir dados frescos
    const timestamp = new Date().getTime()
    const response = await window.apiCall(`/checkin.php/${visitaId}?_t=${timestamp}`)

    console.log("Resposta completa do check-in:", response)

    if (!response || !response.data) {
      console.log("Nenhum dado de check-in encontrado, criando novo")
      checkinData = {
        visita_id: visitaId,
        is_draft: 1,
        opportunity: "0",
        negociacao: "0",
        termometro: 5,
        numero_os: "",
      }
      return
    }

    checkinData = response.data
    console.log("Dados do check-in carregados:", checkinData)

    // Preencher campos se existirem dados
    if (checkinData) {
      // Resumo
      if (checkinData.summary) {
        document.getElementById("summary").value = checkinData.summary
      }

      // Oportunidade - usando select
      const opportunitySelect = document.getElementById("opportunity")
      if (opportunitySelect) {
        const opportunityValue = checkinData.opportunity == 1 || checkinData.opportunity === "1" ? "1" : "0"
        opportunitySelect.value = opportunityValue
        console.log("Select oportunidade definido para:", opportunityValue)
      }

      // NOVOS CAMPOS - Negociação - usando select
      const negociacaoSelect = document.getElementById("negociacao")
      if (negociacaoSelect) {
        const negociacaoValue = checkinData.negociacao == 1 || checkinData.negociacao === "1" ? "1" : "0"
        negociacaoSelect.value = negociacaoValue
        console.log("Select negociação definido para:", negociacaoValue)
      }

      // Termômetro
      if (checkinData.termometro) {
        const termometroSlider = document.getElementById("termometro")
        const termometroValue = document.getElementById("termometroValue")
        if (termometroSlider && termometroValue) {
          termometroSlider.value = checkinData.termometro
          termometroValue.textContent = checkinData.termometro
        }
      }

      // Número da OS
      if (checkinData.numero_os) {
        document.getElementById("numero_os").value = checkinData.numero_os
      }

      // Anexo
      if (checkinData.attachment || checkinData.has_attachment == 1) {
        showAttachmentInfo()
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados do check-in:", error)
    // Não mostrar erro aqui pois pode ser normal não ter check-in ainda
  }
}

const setReadonlyMode = () => {
  isReadonly = true
  console.log("🔒 ATIVANDO MODO READONLY")
  console.log("🔍 checkinData:", checkinData)
  console.log("🔍 is_draft:", checkinData?.is_draft)

  // Adicionar classe readonly
  const container = document.querySelector(".checkin-container")
  if (container) {
    container.classList.add("readonly-mode")
  }

  // Desabilitar todos os campos
  document.querySelectorAll("input, textarea, select").forEach((field) => {
    field.disabled = true
    field.readOnly = true
    field.style.userSelect = "text"
    field.style.cursor = "text"
    field.style.backgroundColor = "#f8f9fa"
  })

  // FORÇAR esconder botões de ação de edição
  const formActions = document.getElementById("formActions")
  if (formActions) {
    formActions.style.display = "none !important"
    formActions.style.visibility = "hidden"
    formActions.classList.add("hidden")
    console.log("✅ Botões de edição ESCONDIDOS")
  } else {
    console.error("❌ Elemento formActions NÃO ENCONTRADO")
  }

  // FORÇAR mostrar botões readonly
  const readonlyActions = document.getElementById("readonlyActions")
  if (readonlyActions) {
    readonlyActions.style.display = "block !important"
    readonlyActions.style.visibility = "visible"
    readonlyActions.classList.remove("hidden")
    console.log("✅ Botões readonly EXIBIDOS")
  } else {
    console.error("❌ Elemento readonlyActions NÃO ENCONTRADO")
  }

  // Mostrar botão de download se houver anexo
  if (checkinData && (checkinData.attachment || checkinData.has_attachment == 1)) {
    const btnBaixarAnexo = document.getElementById("btnBaixarAnexo")
    if (btnBaixarAnexo) {
      btnBaixarAnexo.style.display = "flex"
      console.log("✅ Botão de download EXIBIDO")
    }
  }

  // Adicionar badge de finalizado
  addFinalizadoBadge()

  console.log("🔒 MODO READONLY ATIVADO")
}

const addFinalizadoBadge = () => {
  const pageHeader = document.querySelector("h1") || document.querySelector("h2")
  if (pageHeader && !pageHeader.querySelector(".readonly-badge")) {
    const badge = document.createElement("span")
    badge.className = "readonly-badge"
    badge.textContent = "✅ FINALIZADO"
    badge.style.cssText = `
      background: #28a745 !important;
      color: white !important;
      padding: 6px 12px !important;
      border-radius: 4px !important;
      font-size: 12px !important;
      margin-left: 15px !important;
      font-weight: bold !important;
      display: inline-block !important;
    `
    pageHeader.appendChild(badge)
    console.log("✅ Badge FINALIZADO adicionado")
  }
}

const setEditMode = () => {
  isReadonly = false
  console.log("✏️ ATIVANDO MODO EDIÇÃO")

  // Remover classe readonly
  const container = document.querySelector(".checkin-container")
  if (container) {
    container.classList.remove("readonly-mode")
  }

  // Habilitar campos
  document.querySelectorAll("input, textarea, select").forEach((field) => {
    field.disabled = false
    field.readOnly = false
    field.style.cursor = ""
    field.style.backgroundColor = ""
  })

  // FORÇAR mostrar botões de ação
  const formActions = document.getElementById("formActions")
  if (formActions) {
    formActions.style.display = "flex !important"
    formActions.style.visibility = "visible"
    formActions.classList.remove("hidden")
    console.log("✅ Botões de edição EXIBIDOS")
  }

  // FORÇAR esconder botões readonly
  const readonlyActions = document.getElementById("readonlyActions")
  if (readonlyActions) {
    readonlyActions.style.display = "none !important"
    readonlyActions.style.visibility = "hidden"
    readonlyActions.classList.add("hidden")
    console.log("✅ Botões readonly ESCONDIDOS")
  }

  // Configurar funcionalidades
  setupFileUpload()
  setupTermometro()

  console.log("✏️ MODO EDIÇÃO ATIVADO")
}

const setupTermometro = () => {
  const termometroSlider = document.getElementById("termometro")
  const termometroValue = document.getElementById("termometroValue")

  if (termometroSlider && termometroValue) {
    termometroSlider.addEventListener("input", function () {
      termometroValue.textContent = this.value
      console.log("Termômetro alterado para:", this.value)
    })
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

const collectFormData = () => {
  const formData = {}

  // Resumo
  const summary = document.getElementById("summary").value.trim()
  formData.summary = summary

  // Oportunidade - usando select
  const opportunitySelect = document.getElementById("opportunity")
  formData.opportunity = opportunitySelect ? opportunitySelect.value : "0"

  // NOVOS CAMPOS
  // Negociação - usando select
  const negociacaoSelect = document.getElementById("negociacao")
  formData.negociacao = negociacaoSelect ? negociacaoSelect.value : "0"

  // Termômetro
  const termometro = document.getElementById("termometro").value
  formData.termometro = Number.parseInt(termometro) || 5

  // Número da OS
  const numeroOs = document.getElementById("numero_os").value.trim()
  formData.numero_os = numeroOs

  console.log("Dados coletados do formulário:", formData)
  return formData
}

const salvarRascunho = async () => {
  if (isReadonly) {
    window.showError("CHECK-IN FINALIZADO NÃO PODE SER EDITADO")
    return
  }

  try {
    // Validar campo obrigatório
    const summary = document.getElementById("summary").value.trim()
    if (!summary) {
      window.showError("RESUMO É OBRIGATÓRIO PARA SALVAR RASCUNHO")
      return
    }

    // Coletar e salvar dados
    const formData = collectFormData()
    formData.is_draft = 1

    console.log("Salvando rascunho com dados:", formData)

    await window.apiCall(`/checkin.php/${visitaId}`, {
      method: "POST",
      body: JSON.stringify(formData),
    })

    // Upload do arquivo se houver
    if (currentAttachment) {
      try {
        await uploadFile()
        window.showSuccess("RASCUNHO E ARQUIVO SALVOS COM SUCESSO!")
        currentAttachment = null

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

  const opportunitySelect = document.getElementById("opportunity")
  if (!opportunitySelect.value) {
    window.showError("SELECIONE SE GEROU OPORTUNIDADE COMERCIAL")
    return
  }

  const negociacaoSelect = document.getElementById("negociacao")
  if (!negociacaoSelect.value) {
    window.showError("SELECIONE SE HOUVE NEGOCIAÇÃO")
    return
  }

  if (confirm("TEM CERTEZA QUE DESEJA CONCLUIR O CHECK-IN? ESTA AÇÃO NÃO PODE SER DESFEITA.")) {
    try {
      // Coletar dados do formulário
      const formData = collectFormData()
      formData.is_draft = 0

      console.log("Finalizando check-in com dados:", formData)

      // Salvar dados do formulário
      const response = await window.apiCall(`/checkin.php/${visitaId}`, {
        method: "POST",
        body: JSON.stringify(formData),
      })

      if (!response.success) {
        throw new Error(response.error || "Erro ao salvar dados do check-in")
      }

      // Upload do arquivo se houver
      if (currentAttachment) {
        try {
          await uploadFile()
          currentAttachment = null
        } catch (error) {
          window.showError("CHECK-IN SALVO, MAS ERRO AO ENVIAR ARQUIVO: " + error.message)
          return
        }
      }

      // SEMPRE disparar webhook quando check-in for concluído
      await dispararWebhook(formData)

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

// ✅ FUNÇÃO PARA SANITIZAR STRINGS PARA JSON
const sanitizeForJson = (str) => {
  if (!str || typeof str !== "string") return str || ""

  return str
    .replace(/\n/g, " ") // Substituir quebras de linha por espaços
    .replace(/\r/g, " ") // Substituir carriage return por espaços
    .replace(/\t/g, " ") // Substituir tabs por espaços
    .replace(/"/g, "'") // Substituir aspas duplas por simples
    .replace(/\\/g, "") // Remover barras invertidas
    .replace(/\s+/g, " ") // Substituir múltiplos espaços por um só
    .trim() // Remover espaços no início e fim
}

const dispararWebhook = async (formData) => {
  try {
    console.log("🚀 Disparando webhook para Make.com...")

    // Determinar se gerou oportunidade
    const gerouOportunidade = formData.opportunity === "1" || formData.opportunity === 1
    const houveNegociacao = formData.negociacao === "1" || formData.negociacao === 1

    const webhookData = {
      // Informações da visita - ✅ SANITIZADAS
      visita_id: visitaId,
      empresa: sanitizeForJson(visitaData.empresa_nome) || "N/A",
      consultor: sanitizeForJson(visitaData.consultor_nome) || "N/A",
      data_visita: visitaData.date || "N/A",
      cidade: sanitizeForJson(visitaData.cidade_nome) || "N/A",
      estado_uf: visitaData.estado_uf || visitaData.uf || "N/A",
      objetivo: sanitizeForJson(visitaData.objetivo) || "N/A",
      tipo_visita: visitaData.type || "N/A",

      // Informações do check-in - ✅ SANITIZADAS
      resumo_visita: sanitizeForJson(formData.summary) || "N/A",
      gerou_oportunidade: gerouOportunidade ? "SIM" : "NÃO",
      oportunidade_comercial: gerouOportunidade,

      // NOVOS CAMPOS DE NEGOCIAÇÃO
      houve_negociacao: houveNegociacao ? "SIM" : "NÃO",
      negociacao_comercial: houveNegociacao,
      termometro_negociacao: formData.termometro || 5,
      numero_os: sanitizeForJson(formData.numero_os) || "",

      // Metadados
      timestamp: new Date().toISOString(),
      data_conclusao: new Date().toISOString(),
      sistema: "Sistema de Visitas Comerciais",
    }

    console.log("📤 Dados completos do webhook:", webhookData)
    console.log(`📊 Oportunidade: ${gerouOportunidade ? "SIM" : "NÃO"}`)
    console.log(`🤝 Negociação: ${houveNegociacao ? "SIM" : "NÃO"}`)
    console.log(`🌡️ Termômetro: ${formData.termometro}/10`)
    console.log(`🌍 Estado UF: ${webhookData.estado_uf}`)
    console.log(`🏷️ Tipo Visita: ${webhookData.tipo_visita}`)
    console.log(`🧹 Resumo sanitizado: "${webhookData.resumo_visita}"`)

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookData),
    })

    if (response.ok) {
      console.log("✅ Webhook disparado com sucesso!")
    } else {
      console.warn("⚠️ Erro ao disparar webhook:", response.status, response.statusText)
    }
  } catch (error) {
    console.error("❌ Erro ao disparar webhook:", error)
    // Não interromper o fluxo por erro no webhook
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
    const dados = []
    dados.push("=== CHECK-IN DA VISITA ===")
    dados.push("")
    dados.push(`EMPRESA: ${visitaData.empresa_nome || "N/A"}`)
    dados.push(`DATA: ${formatDate(visitaData.date) || "N/A"}`)
    dados.push(`CONSULTOR: ${visitaData.consultor_nome || "N/A"}`)
    dados.push(`CIDADE: ${visitaData.cidade_nome || "N/A"}`)
    dados.push(`ESTADO: ${visitaData.estado_uf || visitaData.uf || "N/A"}`)
    dados.push(`TIPO: ${visitaData.type || "N/A"}`)
    dados.push(`OBJETIVO: ${visitaData.objetivo || "N/A"}`)
    dados.push("")
    dados.push("RESUMO:")
    dados.push(document.getElementById("summary").value || "N/A")
    dados.push("")

    const opportunitySelect = document.getElementById("opportunity")
    dados.push(`OPORTUNIDADE COMERCIAL: ${opportunitySelect && opportunitySelect.value === "1" ? "SIM" : "NÃO"}`)

    // NOVOS CAMPOS
    const negociacaoSelect = document.getElementById("negociacao")
    dados.push(`HOUVE NEGOCIAÇÃO: ${negociacaoSelect && negociacaoSelect.value === "1" ? "SIM" : "NÃO"}`)

    const termometro = document.getElementById("termometro").value
    dados.push(`TERMÔMETRO DE NEGOCIAÇÃO: ${termometro}/10`)

    const numeroOs = document.getElementById("numero_os").value
    if (numeroOs) {
      dados.push(`NÚMERO DA OS: ${numeroOs}`)
    }

    if (checkinData && checkinData.attachment) {
      dados.push(`ANEXO: ${checkinData.attachment_original_name || checkinData.attachment}`)
    }

    const texto = dados.join("\n")
    navigator.clipboard
      .writeText(texto)
      .then(() => window.showSuccess("DADOS COPIADOS PARA A ÁREA DE TRANSFERÊNCIA!"))
      .catch(() => {
        // Fallback
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
    const downloadUrl = `../api/download.php?visita_id=${visitaId}`
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

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)

    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = checkinData.attachment_original_name || checkinData.attachment || "anexo_checkin"

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }

    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()

    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    window.showSuccess("DOWNLOAD INICIADO COM SUCESSO!")
  } catch (error) {
    console.error("Erro ao baixar anexo:", error)
    window.showError("ERRO AO BAIXAR ANEXO: " + error.message)
  }
}

// Utility functions
const formatDate = (dateString) => {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch (error) {
    return dateString
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

// Função de debug para verificar o estado
window.debugCheckinMode = () => {
  console.log("=== DEBUG CHECKIN MODE ===")
  console.log("visitaId:", visitaId)
  console.log("isReadonly:", isReadonly)
  console.log("checkinData:", checkinData)
  console.log("visitaData:", visitaData)
  console.log("estado_uf:", visitaData?.estado_uf || visitaData?.uf)
  console.log("tipo_visita:", visitaData?.type)
  console.log("is_draft:", checkinData?.is_draft, "tipo:", typeof checkinData?.is_draft)

  const formActions = document.getElementById("formActions")
  const readonlyActions = document.getElementById("readonlyActions")

  console.log("formActions elemento:", formActions)
  console.log("readonlyActions elemento:", readonlyActions)

  if (formActions) {
    console.log("formActions display:", getComputedStyle(formActions).display)
    console.log("formActions visibility:", getComputedStyle(formActions).visibility)
  }

  if (readonlyActions) {
    console.log("readonlyActions display:", getComputedStyle(readonlyActions).display)
    console.log("readonlyActions visibility:", getComputedStyle(readonlyActions).visibility)
  }

  // Forçar readonly se necessário
  if (checkinData && checkinData.is_draft == 0) {
    console.log("🔒 FORÇANDO MODO READONLY")
    setReadonlyMode()
  }
}
