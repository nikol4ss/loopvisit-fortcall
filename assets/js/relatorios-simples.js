document.addEventListener("DOMContentLoaded", async () => {
  console.log("Relatórios simples carregado")

  // Aguardar o auth específico estar disponível
  if (!window.relatoriosAuth) {
    console.error("Sistema de autenticação de relatórios não disponível")
    return
  }

  // A verificação de auth já foi feita no relatorios-auth.js
  // Apenas configurar os event listeners

  document.getElementById("exportarVisitas").addEventListener("click", exportarVisitas)
  document.getElementById("exportarCheckins").addEventListener("click", exportarCheckins)

  // Controle dos checkboxes de período total
  document.getElementById("visitasPeriodoTotal").addEventListener("change", function () {
    const dataInicio = document.getElementById("visitasDataInicio")
    const dataFim = document.getElementById("visitasDataFim")

    if (this.checked) {
      dataInicio.disabled = true
      dataFim.disabled = true
      dataInicio.value = ""
      dataFim.value = ""
    } else {
      dataInicio.disabled = false
      dataFim.disabled = false
      // Definir período padrão (último mês)
      const hoje = new Date()
      const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate())
      dataInicio.value = mesPassado.toISOString().split("T")[0]
      dataFim.value = hoje.toISOString().split("T")[0]
    }
  })

  document.getElementById("checkinsPeriodoTotal").addEventListener("change", function () {
    const dataInicio = document.getElementById("checkinsDataInicio")
    const dataFim = document.getElementById("checkinsDataFim")

    if (this.checked) {
      dataInicio.disabled = true
      dataFim.disabled = true
      dataInicio.value = ""
      dataFim.value = ""
    } else {
      dataInicio.disabled = false
      dataFim.disabled = false
      // Definir período padrão (último mês)
      const hoje = new Date()
      const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate())
      dataInicio.value = mesPassado.toISOString().split("T")[0]
      dataFim.value = hoje.toISOString().split("T")[0]
    }
  })

  // Definir datas padrão
  const hoje = new Date()
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate())

  document.getElementById("visitasDataInicio").value = mesPassado.toISOString().split("T")[0]
  document.getElementById("visitasDataFim").value = hoje.toISOString().split("T")[0]
  document.getElementById("checkinsDataInicio").value = mesPassado.toISOString().split("T")[0]
  document.getElementById("checkinsDataFim").value = hoje.toISOString().split("T")[0]

  console.log("Relatórios configurados com sucesso")
})

