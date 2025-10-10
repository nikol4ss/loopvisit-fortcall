import { Chart } from "@/components/ui/chart"
// Usando JavaScript tradicional ao invés de imports ES6
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de relatórios carregada")

  // Verificar se as funções de auth estão disponíveis
  if (typeof window.checkAuth !== "function") {
    console.error("Funções de autenticação não encontradas. Verifique se auth.js foi carregado.")
    alert("ERRO: Sistema de autenticação não carregado")
    return
  }

  if (!window.checkAuth()) return

  const user = window.TokenManager.getUser()
  document.getElementById("userName").textContent = user.name

  // Apenas gestores podem acessar relatórios
  if (user.role !== "GESTOR") {
    window.showError("ACESSO NEGADO - APENAS GESTORES")
    setTimeout(() => {
      window.location.href = "dashboard.html"
    }, 2000)
    return
  }

  // Event listeners
  document.getElementById("logoutBtn").addEventListener("click", window.logout)
  document.getElementById("generateReport").addEventListener("click", generateReport)
  document.getElementById("exportExcel").addEventListener("click", exportExcel)

  // Carregar consultores
  await loadConsultores()

  // Definir datas padrão (último mês)
  const hoje = new Date()
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)

  document.getElementById("dataInicio").value = mesPassado.toISOString().split("T")[0]
  document.getElementById("dataFim").value = hoje.toISOString().split("T")[0]

  // Gerar relatório inicial
  await generateReport()
})

const loadConsultores = async () => {
  try {
    const response = await window.apiCall("/api/usuarios.php?role=CONSULTOR")
    const select = document.getElementById("consultorFilter")

    response.data.forEach((consultor) => {
      const option = document.createElement("option")
      option.value = consultor.id
      option.textContent = consultor.name
      select.appendChild(option)
    })
  } catch (error) {
    console.error("Erro ao carregar consultores:", error)
    window.showError("ERRO AO CARREGAR CONSULTORES")
  }
}

const generateReport = async () => {
  try {
    const params = new URLSearchParams()

    const dataInicio = document.getElementById("dataInicio").value
    const dataFim = document.getElementById("dataFim").value
    const consultor = document.getElementById("consultorFilter").value

    if (dataInicio) params.append("data_inicio", dataInicio)
    if (dataFim) params.append("data_fim", dataFim)
    if (consultor) params.append("consultor", consultor)

    console.log("Gerando relatório com parâmetros:", params.toString())

    // Buscar dados das visitas
    const visitasResponse = await window.apiCall(`/api/visitas.php?${params}`)
    const visitas = visitasResponse.data

    console.log("Visitas encontradas:", visitas.length)

    // Calcular estatísticas
    const stats = calculateStats(visitas)

    // Atualizar cards de resumo
    updateSummaryCards(stats)

    // Gerar gráficos
    generateCharts(stats)
  } catch (error) {
    console.error("Erro ao gerar relatório:", error)
    window.showError("ERRO AO GERAR RELATÓRIO: " + error.message)
  }
}

const calculateStats = (visitas) => {
  const stats = {
    total: visitas.length,
    realizadas: 0,
    porStatus: {},
    porTipo: {},
    porConsultor: {},
    porMes: {},
    empresasUnicas: new Set(),
  }

  visitas.forEach((visita) => {
    // Status
    const status = visita.status_calculado || visita.status
    stats.porStatus[status] = (stats.porStatus[status] || 0) + 1

    if (status === "REALIZADA") {
      stats.realizadas++
    }

    // Tipo
    const tipo = visita.type || "NÃO DEFINIDO"
    stats.porTipo[tipo] = (stats.porTipo[tipo] || 0) + 1

    // Consultor
    const consultor = visita.consultor_nome || "NÃO DEFINIDO"
    stats.porConsultor[consultor] = (stats.porConsultor[consultor] || 0) + 1

    // Mês
    const mes = new Date(visita.date).toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "short",
    })
    stats.porMes[mes] = (stats.porMes[mes] || 0) + 1

    // Empresas únicas
    if (visita.empresa_nome) {
      stats.empresasUnicas.add(visita.empresa_nome)
    }
  })

  console.log("Estatísticas calculadas:", stats)
  return stats
}

const updateSummaryCards = (stats) => {
  document.getElementById("totalVisitas").textContent = stats.total
  document.getElementById("visitasRealizadas").textContent = stats.realizadas
  document.getElementById("taxaConclusao").textContent =
    stats.total > 0 ? Math.round((stats.realizadas / stats.total) * 100) + "%" : "0%"
  document.getElementById("empresasVisitadas").textContent = stats.empresasUnicas.size
}

