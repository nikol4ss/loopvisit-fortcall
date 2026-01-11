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
  const motivoOutrosCheckbox = document.getElementById("motivoOutros")
  if (motivoOutrosCheckbox) {
    motivoOutrosCheckbox.addEventListener("change", function () {
      const descricaoDiv = document.getElementById("motivoOutrosDescricao")
      descricaoDiv.style.display = this.checked ? "block" : "none"

      if (!this.checked) {
        document.getElementById("motivoOutrosTexto").value = ""
      }
    })
  }

  checkinData = {}
  visitaData = {}

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

    const timestamp = new Date().getTime()
    const response = await window.apiCall(`/visitas.php/${visitaId}?_t=${timestamp}`)

    console.log("📦 Resposta completa da API:", response)

    if (!response || !response.data) {
      throw new Error("Dados da visita não encontrados")
    }

    visitaData = response.data
    console.log("📋 Dados da visita extraídos:", visitaData)

    const empresa = visitaData.empresa_nome || visitaData.empresa_livre
    const dataVisita = visitaData.date || "N/A"
    const consultor = visitaData.consultor_nome || "N/A"
    const tipoVisita = visitaData.type || "N/A"

    document.getElementById("empresaNome").textContent = empresa
    document.getElementById("visitaData").textContent = formatDate(dataVisita)
    document.getElementById("consultorNome").textContent = consultor
    document.getElementById("tipoVisita").textContent = tipoVisita

    if (tipoVisita.toUpperCase() === "TÉCNICA" || tipoVisita.toUpperCase() === "VISITA TÉCNICA") {
      document.getElementById("camposTecnicos").style.display = "block"
    }

    console.log("✅ Dados preenchidos com sucesso!")
  } catch (error) {
    console.error("❌ Erro ao carregar dados da visita:", error)
    window.showError("ERRO AO CARREGAR DADOS DA VISITA")
  }
}

const loadCheckinData = async () => {
  try {
    console.log("Carregando dados do check-in para visita ID:", visitaId)

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
      }
      resetFormFields()
      return
    }

    checkinData = response.data
    console.log("Dados do check-in carregados:", checkinData)

    populateFormFields()
  } catch (error) {
    console.error("Erro ao carregar dados do check-in:", error)
    resetFormFields()
  }
}

const resetFormFields = () => {
  document.getElementById("summary").value = ""

  const opportunitySelect = document.getElementById("opportunity")
  if (opportunitySelect) opportunitySelect.value = ""

  const negociacaoSelect = document.getElementById("negociacao")
  if (negociacaoSelect) negociacaoSelect.value = ""

  const termometroSlider = document.getElementById("termometro")
  const termometroValue = document.getElementById("termometroValue")
  if (termometroSlider && termometroValue) {
    termometroSlider.value = 5
    termometroValue.textContent = "5"
  }

  // Desmarcar todos os checkboxes de motivo
  document.querySelectorAll('input[name="motivo"]').forEach((checkbox) => {
    checkbox.checked = false
  })

  document.getElementById("motivoOutrosTexto").value = ""
  document.getElementById("motivoOutrosDescricao").style.display = "none"

  // Limpar campos técnicos
  const propriedade = document.getElementById("propriedade")
  const objetivosTecnicos = document.getElementById("objetivosTecnicos")
  const observacoesTecnicas = document.getElementById("observacoesTecnicas")

  if (propriedade) propriedade.value = ""
  if (objetivosTecnicos) objetivosTecnicos.value = ""
  if (observacoesTecnicas) observacoesTecnicas.value = ""

  hideAttachmentInfo()
}

