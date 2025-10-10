document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎯 RTV Diagnóstico carregado")

  // Preencher nome do RTV automaticamente
  document.getElementById("consultor_nome").value = "RTV Demonstração"

  // Event listeners
  document.getElementById("saveBtn").addEventListener("click", handleSave)
  document.getElementById("clearBtn").addEventListener("click", handleClear)

  // Event listeners para atualização do progresso
  const formFields = document.querySelectorAll(
    "#rtvDiagnosticoForm input, #rtvDiagnosticoForm select, #rtvDiagnosticoForm textarea",
  )
  formFields.forEach((field) => {
    field.addEventListener("input", updateProgress)
    field.addEventListener("change", updateProgress)
  })

  // Atualizar progresso inicial
  updateProgress()
})

const updateProgress = () => {
  const form = document.getElementById("rtvDiagnosticoForm")
  const formData = new FormData(form)
  const totalFields = 9 // Total de campos no formulário
  let filledFields = 0

  // Contar campos preenchidos
  for (const [key, value] of formData.entries()) {
    if (value && value.toString().trim() !== "") {
      filledFields++
    }
  }

  const percentage = Math.round((filledFields / totalFields) * 100)

  // Atualizar barra de progresso
  const progressFill = document.querySelector(".progress-fill")
  const progressText = document.querySelector(".progress-text")

  progressFill.style.width = `${percentage}%`
  progressText.textContent = `${percentage}% completo (${filledFields}/${totalFields} campos)`

  // Mudar cor da barra baseado no progresso
  if (percentage < 30) {
    progressFill.style.background = "linear-gradient(90deg, #f44336, #ef5350)"
  } else if (percentage < 70) {
    progressFill.style.background = "linear-gradient(90deg, #ff9800, #ffb74d)"
  } else {
    progressFill.style.background = "linear-gradient(90deg, #4CAF50, #66BB6A)"
  }
}

const handleSave = async () => {
  const form = document.getElementById("rtvDiagnosticoForm")
  const formData = new FormData(form)
  const data = Object.fromEntries(formData.entries())

  // Validações básicas
  if (!data.consultor_nome || !data.cliente_nome || !data.tipo_cliente) {
    window.showError("PREENCHA TODOS OS CAMPOS OBRIGATÓRIOS")
    return
  }

  try {
    const saveBtn = document.getElementById("saveBtn")
    const originalText = saveBtn.textContent
    saveBtn.disabled = true
    saveBtn.textContent = "💾 SALVANDO..."

    console.log("📋 Dados do diagnóstico RTV:", data)

    const response = await window.apiCall("/rtv-diagnosticos.php", {
      method: "POST",
      body: JSON.stringify(data),
    })

    if (response.success) {
      window.showSuccess("DIAGNÓSTICO RTV REGISTRADO COM SUCESSO!")

      // Limpar formulário após sucesso
      setTimeout(() => {
        handleClear()
      }, 2000)
    } else {
      throw new Error(response.message || "Erro ao salvar diagnóstico")
    }

    saveBtn.disabled = false
    saveBtn.textContent = originalText
  } catch (error) {
    console.error("Erro ao salvar diagnóstico RTV:", error)
    window.showError(error.message || "ERRO AO SALVAR DIAGNÓSTICO")

    const saveBtn = document.getElementById("saveBtn")
    saveBtn.disabled = false
    saveBtn.textContent = "💾 Salvar Diagnóstico"
  }
}

const handleClear = () => {
  if (confirm("Tem certeza que deseja limpar todos os campos do formulário?")) {
    const form = document.getElementById("rtvDiagnosticoForm")
    form.reset()

    // Manter o nome do RTV preenchido
    document.getElementById("consultor_nome").value = "RTV Demonstração"

    // Atualizar progresso
    updateProgress()

    window.showSuccess("FORMULÁRIO LIMPO COM SUCESSO")
  }
}

// Função para formatar texto em maiúsculas nos campos de texto
const formatTextFields = () => {
  const textInputs = document.querySelectorAll('input[type="text"], textarea')
  textInputs.forEach((input) => {
    input.addEventListener("blur", (e) => {
      if (e.target.value) {
        e.target.value = e.target.value.toUpperCase()
      }
    })
  })
}

// Aplicar formatação quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", formatTextFields)