const exportarVisitas = async () => {
  try {
    console.log("Iniciando exportação de visitas...")

    // Verificar se XLSX está disponível
    const XLSX = window.XLSX
    if (typeof XLSX === "undefined") {
      window.relatoriosAuth.showError("BIBLIOTECA DE EXPORTAÇÃO NÃO DISPONÍVEL")
      return
    }

    // Construir parâmetros
    const params = new URLSearchParams()
    params.append("tipo", "visitas")

    const periodoTotal = document.getElementById("visitasPeriodoTotal").checked

    if (!periodoTotal) {
      const dataInicio = document.getElementById("visitasDataInicio").value
      const dataFim = document.getElementById("visitasDataFim").value

      if (!dataInicio || !dataFim) {
        window.relatoriosAuth.showError("SELECIONE AS DATAS OU MARQUE PERÍODO TOTAL")
        return
      }

      params.append("data_inicio", dataInicio)
      params.append("data_fim", dataFim)
    }

    console.log("Parâmetros:", params.toString())

    // Buscar dados usando o auth específico
    const url = `relatorios-dados.php?${params}`
    console.log("URL da API:", url)

    const response = await window.relatoriosAuth.apiCall(url)

    if (!response.success) {
      throw new Error(response.error || "Erro ao buscar visitas")
    }

    const visitas = response.data || []
    console.log(`${visitas.length} visitas encontradas`)

    if (visitas.length === 0) {
      window.relatoriosAuth.showError("NENHUMA VISITA ENCONTRADA PARA O PERÍODO")
      return
    }

    // Preparar dados para Excel
    const dadosExcel = visitas.map((visita) => ({
      ID: visita.id,
      Data: new Date(visita.date).toLocaleDateString("pt-BR"),
      Empresa: visita.empresa_nome || "",
      Consultor: visita.consultor_nome || "",
      Tipo: visita.type || "",
      Status: visita.status_calculado || visita.status || "",
      Cidade: visita.cidade_nome || "",
      Objetivo: visita.objetivo || "",
      Meta: visita.meta_estabelecida || "",
      "Criado em": new Date(visita.created_at).toLocaleString("pt-BR"),
    }))

    // Atualizar prévia
    document.getElementById("visitasPreview").innerHTML = `
      <div class="preview-success">
        <div class="preview-icon">📊</div>
        <div class="preview-content">
          <p><strong>${visitas.length} visitas encontradas</strong></p>
          <p>Período: ${periodoTotal ? "TOTAL" : `${document.getElementById("visitasDataInicio").value} até ${document.getElementById("visitasDataFim").value}`}</p>
        </div>
      </div>
    `

    // Criar e baixar Excel
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(dadosExcel)

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 5 }, // ID
      { wch: 12 }, // Data
      { wch: 30 }, // Empresa
      { wch: 20 }, // Consultor
      { wch: 15 }, // Tipo
      { wch: 12 }, // Status
      { wch: 20 }, // Cidade
      { wch: 30 }, // Objetivo
      { wch: 20 }, // Meta
      { wch: 18 }, // Criado em
    ]
    ws["!cols"] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, "Visitas")

    const nomeArquivo = `relatorio-visitas-${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)

    window.relatoriosAuth.showSuccess(`RELATÓRIO DE VISITAS EXPORTADO! (${visitas.length} registros)`)
  } catch (error) {
    console.error("Erro ao exportar visitas:", error)
    window.relatoriosAuth.showError("ERRO AO EXPORTAR VISITAS: " + error.message)
  }
}

const exportarCheckins = async () => {
  try {
    console.log("Iniciando exportação de check-ins...")

    // Verificar se XLSX está disponível
    const XLSX = window.XLSX
    if (typeof XLSX === "undefined") {
      window.relatoriosAuth.showError("BIBLIOTECA DE EXPORTAÇÃO NÃO DISPONÍVEL")
      return
    }

    // Construir parâmetros
    const params = new URLSearchParams()
    params.append("tipo", "checkins")

    const periodoTotal = document.getElementById("checkinsPeriodoTotal").checked

    if (!periodoTotal) {
      const dataInicio = document.getElementById("checkinsDataInicio").value
      const dataFim = document.getElementById("checkinsDataFim").value

      if (!dataInicio || !dataFim) {
        window.relatoriosAuth.showError("SELECIONE AS DATAS OU MARQUE PERÍODO TOTAL")
        return
      }

      params.append("data_inicio", dataInicio)
      params.append("data_fim", dataFim)
    }

    console.log("Parâmetros:", params.toString())

    // Buscar dados usando o auth específico
    const url = `relatorios-dados.php?${params}`
    console.log("URL da API:", url)

    const response = await window.relatoriosAuth.apiCall(url)

    if (!response.success) {
      throw new Error(response.error || "Erro ao buscar check-ins")
    }

    const checkins = response.data || []
    console.log(`${checkins.length} check-ins encontrados`)

    if (checkins.length === 0) {
      window.relatoriosAuth.showError("NENHUM CHECK-IN ENCONTRADO PARA O PERÍODO")
      return
    }

    // Preparar dados para Excel
    const dadosExcel = checkins.map((checkin) => ({
      "ID Visita": checkin.id,
      Data: new Date(checkin.date).toLocaleDateString("pt-BR"),
      Empresa: checkin.empresa_nome || "",
      Consultor: checkin.consultor_nome || "",
      Cidade: checkin.cidade_nome || "",
      Resumo: checkin.summary || "",
      Oportunidade: checkin.opportunity === "1" ? "SIM" : "NÃO",
      "Tipo Equipamento": checkin.tipo_equipamento || "",
      "Marca Equipamento": checkin.marca_equipamento || "",
      "Modelo Equipamento": checkin.modelo_equipamento || "",
      "Status Equipamento": checkin.status_equipamento || "",
      "Tipo Operação": checkin.tipo_operacao || "",
      "Qtd Produção/Mês": checkin.qtd_producao_mes || "",
      "Ton Vendida": checkin.ton_vendida || "",
      "Preço Venda/Ton": checkin.preco_venda_ton || "",
      "Expansão Equipamentos": checkin.expansao_equipamentos || "",
      "Prazo Expansão": checkin.prazo_expansao || "",
      "Contato Comprador": checkin.contato_comprador || "",
      "Contato Operador": checkin.contato_operador || "",
      "Contato Encarregado": checkin.contato_encarregado || "",
      "Contato Diretor": checkin.contato_diretor || "",
      "Check-in": checkin.checkin_time ? new Date(checkin.checkin_time).toLocaleString("pt-BR") : "",
      "Check-out": checkin.checkout_time ? new Date(checkin.checkout_time).toLocaleString("pt-BR") : "",
    }))

    // Atualizar prévia
    document.getElementById("checkinsPreview").innerHTML = `
      <div class="preview-success">
        <div class="preview-icon">✅</div>
        <div class="preview-content">
          <p><strong>${checkins.length} check-ins encontrados</strong></p>
          <p>Período: ${periodoTotal ? "TOTAL" : `${document.getElementById("checkinsDataInicio").value} até ${document.getElementById("checkinsDataFim").value}`}</p>
        </div>
      </div>
    `

    // Criar e baixar Excel
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(dadosExcel)

    // Ajustar largura das colunas
    const colWidths = Array(23).fill({ wch: 18 })
    ws["!cols"] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, "Check-ins")

    const nomeArquivo = `relatorio-checkins-${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)

    window.relatoriosAuth.showSuccess(`RELATÓRIO DE CHECK-INS EXPORTADO! (${checkins.length} registros)`)
  } catch (error) {
    console.error("Erro ao exportar check-ins:", error)
    window.relatoriosAuth.showError("ERRO AO EXPORTAR CHECK-INS: " + error.message)
  }
}