const populateFormFields = () => {
  // Preencher campos se existirem dados
  if (checkinData) {
    if (checkinData.summary) {
      document.getElementById("summary").value = checkinData.summary
    }

    const opportunitySelect = document.getElementById("opportunity")
    if (opportunitySelect) {
      const opportunityValue = checkinData.opportunity == 1 || checkinData.opportunity === "1" ? "1" : "0"
      opportunitySelect.value = opportunityValue
    }

    const negociacaoSelect = document.getElementById("negociacao")
    if (negociacaoSelect) {
      const negociacaoValue = checkinData.negociacao == 1 || checkinData.negociacao === "1" ? "1" : "0"
      negociacaoSelect.value = negociacaoValue
    }

    if (checkinData.termometro) {
      const termometroSlider = document.getElementById("termometro")
      const termometroValue = document.getElementById("termometroValue")
      if (termometroSlider && termometroValue) {
        termometroSlider.value = checkinData.termometro
        termometroValue.textContent = checkinData.termometro
      }
    }

    if (checkinData.motivos_visita) {
      try {
        const motivos = JSON.parse(checkinData.motivos_visita)
        motivos.forEach((motivo) => {
          const checkbox = document.querySelector(`input[name="motivo"][value="${motivo}"]`)
          if (checkbox) checkbox.checked = true
        })
      } catch (e) {
        console.error("Erro ao parsear motivos:", e)
      }
    }

    if (checkinData.motivo_outros_texto) {
      document.getElementById("motivoOutros").checked = true
      document.getElementById("motivoOutrosDescricao").style.display = "block"
      document.getElementById("motivoOutrosTexto").value = checkinData.motivo_outros_texto
    }

    if (checkinData.propriedade) {
      document.getElementById("propriedade").value = checkinData.propriedade
    }
    if (checkinData.objetivos_tecnicos) {
      document.getElementById("objetivosTecnicos").value = checkinData.objetivos_tecnicos
    }
    if (checkinData.observacoes_tecnicas) {
      document.getElementById("observacoesTecnicas").value = checkinData.observacoes_tecnicas
    }

    if (checkinData.attachment || checkinData.has_attachment == 1) {
      showAttachmentInfo()
    }
  }
}

const setReadonlyMode = () => {
  isReadonly = true
  console.log("🔒 ATIVANDO MODO READONLY")

  const container = document.querySelector(".checkin-container")
  if (container) {
    container.classList.add("readonly-mode")
  }

  document.querySelectorAll("input, textarea, select").forEach((field) => {
    field.disabled = true
    field.readOnly = true
    field.style.userSelect = "text"
    field.style.cursor = "text"
    field.style.backgroundColor = "#f8f9fa"
  })

  const formActions = document.getElementById("formActions")
  if (formActions) {
    formActions.style.display = "none !important"
    formActions.style.visibility = "hidden"
    formActions.classList.add("hidden")
  }

  const readonlyActions = document.getElementById("readonlyActions")
  if (readonlyActions) {
    readonlyActions.style.display = "block !important"
    readonlyActions.style.visibility = "visible"
    readonlyActions.classList.remove("hidden")
  }

  if (checkinData && (checkinData.attachment || checkinData.has_attachment == 1)) {
    const btnBaixarAnexo = document.getElementById("btnBaixarAnexo")
    if (btnBaixarAnexo) {
      btnBaixarAnexo.style.display = "flex"
    }
  }

  // Placeholder for addFinalizadoBadge function call
  // Assuming it should be defined somewhere in the code
  // Uncomment and define the function if needed
  // addFinalizadoBadge();
}

const setEditMode = () => {
  isReadonly = false
  console.log("✏️ ATIVANDO MODO EDIÇÃO")

  const container = document.querySelector(".checkin-container")
  if (container) {
    container.classList.remove("readonly-mode")
  }

  document.querySelectorAll("input, textarea, select").forEach((field) => {
    field.disabled = false
    field.readOnly = false
    field.style.cursor = ""
    field.style.backgroundColor = ""
  })

  const formActions = document.getElementById("formActions")
  if (formActions) {
    formActions.style.display = "flex !important"
    formActions.style.visibility = "visible"
    formActions.classList.remove("hidden")
  }

  const readonlyActions = document.getElementById("readonlyActions")
  if (readonlyActions) {
    readonlyActions.style.display = "none !important"
    readonlyActions.style.visibility = "hidden"
    readonlyActions.classList.add("hidden")
  }

  setupFileUpload()
  setupTermometro()
}

const setupTermometro = () => {
  const termometroSlider = document.getElementById("termometro")
  const termometroValue = document.getElementById("termometroValue")

  if (termometroSlider && termometroValue) {
    const newSlider = termometroSlider.cloneNode(true)
    termometroSlider.parentNode.replaceChild(newSlider, termometroSlider)

    newSlider.addEventListener("input", function () {
      termometroValue.textContent = this.value
    })
  }
}

