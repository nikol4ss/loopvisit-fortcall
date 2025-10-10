let currentPage = 1
let totalPages = 1
let currentSearch = ""
const limit = 50

document.addEventListener("DOMContentLoaded", () => {
  console.log("Inicializando página de empresas...")

  // Verificar autenticação
  if (!window.checkAuth()) {
    console.error("Usuário não autenticado")
    window.location.href = "index.html"
    return
  }

  // Obter dados do usuário
  const userData = window.TokenManager.getUser()
  console.log("Dados do usuário:", userData)

  // Configurar nome do usuário
  const userNameElement = document.getElementById("userName")
  if (userNameElement && userData) {
    userNameElement.textContent = userData.name || "Usuário"
  }

  // Mostrar link de relatórios apenas para gestores
  if (userData && userData.role === "GESTOR") {
    const relatoriosLink = document.getElementById("relatoriosLink")
    if (relatoriosLink) relatoriosLink.style.display = "block"
  }

  // Configurar event listeners
  setupEventListeners()

  // Carregar empresas
  loadEmpresas()
})

function setupEventListeners() {
  // Botão aplicar filtros
  const applyFiltersBtn = document.getElementById("applyFilters")
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", () => {
      currentSearch = document.getElementById("searchName").value
      currentPage = 1
      loadEmpresas(1, currentSearch)
    })
  }

  // Botão limpar filtros
  const clearFiltersBtn = document.getElementById("clearFilters")
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      document.getElementById("searchName").value = ""
      document.getElementById("statusFilter").value = ""
      currentSearch = ""
      currentPage = 1
      loadEmpresas(1, "")
    })
  }

  // Enter no campo de busca
  const searchInput = document.getElementById("searchName")
  if (searchInput) {
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        currentSearch = this.value
        currentPage = 1
        loadEmpresas(1, currentSearch)
      }
    })
  }

  // Paginação
  const prevPageBtn = document.getElementById("prevPage")
  const nextPageBtn = document.getElementById("nextPage")

  if (prevPageBtn) prevPageBtn.addEventListener("click", () => goToPage(currentPage - 1))
  if (nextPageBtn) nextPageBtn.addEventListener("click", () => goToPage(currentPage + 1))

  // Logout
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", window.logout)
  }
}

