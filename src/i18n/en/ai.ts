// English for AI 解读 (the AI reading under a chart or a day).
export const AI: Record<string, string> = {
  'AI 解读': 'AI reading',
  'AI 服务': 'AI service',
  'API key': 'API key',
  '兼容 OpenAI 的接口': 'OpenAI-compatible API',
  模型: 'Model',
  接口地址: 'API address',
  停止: 'Stop',
  发送: 'Send',
  取消: 'Cancel',
  生成解读: 'Write a reading',
  重新解读: 'Write it again',
  复制提示词: 'Copy prompt',
  已复制: 'Copied',
  '打开 Claude': 'Open Claude',
  '正在思考…': 'Thinking…',
  接着问: 'Ask a follow-up',
  '接着问，比如「今年适合换工作吗？」': 'Ask a follow-up, e.g. "Is this a good year to change jobs?"',
  '交给 AI 写一份解读，之后可以接着问。': 'Have an AI write a reading of it, then ask follow-up questions.',
  '填上自己的 API key（Claude，或兼容 OpenAI 的接口）就能在这里生成解读；用的是订阅的话，复制提示词，粘贴到 Claude 等的网页里。':
    'Add your own API key (Claude, or an OpenAI-compatible API) to get a reading here. With a subscription instead, copy the prompt and paste it into Claude or a similar chat site.',
  '复制完整的提示词，粘贴到 Claude、ChatGPT 等网页里用订阅提问':
    'Copy the whole prompt to paste into Claude, ChatGPT or similar, using your subscription',
  '在 Anthropic 控制台创建 API key，按用量付费；Claude 的订阅（Pro、Max）不能在这里用。':
    'Create an API key in the Anthropic Console; it is billed by use. A Claude subscription (Pro, Max) cannot be used here.',
  '填到 /v1 为止，会请求它的 /chat/completions。服务要允许从浏览器直接访问（CORS），本机的模型（如 Ollama）可能要先打开这个选项。':
    'Enter it up to /v1; its /chat/completions is called. The service must allow requests straight from a browser (CORS); a model on this computer (such as Ollama) may need that switched on first.',
  '生成解读会把这里的命盘或黄历（命盘含出生日期、时间和地点）发给你选的 AI 服务；API key 只存在这个浏览器里，不经过别的服务器。AI 的解读仅供参考。':
    'A reading sends the chart or almanac shown here (a chart includes the birth date, time and place) to the AI service you chose. Your API key stays in this browser and goes through no other server. AI readings are for reference only.',
  '回答太长，到上限截断了。': 'The answer was too long and was cut off at the limit.',
  '没能复制到剪贴板。': 'Could not copy to the clipboard.',
  'API key 不对或没有权限，请在设置里检查。': 'The API key is wrong or lacks permission; check it in the settings.',
  '请求太频繁或额度用完了，稍后再试。': 'Too many requests, or the quota is used up; try again later.',
  '连不上 AI 服务（网络问题，或者这个服务不允许从浏览器直接访问）。':
    'Could not reach the AI service (a network problem, or the service does not allow requests straight from a browser).',
  'AI 拒绝回答这个请求。': 'The AI declined this request.',
  '请求出错（模型名或地址可能不对）。': 'The request failed (the model name or address may be wrong).',
  'AI 服务出错，稍后再试。': 'The AI service had an error; try again later.',
}
