from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from mock_data import DASHBOARD_STATS, TOOLS, CONNECTIONS, ALERTS
from security_engine import BreachSimulator, RiskScorer

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scorer = RiskScorer()
simulator = BreachSimulator()

# In-memory alert state (in production, this would be a database)
alert_states = {alert["alert_id"]: {"is_resolved": alert.get("is_resolved", False)} for alert in ALERTS}

RISK_COLORS = {
    "Critical": "#ff3366",
    "High": "#ffaa00",
    "Medium": "#00d4ff",
    "Low": "#00ff88",
}


def get_dashboard_stats():
    """Calculate dashboard stats based on current alert states."""
    stats = DASHBOARD_STATS.copy()
    
    # Count resolved and unresolved by severity
    resolved_count = 0
    unresolved_by_severity = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    
    for alert in ALERTS:
        is_resolved = alert_states.get(alert["alert_id"], {}).get("is_resolved", alert.get("is_resolved", False))
        severity = alert.get("severity", "Low")
        
        if is_resolved:
            resolved_count += 1
        else:
            if severity in unresolved_by_severity:
                unresolved_by_severity[severity] += 1
    
    stats["resolved"] = resolved_count
    stats["unresolved_by_severity"] = unresolved_by_severity
    stats["active_alerts"] = sum(unresolved_by_severity.values())
    
    return stats


class SimulateRequest(BaseModel):
    trigger_tool_id: str


@app.get("/api/dashboard")
def get_dashboard():
    return get_dashboard_stats()


@app.get("/api/tools")
def get_tools():
    tools_with_scores = []
    for tool in TOOLS:
        risk_score, risk_label = scorer.score(tool)
        updated_tool = tool.copy()
        updated_tool["risk_score"] = risk_score
        updated_tool["risk_label"] = risk_label
        tools_with_scores.append(updated_tool)
    return tools_with_scores


@app.get("/api/graph")
def get_graph():
    nodes = []
    for tool in TOOLS:
        risk_score, risk_label = scorer.score(tool)
        nodes.append(
            {
                "id": tool["tool_id"],
                "name": tool["name"],
                "risk_score": risk_score,
                "risk_label": risk_label,
                "category": tool["category"],
                "val": max(risk_score / 10, 1),
                "color": RISK_COLORS.get(risk_label, "#cccccc"),
            }
        )
    links = [
        {"source": edge["source"], "target": edge["target"], "sensitivity": edge["sensitivity"]}
        for edge in CONNECTIONS
    ]
    return {"nodes": nodes, "links": links}


@app.get("/api/alerts")
def get_alerts(severity: str | None = Query(None, description="Optional severity filter")):
    if not severity:
        # Return alerts with current resolved state
        return [
            {**alert, "is_resolved": alert_states.get(alert["alert_id"], {}).get("is_resolved", alert.get("is_resolved", False))}
            for alert in ALERTS
        ]
    return [
        {**alert, "is_resolved": alert_states.get(alert["alert_id"], {}).get("is_resolved", alert.get("is_resolved", False))}
        for alert in ALERTS if alert.get("severity") == severity
    ]


@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    """Resolve an alert and update dashboard stats."""
    # Find the alert
    alert = None
    for a in ALERTS:
        if a["alert_id"] == alert_id:
            alert = a
            break
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Update the alert state
    alert_states[alert_id] = {"is_resolved": True}
    
    # Return updated dashboard stats
    return get_dashboard_stats()


@app.post("/api/simulate")
def simulate_breach(request: SimulateRequest):
    trigger_tool_id = request.trigger_tool_id
    if not any(tool["tool_id"] == trigger_tool_id for tool in TOOLS):
        raise HTTPException(status_code=404, detail="Trigger tool not found")
    result = simulator.simulate(TOOLS, CONNECTIONS, trigger_tool_id)
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
