import { WidgetRegistry } from './widget-interface.js';
import agentsWidget from './agents-widget.js';
import agentDetailWidget from './agent-detail-widget.js';
import tasksWidget from './tasks-widget.js';
import taskDetailWidget from './task-detail-widget.js';
import taskFlowWidget from './task-flow-widget.js';
import ringWidget from './ring-widget.js';
import chatWidget from './chat-widget.js';
import meshWidget from './mesh-widget.js';
import agentChatWidget from './agent-chat-widget.js';
import erc8004Widget from './erc8004-widget.js';
import runningAgentsWidget from './running-agents-widget.js';
import availableAgentsWidget from './available-agents-widget.js';

const registry = new WidgetRegistry();

// Register core widgets
[
  agentsWidget,
  agentDetailWidget,
  tasksWidget,
  taskDetailWidget,
  taskFlowWidget,
  ringWidget,
  chatWidget,
  meshWidget,
  agentChatWidget,
  erc8004Widget,
  runningAgentsWidget,
  availableAgentsWidget
].forEach(w => registry.register(w));

export default registry;
