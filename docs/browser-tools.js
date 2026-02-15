// Browser-specific Strands tools for multi-agent systems
// Shared across dashboard.html, agi.html, sauhsoj-ii.html, index.html

export function createBrowserTools(deps = {}) {
  const { tool, z, state, notify, saveTasks } = deps;
  
  if (!tool || !z) {
    throw new Error('createBrowserTools requires { tool, z, state, notify, saveTasks } dependencies');
  }

  // ═══ STORAGE TOOLS ═══
  const storageGetTool = tool({
    name: 'storage_get',
    description: 'Read a value from localStorage by key.',
    inputSchema: z.object({ key: z.string().describe('localStorage key') }),
    callback: (input) => JSON.stringify({ key: input.key, value: localStorage.getItem(input.key) })
  });

  const storageSetTool = tool({
    name: 'storage_set',
    description: 'Write a value to localStorage by key.',
    inputSchema: z.object({ 
      key: z.string().describe('localStorage key'), 
      value: z.string().describe('Value to store') 
    }),
    callback: (input) => { 
      localStorage.setItem(input.key, input.value); 
      return JSON.stringify({ key: input.key, stored: true }); 
    }
  });

  // ═══ TASK TOOLS (for dashboard orchestration) ═══
  const createTaskTool = tool({
    name: 'create_task',
    description: 'Create a new task in the task queue. Use parentId to create sub-tasks.',
    inputSchema: z.object({
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description'),
      assignee: z.string().optional().describe('Agent ID to assign to'),
      parentId: z.string().optional().describe('Parent task ID for sub-tasks')
    }),
    callback: (input) => {
      if (!state?.tasks) return JSON.stringify({ error: 'Task state not available' });
      const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const task = { 
        id, 
        title: input.title, 
        description: input.description || '', 
        status: 'pending', 
        agentId: input.assignee || null,
        parentId: input.parentId || null,
        worklog: [],
        createdAt: Date.now() 
      };
      state.tasks.set(id, task);
      if (notify) notify('tasks');
      if (saveTasks) saveTasks();
      return JSON.stringify({ id, title: task.title, status: task.status });
    }
  });

  const updateTaskTool = tool({
    name: 'update_task',
    description: 'Update task status or add a worklog entry.',
    inputSchema: z.object({
      taskId: z.string().describe('Task ID'),
      status: z.enum(['pending', 'in-progress', 'waiting', 'complete', 'failed']).optional(),
      worklog: z.string().optional().describe('Worklog message to append'),
      agentId: z.string().optional().describe('Reassign to agent'),
      result: z.string().optional().describe('Task result or output')
    }),
    callback: (input) => {
      if (!state?.tasks) return JSON.stringify({ error: 'Task state not available' });
      const task = state.tasks.get(input.taskId);
      if (!task) return JSON.stringify({ error: 'Task not found' });
      if (input.status) task.status = input.status;
      if (input.agentId) task.agentId = input.agentId;
      if (input.result) task.result = input.result;
      if (input.worklog) {
        task.worklog = task.worklog || [];
        task.worklog.push({ ts: Date.now(), agentId: input.agentId || task.agentId || 'system', msg: input.worklog });
      }
      task.updatedAt = Date.now();
      if (notify) notify('tasks');
      if (saveTasks) saveTasks();
      return JSON.stringify({ id: task.id, status: task.status, agentId: task.agentId });
    }
  });

  const listTasksTool = tool({
    name: 'list_tasks',
    description: 'List all tasks with optional status or agent filter.',
    inputSchema: z.object({
      status: z.string().optional(),
      agentId: z.string().optional()
    }),
    callback: (input) => {
      if (!state?.tasks) return JSON.stringify({ tasks: [] });
      let tasks = [...state.tasks.values()];
      if (input.status) tasks = tasks.filter(t => t.status === input.status);
      if (input.agentId) tasks = tasks.filter(t => t.agentId === input.agentId);
      return JSON.stringify(tasks.map(t => ({ 
        id: t.id, 
        title: t.title, 
        status: t.status, 
        agentId: t.agentId, 
        parentId: t.parentId 
      })));
    }
  });

  const claimTaskTool = tool({
    name: 'claim_task',
    description: 'Claim a pending task and mark it in-progress.',
    inputSchema: z.object({
      taskId: z.string().describe('Task ID'),
      agentId: z.string().describe('Agent ID claiming the task')
    }),
    callback: (input) => {
      if (!state?.tasks) return JSON.stringify({ error: 'Task state not available' });
      const task = state.tasks.get(input.taskId);
      if (!task) return JSON.stringify({ error: 'Task not found' });
      if (task.status !== 'pending') return JSON.stringify({ error: 'Task not pending' });
      task.status = 'in-progress';
      task.agentId = input.agentId;
      task.claimedAt = Date.now();
      task.worklog = task.worklog || [];
      task.worklog.push({ ts: Date.now(), agentId: input.agentId, msg: `Claimed by ${input.agentId}` });
      if (notify) notify('tasks');
      if (saveTasks) saveTasks();
      return JSON.stringify({ task });
    }
  });

  // ═══ AGENT ORCHESTRATION TOOLS ═══
  const listAgentsTool = tool({
    name: 'list_agents',
    description: 'List all available agents and their status.',
    inputSchema: z.object({}),
    callback: () => {
      if (!state?.agents) return JSON.stringify({ agents: [] });
      const agents = [...state.agents.values()].map(a => ({
        id: a.id,
        model: a.model,
        role: a.role,
        status: a.status,
        currentTask: a.currentTask
      }));
      return JSON.stringify({ agents });
    }
  });

  const delegateTaskTool = tool({
    name: 'delegate_task',
    description: 'Delegate a task to an agent. The agent will start working on it automatically.',
    inputSchema: z.object({
      taskId: z.string().describe('Task ID to delegate'),
      agentId: z.string().describe('Agent ID to delegate to'),
      instructions: z.string().describe('Detailed instructions for the agent')
    }),
    callback: (input) => {
      if (!state?.tasks || !state?.agents) {
        return JSON.stringify({ error: 'State not available' });
      }
      const task = state.tasks.get(input.taskId);
      const agent = state.agents.get(input.agentId);
      if (!task) return JSON.stringify({ error: 'Task not found' });
      if (!agent) return JSON.stringify({ error: 'Agent not found' });
      
      task.status = 'in-progress';
      task.agentId = input.agentId;
      task.worklog = task.worklog || [];
      task.worklog.push({ ts: Date.now(), agentId: input.agentId, msg: `Delegated: ${input.instructions.slice(0, 100)}` });
      agent.status = 'processing';
      
      if (notify) notify('tasks');
      if (saveTasks) saveTasks();
      
      return JSON.stringify({ 
        taskId: input.taskId,
        agentId: input.agentId,
        status: 'delegated'
      });
    }
  });

  return {
    storage: { storageGetTool, storageSetTool },
    tasks: { createTaskTool, updateTaskTool, listTasksTool, claimTaskTool },
    orchestration: { listAgentsTool, delegateTaskTool }
  };
}