const setupFileUpload = () => {
  const attachmentField = document.getElementById("attachment")
  if (attachmentField) {
    const newField = attachmentField.cloneNode(true)
    attachmentField.parentNode.replaceChild(newField, attachmentField)

    newField.addEventListener("change", handleFileSelect)
  }
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (!file) {
    currentAttachment = null
    hideAttachmentInfo()
    return
  }

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

  const maxSize = 5 * 1024 * 1024
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

  const summary = document.getElementById("summary").value.trim()
  formData.summary = summary

  const opportunitySelect = document.getElementById("opportunity")
  formData.opportunity = opportunitySelect ? opportunitySelect.value : "0"

  const negociacaoSelect = document.getElementById("negociacao")
  formData.negociacao = negociacaoSelect ? negociacaoSelect.value : "0"

  const termometro = document.getElementById("termometro").value
  formData.termometro = Number.parseInt(termometro) || 5

  const motivosSelecionados = []
  document.querySelectorAll('input[name="motivo"]:checked').forEach((checkbox) => {
    if (checkbox.value !== "outros") {
      motivosSelecionados.push(checkbox.value)
    }
  })
  formData.motivos_visita = JSON.stringify(motivosSelecionados)

  const motivoOutrosTexto = document.getElementById("motivoOutrosTexto").value.trim()
  formData.motivo_outros_texto = motivoOutrosTexto

  if (document.getElementById("camposTecnicos").style.display !== "none") {
    formData.propriedade = document.getElementById("propriedade").value.trim()
    formData.objetivos_tecnicos = document.getElementById("objetivosTecnicos").value.trim()
    formData.observacoes_tecnicas = document.getElementById("observacoesTecnicas").value.trim()
  }

  console.log("Dados coletados do formulário:", formData)
  return formData
}

