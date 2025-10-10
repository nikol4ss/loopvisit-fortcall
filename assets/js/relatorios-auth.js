// Sistema de autenticação específico para relatórios
class RelatoriosAuth {
  constructor() {
    this.init()
  }

  init() {
    console.log("Inicializando autenticação de relatórios...")
    this.checkAuth()
    this.setupLogout()
  }

  getToken() {
    return localStorage.getItem("auth_token")
  }

  getUser() {
    const token = localStorage.getItem("auth_token")
    if (!token) return null

    try {
      const parts = token.split(".")
      if (parts.length !== 3) return null

      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))

      if (payload.exp < Date.now() / 1000) {
        localStorage.removeItem("auth_token")
        return null
      }

      return payload
    } catch (e) {
      localStorage.removeItem("auth_token")
      return null
    }
  }

  isAuthenticated() {
    return this.getUser() !== null
  }

  checkAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = "index.html"
      return false
    }

    const user = this.getUser()

    // Apenas gestores podem acessar relatórios
    if (user.role !== "GESTOR") {
      this.showError("ACESSO NEGADO - APENAS GESTORES")
      setTimeout(() => {
        window.location.href = "dashboard.html"
      }, 2000)
      return false
    }

    // Mostrar nome do usuário
    const userNameElement = document.getElementById("userName")
    if (userNameElement) {
      userNameElement.textContent = user.name
    }

    return true
  }

  setupLogout() {
    const logoutBtn = document.getElementById("logoutBtn")
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("auth_token")
        window.location.href = "index.html"
      })
    }
  }

  async apiCall(endpoint, options = {}) {
    try {
      const token = this.getToken()
      const config = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        ...options,
      }

      // Construir URL correta
      const url = `api/${endpoint}`
      console.log("URL da API:", url)

      const response = await fetch(url, config)

      // Ler resposta como texto primeiro
      const text = await response.text()

      // Verificar se a resposta é vazia
      if (!text) {
        throw new Error("RESPOSTA VAZIA DO SERVIDOR")
      }

      // Tentar parsear como JSON
      try {
        const data = JSON.parse(text)
        if (!response.ok) {
          throw new Error(data.error || `ERRO HTTP ${response.status}`)
        }
        return data
      } catch (e) {
        console.error("Resposta não é JSON válido:", text)
        throw new Error("RESPOSTA INVÁLIDA DO SERVIDOR")
      }
    } catch (error) {
      console.error("Erro na API:", error)
      throw error
    }
  }

  showError(message) {
    const errorDiv = document.createElement("div")
    errorDiv.className = "error-message"
    errorDiv.textContent = message
    errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `
    document.body.appendChild(errorDiv)
    setTimeout(() => {
      errorDiv.remove()
    }, 5000)
  }

  showSuccess(message) {
    const successDiv = document.createElement("div")
    successDiv.className = "success-message"
    successDiv.textContent = message
    successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `
    document.body.appendChild(successDiv)
    setTimeout(() => {
      successDiv.remove()
    }, 3000)
  }
}

// Instanciar quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", () => {
  window.relatoriosAuth = new RelatoriosAuth()
})