async function loadEmpresas(page = 1, search = "") {
  try {
    console.log(`Carregando empresas - Página: ${page}, Busca: "${search}" (incluindo cidade)`)

    // Mostrar loading
    const tableBody = document.getElementById("empresasTableBody")
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Carregando empresas...</td></tr>'
    }

    // Construir URL - usar barra inicial para garantir separação correta
    let url = `/empresas.php?page=${page}&limit=${limit}`
    if (search) {
      url += `&search=${encodeURIComponent(search)}`
    }

    const statusFilter = document.getElementById("statusFilter")
    if (statusFilter && statusFilter.value) {
      url += `&status=${statusFilter.value}`
    }

    console.log("URL da requisição:", url)

    const response = await window.apiCall(url)
    console.log("Resposta da API:", response)

    if (response.success) {
      renderEmpresas(response.data)
      updatePagination(response.pagination)
    } else {
      throw new Error(response.error || "Erro desconhecido")
    }
  } catch (error) {
    console.error("Erro ao carregar empresas:", error)
    const tableBody = document.getElementById("empresasTableBody")
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Erro ao carregar empresas: ${error.message}</td></tr>`
    }
    if (window.showError) {
      window.showError("Erro ao carregar empresas: " + error.message)
    }
  }
}

function renderEmpresas(empresas) {
  const tableBody = document.getElementById("empresasTableBody")
  if (!tableBody) {
    console.error("Elemento empresasTableBody não encontrado")
    return
  }

  if (empresas.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma empresa encontrada</td></tr>'
    return
  }

  tableBody.innerHTML = ""

  empresas.forEach((empresa) => {
    const row = document.createElement("tr")

    // Adicionar classe de status na linha
    const statusClass = `row-${empresa.status.toLowerCase()}`
    row.className = statusClass

    // Formatar informações da empresa
    let empresaInfo = empresa.name || "-"
    if (empresa.cnpj) {
      empresaInfo += `<br><small class="text-muted">CNPJ: ${empresa.cnpj}</small>`
    }

    // Formatar rating como estrelas
    const formatRating = (rating) => {
      if (!rating) return "-"
      const ratingNumber = Number.parseInt(rating)
      const stars = "★".repeat(ratingNumber) + "☆".repeat(5 - ratingNumber)
      return `<span class="rating">${stars}</span>`
    }

    row.innerHTML = `
      <td>${empresaInfo}</td>
      <td>${empresa.cnpj || "SEM CNPJ"}</td>
      <td>${empresa.segment || "-"}</td>
      <td>${empresa.address || "-"}</td>
      <td>${empresa.cidade_nome || "-"}</td>
      <td>${empresa.consultor_nome || "-"}</td>
      <td>${formatRating(empresa.rating)}</td>
      <td><span class="status-badge status-${empresa.status.toLowerCase()}">${empresa.status}</span></td>
      <td class="action-buttons">
        <a href="empresas/editar.html?id=${empresa.id}" class="btn-action btn-view">EDITAR</a>
        <a href="timeline/index.html?id=${empresa.id}" class="btn-action btn-diagnostic">TIMELINE</a>
        <a href="rtv-diagnosticos/index.html?empresa_id=${empresa.id}" class="btn-action btn-diagnostic">DIAGNÓSTICO</a>
      </td>
    `

    tableBody.appendChild(row)
  })
}

function updatePagination(pagination) {
  console.log("Dados de paginação recebidos:", pagination)

  currentPage = pagination.current_page
  totalPages = pagination.total_pages

  console.log(`Página atual: ${currentPage}, Total de páginas: ${totalPages}`)

  // Atualizar botões de paginação
  const prevPageBtn = document.getElementById("prevPage")
  const nextPageBtn = document.getElementById("nextPage")
  const pageInfo = document.getElementById("pageInfo")
  const paginationDiv = document.getElementById("pagination")

  if (totalPages > 1) {
    if (paginationDiv) paginationDiv.style.display = "flex"

    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages
    if (pageInfo) pageInfo.textContent = `PÁGINA ${currentPage} DE ${totalPages}`
  } else {
    if (paginationDiv) paginationDiv.style.display = "none"
  }

  // Mostrar informações
  const start = (pagination.current_page - 1) * pagination.per_page + 1
  const end = Math.min(start + pagination.per_page - 1, pagination.total)
  console.log(`Mostrando ${start}-${end} de ${pagination.total} empresas`)
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages) {
    console.log(`Navegando para página: ${page}`)
    currentPage = page
    loadEmpresas(currentPage, currentSearch)
  }
}

// Função global para compatibilidade
window.goToPage = goToPage

async function inativarEmpresa(id) {
  if (confirm("Tem certeza que deseja inativar esta empresa?")) {
    try {
      const response = await window.apiCall(`/empresas.php`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: id,
          status: "INATIVA",
        }),
      })

      if (response.success) {
        if (window.showSuccess) {
          window.showSuccess("Empresa inativada com sucesso!")
        } else {
          alert("Empresa inativada com sucesso!")
        }
        loadEmpresas(currentPage, currentSearch)
      } else {
        throw new Error(response.error || "Erro ao inativar empresa")
      }
    } catch (error) {
      console.error("Erro ao inativar empresa:", error)
      if (window.showError) {
        window.showError("Erro ao inativar empresa: " + error.message)
      } else {
        alert("Erro ao inativar empresa: " + error.message)
      }
    }
  }
}

// Tornar função global para uso nos botões HTML
window.inativarEmpresa = inativarEmpresa
