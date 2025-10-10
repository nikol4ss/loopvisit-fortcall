// Auth RTV Diagnóstico - Sistema sem autenticação para demonstração
document.addEventListener("DOMContentLoaded", () => {
  console.log("🎯 Sistema RTV carregado - Modo demonstração")

  // Configurar informações do usuário
  setupUserInfo()
})

function setupUserInfo() {
  const userNameElement = document.getElementById("userName")
  if (userNameElement) {
    userNameElement.textContent = "Demonstração - RTV"
  }
}

// Função para fazer chamadas à API sem autenticação
async function apiCall(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  }

  try {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "")
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}/api${endpoint}`

    console.log("🌐 API Call:", finalOptions.method || "GET", url)

    const response = await fetch(url, finalOptions)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Erro HTTP: ${response.status}`)
    }

    return data
  } catch (error) {
    console.error("Erro na API:", error)
    throw error
  }
}

// Funções de notificação
function showSuccess(message) {
  showNotification(message, "success")
}

function showError(message) {
  showNotification(message, "error")
}

function showNotification(message, type = "info") {
  const container = document.getElementById("notifications") || createNotificationContainer()

  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  notification.textContent = message

  container.appendChild(notification)

  // Auto remove após 5 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 5000)
}

function createNotificationContainer() {
  const container = document.createElement("div")
  container.id = "notifications"
  container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
    `
  document.body.appendChild(container)
  return container
}

// Expor funções globalmente
window.apiCall = apiCall
window.showSuccess = showSuccess
window.showError = showError
