const BASE_URL = "http://localhost:8000";

async function handleResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API error ${response.status}`);
  }
  return response.json();
}

export async function getDashboard() {
  const response = await fetch(`${BASE_URL}/api/dashboard`);
  return handleResponse(response);
}

export async function getTools() {
  const response = await fetch(`${BASE_URL}/api/tools`);
  return handleResponse(response);
}

export async function getGraph() {
  const response = await fetch(`${BASE_URL}/api/graph`);
  return handleResponse(response);
}

export async function getAlerts(severity) {
  const query = severity ? `?severity=${encodeURIComponent(severity)}` : "";
  const response = await fetch(`${BASE_URL}/api/alerts${query}`);
  return handleResponse(response);
}

export async function simulateBreach(triggerToolId) {
  const response = await fetch(`${BASE_URL}/api/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger_tool_id: triggerToolId }),
  });
  return handleResponse(response);
}
