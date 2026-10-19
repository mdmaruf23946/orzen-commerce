// Plug-and-play agent registry. Each agent owns a few drawers (context slices).
// Adding an agent = registerAgent({...}) in its own module; nothing else changes.
// Agents only declare WHAT context/tools they need; the persona layer
// (customer-style.ts) wraps every reply so the customer hears one voice.

export type AgentChannel = "web" | "messenger" | "whatsapp" | (string & {});

export type AgentInput = {
  storeId: string; // always store-scoped — agents never read other stores
  channel: AgentChannel;
  text: string;
};

export type DrawerDefinition = {
  id: string;
  /** Cheap, deterministic relevance check (no AI). */
  matches: (text: string) => boolean;
  /** Tool names this drawer exposes to the main agent. */
  tools?: string[];
  /** Short prompt section added only when this drawer is opened. */
  instruction?: string;
};

export type AgentDefinition = {
  id: string;
  priority: number; // higher wins on overlap
  matches: (input: AgentInput) => boolean;
  drawers: DrawerDefinition[];
};

const registry = new Map<string, AgentDefinition>();

export function registerAgent(def: AgentDefinition): void {
  if (!def.id) throw new Error("agent id required");
  registry.set(def.id, def);
}

export function listAgents(): AgentDefinition[] {
  return [...registry.values()].sort((a, b) => b.priority - a.priority);
}

export type RouteResult = { agent: AgentDefinition; drawers: DrawerDefinition[] } | null;

/** Pick the best agent and only the drawers relevant to this message. */
export function routeMessage(input: AgentInput): RouteResult {
  for (const agent of listAgents()) {
    if (!agent.matches(input)) continue;
    const drawers = agent.drawers.filter((d) => d.matches(input.text));
    return { agent, drawers };
  }
  return null;
}

/** Test helper. */
export function _resetAgents(): void {
  registry.clear();
}
