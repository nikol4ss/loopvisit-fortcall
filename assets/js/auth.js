// Configuração da API
const API_BASE =
  window.location.pathname.includes("/empresas/") || window.location.pathname.includes("/visitas/") ? "../api" : "./api"

// Utilitários para mensagens
const showError = (message) => {
  const errorDiv = document.getElementById("errorMessage")
  if (errorDiv) {
    errorDiv.textContent = message
    errorDiv.style.display = "block"
    setTimeout(() => {
      errorDiv.style.display = "none"
    }, 5000)
  } else {
    alert(message)
  }
}

const showSuccess = (message) => {
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
  `
  document.body.appendChild(successDiv)
  setTimeout(() => {
    successDiv.remove()
  }, 3000)
}

// Gerenciamento de token
const TokenManager = {
  set: (token) => {
    localStorage.setItem("auth_token", token)
  },

  get: () => {
    return localStorage.getItem("auth_token")
  },

  remove: () => {
    localStorage.removeItem("auth_token")
  },

  getUser: () => {
    const token = TokenManager.get()
    if (!token) return null

    try {
      const parts = token.split(".")
      if (parts.length !== 3) return null

      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))

      if (payload.exp < Date.now() / 1000) {
        TokenManager.remove()
        return null
      }

      return payload
    } catch (e) {
      TokenManager.remove()
      return null
    }
  },

  isAuthenticated: () => {
    return TokenManager.getUser() !== null
  },
}

// Função para fazer chamadas à API
const apiCall = async (endpoint, options = {}) => {
  const token = TokenManager.get()

  const config = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config)

    // Ler resposta como texto primeiro
    const text = await response.text()

    // Tentar parsear como JSON
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error("Resposta não é JSON válido:", text)
      throw new Error("RESPOSTA INVÁLIDA DO SERVIDOR")
    }

    if (!response.ok) {
      throw new Error(data.error || `ERRO HTTP ${response.status}`)
    }

    return data
  } catch (error) {
    console.error("Erro na API:", error)
    throw error
  }
}

// Função de login
const login = async (email, password) => {
  try {
    const response = await apiCall("/auth.php", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })

    if (response.success) {
      TokenManager.set(response.token)
      return response
    } else {
      throw new Error(response.error || "ERRO NO LOGIN")
    }
  } catch (error) {
    throw error
  }
}

// Função de logout
const logout = () => {
  TokenManager.remove()
  window.location.href = "index.html"
}

// Verificar autenticação
const checkAuth = () => {
  // Verificar se estamos na página de login
  const isLoginPage =
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname.endsWith("/") ||
    window.location.pathname === ""

  if (isLoginPage) {
    // Se estamos na página de login e já estamos autenticados, redirecionar para o dashboard
    if (TokenManager.isAuthenticated()) {
      window.location.href = "dashboard.html"
      return false
    }
    // Se estamos na página de login e não estamos autenticados, não fazer nada
    return true
  } else {
    // Se não estamos na página de login e não estamos autenticados, redirecionar para o login
    if (!TokenManager.isAuthenticated()) {
      window.location.href = "index.html"
      return false
    }
    // Se não estamos na página de login e estamos autenticados, não fazer nada
    return true
  }
}

// Inicialização da página de login
document.addEventListener("DOMContentLoaded", () => {
  // Se estamos na página de login
  if (
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname.endsWith("/") ||
    window.location.pathname === ""
  ) {
    // Se já estiver logado, redirecionar
    if (TokenManager.isAuthenticated()) {
      window.location.href = "dashboard.html"
      return
    }

    // Configurar formulário de login
    const loginForm = document.getElementById("loginForm")
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault()

        const email = document.getElementById("email").value.trim()
        const password = document.getElementById("password").value

        if (!email || !password) {
          showError("PREENCHA TODOS OS CAMPOS")
          return
        }

        try {
          // Desabilitar botão durante o login
          const submitBtn = loginForm.querySelector('button[type="submit"]')
          const originalText = submitBtn.textContent
          submitBtn.disabled = true
          submitBtn.textContent = "ENTRANDO..."

          const response = await login(email, password)

          showSuccess("LOGIN REALIZADO COM SUCESSO!")

          setTimeout(() => {
            window.location.href = "dashboard.html"
          }, 1000)
        } catch (error) {
          showError(error.message)

          // Reabilitar botão
          const submitBtn = loginForm.querySelector('button[type="submit"]')
          submitBtn.disabled = false
          submitBtn.textContent = "ENTRAR"
        }
      })
    }
  }
})

// Exportar funções para uso global
window.checkAuth = checkAuth
window.TokenManager = TokenManager
window.logout = logout
window.apiCall = apiCall
window.showError = showError
window.showSuccess = showSuccess
