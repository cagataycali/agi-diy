// Minimal MCP types — only runtime values used by Client, protocol, and transport.
// All zod schemas are no-ops (validation stubbed).
export var LATEST_PROTOCOL_VERSION = "2025-11-25";
export var SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"];
export var JSONRPC_VERSION = "2.0";
export var RELATED_TASK_META_KEY = "io.modelcontextprotocol/related-task";

export var ErrorCode;
(function(E) {
  E[E["ConnectionClosed"] = -1] = "ConnectionClosed";
  E[E["RequestTimeout"] = -2] = "RequestTimeout";
  E[E["ParseError"] = -32700] = "ParseError";
  E[E["InvalidRequest"] = -32600] = "InvalidRequest";
  E[E["MethodNotFound"] = -32601] = "MethodNotFound";
  E[E["InvalidParams"] = -32602] = "InvalidParams";
  E[E["InternalError"] = -32603] = "InternalError";
})(ErrorCode || (ErrorCode = {}));

export class McpError extends Error {
  constructor(code, message, data) { super(message); this.code = code; this.data = data; }
}

// JSON-RPC type guards
export var isJSONRPCRequest = (v) => v?.jsonrpc === "2.0" && "method" in v && "id" in v;
export var isJSONRPCNotification = (v) => v?.jsonrpc === "2.0" && "method" in v && !("id" in v);
export var isJSONRPCResultResponse = (v) => v?.jsonrpc === "2.0" && "result" in v && "id" in v;
export var isJSONRPCErrorResponse = (v) => v?.jsonrpc === "2.0" && "error" in v && "id" in v;
export var isTaskAugmentedRequestParams = () => false;
export var isInitializedNotification = (v) => v?.method === 'notifications/initialized';

// All schemas are no-ops (zod stubbed)
const s = undefined;
export var AssertObjectSchema=s, ProgressTokenSchema=s, CursorSchema=s, RequestMetaSchema=s;
export var BaseRequestParamsSchema=s, TaskAugmentedRequestParamsSchema=s, RequestSchema=s;
export var NotificationsParamsSchema=s, NotificationSchema=s, ResultSchema=s, RequestIdSchema=s;
export var JSONRPCRequestSchema=s, JSONRPCNotificationSchema=s, JSONRPCResultResponseSchema=s;
export var JSONRPCErrorResponseSchema=s, JSONRPCMessageSchema=s, JSONRPCResponseSchema=s;
export var InitializeRequestSchema=s, InitializeResultSchema=s, InitializedNotificationSchema=s;
export var PingRequestSchema=s, ProgressNotificationSchema=s, CancelledNotificationSchema=s;
export var ListResourcesRequestSchema=s, ListResourcesResultSchema=s, ReadResourceRequestSchema=s;
export var ReadResourceResultSchema=s, ResourceListChangedNotificationSchema=s;
export var ListResourceTemplatesRequestSchema=s, ListResourceTemplatesResultSchema=s;
export var ListPromptsRequestSchema=s, ListPromptsResultSchema=s, GetPromptRequestSchema=s;
export var GetPromptResultSchema=s, PromptListChangedNotificationSchema=s;
export var ListToolsRequestSchema=s, ListToolsResultSchema=s, CallToolRequestSchema=s;
export var CallToolResultSchema=s, ToolListChangedNotificationSchema=s;
export var CompleteRequestSchema=s, CompleteResultSchema=s, EmptyResultSchema=s;
export var CreateMessageRequestSchema=s, CreateMessageResultSchema=s, CreateMessageResultWithToolsSchema=s;
export var ElicitRequestSchema=s, ElicitResultSchema=s;
export var CustomRequestSchema=s, CustomResultSchema=s, CustomNotificationSchema=s;
export var ListChangedOptionsBaseSchema=s;
export var TaskCreationParamsSchema=s, TaskMetadataSchema=s, RelatedTaskMetadataSchema=s;
export var CreateTaskResultSchema=s, GetTaskRequestSchema=s, GetTaskResultSchema=s;
export var GetTaskPayloadRequestSchema=s, ListTasksRequestSchema=s, ListTasksResultSchema=s;
export var CancelTaskRequestSchema=s, CancelTaskResultSchema=s, TaskStatusNotificationSchema=s;
