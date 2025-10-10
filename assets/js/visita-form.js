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

  // Carregar dados para os selects
  await loadEmpresas()

  // Event listener para mudança de empresa
  document.getElementById("company_id").addEventListener("change", loadEmpresaInfo)

  // Event listener para o formulário
  document.getElementById("visitaForm").addEventListener("submit", handleSubmit)

  // Definir data mínima como hoje
  const now = new Date()
  const minDate = now.toISOString().slice(0, 16)
  document.getElementById("date").min = minDate
})

const loadEmpresas = async () => {
  try {
    const response = await window.apiCall("/empresas.php")
    const select = document.getElementById("company_id")

    if (response.success && response.data) {
      response.data.forEach((empresa) => {
        const option = document.createElement("option")
        option.value = empresa.id
        option.textContent = empresa.name
        option.dataset.endereco = empresa.address || ""
        option.dataset.telefone = empresa.phone || ""
        option.dataset.whatsapp = empresa.whatsapp || ""
        option.dataset.responsavel = empresa.responsible || ""
        option.dataset.cityId = empresa.city_id
        option.dataset.cityName = empresa.cidade_nome || ""
        option.dataset.stateCode = empresa.estado_sigla || ""
        select.appendChild(option)
      })
    }
  } catch (error) {
    console.error("Erro ao carregar empresas:", error)
    window.showError("ERRO AO CARREGAR EMPRESAS")
  }
}

const loadEmpresaInfo = () => {
  const select = document.getElementById("company_id")
  const selectedOption = select.options[select.selectedIndex]
  const empresaInfo = document.getElementById("empresaInfo")

  if (selectedOption.value) {
    // Preencher informações da empresa
    document.getElementById("empresaEndereco").textContent = selectedOption.dataset.endereco || "-"
    document.getElementById("empresaTelefone").textContent = selectedOption.dataset.telefone || "-"
    document.getElementById("empresaWhatsapp").textContent = selectedOption.dataset.whatsapp || "-"
    document.getElementById("empresaResponsavel").textContent = selectedOption.dataset.responsavel || "-"

    // Mostrar cidade da empresa
    const cityName = selectedOption.dataset.cityName
    const stateCode = selectedOption.dataset.stateCode
    const cidadeTexto = cityName && stateCode ? `${cityName} - ${stateCode}` : "-"
    document.getElementById("empresaCidade").textContent = cidadeTexto

    empresaInfo.style.display = "block"
  } else {
    empresaInfo.style.display = "none"
  }
}

const handleSubmit = async (e) => {
  e.preventDefault()

  const formData = new FormData(e.target)
  const data = Object.fromEntries(formData.entries())

  // Adicionar city_id da empresa selecionada
  const select = document.getElementById("company_id")
  const selectedOption = select.options[select.selectedIndex]

  if (selectedOption.value && selectedOption.dataset.cityId) {
    data.city_id = selectedOption.dataset.cityId
  } else {
    window.showError("EMPRESA SELECIONADA NÃO POSSUI CIDADE CADASTRADA")
    return
  }

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
      window.showSuccess("VISITA AGENDADA COM SUCESSO!")
      setTimeout(() => {
        window.location.href = "../visitas.html"
      }, 2000)
    } else {
      throw new Error(response.error || "Erro ao agendar visita")
    }
  } catch (error) {
    console.error("Erro ao agendar visita:", error)
    window.showError(error.message || "ERRO AO AGENDAR VISITA")

    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.textContent = "AGENDAR VISITA"
  }
}
