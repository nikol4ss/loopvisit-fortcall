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
  await loadEstados()
  await loadConsultores()

  // Event listener para mudança de estado
  document.getElementById("state_id").addEventListener("change", loadCidadesPorEstado)

  // Event listener para o formulário
  document.getElementById("empresaForm").addEventListener("submit", handleSubmit)
})

const loadEstados = async () => {
  try {
    const response = await window.apiCall("/estados-cidades.php")
    const select = document.getElementById("state_id")

    response.data.forEach((estado) => {
      const option = document.createElement("option")
      option.value = estado.id
      option.textContent = `${estado.nome} (${estado.sigla})`
      select.appendChild(option)
    })
  } catch (error) {
    window.showError("ERRO AO CARREGAR ESTADOS")
  }
}

const loadCidadesPorEstado = async () => {
  const estadoId = document.getElementById("state_id").value
  const citySelect = document.getElementById("city_id")

  // Limpar cidades
  citySelect.innerHTML = '<option value="">SELECIONE A CIDADE</option>'

  if (!estadoId) return

  try {
    const response = await window.apiCall(`/estados-cidades.php?estado_id=${estadoId}`)

    response.data.forEach((cidade) => {
      const option = document.createElement("option")
      option.value = cidade.id
      option.textContent = cidade.nome
      citySelect.appendChild(option)
    })
  } catch (error) {
    window.showError("ERRO AO CARREGAR CIDADES")
  }
}

const loadConsultores = async () => {
  try {
    const response = await window.apiCall("/usuarios.php?role=CONSULTOR")
    const select = document.getElementById("consultant")

    response.data.forEach((consultor) => {
      const option = document.createElement("option")
      option.value = consultor.id
      option.textContent = consultor.name
      select.appendChild(option)
    })
  } catch (error) {
    window.showError("ERRO AO CARREGAR CONSULTORES")
  }
}

const handleSubmit = async (e) => {
  e.preventDefault()

  const formData = new FormData(e.target)
  const data = Object.fromEntries(formData.entries())

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]')
    const originalText = submitBtn.textContent
    submitBtn.disabled = true
    submitBtn.textContent = "SALVANDO..."

    await window.apiCall("/empresas.php", {
      method: "POST",
      body: JSON.stringify(data),
    })

    window.showSuccess("EMPRESA CRIADA COM SUCESSO!")
    setTimeout(() => {
      window.location.href = "../empresas.html"
    }, 2000)
  } catch (error) {
    window.showError(error.message)

    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.textContent = "SALVAR EMPRESA"
  }
}
