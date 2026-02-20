import { Key, Lock, User } from 'lucide-react'
import { useEditorStore, type AuthType } from '../../store'

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'apiKey', label: 'API Key' },
  { value: 'basic', label: 'Basic Auth' },
]

export function AuthConfig() {
  const authConfig = useEditorStore((state) => state.tryIt.authConfig)
  const setTryItAuth = useEditorStore((state) => state.setTryItAuth)

  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
        Authentication
      </h3>

      {/* Auth Type Selector */}
      <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg mb-3">
        {AUTH_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => setTryItAuth({ type: type.value })}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
              authConfig.type === type.value
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Auth Config Fields */}
      {authConfig.type === 'bearer' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="password"
              value={authConfig.bearerToken}
              onChange={(e) => setTryItAuth({ bearerToken: e.target.value })}
              placeholder="Enter bearer token..."
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 font-mono placeholder-zinc-600 outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <p className="text-xs text-zinc-500 ml-6">
            Token will be sent as: Authorization: Bearer &lt;token&gt;
          </p>
        </div>
      )}

      {authConfig.type === 'apiKey' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              value={authConfig.apiKeyName}
              onChange={(e) => setTryItAuth({ apiKeyName: e.target.value })}
              placeholder="Header/param name (e.g., X-API-Key)"
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 font-mono placeholder-zinc-600 outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="password"
              value={authConfig.apiKeyValue}
              onChange={(e) => setTryItAuth({ apiKeyValue: e.target.value })}
              placeholder="API key value..."
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 font-mono placeholder-zinc-600 outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 ml-6">
            <span className="text-xs text-zinc-500">Send in:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTryItAuth({ apiKeyLocation: 'header' })}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  authConfig.apiKeyLocation === 'header'
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Header
              </button>
              <button
                type="button"
                onClick={() => setTryItAuth({ apiKeyLocation: 'query' })}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  authConfig.apiKeyLocation === 'query'
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Query
              </button>
            </div>
          </div>
        </div>
      )}

      {authConfig.type === 'basic' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              value={authConfig.username}
              onChange={(e) => setTryItAuth({ username: e.target.value })}
              placeholder="Username"
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="password"
              value={authConfig.password}
              onChange={(e) => setTryItAuth({ password: e.target.value })}
              placeholder="Password"
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <p className="text-xs text-zinc-500 ml-6">
            Credentials will be Base64 encoded and sent as: Authorization: Basic
            &lt;encoded&gt;
          </p>
        </div>
      )}

      {authConfig.type === 'none' && (
        <p className="text-xs text-zinc-500">
          No authentication will be added to the request.
        </p>
      )}
    </div>
  )
}