const salvarRascunho = async () => {
  if (isReadonly) {
    window.showError("CHECK-IN FINALIZADO NÃO PODE SER EDITADO")
    return
  }

  try {
    const formData = collectFormData()
    formData.is_draft = 1

    console.log("Salvando rascunho com dados:", formData)

    await window.apiCall(`/checkin.php/${visitaId}`, {
      method: "POST",
      body: JSON.stringify(formData),
    })

    if (currentAttachment) {
      try {
        await uploadFile()
        window.showSuccess("RASCUNHO E ARQUIVO SALVOS COM SUCESSO!")
        currentAttachment = null

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
  const motivosSelecionados = document.querySelectorAll('input[name="motivo"]:checked')
  if (motivosSelecionados.length === 0) {
    window.showError("SELECIONE PELO MENOS UM MOTIVO DA VISITA")
    return
  }

  const motivoOutros = document.getElementById("motivoOutros")
  const motivoOutrosTexto = document.getElementById("motivoOutrosTexto").value.trim()
  if (motivoOutros.checked && !motivoOutrosTexto) {
    window.showError("DESCRIÇÃO DE 'OUTROS' É OBRIGATÓRIA QUANDO SELECIONADO")
    return
  }

  if (document.getElementById("camposTecnicos").style.display !== "none") {
    const propriedade = document.getElementById("propriedade").value.trim()
    const objetivosTecnicos = document.getElementById("objetivosTecnicos").value.trim()

    if (!propriedade) {
      window.showError("PROPRIEDADE/PROPRIETÁRIO É OBRIGATÓRIO PARA VISITA TÉCNICA")
      return
    }
    if (!objetivosTecnicos) {
      window.showError("PRINCIPAIS OBJETIVOS É OBRIGATÓRIO PARA VISITA TÉCNICA")
      return
    }
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
      const formData = collectFormData()
      formData.is_draft = 0

      console.log("Finalizando check-in com dados:", formData)

      const response = await window.apiCall(`/checkin.php/${visitaId}`, {
        method: "POST",
        body: JSON.stringify(formData),
      })

      if (!response.success) {
        throw new Error(response.error || "Erro ao salvar dados do check-in")
      }

      if (currentAttachment) {
        try {
          await uploadFile()
          currentAttachment = null
        } catch (error) {
          window.showError("CHECK-IN SALVO, MAS ERRO AO ENVIAR ARQUIVO: " + error.message)
          return
        }
      }

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

const sanitizeForJson = (str) => {
  if (!str || typeof str !== "string") return str || ""

  return str
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/"/g, "'")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const dispararWebhook = async (formData) => {
  try {
    console.log("🚀 Disparando webhook para Make.com...")

    const gerouOportunidade = formData.opportunity === "1" || formData.opportunity === 1
    const houveNegociacao = formData.negociacao === "1" || formData.negociacao === 1

    let motivosVisita = []
    try {
      motivosVisita = JSON.parse(formData.motivos_visita || "[]")
    } catch (e) {
      motivosVisita = []
    }

    const webhookData = {
      visita_id: visitaId,
      empresa: sanitizeForJson(visitaData.empresa_nome) || "N/A",
      consultor: sanitizeForJson(visitaData.consultor_nome) || "N/A",
      data_visita: visitaData.date || "N/A",
      cidade: sanitizeForJson(visitaData.cidade_nome) || "N/A",
      estado_uf: visitaData.estado_uf || visitaData.uf || "N/A",
      objetivo: sanitizeForJson(visitaData.objetivo) || "N/A",
      tipo_visita: visitaData.type || "N/A",

      resumo_visita: sanitizeForJson(formData.summary) || "N/A",
      gerou_oportunidade: gerouOportunidade ? "SIM" : "NÃO",
      oportunidade_comercial: gerouOportunidade,

      houve_negociacao: houveNegociacao ? "SIM" : "NÃO",
      negociacao_comercial: houveNegociacao,
      termometro_negociacao: formData.termometro || 5,

      motivos_visita: motivosVisita,
      motivo_outros_descricao: sanitizeForJson(formData.motivo_outros_texto) || "",

      // Campos técnicos (se aplicável)
      propriedade: sanitizeForJson(formData.propriedade) || "",
      objetivos_tecnicos: sanitizeForJson(formData.objetivos_tecnicos) || "",
      observacoes_tecnicas: sanitizeForJson(formData.observacoes_tecnicas) || "",

      timestamp: new Date().toISOString(),
      data_conclusao: new Date().toISOString(),
      sistema: "Sistema de Visitas Comerciais",
    }

    console.log("📤 Dados completos do webhook:", webhookData)

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookData),
    })

    if (response.ok) {
      console.log("✅ Webhook enviado com sucesso!")
    } else {
      console.error("⚠️ Erro no webhook (não crítico):", response.status)
    }
  } catch (error) {
    console.error("⚠️ Erro ao disparar webhook (não crítico):", error)
  }
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

const cancelarCheckin = () => {
  if (confirm("TEM CERTEZA QUE DESEJA CANCELAR? AS ALTERAÇÕES NÃO SALVAS SERÃO PERDIDAS.")) {
    window.location.href = "../dashboard.html"
  }
}

const voltarParaVisitas = () => {
  window.location.href = "../dashboard.html"
}

const copiarDados = () => {
  let textoCompleto = `=== CHECK-IN DA VISITA ===\n\n`
  textoCompleto += `Empresa: ${visitaData.empresa_nome || "N/A"}\n`
  textoCompleto += `Data da Visita: ${formatDate(visitaData.date)}\n`
  textoCompleto += `Consultor: ${visitaData.consultor_nome || "N/A"}\n`
  textoCompleto += `Tipo: ${visitaData.type || "N/A"}\n\n`
  textoCompleto += `--- RESUMO ---\n${checkinData.summary || "N/A"}\n\n`
  textoCompleto += `Gerou Oportunidade: ${checkinData.opportunity == 1 ? "SIM" : "NÃO"}\n`
  textoCompleto += `Houve Negociação: ${checkinData.negociacao == 1 ? "SIM" : "NÃO"}\n`
  textoCompleto += `Termômetro: ${checkinData.termometro || 5}/10\n`

  navigator.clipboard
    .writeText(textoCompleto)
    .then(() => {
      window.showSuccess("DADOS COPIADOS PARA A ÁREA DE TRANSFERÊNCIA!")
    })
    .catch(() => {
      window.showError("ERRO AO COPIAR DADOS")
    })
}

const baixarAnexo = async () => {
  if (!checkinData || !checkinData.attachment) {
    window.showError("NENHUM ANEXO DISPONÍVEL")
    return
  }

  try {
    const response = await fetch(`../api/download.php?file=${encodeURIComponent(checkinData.attachment)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${window.TokenManager.get()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Erro ao baixar arquivo")
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = checkinData.attachment_original_name || checkinData.attachment
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    window.showSuccess("ARQUIVO BAIXADO COM SUCESSO!")
  } catch (error) {
    console.error("Erro ao baixar anexo:", error)
    window.showError("ERRO AO BAIXAR ARQUIVO: " + error.message)
  }
}

// Placeholder function for addFinalizadoBadge
const addFinalizadoBadge = () => {
  // Define the function here if needed
  console.log("Finalizado badge added")
}