// Variáveis globais para armazenar os gráficos
let statusChart, tipoChart, consultorChart, mesChart

const generateCharts = (stats) => {
  console.log("Gerando gráficos com os dados:", stats)

  // Verificar se Chart está disponível
  if (typeof Chart === "undefined") {
    console.error("Chart.js não está carregado!")
    window.showError("ERRO: Chart.js não está disponível")
    return
  }

  // Destruir gráficos existentes se existirem
  if (statusChart) statusChart.destroy()
  if (tipoChart) tipoChart.destroy()
  if (consultorChart) consultorChart.destroy()
  if (mesChart) mesChart.destroy()

  try {
    // Gráfico de Status
    const statusCtx = document.getElementById("statusChart").getContext("2d")
    statusChart = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(stats.porStatus),
        datasets: [
          {
            data: Object.values(stats.porStatus),
            backgroundColor: ["#007bff", "#28a745", "#ffc107", "#fd7e14", "#dc3545", "#6f42c1"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    })

    // Gráfico de Tipo
    const tipoCtx = document.getElementById("tipoChart").getContext("2d")
    tipoChart = new Chart(tipoCtx, {
      type: "bar",
      data: {
        labels: Object.keys(stats.porTipo),
        datasets: [
          {
            label: "Visitas",
            data: Object.values(stats.porTipo),
            backgroundColor: "#667eea",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    })

    // Gráfico de Consultor
    const consultorCtx = document.getElementById("consultorChart").getContext("2d")
    consultorChart = new Chart(consultorCtx, {
      type: "bar",
      data: {
        labels: Object.keys(stats.porConsultor),
        datasets: [
          {
            label: "Visitas",
            data: Object.values(stats.porConsultor),
            backgroundColor: "#764ba2",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    })

    // Gráfico por Mês
    const mesCtx = document.getElementById("mesChart").getContext("2d")
    mesChart = new Chart(mesCtx, {
      type: "line",
      data: {
        labels: Object.keys(stats.porMes),
        datasets: [
          {
            label: "Visitas",
            data: Object.values(stats.porMes),
            borderColor: "#28a745",
            backgroundColor: "rgba(40, 167, 69, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    })

    console.log("Gráficos gerados com sucesso")
  } catch (error) {
    console.error("Erro ao gerar gráficos:", error)
    window.showError("ERRO AO GERAR GRÁFICOS: " + error.message)
  }
}

const exportExcel = async () => {
  try {
    console.log("Iniciando exportação Excel...")

    // Verificar se SheetJS está disponível
    const XLSX = window.XLSX // Declare the variable here
    if (typeof XLSX === "undefined") {
      console.error("SheetJS (XLSX) não está carregado!")
      window.showError("BIBLIOTECA DE EXPORTAÇÃO NÃO CARREGADA")
      return
    }

    console.log("XLSX disponível:", XLSX)

    const params = new URLSearchParams()
    const dataInicio = document.getElementById("dataInicio").value
    const dataFim = document.getElementById("dataFim").value
    const consultor = document.getElementById("consultorFilter").value

    if (dataInicio) params.append("data_inicio", dataInicio)
    if (dataFim) params.append("data_fim", dataFim)
    if (consultor) params.append("consultor", consultor)

    // Buscar dados das visitas
    const visitasResponse = await window.apiCall(`/api/visitas.php?${params}`)
    const visitas = visitasResponse.data

    console.log("Dados para Excel:", visitas)

    // Preparar dados para Excel
    const dadosExcel = visitas.map((visita) => ({
      Data: new Date(visita.date).toLocaleDateString("pt-BR"),
      Empresa: visita.empresa_nome || "",
      Consultor: visita.consultor_nome || "",
      Tipo: visita.type || "",
      Status: visita.status_calculado || visita.status || "",
      Cidade: visita.empresa_cidade || "",
      Estado: visita.empresa_estado || "",
      Observações: visita.observations || "",
    }))

    // Criar workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(dadosExcel)

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, "Relatório de Visitas")

    // Gerar nome do arquivo
    const hoje = new Date().toISOString().split("T")[0]
    const nomeArquivo = `relatorio-visitas-${hoje}.xlsx`

    // Fazer download
    XLSX.writeFile(wb, nomeArquivo)

    window.showSuccess("RELATÓRIO EXPORTADO COM SUCESSO!")
  } catch (error) {
    console.error("Erro ao exportar Excel:", error)
    window.showError("ERRO AO EXPORTAR RELATÓRIO: " + error.message)
  }
}
