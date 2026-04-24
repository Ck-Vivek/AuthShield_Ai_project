from collections import deque

class RiskScorer:
    def score(self, tool):
        score = 0
        scopes = tool.get("oauth_scopes", [])
        for scope in scopes:
            normalized = scope.lower()
            if normalized in {"admin", "full_access"}:
                score += 25
            elif normalized in {"write", "delete"}:
                score += 15
            elif normalized in {"read", "send"}:
                score += 5

        connected_systems = tool.get("connected_systems", [])
        for system in connected_systems:
            if system in {"AWS", "GitHub", "MongoDB", "Google Workspace"}:
                score += 10
            else:
                score += 5

        score = min(score, 100)
        label = self._risk_label(score)
        return score, label

    def _risk_label(self, score):
        if score >= 80:
            return "Critical"
        if score >= 60:
            return "High"
        if score >= 40:
            return "Medium"
        return "Low"


class BreachSimulator:
    def simulate(self, tools, connections, trigger_tool_id):
        tool_ids = {tool["tool_id"] for tool in tools}
        adjacency = self._build_adjacency(connections)
        visited = set()
        queue = deque([(trigger_tool_id, 0)])
        visited.add(trigger_tool_id)
        propagation_path = []
        affected_systems = set()
        distances = {trigger_tool_id: 0}

        while queue:
            node, distance = queue.popleft()
            if node in tool_ids:
                propagation_path.append(node)
                tool = next((t for t in tools if t["tool_id"] == node), None)
                if tool:
                    affected_systems.update(tool.get("connected_systems", []))

            for neighbor in adjacency.get(node, []):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                distances[neighbor] = distance + 1
                queue.append((neighbor, distance + 1))

        affected_tools = [tool_id for tool_id in propagation_path if tool_id in tool_ids]
        time_to_compromise = max(distances.values(), default=0) * 20
        recommended_actions = self._build_recommendations(affected_systems)

        return {
            "propagation_path": propagation_path,
            "blast_radius": len(affected_tools),
            "affected_systems": sorted(affected_systems),
            "time_to_compromise_minutes": time_to_compromise,
            "recommended_actions": recommended_actions,
        }

    def _build_adjacency(self, connections):
        adjacency = {}
        for edge in connections:
            source = edge["source"]
            target = edge["target"]
            adjacency.setdefault(source, []).append(target)
            adjacency.setdefault(target, []).append(source)
        return adjacency

    def _build_recommendations(self, affected_systems):
        actions = []
        if "AWS" in affected_systems:
            actions.append("Immediately rotate AWS keys")
        if "GitHub" in affected_systems:
            actions.append("Revoke GitHub tokens")
        if "Google Workspace" in affected_systems:
            actions.append("Reset Google OAuth for all employees")
        actions.append("Enable MFA on all connected systems")
        actions.append("Run full permission audit")
        return actions
