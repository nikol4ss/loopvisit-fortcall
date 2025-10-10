let visitaId = null

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

  if (!visitaId) {
    window.showError("ID DA VISITA NÃO ENCONTRADO")
    return
  }

  // Event listeners
  document.getElementById("logoutBtn").addEventListener("click", window.logout)
  document.getElementById("remarcarForm").addEventListener("submit", handleSubmit)

  // Carregar dados da visita
  await loadVisitaData()

  // Definir data mínima como hoje
  const now = new Date()
  const minDate = now.toISOString().slice(0, 16)
  document.getElementById("newDate").min = minDate
})

const loadVisitaData = async () => {
  try {
    // Buscar dados específicos da visita
    const response = await window.apiCall(`/visitas.php`)

    if (response.success && response.data) {
      // Encontrar a visita específica pelo ID
      const visita = response.data.find((v) => v.id == visitaId)

      if (!visita) {
        throw new Error("Visita não encontrada")
      }

      // Preencher informações atuais
      document.getElementById("empresaNome").textContent = visita.empresa_nome || "N/A"

      // Formatar data
      const dataVisita = new Date(visita.date)
      document.getElementById("dataAtual").textContent = dataVisita.toLocaleString("pt-BR")

      document.getElementById("tipoVisita").textContent = visita.type || "COMERCIAL"
      document.getElementById("sequenciaVisita").textContent = visita.visit_sequence || "1"
    } else {
      throw new Error("Erro ao carregar dados da visita")
    }
  } catch (error) {
    console.error("Erro ao carregar dados da visita:", error)
    window.showError("ERRO AO CARREGAR DADOS DA VISITA: " + error.message)
  }
}

const handleSubmit = async (e) => {
  e.preventDefault()

  const newDate = document.getElementById("newDate").value
  const motivo = document.getElementById("motivo").value

  if (!newDate) {
    window.showError("NOVA DATA É OBRIGATÓRIA")
    return
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]')
    const originalText = submitBtn.textContent
    submitBtn.disabled = true
    submitBtn.textContent = "REMARCANDO..."

    const response = await window.apiCall(`/visitas.php/${visitaId}/remarcar`, {
      method: "PATCH",
      body: JSON.stringify({
        date: newDate,
        motivo: motivo,
      }),
    })

    if (response.success) {
      window.showSuccess("VISITA REMARCADA COM SUCESSO!")
      setTimeout(() => {
        window.location.href = "../visitas.html"
      }, 2000)
    } else {
      throw new Error(response.error || "Erro ao remarcar visita")
    }
  } catch (error) {
    console.error("Erro ao remarcar visita:", error)
    window.showError(error.message || "ERRO AO REMARCAR VISITA")

    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.textContent = "CONFIRMAR REMARCAÇÃO"
  }
}
